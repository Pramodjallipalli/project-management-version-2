import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { prisma } from '../lib/prisma';
import { AuditService } from './audit.service';
import { invalidateOrganizationsCache } from '../controllers/auth.controller';

export interface CreateOrganizationInput {
  name: string;
  actorId?: string;
}

export interface CreateOrganizationWithManagerInput {
  organizationName: string;
  managerName: string;
  managerEmail: string;
  actorId?: string;
}

export interface AddManagerToOrganizationInput {
  organizationId: string;
  managerName: string;
  managerEmail: string;
  actorId?: string;
}

export interface ResetManagerPasswordInput {
  organizationId: string;
  managerId: string;
  actorId?: string;
}

export interface UpdateOrganizationInput {
  organizationId: string;
  name?: string;
  actorId?: string;
}

export interface ToggleOrganizationStatusInput {
  organizationId: string;
  isActive: boolean;
  reason?: string;
  actorId?: string;
}

export interface BulkImportManagerRow {
  rowNumber: number;
  name: string;
  email: string;
}

export interface ValidateBulkCsvResult {
  isValid: boolean;
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  validRows: BulkImportManagerRow[];
  invalidRows: Array<{
    rowNumber: number;
    name?: string;
    email?: string;
    errors: string[];
  }>;
  errors: string[];
}

export class OrganizationService {
  /**
   * Helper to generate a secure, human-friendly temporary password
   */
  private static generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const randomBytes = crypto.randomBytes(12);
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars[randomBytes[i] % chars.length];
    }
    return pwd;
  }

  /**
   * Helper to generate a unique user code for the manager within an organization
   */
  private static generateUserCode(prefix: string = 'MGR'): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  }

  /**
   * Create an Organization ONLY (without requiring an initial manager)
   */
  static async createOrganizationOnly(input: CreateOrganizationInput) {
    const { name, actorId } = input;

    if (!name?.trim()) {
      const err: any = new Error('Organization name is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmedName = name.trim();

    // Check duplicate organization name
    const existing = await prisma.organization.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      const err: any = new Error(`An organization with the name "${trimmedName}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const org = await prisma.organization.create({
      data: {
        name: trimmedName,
        is_active: true,
      },
    });

    invalidateOrganizationsCache();

    await AuditService.record({
      actorId,
      organizationId: org.id,
      action: 'ORGANIZATION_CREATED',
      targetType: 'ORGANIZATION',
      targetId: org.id,
      metadata: {
        organizationName: org.name,
      },
    });

    return { organization: org };
  }

  /**
   * Create an Organization and its initial Manager in an atomic transaction
   * (Maintained for backward-compatibility if invoked)
   */
  static async createOrganizationWithManager(input: CreateOrganizationWithManagerInput) {
    const { organizationName, managerName, managerEmail, actorId } = input;

    if (!organizationName?.trim()) {
      throw new Error('Organization name is required');
    }
    if (!managerName?.trim()) {
      throw new Error('Manager name is required');
    }
    if (!managerEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail.trim())) {
      throw new Error('A valid manager email is required');
    }

    const normalizedEmail = managerEmail.trim().toLowerCase();

    // Check duplicate organization name
    const existingOrg = await prisma.organization.findFirst({
      where: { name: { equals: organizationName.trim(), mode: 'insensitive' } },
    });
    if (existingOrg) {
      const err: any = new Error(`An organization with the name "${organizationName.trim()}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    // Check if email already exists globally across the platform
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      const err: any = new Error(`A user with email "${normalizedEmail}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    // Find the MANAGER role
    const managerRole = await prisma.role.findUnique({
      where: { name: 'MANAGER' },
    });
    if (!managerRole) {
      throw new Error('MANAGER role not found in system. Please run seeds.');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const userCode = this.generateUserCode('MGR');

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          is_active: true,
        },
      });

      const managerUser = await tx.user.create({
        data: {
          organization_id: org.id,
          name: managerName.trim(),
          email: normalizedEmail,
          user_code: userCode,
          must_change_password: true,
          password_hash: passwordHash,
          is_active: true,
        },
      });

      await tx.userRole.create({
        data: {
          user_id: managerUser.id,
          role_id: managerRole.id,
        },
      });

      return {
        organization: org,
        manager: {
          id: managerUser.id,
          user_code: managerUser.user_code,
          name: managerUser.name,
          email: managerUser.email,
          role: 'MANAGER',
          must_change_password: managerUser.must_change_password,
          temporary_password: temporaryPassword,
        },
      };
    });

    await AuditService.record({
      actorId,
      organizationId: result.organization.id,
      action: 'ORGANIZATION_CREATED',
      targetType: 'ORGANIZATION',
      targetId: result.organization.id,
      metadata: {
        organizationName: result.organization.name,
        managerEmail: result.manager.email,
        managerName: result.manager.name,
      },
    });

    return result;
  }

  /**
   * Provision an additional Manager to an existing Organization
   */
  static async addManagerToOrganization(input: AddManagerToOrganizationInput) {
    const { organizationId, managerName, managerEmail, actorId } = input;

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    if (!managerName?.trim()) {
      throw new Error('Manager name is required');
    }
    if (!managerEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail.trim())) {
      throw new Error('A valid manager email is required');
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    if (!org.is_active) {
      const err: any = new Error('Cannot add managers to a suspended organization');
      err.statusCode = 403;
      throw err;
    }

    const normalizedEmail = managerEmail.trim().toLowerCase();

    // Check if email already exists globally
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      const err: any = new Error(`A user with email "${normalizedEmail}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const managerRole = await prisma.role.findUnique({
      where: { name: 'MANAGER' },
    });
    if (!managerRole) {
      throw new Error('MANAGER role not found in system');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const userCode = this.generateUserCode('MGR');

    const managerUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organization_id: org.id,
          name: managerName.trim(),
          email: normalizedEmail,
          user_code: userCode,
          must_change_password: true,
          password_hash: passwordHash,
          is_active: true,
        },
      });

      await tx.userRole.create({
        data: {
          user_id: user.id,
          role_id: managerRole.id,
        },
      });

      return user;
    });

    await AuditService.record({
      actorId,
      organizationId: org.id,
      action: 'MANAGER_PROVISIONED',
      targetType: 'USER',
      targetId: managerUser.id,
      metadata: {
        organizationId: org.id,
        managerName: managerUser.name,
        managerEmail: managerUser.email,
      },
    });

    return {
      manager: {
        id: managerUser.id,
        user_code: managerUser.user_code,
        name: managerUser.name,
        email: managerUser.email,
        role: 'MANAGER',
        must_change_password: managerUser.must_change_password,
        temporary_password: temporaryPassword,
      },
    };
  }

  /**
   * Validate CSV content for bulk manager import
   */
  static async validateBulkManagerCsv(csvText: string, organizationId: string): Promise<ValidateBulkCsvResult> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    if (!org.is_active) {
      const err: any = new Error('Cannot import managers to a suspended organization');
      err.statusCode = 403;
      throw err;
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return {
        isValid: false,
        summary: { total: 0, valid: 0, invalid: 0 },
        validRows: [],
        invalidRows: [],
        errors: ['CSV file is empty or missing headers and data rows.'],
      };
    }

    if (lines.length > 101) {
      return {
        isValid: false,
        summary: { total: lines.length - 1, valid: 0, invalid: lines.length - 1 },
        validRows: [],
        invalidRows: [],
        errors: ['CSV exceeds maximum limit of 100 managers per bulk import batch.'],
      };
    }

    const headerLine = lines[0];
    const rawHeaders = headerLine
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

    // Security check: reject unauthorized fields
    const forbidden = ['organization_id', 'password', 'role', 'user_id', 'user_code', 'is_active'];
    const forbiddenFound = rawHeaders.filter((h) => forbidden.includes(h));
    if (forbiddenFound.length > 0) {
      return {
        isValid: false,
        summary: { total: 0, valid: 0, invalid: 0 },
        validRows: [],
        invalidRows: [],
        errors: [`Security Violation: CSV cannot specify "${forbiddenFound.join(', ')}". Only name and email are allowed.`],
      };
    }

    const nameIdx = rawHeaders.indexOf('name');
    const emailIdx = rawHeaders.indexOf('email');

    if (nameIdx === -1 || emailIdx === -1) {
      return {
        isValid: false,
        summary: { total: 0, valid: 0, invalid: 0 },
        validRows: [],
        invalidRows: [],
        errors: ['Missing required CSV headers. Expected headers: "name,email"'],
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailCounts = new Map<string, number>();
    const parsedRows: Array<{ rowNumber: number; name: string; email: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const name = parts[nameIdx] || '';
      const email = (parts[emailIdx] || '').toLowerCase();
      parsedRows.push({ rowNumber: i + 1, name, email });
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    }

    // Pre-fetch all existing emails in database
    const allEmails = parsedRows.map((r) => r.email).filter(Boolean);
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const validRows: BulkImportManagerRow[] = [];
    const invalidRows: Array<{ rowNumber: number; name?: string; email?: string; errors: string[] }> = [];

    for (const row of parsedRows) {
      const rowErrors: string[] = [];

      if (!row.name) {
        rowErrors.push('Name is required');
      } else if (row.name.length < 2) {
        rowErrors.push('Name must be at least 2 characters');
      }

      if (!row.email) {
        rowErrors.push('Email is required');
      } else if (!emailRegex.test(row.email)) {
        rowErrors.push('Invalid email format');
      } else if ((emailCounts.get(row.email) || 0) > 1) {
        rowErrors.push('Duplicate email found within CSV file');
      } else if (existingEmailSet.has(row.email)) {
        rowErrors.push(`Email "${row.email}" already registered in database`);
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          errors: rowErrors,
        });
      } else {
        validRows.push(row);
      }
    }

    return {
      isValid: invalidRows.length === 0 && validRows.length > 0,
      summary: {
        total: parsedRows.length,
        valid: validRows.length,
        invalid: invalidRows.length,
      },
      validRows,
      invalidRows,
      errors: invalidRows.length > 0 ? ['One or more rows have validation errors. Review preview before importing.'] : [],
    };
  }

  /**
   * Bulk import validated managers
   */
  static async importManagersBulk(input: {
    organizationId: string;
    rows: BulkImportManagerRow[];
    actorId?: string;
  }) {
    const { organizationId, rows, actorId } = input;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    if (!org.is_active) {
      const err: any = new Error('Cannot import managers to a suspended organization');
      err.statusCode = 403;
      throw err;
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      const err: any = new Error('No manager rows provided for bulk import');
      err.statusCode = 400;
      throw err;
    }

    const managerRole = await prisma.role.findUnique({
      where: { name: 'MANAGER' },
    });
    if (!managerRole) {
      throw new Error('MANAGER role not found in system');
    }

    const createdManagers: Array<{
      id: string;
      user_code: string | null;
      name: string;
      email: string;
      temporary_password: string;
    }> = [];

    const skippedDuplicates: string[] = [];

    for (const r of rows) {
      const normalizedEmail = r.email.trim().toLowerCase();

      // Check duplicate immediately before insert
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        skippedDuplicates.push(normalizedEmail);
        continue;
      }

      const tempPassword = this.generateTemporaryPassword();
      const passwordHash = await argon2.hash(tempPassword);
      const userCode = this.generateUserCode('MGR');

      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            organization_id: org.id,
            name: r.name.trim(),
            email: normalizedEmail,
            user_code: userCode,
            must_change_password: true,
            password_hash: passwordHash,
            is_active: true,
          },
        });

        await tx.userRole.create({
          data: {
            user_id: u.id,
            role_id: managerRole.id,
          },
        });

        return u;
      });

      createdManagers.push({
        id: user.id,
        user_code: user.user_code,
        name: user.name,
        email: user.email,
        temporary_password: tempPassword,
      });
    }

    await AuditService.record({
      actorId,
      organizationId: org.id,
      action: 'MANAGERS_BULK_IMPORTED',
      targetType: 'ORGANIZATION',
      targetId: org.id,
      metadata: {
        totalRows: rows.length,
        createdCount: createdManagers.length,
        skippedCount: skippedDuplicates.length,
      },
    });

    return {
      summary: {
        total: rows.length,
        created: createdManagers.length,
        skipped: skippedDuplicates.length,
      },
      createdManagers,
      skippedDuplicates,
    };
  }

  /**
   * Superadmin resets a Manager's password securely & revokes active sessions
   */
  static async resetManagerPassword(input: ResetManagerPasswordInput) {
    const { organizationId, managerId, actorId } = input;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: managerId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!targetUser) {
      const err: any = new Error('Manager user not found');
      err.statusCode = 404;
      throw err;
    }

    // Safety: Verify target user belongs to this specific organization
    if (targetUser.organization_id !== organizationId) {
      const err: any = new Error('User does not belong to the specified organization');
      err.statusCode = 403;
      throw err;
    }

    // Safety: Prevent resetting Superadmin accounts through this manager-specific endpoint
    const isTargetSuperAdmin = targetUser.roles.some((r) => r.role?.name === 'SUPER_ADMIN');
    if (isTargetSuperAdmin) {
      const err: any = new Error('Cannot reset Superadmin accounts through manager administration endpoints');
      err.statusCode = 403;
      throw err;
    }

    // Verify user is actually a manager or admin in the organization
    const isManager = targetUser.roles.some(
      (r) => r.role?.name === 'MANAGER' || r.role?.name === 'ADMIN'
    );
    if (!isManager) {
      const err: any = new Error('Target user is not a manager');
      err.statusCode = 400;
      throw err;
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);

    await prisma.$transaction(async (tx) => {
      // 1. Update user password hash and force change
      await tx.user.update({
        where: { id: targetUser.id },
        data: {
          password_hash: passwordHash,
          must_change_password: true,
        },
      });

      // 2. Revoke and invalidate all existing active sessions
      await tx.userSession.updateMany({
        where: {
          user_id: targetUser.id,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
        },
      });
    });

    await AuditService.record({
      actorId,
      organizationId,
      action: 'MANAGER_PASSWORD_RESET',
      targetType: 'USER',
      targetId: targetUser.id,
      metadata: {
        managerEmail: targetUser.email,
        managerName: targetUser.name,
      },
    });

    return {
      managerId: targetUser.id,
      temporary_password: temporaryPassword,
      message: 'Manager password has been reset successfully. Existing sessions have been revoked.',
    };
  }

  /**
   * Update Organization details (e.g. name)
   */
  static async updateOrganization(input: UpdateOrganizationInput) {
    const { organizationId, name, actorId } = input;

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    if (!name?.trim()) {
      throw new Error('Organization name is required');
    }

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!existing) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { name: name.trim() },
    });

    invalidateOrganizationsCache();

    await AuditService.record({
      actorId,
      organizationId,
      action: 'ORGANIZATION_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: organizationId,
      metadata: {
        previousName: existing.name,
        newName: updated.name,
      },
    });

    return { organization: updated };
  }

  /**
   * Suspend or Reactivate an Organization
   * When suspended (isActive = false), all member sessions are revoked immediately.
   */
  static async toggleOrganizationStatus(input: ToggleOrganizationStatusInput) {
    const { organizationId, isActive, reason, actorId } = input;

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!existing) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrg = await tx.organization.update({
        where: { id: organizationId },
        data: { is_active: isActive },
      });

      // If suspended, revoke all active sessions for users in this organization
      if (!isActive) {
        const orgUsers = await tx.user.findMany({
          where: { organization_id: organizationId },
          select: { id: true },
        });
        const userIds = orgUsers.map((u) => u.id);

        if (userIds.length > 0) {
          await tx.userSession.updateMany({
            where: {
              user_id: { in: userIds },
              revoked_at: null,
            },
            data: {
              revoked_at: new Date(),
            },
          });
        }
      }

      return updatedOrg;
    });

    await AuditService.record({
      actorId,
      organizationId,
      action: isActive ? 'ORGANIZATION_REACTIVATED' : 'ORGANIZATION_SUSPENDED',
      targetType: 'ORGANIZATION',
      targetId: organizationId,
      metadata: {
        reason: reason || (isActive ? 'Reactivated by Superadmin' : 'Suspended by Superadmin'),
      },
    });

    invalidateOrganizationsCache();
    return { organization: result };
  }

  /**
   * List all platform organizations with search, status filtering, and pagination
  /**
   * Get Platform Overview KPIs, status distribution, and recent activity
   */
  static async getPlatformOverview() {
    const isUuid = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalManagers,
      totalUsers,
      totalProjects,
      recentLogsResult,
      totalBugReports,
      pendingComplaints,
      activeBugs,
      closedBugs,
      projectRoleCounts,
      globalRoles,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { is_active: true } }),
      prisma.organization.count({ where: { is_active: false } }),
      prisma.user.count({
        where: {
          organization_id: { not: null },
          roles: { some: { role: { name: 'MANAGER' } } },
        },
      }),
      // Tenant members only (exclude SUPER_ADMIN accounts with organization_id = null)
      prisma.user.count({
        where: {
          organization_id: { not: null },
        },
      }),
      prisma.project.count(),
      AuditService.listLogs({ page: 1, limit: 5 }),
      prisma.bugReport.count(),
      prisma.bugReport.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.bug.count({ where: { status: { notIn: ['CLOSED'] } } }),
      prisma.bug.count({ where: { status: 'CLOSED' } }),
      prisma.projectMemberRole.groupBy({
        by: ['role_name'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.role.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { users: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const activePercentage =
      totalOrganizations > 0 ? Math.round((activeOrganizations / totalOrganizations) * 100) : 0;
    const suspendedPercentage =
      totalOrganizations > 0 ? 100 - activePercentage : 0;

    return {
      kpis: {
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations,
        totalManagers,
        totalUsers,
        totalProjects,
      },
      statusDistribution: {
        total: totalOrganizations,
        active: activeOrganizations,
        suspended: suspendedOrganizations,
        activePercentage,
        suspendedPercentage,
      },
      bugPortalSummary: {
        totalComplaints: totalBugReports,
        pendingReview: pendingComplaints,
        activeBugs,
        closedBugs,
        verifiedRate: totalBugReports > 0 ? Math.round(((totalBugReports - pendingComplaints) / totalBugReports) * 100) : 0,
      },
      rolesSummary: {
        totalProjectRoles: projectRoleCounts.reduce((acc, curr) => acc + curr._count.id, 0),
        projectRoleDistribution: projectRoleCounts.map((prc) => ({
          role_name: prc.role_name,
          count: prc._count.id,
        })),
        globalRoles: globalRoles.map((gr) => ({
          id: gr.id,
          name: gr.name,
          userCount: gr._count.users,
        })),
      },
      recentActivity: recentLogsResult.logs || [],
    };
  }

  /**
   * List all platform organizations with search, status filtering, sorting, and pagination
   */
  static async listOrganizations(params?: {
    search?: string;
    status?: 'all' | 'active' | 'suspended';
    sortBy?: 'created_at' | 'name' | 'users' | 'projects';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params?.status === 'active') {
      where.is_active = true;
    } else if (params?.status === 'suspended') {
      where.is_active = false;
    }

    if (params?.search?.trim()) {
      const q = params.search.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

      const orConditions: any[] = [
        { name: { contains: q, mode: 'insensitive' } },
        {
          users: {
            some: {
              roles: { some: { role: { name: 'MANAGER' } } },
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];

      if (isUuid) {
        orConditions.push({ id: q });
      }

      where.OR = orConditions;
    }

    // Determine sorting
    const sortBy = params?.sortBy || 'created_at';
    const sortOrder = params?.sortOrder === 'asc' ? 'asc' : 'desc';

    let orderBy: any = { created_at: 'desc' };
    if (sortBy === 'name') {
      orderBy = { name: sortOrder };
    } else if (sortBy === 'created_at') {
      orderBy = { created_at: sortOrder };
    } else if (sortBy === 'users') {
      orderBy = { users: { _count: sortOrder } };
    } else if (sortBy === 'projects') {
      orderBy = { projects: { _count: sortOrder } };
    }

    const [total, orgs] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              projects: true,
              work_items: true,
              forms: true,
            },
          },
          users: {
            where: {
              roles: {
                some: {
                  role: { name: 'MANAGER' },
                },
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              user_code: true,
              is_active: true,
            },
            take: 20,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      organizations: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        is_active: org.is_active,
        created_at: org.created_at,
        updated_at: org.updated_at,
        stats: {
          user_count: org._count.users,
          project_count: org._count.projects,
          work_item_count: org._count.work_items,
          form_count: org._count.forms,
        },
        managers: org.users,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single organization details for Super Admin
   */
  static async getOrganizationById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
            work_items: true,
            forms: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            user_code: true,
            is_active: true,
            created_at: true,
            roles: {
              select: {
                role: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { created_at: 'asc' },
          take: 100,
        },
      },
    });

    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      id: org.id,
      name: org.name,
      is_active: org.is_active,
      created_at: org.created_at,
      updated_at: org.updated_at,
      stats: {
        user_count: org._count.users,
        project_count: org._count.projects,
        work_item_count: org._count.work_items,
        form_count: org._count.forms,
      },
      users: org.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        user_code: u.user_code,
        is_active: u.is_active,
        role: u.roles[0]?.role?.name || 'USER',
        created_at: u.created_at,
      })),
    };
  }

  /**
   * Get paginated members of an organization
   */
  static async getOrganizationMembers(params: {
    organizationId: string;
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const { organizationId, search, role } = params;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, is_active: true },
    });
    if (!org) {
      const err: any = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    const where: any = { organization_id: organizationId };

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { user_code: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (role?.trim() && role !== 'ALL') {
      where.roles = {
        some: {
          role: { name: role.trim() },
        },
      };
    }

    const [total, members] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          user_code: true,
          batch: true,
          subbatch: true,
          is_active: true,
          created_at: true,
          roles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { created_at: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      organization: org,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        user_code: m.user_code,
        batch: m.batch,
        subbatch: m.subbatch,
        is_active: m.is_active,
        role: m.roles[0]?.role?.name || 'USER',
        created_at: m.created_at,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
