import React, { useState, useEffect, useMemo } from 'react';
import {
  Bug,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  FileText,
  UserCheck,
  Flame,
  ArrowRight,
  Eye,
  Loader2,
  User,
  HelpCircle,
  XCircle,
  Copy,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { bugsService } from '../../../services/bugs.service';
import CreateComplaintModal from './bugs/CreateComplaintModal';
import QaReviewModal from './bugs/QaReviewModal';
import BugDetailModal from './bugs/BugDetailModal';

export default function ProjectBugsTab({
  projectId,
  projectName = '',
  project = null,
  onToast,
  readOnly = false,
}) {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id || authUser?.user_id;
  const authRole = String(
    authUser?.role?.name || authUser?.role || authUser?.type || authUser?.user_type || ''
  ).toUpperCase();

  const isSuperAdmin = authRole === 'SUPER_ADMIN';

  const isOwner = useMemo(() => {
    if (!project || !currentUserId) return false;
    if (project.owner_id === currentUserId) return true;
    if (Array.isArray(project.owners) && project.owners.some((o) => (o.user_id || o.id) === currentUserId)) return true;
    if (Array.isArray(project.owner_ids) && project.owner_ids.includes(currentUserId)) return true;
    return false;
  }, [project, currentUserId]);

  const currentMember = useMemo(() => {
    return (project?.members || []).find(
      (m) => (m.user_id || m.id) === currentUserId || (m.user?.id || m.user?.user_id) === currentUserId
    );
  }, [project, currentUserId]);

  // Project-scoped role (never leak fixed demo roles or global roles)
  const projectRole = useMemo(() => {
    const rawRole = String(currentMember?.project_role || '').trim().toUpperCase();
    if (rawRole && rawRole !== 'NOT_ASSIGNED') return rawRole;
    if (isOwner) return 'OWNER';
    if (isSuperAdmin) return 'SUPER_ADMIN';
    return 'NOT_ASSIGNED';
  }, [currentMember, isOwner, isSuperAdmin]);

  const isQA = projectRole === 'QA_TESTER' || isSuperAdmin;
  const isTechLead = projectRole === 'TECH_LEAD' || isSuperAdmin;
  const isManager =
    projectRole === 'MANAGER' ||
    (isOwner && !['DEVELOPER', 'QA_TESTER', 'EMPLOYEE', 'INTERN', 'BUSINESS_ANALYST', 'DEVOPS_ENGINEER', 'UI_UX_DESIGNER', 'NOT_ASSIGNED'].includes(projectRole)) ||
    isSuperAdmin;
  const isIntern = projectRole === 'INTERN';
  const isEmployee = projectRole === 'EMPLOYEE';
  const isNotAssigned = projectRole === 'NOT_ASSIGNED';

  const canReportDefect = Boolean(authUser);

  const [activeSubView, setActiveSubView] = useState('all'); // 'all' | 'complaints' | 'assigned' | 'retest'
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [analytics, setAnalytics] = useState({
    totalBugs: 0,
    openBugs: 0,
    inProgressBugs: 0,
    readyRetestBugs: 0,
    closedBugs: 0,
    pendingComplaints: 0,
    totalRetests: 0,
    passRate: 100,
    bugsBySeverity: {},
  });

  const [bugs, setBugs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewingComplaint, setReviewingComplaint] = useState(null);
  const [selectedBugId, setSelectedBugId] = useState(null);

  // Load project members for assignment dropdowns
  const projectMembers = useMemo(() => {
    return project?.members || [];
  }, [project]);

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [analyticsData, bugsData, complaintsData] = await Promise.all([
        bugsService.getAnalytics(projectId).catch(() => null),
        bugsService.listBugs(projectId).catch(() => []),
        bugsService.listComplaints(projectId).catch(() => []),
      ]);

      if (analyticsData) {
        setAnalytics(analyticsData);
      }
      setBugs(bugsData || []);
      setComplaints(complaintsData || []);
    } catch (err) {
      console.warn('Could not load bugs data (isolated dev mode):', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Filtered bugs according to subview and selectors
  const displayedBugs = useMemo(() => {
    let list = [...bugs];

    if (activeSubView === 'assigned') {
      list = list.filter((b) => b.current_assignee_id === currentUserId);
    } else if (activeSubView === 'retest') {
      list = list.filter((b) => b.status === 'READY_FOR_RETEST');
    }

    if (severityFilter !== 'ALL') {
      list = list.filter((b) => b.severity === severityFilter);
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.bug_code?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bugs, activeSubView, severityFilter, statusFilter, searchQuery, currentUserId]);

  // Filtered complaints for QA Intake Queue
  const displayedComplaints = useMemo(() => {
    let list = [...complaints];
    if (severityFilter !== 'ALL') {
      list = list.filter((c) => c.severity === severityFilter);
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.steps_to_reproduce?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [complaints, severityFilter, statusFilter, searchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">OPEN</span>;
      case 'TRIAGED':
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{status}</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">IN PROGRESS</span>;
      case 'BLOCKED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">BLOCKED</span>;
      case 'FIXED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">FIXED</span>;
      case 'READY_FOR_RETEST':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">READY FOR RETEST</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CLOSED (PASSED)</span>;
      case 'REOPENED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">REOPENED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-100 text-yellow-800">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">LOW</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER SUMMARY BANNER ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Bug Management & QA Retest Portal
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  DAILOQA
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Project-scoped defect intake, QA verification, technical triage, controlled fix workflow, and retesting verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Refresh defect data"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canReportDefect && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Report Defect</span>
              </button>
            )}
          </div>
        </div>

        {isNotAssigned && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 text-xs">
            <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Project Role Not Assigned:</strong> You are currently listed in this project without an assigned role. You can report defects, but defect triage, assignment, development-state updates, and QA retesting require an authorized role assigned via the Project Overview &gt; Team Roles panel.
            </div>
          </div>
        )}

        {/* ── KPI METRICS CARDS ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Defects</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{analytics.totalBugs || bugs.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across project</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100/80">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending QA</span>
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              {analytics.pendingComplaints || complaints.filter((c) => c.status === 'PENDING_REVIEW').length}
            </div>
            <div className="text-[11px] text-amber-700/80 mt-0.5">Awaiting verification</div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100/80">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-blue-600" />
              <span>In Dev</span>
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {analytics.inProgressBugs || bugs.filter((b) => b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED').length}
            </div>
            <div className="text-[11px] text-blue-700/80 mt-0.5">Assigned to engineers</div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100/80">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
              <span>Ready for Retest</span>
            </div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {analytics.readyRetestBugs || bugs.filter((b) => b.status === 'READY_FOR_RETEST').length}
            </div>
            <div className="text-[11px] text-purple-700/80 mt-0.5">Fix submitted by dev</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100/80 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Closed (Passed)</span>
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">
              {analytics.closedBugs || bugs.filter((b) => b.status === 'CLOSED').length}
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-0.5">Verified & resolved</div>
          </div>
        </div>
      </div>

      {/* ── FILTER & NAVIGATION BAR ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Sub-view Switcher */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: `All Bugs (${bugs.length})` },
            { id: 'complaints', label: `QA Intake Queue (${complaints.length})` },
            { id: 'assigned', label: 'My Assigned' },
            { id: 'retest', label: `Retest Queue (${bugs.filter((b) => b.status === 'READY_FOR_RETEST').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubView(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSubView === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search bugs or complaints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <option value="ALL">All Statuses</option>
            {activeSubView === 'complaints' ? (
              <>
                <option value="PENDING_REVIEW">Pending QA Review</option>
                <option value="NEED_INFO">Need More Info</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="DUPLICATE">Duplicate</option>
              </>
            ) : (
              <>
                <option value="OPEN">Open (Verified)</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="FIXED">Fixed</option>
                <option value="READY_FOR_RETEST">Ready for Retest</option>
                <option value="CLOSED">Closed (Passed)</option>
                <option value="REOPENED">Reopened</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* ── LIST VIEWS ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading project defect records...</p>
        </div>
      ) : activeSubView === 'complaints' ? (
        /* QA INTAKE QUEUE VIEW */
        displayedComplaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs text-center max-w-xl mx-auto my-6">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">QA Intake Queue is Clear</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
              No defect complaints awaiting verification. New reports submitted by team members will appear here.
            </p>
            {canReportDefect && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Complaint</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {displayedComplaints.map((c) => (
                <div
                  key={c.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      {getSeverityBadge(c.severity)}
                      {c.assigned_qa && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <span>QA:</span>
                          <strong>{c.assigned_qa.name || c.assigned_qa.email}</strong>
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Reported by <strong>{c.reporter?.name || c.reporter?.email}</strong> &bull;{' '}
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 truncate">{c.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{c.actual_result || c.description}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {c.attachments && c.attachments.length > 0 && (
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-lg">
                        {c.attachments.length} image{c.attachments.length > 1 ? 's' : ''}
                      </span>
                    )}

                    {isQA && (c.status === 'PENDING_REVIEW' || c.status === 'NEED_INFO') ? (
                      <button
                        onClick={() => setReviewingComplaint(c)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Verify / Review
                      </button>
                    ) : (
                      <button
                        onClick={() => setReviewingComplaint(c)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        View Review
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* OFFICIAL BUGS VIEW (All, Assigned, Retest Queue) */
        displayedBugs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs text-center max-w-xl mx-auto my-6">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Bug className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {activeSubView === 'retest'
                ? 'Retest Queue is Empty'
                : activeSubView === 'assigned'
                ? 'No Bugs Assigned to You'
                : 'No Defects Found'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
              {activeSubView === 'retest'
                ? 'When engineers mark defects as fixed, they will enter the Retest Queue for verification.'
                : activeSubView === 'assigned'
                ? 'Defects assigned to you during technical triage will appear in this workspace.'
                : 'Reported defects verified by QA will appear as official bugs here.'}
            </p>
            {canReportDefect && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Report Defect</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {displayedBugs.map((bug) => (
                <div
                  key={bug.id}
                  onClick={() => setSelectedBugId(bug.id)}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {bug.bug_code}
                      </span>
                      {getStatusBadge(bug.status)}
                      {getSeverityBadge(bug.severity)}
                      <span className="text-[11px] text-slate-400">
                        Priority: <strong className="text-slate-700">{bug.priority}</strong>
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 truncate hover:text-rose-600 transition-colors">
                      {bug.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{bug.description}</p>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center shrink-0 text-xs">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Assignee</div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1 justify-end">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{bug.current_assignee?.name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBugId(bug.id);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {/* 1. Complaint Intake Modal */}
      <CreateComplaintModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        onCreated={() => loadData()}
        onToast={onToast}
      />

      {/* 2. QA Review Modal */}
      <QaReviewModal
        isOpen={Boolean(reviewingComplaint)}
        onClose={() => setReviewingComplaint(null)}
        projectId={projectId}
        complaint={reviewingComplaint}
        isQA={isQA}
        onReviewed={() => loadData()}
        onToast={onToast}
      />

      {/* 3. Bug Details & Retest Modal */}
      <BugDetailModal
        isOpen={Boolean(selectedBugId)}
        onClose={() => setSelectedBugId(null)}
        projectId={projectId}
        bugId={selectedBugId}
        projectMembers={projectMembers}
        currentUserRole={projectRole}
        isQA={isQA}
        isTechLead={isTechLead}
        isManager={isManager}
        isOwner={isOwner}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUserId}
        onUpdated={() => loadData()}
        onToast={onToast}
      />
    </div>
  );
}
