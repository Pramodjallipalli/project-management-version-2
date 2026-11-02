import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';

interface CachedUserSession {
  user: any;
  cachedAt: number;
}

// In-memory cache for warm serverless instances (30s TTL per user session)
const userSessionCache = new Map<string, CachedUserSession>();
const USER_CACHE_TTL_MS = 30_000;

// In-flight lookup deduplication to prevent database connection spikes/stampedes under concurrent requests
const inFlightUserLookups = new Map<string, Promise<{ user: any; dbDuration: number }>>();

let cachedDefaultOrgId: string | null = null;
let cachedDefaultOrgExpiry = 0;

export function invalidateUserSessionCache(userId?: string): void {
  if (userId) {
    userSessionCache.delete(userId);
    inFlightUserLookups.delete(userId);
  } else {
    userSessionCache.clear();
    inFlightUserLookups.clear();
  }
}

export function setUserSessionInCache(userId: string, user: any): void {
  userSessionCache.set(userId, { user, cachedAt: Date.now() });
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authStart = performance.now();
  let dbDuration = 0;

  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
      token = req.query.token.trim();
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    let payload: any;
    try {
      payload = jwt.verify(token, ACCESS_SECRET) as any;
    } catch (jwtError) {
      (req as any)._authDuration = performance.now() - authStart;
      res.status(401).json({ error: 'Invalid access token' });
      return;
    }

    const now = Date.now();
    const cached = userSessionCache.get(payload.userId);
    let user: any;

    if (cached && (now - cached.cachedAt < USER_CACHE_TTL_MS)) {
      user = cached.user;
    } else {
      let lookupPromise = inFlightUserLookups.get(payload.userId);
      if (!lookupPromise) {
        lookupPromise = (async () => {
          const dbStart = performance.now();
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
              id: true,
              name: true,
              email: true,
              user_code: true,
              batch: true,
              is_active: true,
              must_change_password: true,
              organization_id: true,
              created_at: true,
              organization: {
                select: { id: true, name: true, is_active: true }
              },
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      permissions: {
                        select: {
                          permission: {
                            select: { name: true }
                          }
                        }
                      }
                    }
                  }
                }
              },
              user_permissions: {
                select: {
                  permission: {
                    select: { id: true, name: true }
                  }
                }
              },
              project_memberships: {
                where: { project_role: 'TECH_LEAD' },
                select: { project_id: true }
              }
            }
          });
          let duration = performance.now() - dbStart;

          if (dbUser && dbUser.is_active) {
            // Handle fallback organization if unassigned
            if (!dbUser.organization_id) {
              const currentNow = Date.now();
              if (cachedDefaultOrgId && currentNow < cachedDefaultOrgExpiry) {
                dbUser.organization_id = cachedDefaultOrgId;
              } else {
                const orgStart = performance.now();
                const firstOrg = await prisma.organization.findFirst({
                  where: { is_active: true },
                  select: { id: true }
                });
                duration += (performance.now() - orgStart);
                if (firstOrg) {
                  cachedDefaultOrgId = firstOrg.id;
                  cachedDefaultOrgExpiry = currentNow + 5 * 60 * 1000;
                  dbUser.organization_id = firstOrg.id;
                }
              }
            }

            userSessionCache.set(payload.userId, { user: dbUser, cachedAt: Date.now() });
          }

          return { user: dbUser, dbDuration: duration };
        })().finally(() => {
          inFlightUserLookups.delete(payload.userId);
        });

        inFlightUserLookups.set(payload.userId, lookupPromise);
      }

      const lookupResult = await lookupPromise;
      user = lookupResult.user;
      dbDuration = lookupResult.dbDuration;
    }

    if (!user || !user.is_active) {
      userSessionCache.delete(payload.userId);
      res.status(401).json({ error: 'User is inactive or not found' });
      return;
    }

    // Tenant Suspension Guard: If user belongs to an organization, verify it is active
    if (user.organization_id && user.organization && !user.organization.is_active) {
      res.status(403).json({ 
        error: 'Forbidden: Organization account is suspended',
        code: 'ORGANIZATION_SUSPENDED'
      });
      return;
    }

    // Force Password Change Guard:
    // If user is flagged with must_change_password, block all protected operational APIs
    // Allowed paths: /api/auth/change-password, /api/auth/me, /api/auth/logout
    const isExemptPath = 
      req.originalUrl.includes('/auth/change-password') || 
      req.originalUrl.includes('/auth/me') || 
      req.originalUrl.includes('/auth/logout');

    if (user.must_change_password && !isExemptPath) {
      res.status(403).json({
        error: 'Forbidden: Password change required before accessing platform features',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
      return;
    }

    (req as any).user = payload;
    (req as any).fullUser = user;
    if (payload?.role && !(user as any).role) {
      (user as any).role = payload.role;
    }
    if (Array.isArray(user.roles) && user.roles.length > 0 && !(user as any).role) {
      (user as any).role = user.roles[0]?.role?.name || (user.roles[0] as any)?.name;
    }

    (req as any)._authDuration = performance.now() - authStart;
    (req as any)._authDbDuration = dbDuration;

    next();
  } catch (error: any) {
    (req as any)._authDuration = performance.now() - authStart;
    (req as any)._authDbDuration = dbDuration;

    // Distinguish database connection/query failures from token errors
    const isDbError =
      error?.code === 'P2024' ||
      error?.name === 'PrismaClientInitializationError' ||
      error?.name === 'PrismaClientKnownRequestError' ||
      error?.name === 'PrismaClientRustPanicError' ||
      error?.name === 'PrismaClientUnknownRequestError' ||
      error?.message?.includes('FATAL') ||
      error?.message?.includes('connection') ||
      error?.message?.includes('timeout');

    if (isDbError) {
      res.status(503).json({
        error: 'Service temporarily unavailable: database connection issue',
        code: 'DB_CONNECTION_ERROR'
      });
      return;
    }

    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userRole = (req as any).user?.role;
    const fullUser = (req as any).fullUser;

    const roles: string[] = [];
    if (userRole) roles.push(userRole);
    if (Array.isArray(fullUser?.roles)) {
      for (const ur of fullUser.roles) {
        const name = ur.role?.name || ur.name;
        if (name && !roles.includes(name)) roles.push(name);
      }
    }

    const hasRole = roles.some((r) => allowedRoles.includes(r)) || roles.includes('SUPER_ADMIN');
    if (!hasRole) {
      res.status(403).json({
        error: 'Forbidden: insufficient role',
        message: 'You do not have permission to perform this action',
        user: {},
        project: {},
        work_item: {},
      });
      return;
    }
    next();
  };
};

export const requireRoleOrPermission = (allowedRoles: string[], ...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userRole = (req as any).user?.role;
    const fullUser = (req as any).fullUser;

    if (!fullUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const roles: string[] = [];
    if (userRole) roles.push(userRole);
    if (Array.isArray(fullUser?.roles)) {
      for (const ur of fullUser.roles) {
        const name = ur.role?.name || ur.name;
        if (name && !roles.includes(name)) roles.push(name);
      }
    }

    if (roles.includes('SUPER_ADMIN') || roles.some((r) => allowedRoles.includes(r))) {
      return next();
    }

    if (requiredPermissions.length > 0) {
      const userPerms = new Set<string>();
      for (const ur of fullUser.roles || []) {
        for (const rp of ur.role?.permissions || []) {
          if (rp.permission?.name) userPerms.add(rp.permission.name);
        }
      }
      for (const up of fullUser.user_permissions || []) {
        if (up.permission?.name) userPerms.add(up.permission.name);
      }

      if (requiredPermissions.some((p) => userPerms.has(p))) {
        return next();
      }
    }

    res.status(403).json({
      error: 'Forbidden: insufficient role or permissions',
      message: 'You do not have permission to perform this action',
      user: {},
      project: {},
      work_item: {},
    });
  };
};

const PROJECT_PERMISSIONS = [
  'PROJECT_READ',
  'PROJECT_UPDATE',
  'PROJECT_ARCHIVE',
  'PROJECT_MEMBER_MANAGE',
  'PROJECT_ROLE_ASSIGN',
  'CUSTOM_ROLE_MANAGE',
  'TASK_READ',
  'TASK_CREATE',
  'TASK_UPDATE',
  'TASK_DELETE',
  'TASK_ASSIGN',
  'TASK_STATUS_TRANSITION',
  'SPRINT_READ',
  'SPRINT_MANAGE',
  'ROADMAP_MANAGE',
  'DOCUMENT_READ',
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DELETE',
  'ANALYTICS_READ',
];

export async function checkProjectMemberPermission(
  fullUser: any,
  req: Request,
  permissionToCheck: string
): Promise<boolean> {
  if (!fullUser || !fullUser.id) {
    return false;
  }

  let projectId: string | null =
    req.params.projectId ||
    req.params.id ||
    req.body?.project_id ||
    req.body?.projectId ||
    (req.query?.project_id as string) ||
    (req.query?.projectId as string) ||
    null;

  try {
    // If not directly found or param is not project, resolve from workItem, document, or sprint
    if (projectId) {
      const isProjectDirect = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!isProjectDirect) {
        // Maybe projectId is actually a work_item_id or document_id
        const workItem = await prisma.workItem.findUnique({
          where: { id: projectId },
          select: { project_id: true },
        });
        if (workItem?.project_id) {
          projectId = workItem.project_id;
        } else {
          const doc = await prisma.projectDocument.findUnique({
            where: { id: projectId },
            select: { project_id: true },
          });
          if (doc?.project_id) {
            projectId = doc.project_id;
          }
        }
      }
    } else {
      if (req.params.documentId) {
        const doc = await prisma.projectDocument.findUnique({
          where: { id: req.params.documentId },
          select: { project_id: true },
        });
        if (doc?.project_id) projectId = doc.project_id;
      } else if (req.params.sprintId) {
        const sprint = await prisma.sprint.findUnique({
          where: { id: req.params.sprintId },
          select: { project_id: true },
        });
        if (sprint?.project_id) projectId = sprint.project_id;
      }
    }

    if (!projectId || typeof projectId !== 'string') {
      return false;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        owner_id: true,
        organization_id: true,
        owners: { select: { user_id: true } },
      },
    });

    if (!project) {
      return false;
    }

    // Project owner always has full project permissions
    const isProjectOwner =
      project.owner_id === fullUser.id ||
      (Array.isArray((project as any).owners) && (project as any).owners.some((po: any) => po.user_id === fullUser.id));
    if (isProjectOwner) {
      return true;
    }

    // Organization Manager / Admin has full project permissions
    const isOrgManager =
      (req as any).user?.role === 'ADMIN' ||
      (req as any).user?.role === 'MANAGER' ||
      (req as any).user?.role === 'SUPER_ADMIN' ||
      fullUser.roles?.some(
        (ur: any) =>
          ur.role?.name === 'ADMIN' ||
          ur.role?.name === 'MANAGER' ||
          ur.role?.name === 'SUPER_ADMIN'
      );

    if (isOrgManager && (!project.organization_id || project.organization_id === fullUser.organization_id)) {
      return true;
    }

    // Direct organization-level user_permissions check
    if (Array.isArray(fullUser.user_permissions)) {
      const directPerms = new Set(fullUser.user_permissions.map((up: any) => up.permission?.name));
      if (directPerms.has(permissionToCheck)) {
        if (!project.organization_id || project.organization_id === fullUser.organization_id) {
          return true;
        }
      }
      if (permissionToCheck === 'TASK_STATUS_TRANSITION' && directPerms.has('TASK_UPDATE')) {
        if (!project.organization_id || project.organization_id === fullUser.organization_id) {
          return true;
        }
      }
    }

    // Query Project Membership with custom role and associated permissions
    const membership = await prisma.projectMember.findFirst({
      where: {
        project_id: projectId,
        user_id: fullUser.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return false;
    }

    // 1. If assigned a Custom Role (or standard role via role_id)
    if (membership.role) {
      const grantedPermissions = new Set(
        membership.role.permissions.map((rp) => rp.permission.name)
      );

      // Direct permission match
      if (grantedPermissions.has(permissionToCheck)) {
        return true;
      }

      // If user has TASK_UPDATE, allow TASK_STATUS_TRANSITION
      if (permissionToCheck === 'TASK_STATUS_TRANSITION' && grantedPermissions.has('TASK_UPDATE')) {
        return true;
      }

      // If user has PROJECT_UPDATE, allow non-destructive project management
      if (
        grantedPermissions.has('PROJECT_UPDATE') &&
        (permissionToCheck === 'SPRINT_MANAGE' ||
          permissionToCheck === 'ROADMAP_MANAGE' ||
          permissionToCheck === 'DOCUMENT_UPLOAD' ||
          permissionToCheck === 'DOCUMENT_DELETE')
      ) {
        return true;
      }

      // Read permissions baseline for any member
      if (
        (permissionToCheck === 'PROJECT_READ' || permissionToCheck === 'TASK_READ' || permissionToCheck === 'DOCUMENT_READ' || permissionToCheck === 'SPRINT_READ') &&
        (grantedPermissions.has('PROJECT_READ') || grantedPermissions.has('TASK_READ'))
      ) {
        return true;
      }

      return false;
    }

    // 2. Standard Built-in project roles fallback
    const isOrgTechLead =
      Array.isArray(fullUser.roles) &&
      fullUser.roles.some((ur: any) => ur.role?.name === 'TECH_LEAD');

    if (
      membership.project_role === 'TECH_LEAD' ||
      membership.project_role === 'MANAGER' ||
      isOrgTechLead
    ) {
      return true;
    }

    if (membership.project_role === 'DEVELOPER') {
      const devPerms = [
        'PROJECT_READ',
        'TASK_READ',
        'TASK_CREATE',
        'TASK_UPDATE',
        'TASK_STATUS_TRANSITION',
        'DOCUMENT_READ',
        'DOCUMENT_UPLOAD',
        'SPRINT_READ',
        'ANALYTICS_READ',
      ];
      return devPerms.includes(permissionToCheck);
    }

    if (membership.project_role === 'QA_TESTER') {
      const qaPerms = [
        'PROJECT_READ',
        'TASK_READ',
        'TASK_CREATE',
        'TASK_UPDATE',
        'TASK_STATUS_TRANSITION',
        'DOCUMENT_READ',
        'SPRINT_READ',
      ];
      return qaPerms.includes(permissionToCheck);
    }

    // Default read permissions for any project member
    if (
      permissionToCheck === 'PROJECT_READ' ||
      permissionToCheck === 'TASK_READ' ||
      permissionToCheck === 'DOCUMENT_READ' ||
      permissionToCheck === 'SPRINT_READ'
    ) {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}

// Preserve backward-compatible alias
async function checkProjectLeadPermission(
  fullUser: any,
  req: Request,
  permissionToCheck: string
): Promise<boolean> {
  return checkProjectMemberPermission(fullUser, req, permissionToCheck);
}

export const requirePermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fullUser = (req as any).fullUser;
    
    if (!fullUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRole = (req as any).user?.role;
    const isSuperAdmin = 
      userRole === 'SUPER_ADMIN' ||
      fullUser.roles?.some((ur: any) => ur.role?.name === 'SUPER_ADMIN' || ur.name === 'SUPER_ADMIN');

    if (isSuperAdmin) {
      return next();
    }

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      return next();
    }

    let hasPermission = false;
    for (const ur of fullUser.roles || []) {
      const rName = ur.role?.name || ur.name;
      if (rName === 'ADMIN' || rName === 'MANAGER' || rName === 'SUPER_ADMIN') {
        hasPermission = true;
        break;
      }
      for (const rp of ur.role?.permissions || []) {
        if (rp.permission?.name === requiredPermission) {
          hasPermission = true;
          break;
        }
      }
      if (hasPermission) break;
    }

    if (!hasPermission && Array.isArray(fullUser.user_permissions)) {
      for (const up of fullUser.user_permissions) {
        if (up.permission?.name === requiredPermission) {
          hasPermission = true;
          break;
        }
      }
    }

    if (!hasPermission) {
      hasPermission = await checkProjectLeadPermission(fullUser, req, requiredPermission);
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden: insufficient permissions',
        message: 'You do not have permission to perform this action',
        user: {},
        project: {},
        work_item: {},
      });
      return;
    }

    next();
  };
};

export const requireAnyPermission = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fullUser = (req as any).fullUser;
    
    if (!fullUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRole = (req as any).user?.role;
    const isSuperAdmin = 
      userRole === 'SUPER_ADMIN' ||
      fullUser.roles?.some((ur: any) => ur.role?.name === 'SUPER_ADMIN' || ur.name === 'SUPER_ADMIN');

    if (isSuperAdmin) {
      return next();
    }

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      return next();
    }

    let hasPermission = false;
    for (const ur of fullUser.roles || []) {
      const rName = ur.role?.name || ur.name;
      if (rName === 'ADMIN' || rName === 'MANAGER' || rName === 'SUPER_ADMIN') {
        hasPermission = true;
        break;
      }
      for (const rp of ur.role?.permissions || []) {
        if (requiredPermissions.includes(rp.permission?.name)) {
          hasPermission = true;
          break;
        }
      }
      if (hasPermission) break;
    }

    if (!hasPermission && Array.isArray(fullUser.user_permissions)) {
      for (const up of fullUser.user_permissions) {
        if (requiredPermissions.includes(up.permission?.name)) {
          hasPermission = true;
          break;
        }
      }
    }

    if (!hasPermission) {
      for (const perm of requiredPermissions) {
        if (await checkProjectLeadPermission(fullUser, req, perm)) {
          hasPermission = true;
          break;
        }
      }
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden: insufficient permissions',
        message: 'You do not have permission to perform this action',
        user: {},
        project: {},
        work_item: {},
      });
      return;
    }

    next();
  };
};
