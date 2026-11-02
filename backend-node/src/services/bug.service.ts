import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { StorageService } from './storage.service';
import {
  BugSeverity,
  BugPriority,
  BugReportStatus,
  BugReviewOutcome,
  BugStatus,
  BugRetestResult,
} from '@prisma/client';

export interface FileUploadPayload {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
  size?: number;
}

export class BugService {
  // ── EVIDENCE IMAGE VALIDATION ──────────────────────────────────────────────
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_FILES_PER_SUBMISSION = 5;

  /**
   * Validates buffer magic bytes for allowed image types (PNG, JPEG, GIF, WebP).
   * Rejects disguised executables, scripts, or non-image files.
   */
  public static validateImageSignature(buffer: Buffer): { mime: string; ext: string } {
    if (!buffer || buffer.length < 12) {
      throw new Error('Invalid file payload: file is too small or empty');
    }

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mime: 'image/png', ext: 'png' };
    }

    // 2. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }

    // 3. GIF: GIF87a or GIF89a (47 49 46 38 37 61 or 47 49 46 38 39 61)
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return { mime: 'image/gif', ext: 'gif' };
    }

    // 4. WebP: RIFF (52 49 46 46) .... WEBP (57 45 42 50)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mime: 'image/webp', ext: 'webp' };
    }

    throw new Error('Unsupported image format. Allowed formats: PNG, JPEG, GIF, and WebP.');
  }

  /**
   * Verify that user has access to the target project
   */
  public static async verifyProjectAccess(projectId: string, userId: string, userRole?: string): Promise<any> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { user_id: userId },
          include: { member_roles: true },
        },
        owners: { where: { user_id: userId } },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    const isOwner = project.owner_id === userId || (project.owners && project.owners.length > 0);
    const isMember = project.members && project.members.length > 0;

    if (!isSuperAdmin && !isOwner && !isMember) {
      throw new Error('Forbidden: You are not a member of this project');
    }

    // Resolve project roles strictly from project membership (never leak global userRole)
    const projectRoles: string[] = [];
    if (isMember) {
      const member = project.members[0];
      if (member.project_role) {
        const parts = member.project_role.split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
        for (const p of parts) {
          if (!projectRoles.includes(p) && p !== 'NOT_ASSIGNED') projectRoles.push(p);
        }
      }
      if (Array.isArray(member.member_roles)) {
        for (const mr of member.member_roles) {
          const rName = mr.role_name.trim().toUpperCase();
          if (!projectRoles.includes(rName) && rName !== 'NOT_ASSIGNED') projectRoles.push(rName);
        }
      }
      if (projectRoles.length === 0) {
        projectRoles.push('NOT_ASSIGNED');
      }
    } else if (isOwner) {
      projectRoles.push('OWNER');
    } else if (isSuperAdmin) {
      projectRoles.push('SUPER_ADMIN');
    }

    const projectRole = projectRoles[0] || 'NOT_ASSIGNED';

    return { project, projectRole, projectRoles, isOwner, isSuperAdmin };
  }

  /**
   * Generate sequential bug code scoped to project (e.g. BUG-001)
   */
  private static async generateBugCode(projectId: string): Promise<string> {
    const count = await prisma.bug.count({ where: { project_id: projectId } });
    const nextSeq = count + 1;
    return `BUG-${String(nextSeq).padStart(3, '0')}`;
  }

  // ── ELIGIBLE QA TESTERS ────────────────────────────────────────────────────
  public static async getEligibleQaTesters(projectId: string, user: any) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const members = await prisma.projectMember.findMany({
      where: {
        project_id: projectId,
        user: { is_active: true },
        OR: [
          { project_role: 'QA_TESTER' },
          { member_roles: { some: { role_name: 'QA_TESTER' } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return members.map((m) => m.user);
  }

  // ── COMPLAINT SUBMISSION ───────────────────────────────────────────────────
  public static async createComplaint(
    projectId: string,
    data: {
      title: string;
      description?: string;
      steps_to_reproduce: string;
      expected_result: string;
      actual_result: string;
      environment?: string;
      severity?: BugSeverity;
      assigned_qa_id?: string;
    },
    user: any,
    files: FileUploadPayload[] = []
  ) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    if (!data.title?.trim()) {
      throw new Error('Complaint title is required');
    }
    if (!data.steps_to_reproduce?.trim()) {
      throw new Error('Steps to reproduce are required');
    }
    if (!data.expected_result?.trim()) {
      throw new Error('Expected result is required');
    }
    if (!data.actual_result?.trim()) {
      throw new Error('Actual result is required');
    }

    // Query eligible QA testers for this project
    const eligibleQaTesters = await prisma.projectMember.findMany({
      where: {
        project_id: projectId,
        user: { is_active: true },
        OR: [
          { project_role: 'QA_TESTER' },
          { member_roles: { some: { role_name: 'QA_TESTER' } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    let assignedQaIdToPersist: string | null = null;
    if (eligibleQaTesters.length > 0) {
      if (!data.assigned_qa_id || !data.assigned_qa_id.trim()) {
        throw new Error('Please select an eligible QA tester to review this complaint');
      }
      const selectedId = data.assigned_qa_id.trim();
      const isEligible = eligibleQaTesters.some((m) => m.user_id === selectedId);
      if (!isEligible) {
        throw new Error('Selected QA tester is not an eligible QA tester for this project');
      }
      assignedQaIdToPersist = selectedId;
    } else {
      if (data.assigned_qa_id && data.assigned_qa_id.trim()) {
        throw new Error('Selected QA tester is not an eligible QA tester for this project');
      }
      assignedQaIdToPersist = null;
    }

    if (files.length > this.MAX_FILES_PER_SUBMISSION) {
      throw new Error(`Maximum ${this.MAX_FILES_PER_SUBMISSION} evidence images allowed per complaint.`);
    }

    // Validate all image files upfront before saving anything
    const validatedFiles = files.map((file) => {
      if (file.buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`File ${file.originalname} exceeds 10MB limit.`);
      }
      const sig = this.validateImageSignature(file.buffer);
      const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
      return { file, sig, sha256 };
    });

    return await prisma.$transaction(async (tx) => {
      const complaint = await tx.bugReport.create({
        data: {
          project_id: projectId,
          reporter_id: user.id,
          assigned_qa_id: assignedQaIdToPersist,
          title: data.title.trim(),
          description: data.description?.trim() || data.actual_result.trim(),
          steps_to_reproduce: data.steps_to_reproduce.trim(),
          expected_result: data.expected_result.trim(),
          actual_result: data.actual_result.trim(),
          environment: data.environment?.trim() || null,
          severity: data.severity || BugSeverity.MEDIUM,
          status: BugReportStatus.PENDING_REVIEW,
        },
      });

      // Save each validated evidence file
      for (const item of validatedFiles) {
        const { storageKey, filename } = await StorageService.saveProjectFile(
          projectId,
          item.file.originalname,
          item.file.buffer
        );

        await tx.bugAttachment.create({
          data: {
            project_id: projectId,
            bug_report_id: complaint.id,
            uploaded_by: user.id,
            storage_key: storageKey,
            original_name: item.file.originalname,
            sanitized_name: filename,
            mime_type: item.sig.mime,
            file_size_bytes: item.file.buffer.length,
            checksum_sha256: item.sha256,
          },
        });
      }

      await tx.bugEvent.create({
        data: {
          bug_report_id: complaint.id,
          actor_id: user.id,
          action: 'COMPLAINT_SUBMITTED',
          to_status: BugReportStatus.PENDING_REVIEW,
          metadata: {
            title: complaint.title,
            severity: complaint.severity,
            assigned_qa_id: assignedQaIdToPersist,
            attachmentCount: validatedFiles.length,
          },
        },
      });

      return await tx.bugReport.findUnique({
        where: { id: complaint.id },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assigned_qa: { select: { id: true, name: true, email: true } },
          attachments: true,
          reviews: true,
        },
      });
    });
  }

  // ── LIST COMPLAINTS ────────────────────────────────────────────────────────
  public static async listComplaints(
    projectId: string,
    filters: { status?: BugReportStatus; severity?: BugSeverity; search?: string; assigned_qa_id?: string },
    user: any
  ) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const where: any = { project_id: projectId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.assigned_qa_id) {
      where.assigned_qa_id = filters.assigned_qa_id;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { steps_to_reproduce: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return await prisma.bugReport.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assigned_qa: { select: { id: true, name: true, email: true } },
        official_bug: { select: { id: true, bug_code: true, status: true, title: true } },
        attachments: true,
        reviews: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { reviewer: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // ── GET COMPLAINT DETAILS ──────────────────────────────────────────────────
  public static async getComplaintById(projectId: string, complaintId: string, user: any) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const complaint = await prisma.bugReport.findFirst({
      where: { id: complaintId, project_id: projectId },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        assigned_qa: { select: { id: true, name: true, email: true } },
        official_bug: {
          include: {
            current_assignee: { select: { id: true, name: true, email: true } },
          },
        },
        attachments: true,
        reviews: {
          orderBy: { created_at: 'desc' },
          include: {
            reviewer: { select: { id: true, name: true, email: true } },
            duplicate_of: { select: { id: true, bug_code: true, title: true, status: true } },
          },
        },
        comments: {
          orderBy: { created_at: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
        events: {
          orderBy: { created_at: 'asc' },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    return complaint;
  }

  // ── QA REVIEW WORKFLOW ─────────────────────────────────────────────────────
  public static async reviewComplaint(
    projectId: string,
    complaintId: string,
    reviewData: {
      outcome: BugReviewOutcome;
      notes: string;
      duplicate_of_id?: string;
      priority?: BugPriority;
    },
    user: any
  ) {
    const { projectRole, projectRoles, isSuperAdmin } = await this.verifyProjectAccess(projectId, user.id, user.role);

    // Only QA testers assigned to this project (or platform Super Admin) can make QA review decisions
    const canReview = isSuperAdmin || projectRoles.includes('QA_TESTER') || projectRole === 'QA_TESTER';

    if (!canReview) {
      throw new Error('Forbidden: Only QA testers assigned to this project can perform verification decisions');
    }

    const complaint = await prisma.bugReport.findFirst({
      where: { id: complaintId, project_id: projectId },
    });

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    if (complaint.status !== BugReportStatus.PENDING_REVIEW && complaint.status !== BugReportStatus.NEED_INFO) {
      throw new Error(`Cannot review complaint in status '${complaint.status}'`);
    }

    if (!reviewData.notes?.trim()) {
      throw new Error('Review notes are required for QA decisions');
    }

    return await prisma.$transaction(async (tx) => {
      let createdBug: any = null;
      let newReportStatus: BugReportStatus;

      switch (reviewData.outcome) {
        case BugReviewOutcome.VERIFIED: {
          newReportStatus = BugReportStatus.VERIFIED;
          const bugCode = await this.generateBugCode(projectId);

          createdBug = await tx.bug.create({
            data: {
              project_id: projectId,
              origin_report_id: complaint.id,
              bug_code: bugCode,
              title: complaint.title,
              description: complaint.description,
              status: BugStatus.OPEN,
              severity: complaint.severity,
              priority: reviewData.priority || BugPriority.MEDIUM,
              triage_notes: reviewData.notes.trim(),
            },
          });

          // Link complaint attachments to the new bug record as well
          await tx.bugAttachment.updateMany({
            where: { bug_report_id: complaint.id },
            data: { bug_id: createdBug.id },
          });
          break;
        }

        case BugReviewOutcome.INFO_REQUESTED:
          newReportStatus = BugReportStatus.NEED_INFO;
          break;

        case BugReviewOutcome.REJECTED:
          newReportStatus = BugReportStatus.REJECTED;
          break;

        case BugReviewOutcome.DUPLICATE: {
          if (!reviewData.duplicate_of_id) {
            throw new Error('Duplicate bug ID is required when marking complaint as duplicate');
          }
          const existingBug = await tx.bug.findFirst({
            where: { id: reviewData.duplicate_of_id, project_id: projectId },
          });
          if (!existingBug) {
            throw new Error('Target duplicate bug was not found in this project');
          }
          newReportStatus = BugReportStatus.DUPLICATE;
          break;
        }

        default:
          throw new Error('Invalid review outcome');
      }

      await tx.bugReport.update({
        where: { id: complaint.id },
        data: { status: newReportStatus },
      });

      const review = await tx.bugReview.create({
        data: {
          bug_report_id: complaint.id,
          reviewer_id: user.id,
          outcome: reviewData.outcome,
          notes: reviewData.notes.trim(),
          duplicate_of_id: reviewData.duplicate_of_id || null,
        },
      });

      await tx.bugEvent.create({
        data: {
          bug_report_id: complaint.id,
          bug_id: createdBug?.id || null,
          actor_id: user.id,
          action: `QA_REVIEW_${reviewData.outcome}`,
          from_status: complaint.status,
          to_status: newReportStatus,
          metadata: {
            notes: reviewData.notes,
            createdBugCode: createdBug?.bug_code,
          },
        },
      });

      return {
        review,
        complaint: await tx.bugReport.findUnique({
          where: { id: complaint.id },
          include: { official_bug: true, reviews: true },
        }),
        officialBug: createdBug,
      };
    });
  }

  // ── REPORTER RESPONSE TO INFO REQUEST ──────────────────────────────────────
  public static async respondToInfoRequest(
    projectId: string,
    complaintId: string,
    responseNote: string,
    user: any,
    files: FileUploadPayload[] = []
  ) {
    const { projectRole, projectRoles } = await this.verifyProjectAccess(projectId, user.id, user.role);

    const complaint = await prisma.bugReport.findFirst({
      where: { id: complaintId, project_id: projectId },
    });

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    const isReporter = complaint.reporter_id === user.id;
    const isUnassigned = (projectRoles.length === 0 || (projectRoles.length === 1 && projectRoles[0] === 'NOT_ASSIGNED')) && (!projectRole || projectRole === 'NOT_ASSIGNED');
    if (isUnassigned && !isReporter) {
      throw new Error('Forbidden: Members with Not Assigned role do not have bug-management privileges');
    }

    if (complaint.status !== BugReportStatus.NEED_INFO) {
      throw new Error('Complaint is not currently awaiting additional information');
    }

    if (!responseNote?.trim()) {
      throw new Error('Response text is required');
    }

    const validatedFiles = files.map((file) => {
      const sig = this.validateImageSignature(file.buffer);
      const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
      return { file, sig, sha256 };
    });

    return await prisma.$transaction(async (tx) => {
      await tx.bugReport.update({
        where: { id: complaint.id },
        data: { status: BugReportStatus.PENDING_REVIEW },
      });

      await tx.bugComment.create({
        data: {
          bug_report_id: complaint.id,
          author_id: user.id,
          content: `[Reporter Info Response]: ${responseNote.trim()}`,
        },
      });

      for (const item of validatedFiles) {
        const { storageKey, filename } = await StorageService.saveProjectFile(
          projectId,
          item.file.originalname,
          item.file.buffer
        );
        await tx.bugAttachment.create({
          data: {
            project_id: projectId,
            bug_report_id: complaint.id,
            uploaded_by: user.id,
            storage_key: storageKey,
            original_name: item.file.originalname,
            sanitized_name: filename,
            mime_type: item.sig.mime,
            file_size_bytes: item.file.buffer.length,
            checksum_sha256: item.sha256,
          },
        });
      }

      await tx.bugEvent.create({
        data: {
          bug_report_id: complaint.id,
          actor_id: user.id,
          action: 'INFO_RESPONSE_PROVIDED',
          from_status: BugReportStatus.NEED_INFO,
          to_status: BugReportStatus.PENDING_REVIEW,
          metadata: { note: responseNote.trim() },
        },
      });

      return await tx.bugReport.findUnique({
        where: { id: complaint.id },
        include: { comments: true, attachments: true, reviews: true },
      });
    });
  }

  // ── LIST OFFICIAL BUGS ─────────────────────────────────────────────────────
  public static async listBugs(
    projectId: string,
    filters: {
      status?: BugStatus;
      severity?: BugSeverity;
      priority?: BugPriority;
      assignee_id?: string;
      search?: string;
    },
    user: any
  ) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const where: any = { project_id: projectId };

    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignee_id) where.current_assignee_id = filters.assignee_id;
    if (filters.search) {
      where.OR = [
        { bug_code: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return await prisma.bug.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        current_assignee: { select: { id: true, name: true, email: true } },
        origin_report: {
          select: {
            id: true,
            reporter: { select: { id: true, name: true } },
            environment: true,
          },
        },
        retests: {
          orderBy: { attempt_number: 'desc' },
          take: 1,
          include: { retester: { select: { id: true, name: true } } },
        },
        attachments: true,
        _count: { select: { retests: true, comments: true, attachments: true } },
      },
    });
  }

  // ── GET BUG DETAILS ────────────────────────────────────────────────────────
  public static async getBugById(projectId: string, bugId: string, user: any) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const bug = await prisma.bug.findFirst({
      where: { id: bugId, project_id: projectId },
      include: {
        current_assignee: { select: { id: true, name: true, email: true } },
        origin_report: {
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            attachments: true,
          },
        },
        assignments: {
          orderBy: { assigned_at: 'desc' },
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            assigned_by: { select: { id: true, name: true } },
          },
        },
        retests: {
          orderBy: { attempt_number: 'desc' },
          include: {
            retester: { select: { id: true, name: true, email: true } },
            attachments: true,
          },
        },
        comments: {
          orderBy: { created_at: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
        attachments: true,
        events: {
          orderBy: { created_at: 'asc' },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });

    if (!bug) {
      throw new Error('Bug not found');
    }

    return bug;
  }

  // ── TRIAGE & ASSIGNMENT ────────────────────────────────────────────────────
  public static async triageAndAssignBug(
    projectId: string,
    bugId: string,
    data: {
      assignee_id?: string;
      severity?: BugSeverity;
      priority?: BugPriority;
      triage_notes?: string;
    },
    user: any
  ) {
    const { projectRole, projectRoles, isSuperAdmin, isOwner } = await this.verifyProjectAccess(projectId, user.id, user.role);

    const hasRole = (role: string) => projectRoles.includes(role) || projectRole === role;
    const canTriage =
      isSuperAdmin ||
      hasRole('TECH_LEAD') ||
      hasRole('MANAGER') ||
      (isOwner && !projectRoles.some((r) => ['DEVELOPER', 'QA_TESTER', 'EMPLOYEE', 'INTERN', 'BUSINESS_ANALYST', 'DEVOPS_ENGINEER', 'UI_UX_DESIGNER', 'NOT_ASSIGNED'].includes(r)));

    if (!canTriage) {
      throw new Error('Forbidden: Only Tech Leads, Project Managers, or Admins can perform technical triage and assignment');
    }

    const bug = await prisma.bug.findFirst({
      where: { id: bugId, project_id: projectId },
    });

    if (!bug) {
      throw new Error('Bug not found');
    }

    // If assigning, verify assignee is a project member and has an active assigned role
    if (data.assignee_id) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          project_id_user_id: {
            project_id: projectId,
            user_id: data.assignee_id,
          },
        },
      });
      if (!membership) {
        throw new Error('Selected assignee is not an active member of this project');
      }
      const assigneeRole = (membership.project_role || '').trim().toUpperCase();
      if (!assigneeRole || assigneeRole === 'NOT_ASSIGNED') {
        throw new Error('Selected assignee has Not Assigned role and cannot be assigned development defects');
      }
    }

    return await prisma.$transaction(async (tx) => {
      let targetStatus = bug.status;
      if (bug.status === BugStatus.OPEN) {
        targetStatus = data.assignee_id ? BugStatus.ASSIGNED : BugStatus.TRIAGED;
      } else if (bug.status === BugStatus.TRIAGED && data.assignee_id) {
        targetStatus = BugStatus.ASSIGNED;
      }

      const updated = await tx.bug.update({
        where: { id: bug.id },
        data: {
          current_assignee_id: data.assignee_id || bug.current_assignee_id,
          severity: data.severity || bug.severity,
          priority: data.priority || bug.priority,
          status: targetStatus,
          triage_notes: data.triage_notes?.trim() || bug.triage_notes,
        },
      });

      if (data.assignee_id) {
        await tx.bugAssignment.create({
          data: {
            bug_id: bug.id,
            assignee_id: data.assignee_id,
            assigned_by_id: user.id,
            notes: data.triage_notes?.trim() || null,
          },
        });
      }

      await tx.bugEvent.create({
        data: {
          bug_id: bug.id,
          actor_id: user.id,
          action: 'BUG_TRIAGED_AND_ASSIGNED',
          from_status: bug.status,
          to_status: targetStatus,
          metadata: {
            assignee_id: data.assignee_id,
            severity: data.severity,
            priority: data.priority,
            notes: data.triage_notes,
          },
        },
      });

      return updated;
    });
  }

  // ── CONTROLLED STATUS TRANSITIONS ──────────────────────────────────────────
  public static async transitionBugStatus(
    projectId: string,
    bugId: string,
    newStatus: BugStatus,
    reason: string = '',
    fixedInBuild?: string,
    user: any = {}
  ) {
    const { projectRole, projectRoles, isSuperAdmin, isOwner } = await this.verifyProjectAccess(projectId, user.id, user.role);

    const bug = await prisma.bug.findFirst({
      where: { id: bugId, project_id: projectId },
    });

    if (!bug) {
      throw new Error('Bug not found');
    }

    const current = bug.status;

    // Define valid transitions
    const validTransitions: Record<BugStatus, BugStatus[]> = {
      [BugStatus.OPEN]: [BugStatus.TRIAGED, BugStatus.ASSIGNED],
      [BugStatus.TRIAGED]: [BugStatus.ASSIGNED, BugStatus.IN_PROGRESS],
      [BugStatus.ASSIGNED]: [BugStatus.IN_PROGRESS, BugStatus.BLOCKED],
      [BugStatus.IN_PROGRESS]: [BugStatus.BLOCKED, BugStatus.FIXED, BugStatus.READY_FOR_RETEST],
      [BugStatus.BLOCKED]: [BugStatus.IN_PROGRESS, BugStatus.ASSIGNED],
      [BugStatus.FIXED]: [BugStatus.READY_FOR_RETEST, BugStatus.IN_PROGRESS],
      [BugStatus.READY_FOR_RETEST]: [BugStatus.CLOSED, BugStatus.REOPENED, BugStatus.IN_PROGRESS],
      [BugStatus.CLOSED]: [BugStatus.REOPENED],
      [BugStatus.REOPENED]: [BugStatus.IN_PROGRESS, BugStatus.ASSIGNED],
    };

    // Prevent direct status transition to CLOSED (must go through QA passing retest)
    if (newStatus === BugStatus.CLOSED) {
      throw new Error('Forbidden: Defects cannot be directly closed. Bugs can only be closed through an official passing QA retest');
    }

    if (!validTransitions[current]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from '${current}' to '${newStatus}'`);
    }

    // Role-specific development transition permissions
    const hasRole = (role: string) => projectRoles.includes(role) || projectRole === role;
    const canUpdateDevState =
      isSuperAdmin ||
      hasRole('TECH_LEAD') ||
      hasRole('DEVELOPER') ||
      hasRole('DEVOPS_ENGINEER') ||
      hasRole('UI_UX_DESIGNER') ||
      (hasRole('INTERN') && bug.current_assignee_id === user.id);

    if (
      ([BugStatus.IN_PROGRESS, BugStatus.BLOCKED, BugStatus.FIXED, BugStatus.READY_FOR_RETEST] as BugStatus[]).includes(newStatus) &&
      !canUpdateDevState
    ) {
      throw new Error(`Forbidden: Role '${projectRole}' is not permitted to modify bug development states`);
    }

    if (newStatus === BugStatus.REOPENED) {
      const canReopen = isSuperAdmin || hasRole('QA_TESTER') || hasRole('TECH_LEAD');
      if (!canReopen) {
        throw new Error('Forbidden: Only QA testers or Tech Leads can reopen defects');
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: newStatus,
      };

      if (fixedInBuild?.trim()) {
        updateData.fixed_in_build = fixedInBuild.trim();
      }

      const updated = await tx.bug.update({
        where: { id: bug.id },
        data: updateData,
      });

      await tx.bugEvent.create({
        data: {
          bug_id: bug.id,
          actor_id: user.id,
          action: `STATUS_TRANSITION_TO_${newStatus}`,
          from_status: current,
          to_status: newStatus,
          metadata: { reason: reason?.trim() || null, fixedInBuild },
        },
      });

      return updated;
    });
  }

  // ── QA RETESTING WORKFLOW ──────────────────────────────────────────────────
  public static async recordRetest(
    projectId: string,
    bugId: string,
    retestData: {
      tested_build: string;
      result: BugRetestResult;
      notes: string;
    },
    user: any,
    files: FileUploadPayload[] = []
  ) {
    const { projectRole, projectRoles, isSuperAdmin } = await this.verifyProjectAccess(projectId, user.id, user.role);

    const canRetest = isSuperAdmin || projectRoles.includes('QA_TESTER') || projectRole === 'QA_TESTER';

    if (!canRetest) {
      throw new Error('Forbidden: Only QA testers assigned to this project can record official retest results');
    }

    const bug = await prisma.bug.findFirst({
      where: { id: bugId, project_id: projectId },
    });

    if (!bug) {
      throw new Error('Bug not found');
    }

    if (bug.status !== BugStatus.READY_FOR_RETEST && bug.status !== BugStatus.FIXED) {
      throw new Error(`Bug must be in 'READY_FOR_RETEST' state to record a retest. Current status: '${bug.status}'`);
    }

    if (!retestData.tested_build?.trim()) {
      throw new Error('Tested build / version is mandatory for QA retest records');
    }
    if (!retestData.notes?.trim()) {
      throw new Error('Retest observations and notes are required');
    }

    const validatedFiles = files.map((file) => {
      const sig = this.validateImageSignature(file.buffer);
      const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
      return { file, sig, sha256 };
    });

    return await prisma.$transaction(async (tx) => {
      const priorRetestCount = await tx.bugRetest.count({ where: { bug_id: bug.id } });
      const attemptNumber = priorRetestCount + 1;

      const isPass = retestData.result === BugRetestResult.PASS;
      const targetBugStatus = isPass ? BugStatus.CLOSED : BugStatus.REOPENED;

      const retest = await tx.bugRetest.create({
        data: {
          bug_id: bug.id,
          retester_id: user.id,
          attempt_number: attemptNumber,
          tested_build: retestData.tested_build.trim(),
          result: retestData.result,
          notes: retestData.notes.trim(),
          status_before: bug.status,
          status_after: targetBugStatus,
        },
      });

      // Save retest screenshot evidence
      for (const item of validatedFiles) {
        const { storageKey, filename } = await StorageService.saveProjectFile(
          projectId,
          item.file.originalname,
          item.file.buffer
        );
        await tx.bugAttachment.create({
          data: {
            project_id: projectId,
            bug_id: bug.id,
            retest_id: retest.id,
            uploaded_by: user.id,
            storage_key: storageKey,
            original_name: item.file.originalname,
            sanitized_name: filename,
            mime_type: item.sig.mime,
            file_size_bytes: item.file.buffer.length,
            checksum_sha256: item.sha256,
          },
        });
      }

      await tx.bug.update({
        where: { id: bug.id },
        data: {
          status: targetBugStatus,
          closed_at: isPass ? new Date() : null,
        },
      });

      await tx.bugEvent.create({
        data: {
          bug_id: bug.id,
          actor_id: user.id,
          action: `RETEST_ATTEMPT_${attemptNumber}_${retestData.result}`,
          from_status: bug.status,
          to_status: targetBugStatus,
          metadata: {
            attemptNumber,
            testedBuild: retestData.tested_build,
            result: retestData.result,
            notes: retestData.notes,
          },
        },
      });

      return await tx.bugRetest.findUnique({
        where: { id: retest.id },
        include: {
          retester: { select: { id: true, name: true, email: true } },
          attachments: true,
        },
      });
    });
  }

  // ── ADD COMMENT ────────────────────────────────────────────────────────────
  public static async addComment(
    projectId: string,
    target: { bug_id?: string; bug_report_id?: string },
    content: string,
    user: any
  ) {
    const { projectRole, projectRoles } = await this.verifyProjectAccess(projectId, user.id, user.role);

    const isUnassigned =
      (projectRoles.length === 0 || (projectRoles.length === 1 && projectRoles[0] === 'NOT_ASSIGNED')) &&
      (!projectRole || projectRole === 'NOT_ASSIGNED');
    if (isUnassigned) {
      throw new Error('Forbidden: Members with Not Assigned role do not have bug-management privileges');
    }

    if (!content?.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (!target.bug_id && !target.bug_report_id) {
      throw new Error('Target bug or complaint ID is required');
    }

    return await prisma.bugComment.create({
      data: {
        bug_id: target.bug_id || null,
        bug_report_id: target.bug_report_id || null,
        author_id: user.id,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  // ── EVIDENCE RETRIEVAL ─────────────────────────────────────────────────────
  public static async getEvidenceFile(projectId: string, attachmentId: string, user: any) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const attachment = await prisma.bugAttachment.findFirst({
      where: { id: attachmentId, project_id: projectId },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    const filePath = StorageService.getFilePath(attachment.storage_key, true);

    return {
      attachment,
      filePath,
      mimeType: attachment.mime_type,
      filename: attachment.original_name,
    };
  }

  // ── DASHBOARD ANALYTICS ────────────────────────────────────────────────────
  public static async getBugAnalytics(projectId: string, user: any) {
    await this.verifyProjectAccess(projectId, user.id, user.role);

    const [
      totalBugs,
      openBugs,
      inProgressBugs,
      readyRetestBugs,
      closedBugs,
      pendingComplaints,
      allRetests,
      bugsBySeverity,
    ] = await Promise.all([
      prisma.bug.count({ where: { project_id: projectId } }),
      prisma.bug.count({ where: { project_id: projectId, status: BugStatus.OPEN } }),
      prisma.bug.count({ where: { project_id: projectId, status: BugStatus.IN_PROGRESS } }),
      prisma.bug.count({ where: { project_id: projectId, status: BugStatus.READY_FOR_RETEST } }),
      prisma.bug.count({ where: { project_id: projectId, status: BugStatus.CLOSED } }),
      prisma.bugReport.count({ where: { project_id: projectId, status: BugReportStatus.PENDING_REVIEW } }),
      prisma.bugRetest.findMany({
        where: { bug: { project_id: projectId } },
        select: { result: true },
      }),
      prisma.bug.groupBy({
        by: ['severity'],
        where: { project_id: projectId },
        _count: { severity: true },
      }),
    ]);

    const totalRetests = allRetests.length;
    const passedRetests = allRetests.filter((r) => r.result === BugRetestResult.PASS).length;
    const passRate = totalRetests > 0 ? Math.round((passedRetests / totalRetests) * 100) : 100;

    return {
      totalBugs,
      openBugs,
      inProgressBugs,
      readyRetestBugs,
      closedBugs,
      pendingComplaints,
      totalRetests,
      passRate,
      bugsBySeverity: bugsBySeverity.reduce((acc, curr) => {
        acc[curr.severity] = curr._count.severity;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
