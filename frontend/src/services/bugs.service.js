import api from './api';

export const bugsService = {
  // ── QA TESTERS ────────────────────────────────────────────────────────────
  async getEligibleQaTesters(projectId) {
    const res = await api.get(`/projects/${projectId}/bugs/qa-testers`);
    return res.qa_testers || [];
  },

  // ── COMPLAINTS (INTAKE & QA REVIEW) ────────────────────────────────────────
  async createComplaint(projectId, formData) {
    // If formData is FormData (for multipart screenshot uploads)
    if (formData instanceof FormData) {
      return api.upload(`/projects/${projectId}/bugs/complaints`, formData);
    }
    return api.post(`/projects/${projectId}/bugs/complaints`, formData);
  },

  async listComplaints(projectId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
    if (filters.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/projects/${projectId}/bugs/complaints${query}`);
    return res.complaints || [];
  },

  async getComplaintById(projectId, complaintId) {
    const res = await api.get(`/projects/${projectId}/bugs/complaints/${complaintId}`);
    return res.complaint;
  },

  async reviewComplaint(projectId, complaintId, reviewData) {
    return api.post(`/projects/${projectId}/bugs/complaints/${complaintId}/review`, reviewData);
  },

  async respondToInfoRequest(projectId, complaintId, data) {
    if (data instanceof FormData) {
      return api.upload(`/projects/${projectId}/bugs/complaints/${complaintId}/respond`, data);
    }
    return api.post(`/projects/${projectId}/bugs/complaints/${complaintId}/respond`, data);
  },

  // ── OFFICIAL BUGS (TRIAGE, STATE MACHINE, RETESTS) ─────────────────────────
  async listBugs(projectId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
    if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
    if (filters.assignee_id) params.append('assignee_id', filters.assignee_id);
    if (filters.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/projects/${projectId}/bugs${query}`);
    return res.bugs || [];
  },

  async getBugById(projectId, bugId) {
    const res = await api.get(`/projects/${projectId}/bugs/${bugId}`);
    return res.bug;
  },

  async triageAndAssign(projectId, bugId, triageData) {
    return api.patch(`/projects/${projectId}/bugs/${bugId}/triage`, triageData);
  },

  async transitionStatus(projectId, bugId, { status, reason, fixed_in_build }) {
    return api.post(`/projects/${projectId}/bugs/${bugId}/transition`, {
      status,
      reason,
      fixed_in_build,
    });
  },

  // ── QA RETESTING ───────────────────────────────────────────────────────────
  async recordRetest(projectId, bugId, retestPayload) {
    if (retestPayload instanceof FormData) {
      return api.upload(`/projects/${projectId}/bugs/${bugId}/retests`, retestPayload);
    }
    return api.post(`/projects/${projectId}/bugs/${bugId}/retests`, retestPayload);
  },

  // ── COMMENTS ───────────────────────────────────────────────────────────────
  async addComment(projectId, bugId, content) {
    return api.post(`/projects/${projectId}/bugs/${bugId}/comments`, { content });
  },

  async addComplaintComment(projectId, complaintId, content) {
    return api.post(`/projects/${projectId}/bugs/comments`, {
      bug_report_id: complaintId,
      content,
    });
  },

  // ── EVIDENCE STREAMING & DOWNLOAD ──────────────────────────────────────────
  getEvidencePreviewUrl(projectId, attachmentId) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `/api/projects/${projectId}/bugs/evidence/${attachmentId}/preview${tokenParam}`;
  },

  getEvidenceDownloadUrl(projectId, attachmentId) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const tokenParam = token ? `?download=true&token=${encodeURIComponent(token)}` : '?download=true';
    return `/api/projects/${projectId}/bugs/evidence/${attachmentId}/preview${tokenParam}`;
  },

  async downloadEvidence(projectId, attachmentId, originalName = 'evidence.png') {
    return api.downloadFile(`/projects/${projectId}/bugs/evidence/${attachmentId}/download`, originalName);
  },

  // ── DASHBOARD & METRICS ────────────────────────────────────────────────────
  async getAnalytics(projectId) {
    const res = await api.get(`/projects/${projectId}/bugs/analytics`);
    return res.analytics || {
      totalBugs: 0,
      openBugs: 0,
      inProgressBugs: 0,
      readyRetestBugs: 0,
      closedBugs: 0,
      pendingComplaints: 0,
      totalRetests: 0,
      passRate: 100,
      bugsBySeverity: {},
    };
  },
};

export default bugsService;
