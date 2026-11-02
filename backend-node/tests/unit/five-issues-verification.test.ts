import { BugService } from '../../src/services/bug.service';
import { ProjectService } from '../../src/services/project.service';
import { OrganizationService } from '../../src/services/organization.service';
import { mockPrisma } from '../mocks/prisma.mock';

jest.mock('../../src/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('Five Issues Comprehensive Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.project.findUnique.mockImplementation((args: any) => {
      const allMembers = [
        {
          project_id: args?.where?.id || 'proj-1',
          user_id: 'user-reporter',
          project_role: 'DEVELOPER',
          member_roles: [{ role_name: 'DEVELOPER' }],
        },
        {
          project_id: args?.where?.id || 'proj-1',
          user_id: 'multi-user',
          project_role: 'DEVELOPER',
          member_roles: [{ role_name: 'DEVELOPER' }, { role_name: 'QA_TESTER' }],
        },
      ];
      const targetUserId = args?.include?.members?.where?.user_id;
      const members = targetUserId
        ? allMembers.filter((m) => m.user_id === targetUserId)
        : allMembers;

      return Promise.resolve({
        id: args?.where?.id || 'proj-1',
        organization_id: 'org-1',
        owner_id: 'owner-1',
        owners: [],
        members,
      });
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      organization_id: 'org-1',
      owners: [],
    });
  });

  // ── ISSUE 1: IMAGE EVIDENCE VIEWING ─────────────────────────────────────────
  describe('Issue #1 — Bug Evidence Image Viewing & Authenticated Serving', () => {
    it('validates image signature for valid PNG, JPEG, GIF, and WebP evidence', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const gifBuffer = Buffer.from('GIF89a123456');
      const webpBuffer = Buffer.from('RIFF1234WEBPVP8 ...');

      expect(BugService.validateImageSignature(pngBuffer)).toEqual({
        ext: 'png',
        mime: 'image/png',
      });
      expect(BugService.validateImageSignature(jpgBuffer)).toEqual({
        ext: 'jpg',
        mime: 'image/jpeg',
      });
      expect(BugService.validateImageSignature(gifBuffer)).toEqual({
        ext: 'gif',
        mime: 'image/gif',
      });
      expect(BugService.validateImageSignature(webpBuffer)).toEqual({
        ext: 'webp',
        mime: 'image/webp',
      });
    });

    it('rejects forged files with non-image bytes', () => {
      const fakeExecutable = Buffer.from('This is a plain text file, not an image!');
      expect(() => BugService.validateImageSignature(fakeExecutable)).toThrow(
        /Unsupported image format/
      );
    });
  });

  // ── ISSUE 2: QA TESTER ASSIGNMENT ON COMPLAINTS ─────────────────────────────
  describe('Issue #2 — Responsible QA Tester Selection on Bug Reporting', () => {
    it('retrieves eligible QA testers belonging to the project with role QA_TESTER', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'user-reporter',
        project_role: 'DEVELOPER',
        member_roles: [{ role_name: 'DEVELOPER' }],
      });
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 'proj-1',
          user_id: 'qa-1',
          user: { id: 'qa-1', name: 'Alice QA', email: 'alice@qa.com' },
          project_role: 'QA_TESTER',
        },
        {
          project_id: 'proj-1',
          user_id: 'qa-2',
          user: { id: 'qa-2', name: 'Bob QA', email: 'bob@qa.com' },
          project_role: 'QA_TESTER',
        },
      ]);

      const testers = await BugService.getEligibleQaTesters('proj-1', {
        id: 'user-reporter',
        role: 'USER',
      });

      expect(testers).toHaveLength(2);
      expect(testers[0].name).toBe('Alice QA');
      expect(testers[1].email).toBe('bob@qa.com');
    });

    it('requires QA tester selection if eligible QA testers exist in the project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organization_id: 'org-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'user-reporter',
        project_role: 'DEVELOPER',
        member_roles: [{ role_name: 'DEVELOPER' }],
      });
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 'proj-1',
          user_id: 'qa-1',
          user: { id: 'qa-1', name: 'Alice QA', email: 'alice@qa.com' },
          project_role: 'QA_TESTER',
        },
      ]);

      await expect(
        BugService.createComplaint(
          'proj-1',
          {
            title: 'Crash on click',
            steps_to_reproduce: '1. Click submit',
            expected_result: 'Success',
            actual_result: 'Crash',
            assigned_qa_id: '', // missing
          },
          { id: 'user-reporter', role: 'USER' }
        )
      ).rejects.toThrow(/Please select an eligible QA tester/);
    });

    it('rejects an assignee who is not an eligible QA tester in the project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organization_id: 'org-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'user-reporter',
        project_role: 'DEVELOPER',
        member_roles: [{ role_name: 'DEVELOPER' }],
      });
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 'proj-1',
          user_id: 'qa-1',
          user: { id: 'qa-1', name: 'Alice QA', email: 'alice@qa.com' },
          project_role: 'QA_TESTER',
        },
      ]);

      await expect(
        BugService.createComplaint(
          'proj-1',
          {
            title: 'Crash on click',
            steps_to_reproduce: '1. Click submit',
            expected_result: 'Success',
            actual_result: 'Crash',
            assigned_qa_id: 'random-user-id', // not eligible
          },
          { id: 'user-reporter', role: 'USER' }
        )
      ).rejects.toThrow(/Selected QA tester is not an eligible QA tester/);
    });

    it('persists assigned_qa_id when a valid eligible QA tester is selected', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organization_id: 'org-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'user-reporter',
        project_role: 'DEVELOPER',
        member_roles: [{ role_name: 'DEVELOPER' }],
      });
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 'proj-1',
          user_id: 'qa-1',
          user: { id: 'qa-1', name: 'Alice QA', email: 'alice@qa.com' },
          project_role: 'QA_TESTER',
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          bugReport: {
            create: jest.fn().mockImplementation((args: any) =>
              Promise.resolve({
                id: 'complaint-1',
                ...args.data,
              })
            ),
            findUnique: jest.fn().mockImplementation((args: any) =>
              Promise.resolve({
                id: 'complaint-1',
                title: 'Crash on click',
                steps_to_reproduce: '1. Click submit',
                expected_result: 'Success',
                actual_result: 'Crash',
                assigned_qa_id: 'qa-1',
                status: 'PENDING_REVIEW',
                reporter: { id: 'user-reporter', name: 'Reporter', email: 'rep@test.com' },
                assigned_qa: { id: 'qa-1', name: 'Alice QA', email: 'alice@qa.com' },
                attachments: [],
              })
            ),
          },
          bugAttachment: { create: jest.fn() },
          bugEvent: { create: jest.fn() },
        });
      });

      const res = await BugService.createComplaint(
        'proj-1',
        {
          title: 'Crash on click',
          steps_to_reproduce: '1. Click submit',
          expected_result: 'Success',
          actual_result: 'Crash',
          assigned_qa_id: 'qa-1',
        },
        { id: 'user-reporter', role: 'USER' }
      );

      expect(res.assigned_qa_id).toBe('qa-1');
      expect(res.status).toBe('PENDING_REVIEW');
    });
  });

  // ── ISSUE 4: MULTI-ROLE DATA MODEL & PERMISSIONS ────────────────────────────
  describe('Issue #4 — Multi-Role Support & Permission Union Evaluation', () => {
    it('persists multiple project roles in project_member_roles and sets primary project_role', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-1', is_active: true });
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organization_id: 'org-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'member-1',
      });
      mockPrisma.role.findFirst.mockImplementation((args: any) =>
        Promise.resolve({ id: `role-id-${args?.where?.name}`, name: args?.where?.name })
      );
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 'proj-1',
          user_id: 'member-1',
          project_role: 'DEVELOPER',
          member_roles: [
            { role_name: 'DEVELOPER', role_id: 'role-dev' },
            { role_name: 'QA_TESTER', role_id: 'role-qa' },
          ],
          user: { id: 'member-1', name: 'Dev & QA Tester', email: 'multi@dailoqa.com' },
        },
      ]);

      const members = await ProjectService.updateProjectMemberRoles(
        'proj-1',
        [
          {
            user_id: 'member-1',
            project_roles: ['DEVELOPER', 'QA_TESTER'],
          },
        ],
        { id: 'admin-1', role: 'ADMIN', organization_id: 'org-1' }
      );

      // Verify projectMemberRole upsert was called for both roles
      expect(mockPrisma.projectMemberRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id_user_id_role_name: {
              project_id: 'proj-1',
              user_id: 'member-1',
              role_name: 'DEVELOPER',
            },
          }),
        })
      );
      expect(mockPrisma.projectMemberRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id_user_id_role_name: {
              project_id: 'proj-1',
              user_id: 'member-1',
              role_name: 'QA_TESTER',
            },
          }),
        })
      );

      // Verify return format includes both roles in project_roles array
      expect(members[0].project_roles).toEqual(['DEVELOPER', 'QA_TESTER']);
    });

    it('grants permission union for multi-role member (DEVELOPER + QA_TESTER)', async () => {
      // Member holds both DEVELOPER and QA_TESTER in project_member_roles
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1', organization_id: 'org-1' });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'multi-user',
        project_role: 'DEVELOPER',
        member_roles: [
          { role_name: 'DEVELOPER' },
          { role_name: 'QA_TESTER' },
        ],
      });

      // 1. Can perform QA Review (from QA_TESTER role)
      mockPrisma.bugReport.findFirst.mockResolvedValue({
        id: 'complaint-1',
        project_id: 'proj-1',
        status: 'PENDING_REVIEW',
      });
      mockPrisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          bugReport: {
            update: jest.fn().mockResolvedValue({ id: 'complaint-1', status: 'VERIFIED' }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'complaint-1',
              status: 'VERIFIED',
              official_bug: { id: 'bug-1', bug_code: 'BUG-0001' },
              reviews: [],
            }),
          },
          bug: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue({ id: 'bug-1', bug_code: 'BUG-0001' }),
          },
          bugAttachment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          bugReview: { create: jest.fn().mockResolvedValue({}) },
          bugEvent: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      const reviewRes = await BugService.reviewComplaint(
        'proj-1',
        'complaint-1',
        { outcome: 'VERIFIED' as any, notes: 'Verified by multi-role QA' },
        { id: 'multi-user', role: 'USER' }
      );
      expect(reviewRes.complaint.status).toBe('VERIFIED');

      // 2. Can also perform development transition (from DEVELOPER role)
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: 'proj-1',
        status: 'ASSIGNED',
        current_assignee_id: 'multi-user',
      });
      mockPrisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          bug: {
            update: jest.fn().mockResolvedValue({ id: 'bug-1', status: 'IN_PROGRESS' }),
          },
          bugEvent: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      const transRes = await BugService.transitionBugStatus(
        'proj-1',
        'bug-1',
        'IN_PROGRESS' as any,
        'Started work',
        undefined,
        { id: 'multi-user', role: 'USER' }
      );
      expect(transRes.status).toBe('IN_PROGRESS');
    });
  });

  // ── ISSUE 5: SUPER ADMIN PLATFORM CONTROL ───────────────────────────────────
  describe('Issue #5 — Super Admin Portal Platform Monitoring & Bug Telemetry', () => {
    it('aggregates live database counts for organizations, projects, bug portal, and project roles', async () => {
      mockPrisma.organization.count.mockResolvedValueOnce(2); // total
      mockPrisma.organization.count.mockResolvedValueOnce(2); // active
      mockPrisma.organization.count.mockResolvedValueOnce(0); // suspended
      mockPrisma.user.count.mockResolvedValueOnce(3); // managers
      mockPrisma.user.count.mockResolvedValueOnce(85); // tenant members
      mockPrisma.project.count.mockResolvedValueOnce(4); // projects
      mockPrisma.bugReport.count.mockResolvedValueOnce(17); // total complaints
      mockPrisma.bugReport.count.mockResolvedValueOnce(12); // pending review
      mockPrisma.bug.count.mockResolvedValueOnce(2); // active bugs
      mockPrisma.bug.count.mockResolvedValueOnce(3); // closed bugs
      mockPrisma.projectMemberRole.groupBy.mockResolvedValueOnce([
        { role_name: 'INTERN', _count: { id: 165 } },
        { role_name: 'DEVELOPER', _count: { id: 7 } },
        { role_name: 'QA_TESTER', _count: { id: 6 } },
      ]);
      mockPrisma.role.findMany.mockResolvedValueOnce([
        { id: 'r1', name: 'SUPER_ADMIN', _count: { users: 1 } },
        { id: 'r2', name: 'MANAGER', _count: { users: 3 } },
      ]);

      const overview = await OrganizationService.getPlatformOverview();

      // Check standard platform KPIs
      expect(overview.kpis.totalOrganizations).toBe(2);
      expect(overview.kpis.totalProjects).toBe(4);
      expect(overview.kpis.totalUsers).toBe(85);

      // Check live bug portal summary
      expect(overview.bugPortalSummary.totalComplaints).toBe(17);
      expect(overview.bugPortalSummary.pendingReview).toBe(12);
      expect(overview.bugPortalSummary.activeBugs).toBe(2);
      expect(overview.bugPortalSummary.closedBugs).toBe(3);

      // Check live project roles breakdown
      expect(overview.rolesSummary.totalProjectRoles).toBe(178);
      expect(overview.rolesSummary.projectRoleDistribution[0].role_name).toBe('INTERN');
      expect(overview.rolesSummary.projectRoleDistribution[0].count).toBe(165);
    });
  });
});
