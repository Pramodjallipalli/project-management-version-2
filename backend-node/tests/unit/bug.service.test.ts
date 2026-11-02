import { BugService } from '../../src/services/bug.service';
import { mockPrisma } from '../mocks/prisma.mock';
import { BugSeverity, BugPriority, BugReviewOutcome, BugStatus, BugRetestResult, BugReportStatus } from '@prisma/client';

// Mock StorageService
jest.mock('../../src/services/storage.service', () => ({
  StorageService: {
    saveProjectFile: jest.fn().mockResolvedValue({ storageKey: 'mock-key-123', filename: 'evidence.png' }),
    getFilePath: jest.fn().mockReturnValue('/storage/projects/mock-key-123'),
  },
}));

describe('BugService Unit Tests', () => {
  const projectId = 'proj-123';
  const orgId = 'org-123';
  const mockUser = { id: 'user-qa-1', role: 'ADMIN', name: 'Admin QA' };

  const mockProject = {
    id: projectId,
    organization_id: orgId,
    owner_id: 'owner-1',
    members: [{ project_id: projectId, user_id: mockUser.id, project_role: 'QA_TESTER' }],
    owners: [],
  };

  const mockTechLeadProject = {
    id: projectId,
    organization_id: orgId,
    owner_id: 'owner-1',
    members: [{ project_id: projectId, user_id: mockUser.id, project_role: 'TECH_LEAD' }],
    owners: [],
  };

  const mockDevProject = {
    id: projectId,
    organization_id: orgId,
    owner_id: 'owner-1',
    members: [{ project_id: projectId, user_id: mockUser.id, project_role: 'DEVELOPER' }],
    owners: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
  });

  describe('Image Validation & Magic Bytes', () => {
    it('accepts valid PNG magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
      const res = BugService.validateImageSignature(pngBuffer);
      expect(res.mime).toBe('image/png');
      expect(res.ext).toBe('png');
    });

    it('accepts valid JPEG magic bytes', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const res = BugService.validateImageSignature(jpegBuffer);
      expect(res.mime).toBe('image/jpeg');
      expect(res.ext).toBe('jpg');
    });

    it('accepts valid GIF magic bytes', () => {
      const gifBuffer = Buffer.from('GIF89a123456');
      const res = BugService.validateImageSignature(gifBuffer);
      expect(res.mime).toBe('image/gif');
      expect(res.ext).toBe('gif');
    });

    it('accepts valid WebP magic bytes', () => {
      const webpBuffer = Buffer.from('RIFF1234WEBPVP8 ...');
      const res = BugService.validateImageSignature(webpBuffer);
      expect(res.mime).toBe('image/webp');
      expect(res.ext).toBe('webp');
    });

    it('rejects fake or non-image buffers', () => {
      const textBuffer = Buffer.from('This is a plain text file, not an image!');
      expect(() => BugService.validateImageSignature(textBuffer)).toThrow('Unsupported image format');

      const smallBuffer = Buffer.from([0x00, 0x01]);
      expect(() => BugService.validateImageSignature(smallBuffer)).toThrow('Invalid file payload');
    });
  });

  describe('createComplaint (Defect Intake)', () => {
    it('throws error when mandatory fields are missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        BugService.createComplaint(
          projectId,
          {
            title: '',
            steps_to_reproduce: 'Steps',
            expected_result: 'Exp',
            actual_result: 'Act',
          },
          mockUser,
          []
        )
      ).rejects.toThrow('Complaint title is required');
    });

    it('throws error when evidence file exceeds size or is invalid image', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const fakeFile = {
        originalname: 'script.sh',
        buffer: Buffer.from('#!/bin/bash echo hello'),
      };

      await expect(
        BugService.createComplaint(
          projectId,
          {
            title: 'Button broken',
            steps_to_reproduce: '1. Click',
            expected_result: 'Works',
            actual_result: 'Fails',
            severity: BugSeverity.HIGH,
          },
          mockUser,
          [fakeFile]
        )
      ).rejects.toThrow('Unsupported image format');
    });

    it('successfully creates a complaint with valid image evidence', async () => {
      const validPng = {
        originalname: 'screenshot.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]),
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bugReport.create.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        title: 'Crash on login',
        status: BugReportStatus.PENDING_REVIEW,
      });
      mockPrisma.bugReport.findUnique.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        title: 'Crash on login',
        status: BugReportStatus.PENDING_REVIEW,
        attachments: [{ id: 'att-1' }],
      });

      const result = await BugService.createComplaint(
        projectId,
        {
          title: 'Crash on login',
          description: 'Clicking submit crashes',
          steps_to_reproduce: '1. Enter email\n2. Click submit',
          expected_result: 'Dashboard loads',
          actual_result: 'White screen',
          environment: 'Chrome Windows 11',
          severity: BugSeverity.CRITICAL,
        },
        mockUser,
        [validPng]
      );

      expect(mockPrisma.bugReport.create).toHaveBeenCalled();
      expect(mockPrisma.bugAttachment.create).toHaveBeenCalled();
      expect(result?.id).toBe('report-1');
    });
  });

  describe('reviewComplaint (QA Verification Gate)', () => {
    it('throws error if complaint does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bugReport.findFirst.mockResolvedValue(null);

      await expect(
        BugService.reviewComplaint(
          projectId,
          'non-existent-report',
          { outcome: BugReviewOutcome.VERIFIED, notes: 'Looks good' },
          mockUser
        )
      ).rejects.toThrow('Complaint not found');
    });

    it('requires duplicate_of_id when outcome is DUPLICATE', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bugReport.findFirst.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        status: BugReportStatus.PENDING_REVIEW,
      });

      await expect(
        BugService.reviewComplaint(
          projectId,
          'report-1',
          { outcome: BugReviewOutcome.DUPLICATE, notes: 'Duplicate report' },
          mockUser
        )
      ).rejects.toThrow('Duplicate bug ID is required');
    });

    it('updates status and does not promote to bug on REJECTED outcome', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bugReport.findFirst.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        status: BugReportStatus.PENDING_REVIEW,
      });
      mockPrisma.bugReport.update.mockResolvedValue({ id: 'report-1', status: BugReportStatus.REJECTED });
      mockPrisma.bugReview.create.mockResolvedValue({ id: 'review-1', outcome: BugReviewOutcome.REJECTED });
      mockPrisma.bugReport.findUnique.mockResolvedValue({ id: 'report-1', status: BugReportStatus.REJECTED });

      const result = await BugService.reviewComplaint(
        projectId,
        'report-1',
        { outcome: BugReviewOutcome.REJECTED, notes: 'Working as intended' },
        mockUser
      );

      expect(mockPrisma.bug.create).not.toHaveBeenCalled();
      expect(mockPrisma.bugReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({ status: BugReportStatus.REJECTED }),
        })
      );
    });

    it('promotes to official bug with sequential bug code on VERIFIED outcome', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bugReport.findFirst.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        title: 'Checkout fails',
        description: 'Payment error 500',
        severity: BugSeverity.CRITICAL,
        status: BugReportStatus.PENDING_REVIEW,
      });
      mockPrisma.bug.count.mockResolvedValue(5);
      mockPrisma.bug.create.mockResolvedValue({
        id: 'bug-6',
        bug_code: 'BUG-006',
        title: 'Checkout fails',
        status: BugStatus.OPEN,
      });
      mockPrisma.bugReport.update.mockResolvedValue({ id: 'report-1', status: BugReportStatus.VERIFIED });
      mockPrisma.bugReview.create.mockResolvedValue({ id: 'review-1', outcome: BugReviewOutcome.VERIFIED });
      mockPrisma.bugReport.findUnique.mockResolvedValue({ id: 'report-1', status: BugReportStatus.VERIFIED });

      const result = await BugService.reviewComplaint(
        projectId,
        'report-1',
        { outcome: BugReviewOutcome.VERIFIED, priority: BugPriority.HIGH, notes: 'Reproduced on staging' },
        mockUser
      );

      expect(mockPrisma.bug.create).toHaveBeenCalled();
      const createCall = mockPrisma.bug.create.mock.calls[0][0];
      expect(createCall.data.bug_code).toBe('BUG-006');
      expect(createCall.data.status).toBe(BugStatus.OPEN);
      expect(result.officialBug.bug_code).toBe('BUG-006');
    });
  });

  describe('triageAndAssignBug (Triage & Assignment)', () => {
    it('throws error if bug does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockTechLeadProject);
      mockPrisma.bug.findFirst.mockResolvedValue(null);

      await expect(
        BugService.triageAndAssignBug(projectId, 'bad-bug', { assignee_id: 'dev-1' }, mockUser)
      ).rejects.toThrow('Bug not found');
    });

    it('assigns developer and updates status to ASSIGNED', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockTechLeadProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.OPEN,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'pm-1', project_role: 'DEVELOPER' });
      mockPrisma.bug.update.mockResolvedValue({
        id: 'bug-1',
        current_assignee_id: 'dev-1',
        status: BugStatus.ASSIGNED,
      });

      const result = await BugService.triageAndAssignBug(
        projectId,
        'bug-1',
        { assignee_id: 'dev-1', triage_notes: 'Please investigate backend auth' },
        mockUser
      );

      expect(mockPrisma.bugAssignment.create).toHaveBeenCalled();
      expect(mockPrisma.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bug-1' },
          data: expect.objectContaining({ current_assignee_id: 'dev-1', status: BugStatus.ASSIGNED }),
        })
      );
    });
  });

  describe('transitionBugStatus (State Machine)', () => {
    it('disallows arbitrary jumping from OPEN to CLOSED', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.OPEN,
      });

      await expect(
        BugService.transitionBugStatus(projectId, 'bug-1', BugStatus.CLOSED, 'Direct close', undefined, mockUser)
      ).rejects.toThrow('Forbidden: Defects cannot be directly closed. Bugs can only be closed through an official passing QA retest');
    });

    it('allows valid transition from ASSIGNED to IN_PROGRESS', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockDevProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.ASSIGNED,
      });
      mockPrisma.bug.update.mockResolvedValue({
        id: 'bug-1',
        status: BugStatus.IN_PROGRESS,
      });

      const result = await BugService.transitionBugStatus(
        projectId,
        'bug-1',
        BugStatus.IN_PROGRESS,
        'Started work',
        undefined,
        mockUser
      );

      expect(mockPrisma.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bug-1' },
          data: expect.objectContaining({ status: BugStatus.IN_PROGRESS }),
        })
      );
      expect(mockPrisma.bugEvent.create).toHaveBeenCalled();
    });
  });

  describe('recordRetest (QA Retest Engine)', () => {
    it('rejects retest when bug is not in READY_FOR_RETEST or FIXED status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.IN_PROGRESS,
      });

      await expect(
        BugService.recordRetest(
          projectId,
          'bug-1',
          { result: BugRetestResult.PASS, tested_build: 'v1.2.0', notes: 'Done' },
          mockUser,
          []
        )
      ).rejects.toThrow("Bug must be in 'READY_FOR_RETEST' state");
    });

    it('closes bug upon PASS retest result with evidence', async () => {
      const validPng = {
        originalname: 'pass_proof.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]),
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.READY_FOR_RETEST,
      });
      mockPrisma.bugRetest.count.mockResolvedValue(1);
      mockPrisma.bugRetest.create.mockResolvedValue({
        id: 'retest-2',
        attempt_number: 2,
        result: BugRetestResult.PASS,
      });
      mockPrisma.bugRetest.findUnique.mockResolvedValue({
        id: 'retest-2',
        attempt_number: 2,
        result: BugRetestResult.PASS,
        tested_build: 'v2.0.1',
      });
      mockPrisma.bug.update.mockResolvedValue({
        id: 'bug-1',
        status: BugStatus.CLOSED,
      });

      const result = await BugService.recordRetest(
        projectId,
        'bug-1',
        {
          result: BugRetestResult.PASS,
          tested_build: 'v2.0.1',
          notes: 'Tested in staging, issue is resolved',
        },
        mockUser,
        [validPng]
      );

      expect(mockPrisma.bugRetest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attempt_number: 2,
            result: BugRetestResult.PASS,
            tested_build: 'v2.0.1',
          }),
        })
      );
      expect(mockPrisma.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bug-1' },
          data: expect.objectContaining({ status: BugStatus.CLOSED }),
        })
      );
    });

    it('reopens bug upon FAIL retest result with evidence', async () => {
      const validPng = {
        originalname: 'fail_proof.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]),
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bug.findFirst.mockResolvedValue({
        id: 'bug-1',
        project_id: projectId,
        status: BugStatus.READY_FOR_RETEST,
      });
      mockPrisma.bugRetest.count.mockResolvedValue(0);
      mockPrisma.bugRetest.create.mockResolvedValue({
        id: 'retest-1',
        attempt_number: 1,
        result: BugRetestResult.FAIL,
      });
      mockPrisma.bugRetest.findUnique.mockResolvedValue({
        id: 'retest-1',
        attempt_number: 1,
        result: BugRetestResult.FAIL,
      });
      mockPrisma.bug.update.mockResolvedValue({
        id: 'bug-1',
        status: BugStatus.REOPENED,
      });

      const result = await BugService.recordRetest(
        projectId,
        'bug-1',
        {
          result: BugRetestResult.FAIL,
          tested_build: 'v2.0.1',
          notes: 'Still fails when clicking twice',
        },
        mockUser,
        [validPng]
      );

      expect(mockPrisma.bugRetest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attempt_number: 1,
            result: BugRetestResult.FAIL,
          }),
        })
      );
      expect(mockPrisma.bug.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bug-1' },
          data: expect.objectContaining({ status: BugStatus.REOPENED }),
        })
      );
    });
  });

  describe('getBugAnalytics (Analytics)', () => {
    it('aggregates counts accurately', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.bug.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(5)  // open
        .mockResolvedValueOnce(3)  // inProgress
        .mockResolvedValueOnce(4)  // readyRetest
        .mockResolvedValueOnce(3); // closed
      mockPrisma.bugReport.count.mockResolvedValue(2); // pending complaints
      mockPrisma.bugRetest.findMany.mockResolvedValue([
        { result: BugRetestResult.PASS },
        { result: BugRetestResult.FAIL },
      ]);
      mockPrisma.bug.groupBy.mockResolvedValue([
        { severity: 'CRITICAL', _count: { severity: 2 } },
        { severity: 'HIGH', _count: { severity: 5 } },
      ]);

      const metrics = await BugService.getBugAnalytics(projectId, mockUser);

      expect(metrics.totalBugs).toBe(15);
      expect(metrics.openBugs).toBe(5);
      expect(metrics.readyRetestBugs).toBe(4);
      expect(metrics.pendingComplaints).toBe(2);
      expect(metrics.totalRetests).toBe(2);
      expect(metrics.passRate).toBe(50);
      expect(metrics.bugsBySeverity).toEqual({
        CRITICAL: 2,
        HIGH: 5,
      });
    });
  });

  describe('Project-Scoped Authorization Enforcement', () => {
    const nonMemberUser = { id: 'non-member-1', role: 'EMPLOYEE', name: 'External User' };
    const devUser = { id: 'dev-user-1', role: 'DEVELOPER', name: 'Dev User' };
    const internUser = { id: 'intern-user-1', role: 'INTERN', name: 'Intern User' };

    it('denies access if user is not a member, owner, or superadmin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [],
        owners: [],
      });

      await expect(
        BugService.listBugs(projectId, {}, nonMemberUser)
      ).rejects.toThrow('Forbidden: You are not a member of this project');
    });

    it('denies QA complaint review if member is assigned DEVELOPER role in this project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: devUser.id, project_role: 'DEVELOPER' }],
        owners: [],
      });

      await expect(
        BugService.reviewComplaint(
          projectId,
          'report-1',
          { outcome: BugReviewOutcome.VERIFIED, notes: 'Dev attempting QA verification' },
          devUser
        )
      ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
    });

    it('denies QA retest execution if member is assigned TECH_LEAD role in this project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: mockUser.id, project_role: 'TECH_LEAD' }],
        owners: [],
      });

      await expect(
        BugService.recordRetest(
          projectId,
          'bug-1',
          { result: BugRetestResult.PASS, tested_build: 'v1.0.0', notes: 'Lead trying to retest' },
          mockUser,
          []
        )
      ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
    });

    it('denies technical triage and assignment if member is assigned INTERN role in this project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: internUser.id, project_role: 'INTERN' }],
        owners: [],
      });

      await expect(
        BugService.triageAndAssignBug(
          projectId,
          'bug-1',
          { assignee_id: 'dev-1', triage_notes: 'Intern attempting assignment' },
          internUser
        )
      ).rejects.toThrow('Forbidden: Only Tech Leads, Project Managers, or Admins can perform technical triage and assignment');
    });

    it('allows SUPER_ADMIN to oversee and verify even if not explicitly listed in project_members', async () => {
      const superAdminUser = { id: 'super-1', role: 'SUPER_ADMIN', name: 'Super Admin' };
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [],
        owners: [],
      });
      mockPrisma.bugReport.findFirst.mockResolvedValue({
        id: 'report-1',
        project_id: projectId,
        status: BugReportStatus.PENDING_REVIEW,
      });
      mockPrisma.bugReport.update.mockResolvedValue({ id: 'report-1', status: BugReportStatus.REJECTED });
      mockPrisma.bugReview.create.mockResolvedValue({ id: 'rev-1', outcome: BugReviewOutcome.REJECTED });
      mockPrisma.bugReport.findUnique.mockResolvedValue({ id: 'report-1', status: BugReportStatus.REJECTED });

      const res = await BugService.reviewComplaint(
        projectId,
        'report-1',
        { outcome: BugReviewOutcome.REJECTED, notes: 'Super Admin oversight rejection' },
        superAdminUser
      );

      expect(res.complaint.status).toBe(BugReportStatus.REJECTED);
    });

    describe('Mandatory Role Matrix: Employee', () => {
      const empUser = { id: 'emp-1', role: 'EMPLOYEE', name: 'Employee User' };
      const empProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: empUser.id, project_role: 'EMPLOYEE' }],
        owners: [],
      };

      it('allows Employee to submit complaint and comment', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(empProject);
        mockPrisma.bugReport.create.mockResolvedValue({
          id: 'emp-report-1',
          project_id: projectId,
          reporter_id: empUser.id,
          title: 'Defect noticed during operations',
          status: BugReportStatus.PENDING_REVIEW,
          severity: BugSeverity.MEDIUM,
        });
        mockPrisma.bugReport.findUnique.mockResolvedValue({
          id: 'emp-report-1',
          title: 'Defect noticed during operations',
          reporter: empUser,
          attachments: [],
          reviews: [],
        });

        const created = await BugService.createComplaint(
          projectId,
          {
            title: 'Defect noticed during operations',
            steps_to_reproduce: 'Open dashboard',
            expected_result: 'Metrics render',
            actual_result: 'Blank screen',
          },
          empUser
        );
        expect(created.id).toBe('emp-report-1');
      });

      it('denies Employee from performing QA review', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(empProject);
        await expect(
          BugService.reviewComplaint(
            projectId,
            'report-1',
            { outcome: BugReviewOutcome.VERIFIED, notes: 'Employee attempt' },
            empUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
      });

      it('denies Employee from performing technical triage and assignment', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(empProject);
        await expect(
          BugService.triageAndAssignBug(projectId, 'bug-1', { assignee_id: 'dev-1' }, empUser)
        ).rejects.toThrow('Forbidden: Only Tech Leads, Project Managers, or Admins can perform technical triage and assignment');
      });

      it('denies Employee from modifying development states', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(empProject);
        mockPrisma.bug.findFirst.mockResolvedValue({
          id: 'bug-1',
          project_id: projectId,
          status: BugStatus.ASSIGNED,
          current_assignee_id: 'other-dev',
        });

        await expect(
          BugService.transitionBugStatus(projectId, 'bug-1', BugStatus.IN_PROGRESS, 'Attempting state change', undefined, empUser)
        ).rejects.toThrow("Forbidden: Role 'EMPLOYEE' is not permitted to modify bug development states");
      });

      it('denies Employee from executing QA retest', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(empProject);
        await expect(
          BugService.recordRetest(
            projectId,
            'bug-1',
            { tested_build: 'v1.0.1', result: BugRetestResult.PASS, notes: 'Emp retest' },
            empUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });
    });

    describe('Mandatory Role Matrix: Not Assigned', () => {
      const unassignedUser = { id: 'unassigned-1', role: 'EMPLOYEE', name: 'Unassigned Member' };
      const unassignedProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: unassignedUser.id, project_role: null }],
        owners: [],
      };

      it('allows Not Assigned / null member to submit complaint (Universal Bug Reporting)', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        mockPrisma.bugReport.create.mockResolvedValue({
          id: 'unassigned-report-1',
          project_id: projectId,
          reporter_id: unassignedUser.id,
          title: 'Complaint from unassigned member',
          status: BugReportStatus.PENDING_REVIEW,
          severity: BugSeverity.MEDIUM,
        });
        mockPrisma.bugReport.findUnique.mockResolvedValue({
          id: 'unassigned-report-1',
          title: 'Complaint from unassigned member',
          reporter: unassignedUser,
          attachments: [],
          reviews: [],
        });

        const created = await BugService.createComplaint(
          projectId,
          {
            title: 'Complaint from unassigned member',
            steps_to_reproduce: '1. Click button',
            expected_result: 'Success',
            actual_result: 'Failure',
          },
          unassignedUser
        );
        expect(created.id).toBe('unassigned-report-1');
        expect(created.title).toBe('Complaint from unassigned member');
      });

      it('denies Not Assigned member from performing QA verification review', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        await expect(
          BugService.reviewComplaint(
            projectId,
            'report-1',
            { outcome: BugReviewOutcome.VERIFIED, notes: 'Unassigned QA attempt' },
            unassignedUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
      });

      it('denies Not Assigned member from performing technical triage and assignment', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        await expect(
          BugService.triageAndAssignBug(projectId, 'bug-1', { assignee_id: 'dev-1' }, unassignedUser)
        ).rejects.toThrow('Forbidden: Only Tech Leads, Project Managers, or Admins can perform technical triage and assignment');
      });

      it('denies Not Assigned member from modifying development states', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        mockPrisma.bug.findFirst.mockResolvedValue({
          id: 'bug-1',
          project_id: projectId,
          status: BugStatus.ASSIGNED,
          current_assignee_id: 'dev-1',
        });

        await expect(
          BugService.transitionBugStatus(projectId, 'bug-1', BugStatus.IN_PROGRESS, 'Attempting state change', undefined, unassignedUser)
        ).rejects.toThrow("Forbidden: Role 'NOT_ASSIGNED' is not permitted to modify bug development states");
      });

      it('denies Not Assigned member from executing QA retest', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        await expect(
          BugService.recordRetest(
            projectId,
            'bug-1',
            { tested_build: 'v1.0.1', result: BugRetestResult.PASS, notes: 'Unassigned retest' },
            unassignedUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });

      it('denies Not Assigned member from adding comments', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(unassignedProject);
        await expect(
          BugService.addComment(projectId, { bug_id: 'bug-1' }, 'Comment from unassigned', unassignedUser)
        ).rejects.toThrow('Forbidden: Members with Not Assigned role do not have bug-management privileges');
      });

      it('prevents assigning defect to a member with Not Assigned role', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(mockTechLeadProject);
        mockPrisma.bug.findFirst.mockResolvedValue({
          id: 'bug-1',
          project_id: projectId,
          status: BugStatus.OPEN,
        });
        mockPrisma.projectMember.findUnique.mockResolvedValue({
          id: 'pm-unassigned',
          project_id: projectId,
          user_id: 'target-unassigned',
          project_role: null,
        });

        await expect(
          BugService.triageAndAssignBug(
            projectId,
            'bug-1',
            { assignee_id: 'target-unassigned' },
            mockUser
          )
        ).rejects.toThrow('Selected assignee has Not Assigned role and cannot be assigned development defects');
      });
    });

    describe('Mandatory Role Matrix: Manager & Tech Lead Restrictions', () => {
      const managerUser = { id: 'mgr-1', role: 'MANAGER', name: 'Project Manager' };
      const managerProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: managerUser.id, project_role: 'MANAGER' }],
        owners: [],
      };

      it('Manager cannot execute QA retest (Req 6)', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(managerProject);
        await expect(
          BugService.recordRetest(
            projectId,
            'bug-1',
            { tested_build: 'v1.0.0', result: BugRetestResult.PASS, notes: 'Mgr retest' },
            managerUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });

      it('Manager cannot perform QA complaint verification review', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(managerProject);
        await expect(
          BugService.reviewComplaint(
            projectId,
            'report-1',
            { outcome: BugReviewOutcome.VERIFIED, notes: 'Mgr verification' },
            managerUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
      });

      it('Tech Lead cannot execute QA retest (Req 6)', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(mockTechLeadProject);
        await expect(
          BugService.recordRetest(
            projectId,
            'bug-1',
            { tested_build: 'v1.0.0', result: BugRetestResult.PASS, notes: 'Lead retest' },
            mockUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });
    });

    describe('Mandatory Role Matrix: Business Analyst, DevOps, UI/UX, Coordinator', () => {
      const baUser = { id: 'ba-1', role: 'EMPLOYEE', name: 'BA User' };
      const baProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: baUser.id, project_role: 'BUSINESS_ANALYST' }],
        owners: [],
      };

      const devopsUser = { id: 'devops-1', role: 'EMPLOYEE', name: 'DevOps User' };
      const devopsProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: devopsUser.id, project_role: 'DEVOPS_ENGINEER' }],
        owners: [],
      };

      const uiuxUser = { id: 'uiux-1', role: 'EMPLOYEE', name: 'UI/UX User' };
      const uiuxProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: uiuxUser.id, project_role: 'UI_UX_DESIGNER' }],
        owners: [],
      };

      const pcUser = { id: 'pc-1', role: 'EMPLOYEE', name: 'PC User' };
      const pcProject = {
        id: projectId,
        organization_id: orgId,
        owner_id: 'other-owner',
        members: [{ project_id: projectId, user_id: pcUser.id, project_role: 'PROJECT_COORDINATOR' }],
        owners: [],
      };

      it('Business Analyst cannot QA review or execute retests', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(baProject);
        await expect(
          BugService.reviewComplaint(projectId, 'report-1', { outcome: BugReviewOutcome.VERIFIED, notes: 'BA' }, baUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
        await expect(
          BugService.recordRetest(projectId, 'bug-1', { tested_build: 'v1.0', result: BugRetestResult.PASS, notes: 'BA' }, baUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });

      it('DevOps Engineer cannot QA review or execute retests', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(devopsProject);
        await expect(
          BugService.reviewComplaint(projectId, 'report-1', { outcome: BugReviewOutcome.VERIFIED, notes: 'DevOps' }, devopsUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
        await expect(
          BugService.recordRetest(projectId, 'bug-1', { tested_build: 'v1.0', result: BugRetestResult.PASS, notes: 'DevOps' }, devopsUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });

      it('UI/UX Designer cannot QA review or execute retests', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(uiuxProject);
        await expect(
          BugService.reviewComplaint(projectId, 'report-1', { outcome: BugReviewOutcome.VERIFIED, notes: 'UI/UX' }, uiuxUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
        await expect(
          BugService.recordRetest(projectId, 'bug-1', { tested_build: 'v1.0', result: BugRetestResult.PASS, notes: 'UI/UX' }, uiuxUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });

      it('Project Coordinator cannot triage or execute retests', async () => {
        mockPrisma.project.findUnique.mockResolvedValue(pcProject);
        await expect(
          BugService.triageAndAssignBug(projectId, 'bug-1', { assignee_id: 'dev-1' }, pcUser)
        ).rejects.toThrow('Forbidden: Only Tech Leads, Project Managers, or Admins can perform technical triage and assignment');
        await expect(
          BugService.recordRetest(projectId, 'bug-1', { tested_build: 'v1.0', result: BugRetestResult.PASS, notes: 'PC' }, pcUser)
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can record official retest results');
      });
    });

    describe('Cross-Project Context & Role Isolation (Req 3 & 4)', () => {
      const multiProjectUser = { id: 'multi-user-1', role: 'EMPLOYEE', name: 'Flexible Engineer' };
      const projectAlpha = 'proj-alpha';
      const projectBeta = 'proj-beta';

      it('user is QA_TESTER in Project Alpha but DEVELOPER in Project Beta', async () => {
        // Project Alpha check: user is QA_TESTER
        mockPrisma.project.findUnique.mockImplementation(({ where }) => {
          if (where.id === projectAlpha) {
            return Promise.resolve({
              id: projectAlpha,
              organization_id: orgId,
              owner_id: 'owner-1',
              members: [{ project_id: projectAlpha, user_id: multiProjectUser.id, project_role: 'QA_TESTER' }],
              owners: [],
            });
          }
          if (where.id === projectBeta) {
            return Promise.resolve({
              id: projectBeta,
              organization_id: orgId,
              owner_id: 'owner-1',
              members: [{ project_id: projectBeta, user_id: multiProjectUser.id, project_role: 'DEVELOPER' }],
              owners: [],
            });
          }
          return Promise.resolve(null);
        });

        // In Project Alpha: can verify complaint
        mockPrisma.bugReport.findFirst.mockResolvedValue({
          id: 'alpha-report-1',
          project_id: projectAlpha,
          status: BugReportStatus.PENDING_REVIEW,
          title: 'Defect in Alpha',
          description: 'Steps',
          severity: BugSeverity.MEDIUM,
        });
        mockPrisma.bug.count.mockResolvedValue(0);
        mockPrisma.bug.create.mockResolvedValue({
          id: 'alpha-bug-1',
          project_id: projectAlpha,
          bug_code: 'BUG-001',
          status: BugStatus.OPEN,
        });
        mockPrisma.bugReport.update.mockResolvedValue({ id: 'alpha-report-1', status: BugReportStatus.VERIFIED });
        mockPrisma.bugReview.create.mockResolvedValue({ id: 'rev-alpha', outcome: BugReviewOutcome.VERIFIED });
        mockPrisma.bugReport.findUnique.mockResolvedValue({
          id: 'alpha-report-1',
          status: BugReportStatus.VERIFIED,
          official_bug: { bug_code: 'BUG-001' },
          reviews: [],
        });

        const alphaReview = await BugService.reviewComplaint(
          projectAlpha,
          'alpha-report-1',
          { outcome: BugReviewOutcome.VERIFIED, notes: 'Verified in Alpha as QA' },
          multiProjectUser
        );
        expect(alphaReview.officialBug.bug_code).toBe('BUG-001');

        // In Project Beta: QA action is DENIED because user is DEVELOPER in Project Beta
        await expect(
          BugService.reviewComplaint(
            projectBeta,
            'beta-report-1',
            { outcome: BugReviewOutcome.VERIFIED, notes: 'Attempt in Beta' },
            multiProjectUser
          )
        ).rejects.toThrow('Forbidden: Only QA testers assigned to this project can perform verification decisions');
      });
    });

    describe('Universal Bug Reporting across all PMS Project Roles (Req 1 & 5)', () => {
      const allRoles = [
        'BUSINESS_ANALYST',
        'DEVELOPER',
        'DEVOPS_ENGINEER',
        'EMPLOYEE',
        'INTERN',
        'MANAGER',
        'PROJECT_COORDINATOR',
        'QA_TESTER',
        'TECH_LEAD',
        'UI_UX_DESIGNER',
        'NOT_ASSIGNED',
        null,
      ];

      for (const role of allRoles) {
        it(`allows user with project role '${role}' to submit a complaint`, async () => {
          const testUser = { id: `user-${role || 'null'}`, role: 'EMPLOYEE', name: `User ${role || 'Null'}` };
          const roleProject = {
            id: projectId,
            organization_id: orgId,
            owner_id: 'other-owner',
            members: [{ project_id: projectId, user_id: testUser.id, project_role: role }],
            owners: [],
          };

          mockPrisma.project.findUnique.mockResolvedValue(roleProject);
          mockPrisma.bugReport.create.mockResolvedValue({
            id: `complaint-${role || 'null'}`,
            project_id: projectId,
            reporter_id: testUser.id,
            title: `Defect reported by ${role || 'Unassigned'}`,
            status: BugReportStatus.PENDING_REVIEW,
            severity: BugSeverity.HIGH,
          });
          mockPrisma.bugReport.findUnique.mockResolvedValue({
            id: `complaint-${role || 'null'}`,
            title: `Defect reported by ${role || 'Unassigned'}`,
            status: BugReportStatus.PENDING_REVIEW,
            reporter: testUser,
            attachments: [],
            reviews: [],
          });

          const result = await BugService.createComplaint(
            projectId,
            {
              title: `Defect reported by ${role || 'Unassigned'}`,
              steps_to_reproduce: 'Navigate to app, trigger error',
              expected_result: 'Work smoothly',
              actual_result: 'Error occurred',
              severity: BugSeverity.HIGH,
            },
            testUser
          );

          expect(result.id).toBe(`complaint-${role || 'null'}`);
          expect(result.status).toBe(BugReportStatus.PENDING_REVIEW);
          // Confirm bug report creation does not create an official bug
          expect(mockPrisma.bug.create).not.toHaveBeenCalled();
        });
      }

      it('allows platform Super Admin to report a defect', async () => {
        const saUser = { id: 'sa-reporter', role: 'SUPER_ADMIN', name: 'Super Admin' };
        mockPrisma.project.findUnique.mockResolvedValue({
          id: projectId,
          organization_id: orgId,
          owner_id: 'other-owner',
          members: [],
          owners: [],
        });
        mockPrisma.bugReport.create.mockResolvedValue({
          id: 'complaint-sa',
          project_id: projectId,
          reporter_id: saUser.id,
          title: 'Defect noticed by Super Admin',
          status: BugReportStatus.PENDING_REVIEW,
          severity: BugSeverity.CRITICAL,
        });
        mockPrisma.bugReport.findUnique.mockResolvedValue({
          id: 'complaint-sa',
          title: 'Defect noticed by Super Admin',
          status: BugReportStatus.PENDING_REVIEW,
          reporter: saUser,
          attachments: [],
          reviews: [],
        });

        const result = await BugService.createComplaint(
          projectId,
          {
            title: 'Defect noticed by Super Admin',
            steps_to_reproduce: 'System audit',
            expected_result: 'Clean audit',
            actual_result: 'Audit flag',
            severity: BugSeverity.CRITICAL,
          },
          saUser
        );

        expect(result.id).toBe('complaint-sa');
        expect(result.status).toBe(BugReportStatus.PENDING_REVIEW);
      });

      it('rejects complaint submission into an unauthorized project (cross-project tampering prevented)', async () => {
        const unauthorizedUser = { id: 'unauth-user', role: 'EMPLOYEE', name: 'Unauthorized Outsider' };
        mockPrisma.project.findUnique.mockResolvedValue({
          id: 'unauthorized-project-id',
          organization_id: orgId,
          owner_id: 'owner-xyz',
          members: [], // User is NOT a member
          owners: [],
        });

        await expect(
          BugService.createComplaint(
            'unauthorized-project-id',
            {
              title: 'Attempted cross-project report',
              steps_to_reproduce: 'Hacking IDs',
              expected_result: 'Blocked',
              actual_result: 'Blocked',
            },
            unauthorizedUser
          )
        ).rejects.toThrow('Forbidden: You are not a member of this project');
      });

      it('rejects complaint submission when project does not exist', async () => {
        const anyUser = { id: 'any-user', role: 'EMPLOYEE', name: 'Any User' };
        mockPrisma.project.findUnique.mockResolvedValue(null);

        await expect(
          BugService.createComplaint(
            'non-existent-project',
            {
              title: 'Invalid project report',
              steps_to_reproduce: 'None',
              expected_result: 'None',
              actual_result: 'None',
            },
            anyUser
          )
        ).rejects.toThrow('Project not found');
      });
    });
  });
});
