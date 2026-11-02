import { Request, Response } from 'express';
import { BugService, FileUploadPayload } from '../services/bug.service';

export class BugController {
  private static handleError(res: Response, error: any) {
    const msg = error?.message || 'Internal server error';

    if (
      msg.includes('not found') ||
      msg === 'Complaint not found' ||
      msg === 'Bug not found' ||
      msg === 'Project not found' ||
      msg === 'Attachment not found'
    ) {
      res.status(404).json({ error: msg });
      return;
    }

    if (
      msg.includes('required') ||
      msg.includes('mandatory') ||
      msg.includes('Invalid') ||
      msg.includes('Cannot review') ||
      msg.includes('limit') ||
      msg.includes('Maximum') ||
      msg.includes('exceeds') ||
      msg.includes('Unsupported image format') ||
      msg.includes('Must be in') ||
      msg.includes('not currently awaiting') ||
      msg.includes('Please select') ||
      msg.includes('eligible QA tester')
    ) {
      res.status(400).json({ error: msg });
      return;
    }

    if (msg.includes('Forbidden') || msg.includes('permission') || msg.includes('Only authorized') || msg.includes('Only QA')) {
      res.status(403).json({ error: msg });
      return;
    }

    res.status(500).json({ error: msg });
  }

  private static extractFiles(req: Request): FileUploadPayload[] {
    const files: FileUploadPayload[] = [];
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        files.push({
          originalname: f.originalname,
          buffer: f.buffer,
          mimetype: f.mimetype,
          size: f.size,
        });
      }
    } else if (req.file) {
      files.push({
        originalname: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }
    return files;
  }

  // ── COMPLAINT ENDPOINTS ────────────────────────────────────────────────────
  public static async createComplaint(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const projectId = req.params.projectId || req.body.project_id;
      const files = BugController.extractFiles(req);

      const complaint = await BugService.createComplaint(projectId, req.body, user, files);
      res.status(201).json({ success: true, complaint });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async getEligibleQaTesters(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const projectId = req.params.projectId;

      const testers = await BugService.getEligibleQaTesters(projectId, user);
      res.status(200).json({ success: true, qa_testers: testers, qaTesters: testers, count: testers.length });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async listComplaints(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const projectId = req.params.projectId;
      const { status, severity, search, assigned_qa_id } = req.query as any;

      const complaints = await BugService.listComplaints(projectId, { status, severity, search, assigned_qa_id }, user);
      res.status(200).json({ success: true, complaints, count: complaints.length });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async getComplaintById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, complaintId } = req.params;

      const complaint = await BugService.getComplaintById(projectId, complaintId, user);
      res.status(200).json({ success: true, complaint });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async reviewComplaint(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, complaintId } = req.params;

      const result = await BugService.reviewComplaint(projectId, complaintId, req.body, user);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async respondToInfoRequest(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, complaintId } = req.params;
      const files = BugController.extractFiles(req);
      const { responseNote } = req.body;

      const complaint = await BugService.respondToInfoRequest(projectId, complaintId, responseNote, user, files);
      res.status(200).json({ success: true, complaint });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  // ── OFFICIAL BUG ENDPOINTS ─────────────────────────────────────────────────
  public static async listBugs(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const projectId = req.params.projectId;
      const { status, severity, priority, assignee_id, search } = req.query as any;

      const bugs = await BugService.listBugs(
        projectId,
        { status, severity, priority, assignee_id, search },
        user
      );
      res.status(200).json({ success: true, bugs, count: bugs.length });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async getBugById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, bugId } = req.params;

      const bug = await BugService.getBugById(projectId, bugId, user);
      res.status(200).json({ success: true, bug });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async triageAndAssign(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, bugId } = req.params;

      const bug = await BugService.triageAndAssignBug(projectId, bugId, req.body, user);
      res.status(200).json({ success: true, bug });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async transitionStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, bugId } = req.params;
      const { status, reason, fixed_in_build } = req.body;

      const bug = await BugService.transitionBugStatus(projectId, bugId, status, reason, fixed_in_build, user);
      res.status(200).json({ success: true, bug });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  // ── QA RETESTING ENDPOINT ──────────────────────────────────────────────────
  public static async recordRetest(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, bugId } = req.params;
      const files = BugController.extractFiles(req);

      const retest = await BugService.recordRetest(projectId, bugId, req.body, user, files);
      res.status(201).json({ success: true, retest });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  // ── COMMENTS & EVIDENCE ────────────────────────────────────────────────────
  public static async addComment(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId } = req.params;
      const { bug_id, bug_report_id, content } = req.body;

      const comment = await BugService.addComment(projectId, { bug_id, bug_report_id }, content, user);
      res.status(201).json({ success: true, comment });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async getEvidenceFile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId, attachmentId } = req.params;
      const isDownload = req.query.download === 'true';

      const fileData = await BugService.getEvidenceFile(projectId, attachmentId, user);
      res.setHeader('Content-Type', fileData.mimeType);

      const disposition = isDownload ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileData.filename)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      res.sendFile(fileData.filePath);
    } catch (err) {
      BugController.handleError(res, err);
    }
  }

  public static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).fullUser || (req as any).user;
      const { projectId } = req.params;

      const analytics = await BugService.getBugAnalytics(projectId, user);
      res.status(200).json({ success: true, analytics });
    } catch (err) {
      BugController.handleError(res, err);
    }
  }
}
