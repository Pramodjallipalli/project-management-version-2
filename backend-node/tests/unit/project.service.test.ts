import fs from 'fs';
import path from 'path';
import { ProjectStatus, ProjectMethodology } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { StorageService } from '../../src/services/storage.service';
import { ObjectStorageService } from '../../src/services/object-storage.service';
import { ProjectFile } from '../../src/models/project-file.model';
import { ProjectService } from '../../src/services/project.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    projectDocument: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    rolePermission: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    permission: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    organization: {
      findFirst: jest.fn(),
    },
    workItem: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/storage.service', () => ({
  StorageService: {
    saveProjectFile: jest.fn().mockResolvedValue({
      storageKey: 'supabase://bug-attachments/projects/p-1/spec.pdf',
      filename: 'spec.pdf',
    }),
    deleteFile: jest.fn().mockResolvedValue(true),
    getStorageRoot: jest.fn().mockReturnValue(path.resolve('./test-storage')),
    getMimeType: jest.fn().mockReturnValue('application/pdf'),
    isSupabaseKey: jest.fn().mockImplementation((key: string) => typeof key === 'string' && key.startsWith('supabase://')),
    downloadSupabaseFile: jest.fn(),
  },
}));

jest.mock('../../src/services/object-storage.service', () => ({
  ObjectStorageService: {
    uploadBuffer: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/models/project-file.model', () => ({
  ProjectFile: {
    create: jest.fn(),
  },
}));

describe('ProjectService Unit Tests', () => {
  const mockOrgUser = {
    id: 'user-mgr-1',
    organization_id: 'org-1',
    role: 'MANAGER',
  };

  const mockInternUser = {
    id: 'user-intern-1',
    organization_id: 'org-1',
    role: 'INTERN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_MONGODB_PROJECT_FILES;
    delete process.env.STORAGE_DRIVER;
    delete process.env.REVERSE_SYNC_TO_POSTGRES;
  });

  describe('listProjects', () => {
    it('should throw if user has no organization_id', async () => {
      await expect(ProjectService.listProjects({ id: 'u-no-org' })).rejects.toThrow(
        'User does not belong to any organization'
      );
    });

    it('should throw if invalid project status filter is supplied', async () => {
      await expect(
        ProjectService.listProjects(mockOrgUser, { status: 'INVALID_STATUS' as any })
      ).rejects.toThrow('Invalid project status: INVALID_STATUS');
    });

    it('should list projects with status and my filters', async () => {
      (prisma.project.findMany as jest.Mock).mockResolvedValue([
        { id: 'p-1', name: 'Project One', organization_id: 'org-1' },
      ]);

      const projects = await ProjectService.listProjects(mockOrgUser, {
        status: ProjectStatus.ACTIVE,
        my: true,
      });

      expect(projects.length).toBe(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: 'org-1',
            status: ProjectStatus.ACTIVE,
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('getProjectById', () => {
    it('should throw if projectId is missing or undefined', async () => {
      await expect(ProjectService.getProjectById('', mockOrgUser)).rejects.toThrow('Project not found');
      await expect(ProjectService.getProjectById('undefined', mockOrgUser)).rejects.toThrow('Project not found');
    });

    it('should throw if project not found in database', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(ProjectService.getProjectById('p-missing', mockOrgUser)).rejects.toThrow('Project not found');
    });

    it('should forbid non-manager non-member non-owner user', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        owner_id: 'other-owner',
        members: [{ user_id: 'someone-else' }],
      });

      await expect(ProjectService.getProjectById('p-1', mockInternUser)).rejects.toThrow(
        'Forbidden: you are not a member of this project'
      );
    });

    it('should return project when user is project member', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        owner_id: 'other-owner',
        members: [{ user_id: mockInternUser.id }],
      });

      const res = await ProjectService.getProjectById('p-1', mockInternUser);
      expect(res.id).toBe('p-1');
    });
  });

  describe('createProject', () => {
    it('should validate required fields: name and methodology', async () => {
      await expect(
        ProjectService.createProject({ name: '', methodology: 'SCRUM' }, mockOrgUser)
      ).rejects.toThrow('Project name is required');

      await expect(
        ProjectService.createProject({ name: 'Project A', methodology: '' }, mockOrgUser)
      ).rejects.toThrow('Project methodology is required (SCRUM or KANBAN)');

      await expect(
        ProjectService.createProject({ name: 'Project A', methodology: 'WATERFALL' }, mockOrgUser)
      ).rejects.toThrow('Invalid project methodology: WATERFALL. Must be SCRUM or KANBAN.');
    });

    it('should validate owner belongs to organization', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        ProjectService.createProject(
          { name: 'Project A', methodology: 'SCRUM', owner_id: 'bad-owner' },
          mockOrgUser
        )
      ).rejects.toThrow('Project owner does not exist in your organization');
    });

    it('should validate start_date and end_date', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'valid-owner' });

      await expect(
        ProjectService.createProject(
          { name: 'Proj', methodology: 'SCRUM', start_date: 'invalid-date' },
          mockOrgUser
        )
      ).rejects.toThrow('Invalid start_date format');

      await expect(
        ProjectService.createProject(
          { name: 'Proj', methodology: 'SCRUM', end_date: 'invalid-date' },
          mockOrgUser
        )
      ).rejects.toThrow('Invalid end_date format');

      await expect(
        ProjectService.createProject(
          {
            name: 'Proj',
            methodology: 'SCRUM',
            start_date: '2026-05-01',
            end_date: '2026-04-01',
          },
          mockOrgUser
        )
      ).rejects.toThrow('end_date cannot be earlier than start_date');
    });

    it('should validate status normalization and member validation', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'm-1' }]); // returned 1, requested 2
      await expect(
        ProjectService.createProject(
          {
            name: 'Proj',
            methodology: 'KANBAN',
            member_ids: ['m-1', 'm-2'],
          },
          mockOrgUser
        )
      ).rejects.toThrow('One or more selected members do not exist in your organization');
    });

    it('should create project successfully with members', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'm-1' }]);
      (prisma.project.create as jest.Mock).mockResolvedValue({
        id: 'p-new',
        name: 'New Project',
        methodology: ProjectMethodology.SCRUM,
        status: ProjectStatus.ACTIVE,
      });

      const res = await ProjectService.createProject(
        {
          name: 'New Project',
          methodology: 'SCRUM',
          status: 'IN_PROGRESS' as any,
          member_ids: ['m-1'],
        },
        mockOrgUser
      );

      expect(res.id).toBe('p-new');
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ProjectStatus.ACTIVE,
            methodology: ProjectMethodology.SCRUM,
          }),
        })
      );
    });
  });

  describe('updateProject', () => {
    it('should throw if project not found', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        ProjectService.updateProject('p-missing', { name: 'Updated' }, mockOrgUser)
      ).rejects.toThrow('Project not found');
    });

    it('should forbid changing methodology after creation', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        methodology: ProjectMethodology.SCRUM,
        organization_id: 'org-1',
      });

      await expect(
        ProjectService.updateProject('p-1', { methodology: 'KANBAN' }, mockOrgUser)
      ).rejects.toThrow('Project methodology is immutable and cannot be changed after creation');
    });

    it('should reject empty name', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        methodology: ProjectMethodology.SCRUM,
        organization_id: 'org-1',
      });

      await expect(ProjectService.updateProject('p-1', { name: '  ' }, mockOrgUser)).rejects.toThrow(
        'Project name cannot be empty'
      );
    });

    it('should validate date ordering during update', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        methodology: ProjectMethodology.SCRUM,
        start_date: new Date('2026-06-01'),
        end_date: new Date('2026-08-01'),
        organization_id: 'org-1',
      });

      await expect(
        ProjectService.updateProject('p-1', { end_date: '2026-05-01' }, mockOrgUser)
      ).rejects.toThrow('end_date cannot be earlier than start_date');
    });

    it('should update project successfully', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        methodology: ProjectMethodology.SCRUM,
        organization_id: 'org-1',
      });
      (prisma.project.update as jest.Mock).mockResolvedValue({
        id: 'p-1',
        name: 'Renamed Project',
        status: ProjectStatus.COMPLETED,
      });

      const updated = await ProjectService.updateProject(
        'p-1',
        { name: 'Renamed Project', status: 'COMPLETED' as any },
        mockOrgUser
      );

      expect(updated.name).toBe('Renamed Project');
    });

    it('should support updating multiple project owners and sync memberships', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        owner_id: 'user-mgr-1',
        organization_id: 'org-1',
        methodology: ProjectMethodology.SCRUM,
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-mgr-1', name: 'Manager 1', roles: [{ role: { name: 'MANAGER' } }] },
        { id: 'user-mgr-2', name: 'Manager 2', roles: [{ role: { name: 'TECH_LEAD' } }] },
      ]);
      (prisma.project.update as jest.Mock).mockResolvedValue({
        id: 'p-1',
        name: 'Project 1',
        owner_id: 'user-mgr-1',
        owner: { id: 'user-mgr-1', name: 'Manager 1', email: 'm1@example.com' },
        members: [
          { project_role: 'MANAGER', user: { id: 'user-mgr-2', name: 'Manager 2', email: 'm2@example.com' } },
        ],
      });
      (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([]);

      const updated = await ProjectService.updateProject(
        'p-1',
        { owner_ids: ['user-mgr-1', 'user-mgr-2'] },
        mockOrgUser
      );

      expect(updated.owners).toHaveLength(2);
      expect(updated.owner_ids).toEqual(['user-mgr-1', 'user-mgr-2']);
      expect(prisma.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: 'p-1',
            project_role: 'MANAGER',
          }),
        })
      );
    });

    it('should reject assigning pure interns as project owners', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'p-1',
        owner_id: 'user-mgr-1',
        organization_id: 'org-1',
        methodology: ProjectMethodology.SCRUM,
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-intern-1', name: 'Intern Dave', roles: [{ role: { name: 'INTERN' } }] },
      ]);

      await expect(
        ProjectService.updateProject('p-1', { owner_ids: ['user-intern-1'] }, mockOrgUser)
      ).rejects.toThrow('User "Intern Dave" is an intern and cannot be assigned as a project owner');
    });
  });

  describe('archiveProject', () => {
    it('should throw if project not found', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(ProjectService.archiveProject('p-missing', mockOrgUser)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should archive existing project', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.project.update as jest.Mock).mockResolvedValue({ id: 'p-1', status: ProjectStatus.ARCHIVED });

      const res = await ProjectService.archiveProject('p-1', mockOrgUser);
      expect(res.status).toBe(ProjectStatus.ARCHIVED);
    });
  });

  describe('getProjectMembers', () => {
    it('should return sorted project members with TECH_LEAD first', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([
        {
          project_role: 'DEVELOPER',
          role_id: 'r-dev',
          user: { id: 'u-dev', name: 'Bob Dev', email: 'bob@example.com' },
          role: { id: 'r-dev', name: 'DEVELOPER', permissions: [] },
        },
        {
          project_role: 'TECH_LEAD',
          role_id: 'r-lead',
          user: { id: 'u-lead', name: 'Alice Lead', email: 'alice@example.com' },
          role: { id: 'r-lead', name: 'TECH_LEAD', permissions: [] },
        },
      ]);

      const members = await ProjectService.getProjectMembers('p-1', mockOrgUser, 'Alice');
      expect(members[0].project_role).toBe('TECH_LEAD');
      expect(members[1].project_role).toBe('DEVELOPER');
    });
  });

  describe('getAvailablePermissions & ensureBuiltInProjectRoles', () => {
    it('should list all available permissions and group them', async () => {
      (prisma.permission.findMany as jest.Mock).mockResolvedValue([
        { id: 'p-1', name: 'PROJECT_READ', description: 'Read projects' },
        { id: 'p-2', name: 'TASK_CREATE', description: 'Create tasks' },
      ]);

      const res = await ProjectService.getAvailablePermissions(mockOrgUser, 'project');
      expect(res.totalCount).toBe(2);
      expect(res.categories).toContain('Projects');
      expect(res.categories).toContain('Tasks & Sprints');
    });

    it('should ensure built-in project roles exist in DB', async () => {
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'new-role' });
      (prisma.permission.findFirst as jest.Mock).mockResolvedValue({ id: 'perm-1' });

      await ProjectService.ensureBuiltInProjectRoles();
      expect(prisma.role.create).toHaveBeenCalled();
    });
  });

  describe('getProjectRoles & createCustomRole', () => {
    it('should return available project roles', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.role.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'r-1',
          name: 'DEVELOPER',
          is_custom: false,
          permissions: [{ permission: { name: 'PROJECT_READ' } }],
        },
      ]);

      const roles = await ProjectService.getProjectRoles('p-1', mockOrgUser);
      expect(roles.length).toBe(1);
      expect(roles[0].name).toBe('DEVELOPER');
      expect(roles[0].permissions).toContain('PROJECT_READ');
    });

    it('should validate authorization for custom role creation', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null); // not project owner
      await expect(
        ProjectService.createCustomRole('p-1', { name: 'Role', permissions: ['TASK_READ'] }, mockInternUser)
      ).rejects.toThrow('Unauthorized: Only managers, administrators, or project owners can create custom roles');
    });

    it('should validate custom role name and scope restrictions', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });

      await expect(
        ProjectService.createCustomRole('p-1', { name: 'R', permissions: ['TASK_READ'] }, mockOrgUser)
      ).rejects.toThrow('Role name must be at least 2 characters long');

      await expect(
        ProjectService.createCustomRole('p-1', { name: 'Valid Role', permissions: [] }, mockOrgUser)
      ).rejects.toThrow('At least one permission must be selected for the custom role');

      // Invalid out-of-scope permission
      await expect(
        ProjectService.createCustomRole('p-1', { name: 'Valid Role', permissions: ['ORGANIZATION_DELETE'] }, mockOrgUser)
      ).rejects.toThrow('Invalid project-scoped permissions: ORGANIZATION_DELETE');
    });

    it('should reject duplicate custom role name in scope', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-role' });

      await expect(
        ProjectService.createCustomRole('p-1', { name: 'Developer', permissions: ['TASK_READ'] }, mockOrgUser)
      ).rejects.toThrow('A role with the name "Developer" already exists in this scope.');
    });

    it('should create custom role in transaction', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue([
        { id: 'perm-read', name: 'TASK_READ' },
      ]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          role: { create: jest.fn().mockResolvedValue({ id: 'custom-role-1', name: 'Scrum Assistant', created_at: new Date() }) },
          rolePermission: { createMany: jest.fn() },
        };
        return await callback(tx);
      });

      const res = await ProjectService.createCustomRole(
        'p-1',
        { name: 'Scrum Assistant', permissions: ['TASK_READ'] },
        mockOrgUser
      );

      expect(res.name).toBe('Scrum Assistant');
      expect(res.permissions).toContain('TASK_READ');
    });
  });

  describe('updateProjectMemberRoles & updateMemberPermissions', () => {
    it('should reject invalid role assignments or cross-project role assignments', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role-p2',
        name: 'Project 2 Role',
        project_id: 'p-2', // scoped to project 2
      });

      await expect(
        ProjectService.updateProjectMemberRoles(
          'p-1',
          [{ user_id: 'u-1', role_id: 'role-p2' }],
          mockOrgUser
        )
      ).rejects.toThrow('Cross-project role assignment rejected');
    });

    it('should update member roles successfully with standard roles', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({
        project_id: 'p-1',
        user_id: 'u-1',
      });
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([]);

      const members = await ProjectService.updateProjectMemberRoles(
        'p-1',
        [{ user_id: 'u-1', project_role: 'LEAD' }],
        mockOrgUser
      );

      expect(prisma.projectMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_role: 'TECH_LEAD',
          }),
        })
      );
    });

    it('should clear custom permissions when permissions array is empty or NONE', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue({
        project_id: 'p-1',
        user_id: 'u-1',
        role: { id: 'r-custom', is_custom: true, name: 'Member_u-1_p-1' },
      });
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([]);

      await ProjectService.updateMemberPermissions('p-1', 'u-1', ['NONE'], mockOrgUser);
      expect(prisma.projectMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role_id: null },
        })
      );
    });
  });

  describe('addProjectMember and removeProjectMember', () => {
    it('should add project member or update existing role', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u-2', organization_id: 'org-1' });
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.projectMember.create as jest.Mock).mockResolvedValue({
        project_id: 'p-1',
        user_id: 'u-2',
        project_role: 'DEVELOPER',
        role_id: null,
        user: { id: 'u-2', name: 'User 2', email: 'u2@example.com' },
      });

      const res = await ProjectService.addProjectMember('p-1', 'u-2', mockOrgUser, 'DEVELOPER');
      expect(res.user_id).toBe('u-2');
      expect(res.role).toBe('DEVELOPER');
    });

    it('should remove project member', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      const res = await ProjectService.removeProjectMember('p-1', 'u-2', mockOrgUser);
      expect(res.message).toBe('Member removed successfully');
      expect(prisma.projectMember.deleteMany).toHaveBeenCalledWith({
        where: { project_id: 'p-1', user_id: 'u-2' },
      });
    });
  });

  describe('Project Documents and File Handling', () => {
    it('should list project documents', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectDocument.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', name: 'Spec.pdf', project_id: 'p-1' },
      ]);

      const docs = await ProjectService.getProjectDocuments('p-1', mockOrgUser);
      expect(docs.length).toBe(1);
    });

    it('should upload file and save document metadata', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        name: 'Architecture.pdf',
        document_type: 'pdf',
        storage_key: 'projects/p-1/Architecture.pdf',
      });

      const doc = await ProjectService.uploadProjectDocumentWithFile(
        'p-1',
        {
          originalname: 'Architecture.pdf',
          buffer: Buffer.from('dummy content'),
        },
        mockOrgUser
      );

      expect(doc.name).toBe('Architecture.pdf');
    });

    it('uses ObjectStorageService for MongoDB project files when STORAGE_DRIVER=s3', async () => {
      process.env.ENABLE_MONGODB_PROJECT_FILES = 'true';
      process.env.STORAGE_DRIVER = 's3';

      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (ObjectStorageService.uploadBuffer as jest.Mock).mockResolvedValue({
        storageKey: 'projects/p-1/spec.pdf',
        sanitizedFilename: 'uuid-spec.pdf',
        mimeType: 'application/pdf',
        byteLength: 11,
        checksumSha256: 's3-checksum',
      });
      (ProjectFile.create as jest.Mock).mockResolvedValue({
        file_id: 'mongo-doc-1',
        project_id: 'p-1',
        name: 'uuid-spec.pdf',
        document_type: 'pdf',
        storage_key: 'projects/p-1/spec.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 11,
        checksum_sha256: 's3-checksum',
      });

      const result = await ProjectService.uploadProjectDocumentWithFile(
        'p-1',
        { originalname: 'spec.pdf', buffer: Buffer.alloc(11, 1), mimetype: 'application/pdf' },
        mockOrgUser
      );

      expect(ObjectStorageService.uploadBuffer).toHaveBeenCalledWith(
        'p-1',
        'spec.pdf',
        expect.any(Buffer),
        'application/pdf'
      );
      expect(StorageService.saveProjectFile).not.toHaveBeenCalled();
      expect(ProjectFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storage_provider: 's3',
          storage_key: 'projects/p-1/spec.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 11,
          checksum_sha256: 's3-checksum',
        })
      );
      expect(result.storage_key).toBe('projects/p-1/spec.pdf');

      delete process.env.ENABLE_MONGODB_PROJECT_FILES;
      delete process.env.STORAGE_DRIVER;
    });

    it('uses Supabase Storage for MongoDB project files otherwise', async () => {
      process.env.ENABLE_MONGODB_PROJECT_FILES = 'true';
      process.env.STORAGE_DRIVER = 'supabase';
      process.env.REVERSE_SYNC_TO_POSTGRES = 'true';

      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (StorageService.saveProjectFile as jest.Mock).mockResolvedValue({
        storageKey: 'supabase://bug-attachments/projects/p-1/spec.pdf',
        filename: 'uuid-spec.pdf',
      });
      (ProjectFile.create as jest.Mock).mockResolvedValue({
        file_id: 'mongo-doc-2',
        project_id: 'p-1',
        name: 'uuid-spec.pdf',
        document_type: 'pdf',
        storage_key: 'supabase://bug-attachments/projects/p-1/spec.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 11,
        checksum_sha256: expect.any(String),
      });

      const result = await ProjectService.uploadProjectDocumentWithFile(
        'p-1',
        { originalname: 'spec.pdf', buffer: Buffer.alloc(11, 1), mimetype: 'application/pdf' },
        mockOrgUser
      );

      expect(StorageService.saveProjectFile).toHaveBeenCalledWith(
        'p-1',
        'spec.pdf',
        expect.any(Buffer),
        'application/pdf'
      );
      expect(ObjectStorageService.uploadBuffer).not.toHaveBeenCalled();
      expect(ProjectFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storage_provider: 'supabase',
          storage_key: 'supabase://bug-attachments/projects/p-1/spec.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 11,
          checksum_sha256: expect.any(String),
        })
      );
      expect(prisma.projectDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storage_key: 'supabase://bug-attachments/projects/p-1/spec.pdf',
        }),
      });
      expect(result.storage_key).toBe('supabase://bug-attachments/projects/p-1/spec.pdf');

      delete process.env.ENABLE_MONGODB_PROJECT_FILES;
      delete process.env.STORAGE_DRIVER;
    });

    it('deletes an S3 object when MongoDB metadata creation fails', async () => {
      process.env.ENABLE_MONGODB_PROJECT_FILES = 'true';
      process.env.STORAGE_DRIVER = 's3';

      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (ObjectStorageService.uploadBuffer as jest.Mock).mockResolvedValue({
        storageKey: 'projects/p-1/spec.pdf',
        sanitizedFilename: 'uuid-spec.pdf',
        mimeType: 'application/pdf',
        byteLength: 11,
        checksumSha256: 's3-checksum',
      });
      (ProjectFile.create as jest.Mock).mockRejectedValue(new Error('Mongo insert failed'));

      await expect(
        ProjectService.uploadProjectDocumentWithFile(
          'p-1',
          { originalname: 'spec.pdf', buffer: Buffer.alloc(11, 1), mimetype: 'application/pdf' },
          mockOrgUser
        )
      ).rejects.toThrow('Mongo insert failed');

      expect(ObjectStorageService.deleteObject).toHaveBeenCalledWith('projects/p-1/spec.pdf');
    });

    it('deletes a Supabase object when MongoDB metadata creation fails', async () => {
      process.env.ENABLE_MONGODB_PROJECT_FILES = 'true';
      process.env.STORAGE_DRIVER = 'supabase';

      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (StorageService.saveProjectFile as jest.Mock).mockResolvedValue({
        storageKey: 'supabase://bug-attachments/projects/p-1/spec.pdf',
        filename: 'uuid-spec.pdf',
      });
      (ProjectFile.create as jest.Mock).mockRejectedValue(new Error('Mongo insert failed'));

      await expect(
        ProjectService.uploadProjectDocumentWithFile(
          'p-1',
          { originalname: 'spec.pdf', buffer: Buffer.alloc(11, 1), mimetype: 'application/pdf' },
          mockOrgUser
        )
      ).rejects.toThrow('Mongo insert failed');

      expect(StorageService.deleteFile).toHaveBeenCalledWith(
        'supabase://bug-attachments/projects/p-1/spec.pdf'
      );
    });

    it('should retrieve physical document file for download', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectDocument.findFirst as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        name: 'Document.pdf',
        storage_key: 'doc.pdf',
        project_id: 'p-1',
      });

      const res = await ProjectService.getProjectDocumentFile('p-1', 'doc-1', mockOrgUser);
      expect(res.document.id).toBe('doc-1');
      expect(res.mimeType).toBe('application/pdf');
    });

    it('should update and delete document', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', organization_id: 'org-1' });
      (prisma.projectDocument.findFirst as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        name: 'Old.pdf',
        storage_key: 'old.pdf',
      });
      (prisma.projectDocument.update as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        name: 'New.pdf',
      });

      const updated = await ProjectService.updateProjectDocument(
        'p-1',
        'doc-1',
        { name: 'New.pdf' },
        mockOrgUser
      );
      expect(updated.name).toBe('New.pdf');

      const deleted = await ProjectService.deleteProjectDocument('p-1', 'doc-1', mockOrgUser);
      expect(deleted.success).toBe(true);
      expect(StorageService.deleteFile).toHaveBeenCalledWith('old.pdf');
    });
  });

  describe('getTechLeadsOverview', () => {
    it('should return overview metrics for tech leads', async () => {
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([
        {
          project_role: 'TECH_LEAD',
          user: {
            id: 'lead-1',
            name: 'Sarah Lead',
            email: 'sarah@example.com',
            batch: 'A',
            is_active: true,
            roles: [{ role: { name: 'TECH_LEAD' } }],
          },
          project: {
            id: 'proj-1',
            name: 'Alpha Project',
            status: 'ACTIVE',
            start_date: new Date(),
            end_date: new Date(),
          },
        },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.workItem.findMany as jest.Mock)
        .mockResolvedValueOnce([
          // projectWorkItems
          {
            id: 'task-1',
            project_id: 'proj-1',
            status: 'COMPLETED',
            priority: 'HIGH',
            story_points: 5,
            type: 'TASK',
            assignees: [{ user_id: 'lead-1' }],
          },
          {
            id: 'task-2',
            project_id: 'proj-1',
            status: 'IN_PROGRESS',
            priority: 'MEDIUM',
            story_points: 3,
            type: 'TASK',
            assignees: [],
          },
        ])
        .mockResolvedValueOnce([
          // leadAssignedItems
          {
            id: 'task-1',
            project_id: 'proj-1',
            status: 'COMPLETED',
            story_points: 5,
            assignees: [{ user_id: 'lead-1' }],
          },
        ]);

      const overview = await ProjectService.getTechLeadsOverview(mockOrgUser);
      expect(overview.length).toBe(1);
      expect(overview[0].name).toBe('Sarah Lead');
      expect(overview[0].project_count).toBe(1);
      expect(overview[0].total_project_tasks).toBe(2);
      expect(overview[0].completed_project_tasks).toBe(1);
      expect(overview[0].project_completion_rate).toBe(50);
      expect(overview[0].direct_assigned_tasks).toBe(1);
      expect(overview[0].direct_completion_rate).toBe(100);
      // Performance score: 50 * 0.6 + 100 * 0.4 = 70
      expect(overview[0].performance_score).toBe(70);
      expect(overview[0].performance_label).toBe('Strong');
      // Project Health & Risk Assessment
      expect(overview[0].health_score).toBeGreaterThanOrEqual(0);
      expect(overview[0].health_status).toBeDefined();
      expect(overview[0].risk_level).toBeDefined();
      expect(overview[0].projects[0].health_score).toBeDefined();
      expect(overview[0].projects[0].risk_level).toBeDefined();
      expect(overview[0].projects[0].schedule_health).toBeDefined();
      expect(overview[0].projects[0].recommended_actions).toBeDefined();
    });

    it('should handle tech lead with 0 project tasks as Insufficient Data', async () => {
      (prisma.projectMember.findMany as jest.Mock).mockResolvedValue([
        {
          project_role: 'TECH_LEAD',
          user: {
            id: 'lead-2',
            name: 'Empty Lead',
            email: 'empty@example.com',
            is_active: true,
            roles: [],
          },
          project: {
            id: 'proj-empty',
            name: 'Empty Project',
            status: 'PLANNED',
          },
        },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.workItem.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // 0 project items
        .mockResolvedValueOnce([]); // 0 lead assigned items

      const overview = await ProjectService.getTechLeadsOverview(mockOrgUser);
      expect(overview[0].total_project_tasks).toBe(0);
      expect(overview[0].performance_score).toBe(0);
      expect(overview[0].performance_label).toBe('No Tasks');
      expect(overview[0].health_score).toBeNull();
      expect(overview[0].health_status).toBe('INSUFFICIENT_DATA');
      expect(overview[0].risk_level).toBe('Insufficient Data');
      expect(overview[0].projects[0].health_score).toBeNull();
      expect(overview[0].projects[0].risk_level).toBe('Insufficient Data');
    });
  });
});
