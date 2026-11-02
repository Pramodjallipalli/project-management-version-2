import { Router } from 'express';
import multer from 'multer';
import { BugController } from '../controllers/bug.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

// All bug routes require user authentication
router.use(authenticate);

// ── Metrics & Dashboard ───────────────────────────────────────────────────────
router.get('/analytics', BugController.getAnalytics);

// ── QA Tester Directory ───────────────────────────────────────────────────
router.get('/qa-testers', BugController.getEligibleQaTesters);

// ── Complaints (Intake & QA Verification) ─────────────────────────────────────
router.get('/complaints', BugController.listComplaints);
router.post('/complaints', upload.array('evidence', 5), BugController.createComplaint);
router.get('/complaints/:complaintId', BugController.getComplaintById);
router.post('/complaints/:complaintId/review', BugController.reviewComplaint);
router.post('/complaints/:complaintId/respond', upload.array('evidence', 5), BugController.respondToInfoRequest);

// ── Official Bugs (Triage, State Machine, Retesting) ─────────────────────────
router.get('/', BugController.listBugs);
router.get('/:bugId', BugController.getBugById);
router.patch('/:bugId/triage', BugController.triageAndAssign);
router.post('/:bugId/transition', BugController.transitionStatus);
router.patch('/:bugId/status', BugController.transitionStatus);
router.post('/:bugId/status', BugController.transitionStatus);
router.post('/:bugId/retest', upload.array('evidence', 5), BugController.recordRetest);
router.post('/:bugId/retests', upload.array('evidence', 5), BugController.recordRetest);

// ── Threaded Discussion Comments ──────────────────────────────────────────────
router.post('/comments', BugController.addComment);
router.post('/:bugId/comments', (req, res, next) => {
  req.body.bug_id = req.params.bugId;
  BugController.addComment(req, res);
});

// ── Evidence Preview & Download ───────────────────────────────────────────────
router.get('/evidence/:attachmentId/preview', BugController.getEvidenceFile);
router.get('/evidence/:attachmentId/download', (req, res, next) => {
  req.query.download = 'true';
  BugController.getEvidenceFile(req, res);
});

export { router as bugRouter };
