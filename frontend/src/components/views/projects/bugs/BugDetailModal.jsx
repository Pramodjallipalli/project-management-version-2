import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  RefreshCw,
  Send,
  User,
  Shield,
  Layers,
  ArrowRight,
  Loader2,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  CheckSquare,
  XCircle,
  Download,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { bugsService } from '../../../../services/bugs.service';
import { PROJECT_ROLE_LABELS } from '../../../modals/AssignProjectRolesModal';
import RetestModal from './RetestModal';

export default function BugDetailModal({
  isOpen,
  onClose,
  projectId,
  bugId,
  projectMembers = [],
  currentUserRole = 'MEMBER',
  isQA = false,
  isTechLead = false,
  isManager = false,
  isOwner = false,
  isSuperAdmin = false,
  currentUserId = null,
  onUpdated,
  onToast,
}) {
  const [bug, setBug] = useState(null);
  const canTriage =
    isTechLead ||
    isManager ||
    (isOwner && !['DEVELOPER', 'QA_TESTER', 'EMPLOYEE', 'INTERN', 'BUSINESS_ANALYST', 'DEVOPS_ENGINEER', 'UI_UX_DESIGNER', 'NOT_ASSIGNED'].includes(currentUserRole)) ||
    isSuperAdmin;
  const canRetest = isQA || isSuperAdmin;
  const isAssignedToMe = currentUserId && bug?.current_assignee_id === currentUserId;
  const canUpdateDevState =
    isSuperAdmin ||
    currentUserRole === 'TECH_LEAD' ||
    currentUserRole === 'DEVELOPER' ||
    currentUserRole === 'DEVOPS_ENGINEER' ||
    currentUserRole === 'UI_UX_DESIGNER' ||
    (currentUserRole === 'INTERN' && isAssignedToMe);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [isRetestModalOpen, setIsRetestModalOpen] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null); // { url, name, downloadUrl, size }
  const [brokenImages, setBrokenImages] = useState({});

  // Triage edit state
  const [isEditingTriage, setIsEditingTriage] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('MEDIUM');
  const [triageNotes, setTriageNotes] = useState('');
  const [savingTriage, setSavingTriage] = useState(false);

  const fetchBug = async () => {
    if (!bugId || !projectId) return;
    try {
      setLoading(true);
      const data = await bugsService.getBugById(projectId, bugId);
      setBug(data);
      setSelectedAssignee(data.current_assignee_id || '');
      setSelectedPriority(data.priority || 'MEDIUM');
      setTriageNotes(data.triage_notes || '');
    } catch (err) {
      console.error('Failed to load bug details:', err);
      onToast?.({ title: 'Error', message: 'Failed to load defect details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bugId) {
      fetchBug();
    }
  }, [isOpen, bugId]);

  if (!isOpen) return null;

  const handleTransition = async (newStatus, reason = '') => {
    try {
      setTransitioning(true);
      await bugsService.transitionStatus(projectId, bug.id, { status: newStatus, reason });
      onToast?.({
        title: 'Status Updated',
        message: `Defect status transitioned to ${newStatus}.`,
        type: 'success',
      });
      await fetchBug();
      onUpdated?.();
    } catch (err) {
      onToast?.({ title: 'Transition Failed', message: err.message, type: 'error' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleSaveTriage = async () => {
    try {
      setSavingTriage(true);
      await bugsService.triageAndAssign(projectId, bug.id, {
        assignee_id: selectedAssignee || undefined,
        priority: selectedPriority,
        triage_notes: triageNotes,
      });
      onToast?.({ title: 'Triage Saved', message: 'Defect assignment updated.', type: 'success' });
      setIsEditingTriage(false);
      await fetchBug();
      onUpdated?.();
    } catch (err) {
      onToast?.({ title: 'Triage Failed', message: err.message, type: 'error' });
    } finally {
      setSavingTriage(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await bugsService.addComment(projectId, bug.id, commentText.trim());
      setCommentText('');
      await fetchBug();
    } catch (err) {
      onToast?.({ title: 'Failed to add comment', message: err.message, type: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">OPEN</span>;
      case 'TRIAGED':
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">{status}</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">IN PROGRESS</span>;
      case 'BLOCKED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">BLOCKED</span>;
      case 'FIXED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">FIXED</span>;
      case 'READY_FOR_RETEST':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">READY FOR RETEST</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CLOSED (PASSED)</span>;
      case 'REOPENED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">REOPENED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {loading || !bug ? (
          <div className="p-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading defect details and retest history...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                    {bug.bug_code}
                  </span>
                  {getStatusBadge(bug.status)}
                  {getSeverityBadge(bug.severity)}
                  <span className="text-xs font-semibold text-slate-500">Priority: {bug.priority}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{bug.title}</h3>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workflow Action Bar */}
            <div className="px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span>Current Phase:</span>
                <strong className="text-white font-bold">{bug.status.replace(/_/g, ' ')}</strong>
              </div>

              {/* Transition Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {bug.status === 'OPEN' && canTriage && (
                  <button
                    onClick={() => setIsEditingTriage(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Triage & Assign
                  </button>
                )}

                {(bug.status === 'ASSIGNED' || bug.status === 'TRIAGED' || bug.status === 'REOPENED') && canUpdateDevState && (
                  <button
                    disabled={transitioning}
                    onClick={() => handleTransition('IN_PROGRESS')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Start Investigation
                  </button>
                )}

                {bug.status === 'IN_PROGRESS' && canUpdateDevState && (
                  <>
                    <button
                      disabled={transitioning}
                      onClick={() => handleTransition('BLOCKED', 'Waiting on third party API / dependency')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Blocked
                    </button>
                    <button
                      disabled={transitioning}
                      onClick={() => handleTransition('FIXED')}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Fixed
                    </button>
                    <button
                      disabled={transitioning}
                      onClick={() => handleTransition('READY_FOR_RETEST')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Ready for Retest
                    </button>
                  </>
                )}

                {bug.status === 'BLOCKED' && canUpdateDevState && (
                  <button
                    disabled={transitioning}
                    onClick={() => handleTransition('IN_PROGRESS', 'Blocker resolved')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Resume Progress
                  </button>
                )}

                {bug.status === 'FIXED' && canUpdateDevState && (
                  <button
                    disabled={transitioning}
                    onClick={() => handleTransition('READY_FOR_RETEST')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Ready for Retest
                  </button>
                )}

                {bug.status === 'READY_FOR_RETEST' && (
                  canRetest ? (
                    <button
                      onClick={() => setIsRetestModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Execute QA Retest</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                      Awaiting QA Verification Retest
                    </span>
                  )
                )}

                {bug.status === 'CLOSED' && (isQA || isTechLead || isSuperAdmin) && (
                  <button
                    disabled={transitioning}
                    onClick={() => handleTransition('REOPENED', 'Defect resurfaced')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Reopen Defect
                  </button>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[68vh] overflow-y-auto">
              {/* Left Column: Defect Details & Evidence (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description & Reproduction Steps */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Defect Specifications</h4>

                  {bug.origin_report?.environment && (
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Environment:</span> {bug.origin_report.environment}
                    </div>
                  )}

                  {bug.fixed_in_build && (
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Fixed in Build:</span>{' '}
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                        {bug.fixed_in_build}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-800">Steps to reproduce:</span>
                    <p className="whitespace-pre-line text-slate-600 bg-white p-3 rounded-xl border border-slate-200 text-xs leading-relaxed">
                      {bug.origin_report?.steps_to_reproduce || bug.description}
                    </p>
                  </div>

                  {bug.origin_report?.expected_result && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="font-semibold text-emerald-700 block mb-0.5">Expected Result:</span>
                        <p className="text-slate-600 leading-relaxed">{bug.origin_report.expected_result}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="font-semibold text-rose-700 block mb-0.5">Actual Result:</span>
                        <p className="text-slate-600 leading-relaxed">{bug.origin_report.actual_result}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Evidence Screenshots Lightbox Gallery */}
                {bug.attachments && bug.attachments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <span>Defect Screenshot Evidence ({bug.attachments.length})</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {bug.attachments.map((att) => {
                        const previewUrl = bugsService.getEvidencePreviewUrl(projectId, att.id);
                        const downloadUrl = bugsService.getEvidenceDownloadUrl(projectId, att.id);
                        const isBroken = brokenImages[att.id];

                        return (
                          <div
                            key={att.id}
                            className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs hover:border-purple-300 transition-all flex flex-col"
                          >
                            {isBroken ? (
                              <div className="w-full h-24 bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                <ImageIcon className="w-5 h-5 mb-1 text-slate-300" />
                                <span className="text-[10px] font-medium text-slate-500">Image not accessible</span>
                              </div>
                            ) : (
                              <div
                                onClick={() => setSelectedPreviewImage({
                                  url: previewUrl,
                                  name: att.original_name,
                                  downloadUrl,
                                  size: att.file_size_bytes ? `${Math.round(att.file_size_bytes / 1024)} KB` : ''
                                })}
                                className="w-full h-24 bg-slate-100 relative cursor-pointer overflow-hidden"
                                title="Click to view full image preview"
                              >
                                <img
                                  src={previewUrl}
                                  alt={att.original_name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={() => setBrokenImages(prev => ({ ...prev, [att.id]: true }))}
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                                  <Eye className="w-4 h-4" />
                                  <span className="text-[10px] font-semibold">Inspect</span>
                                </div>
                              </div>
                            )}

                            <div className="p-1.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1">
                              <span className="text-[10px] text-slate-700 font-medium truncate" title={att.original_name}>
                                {att.original_name}
                              </span>
                              <a
                                href={downloadUrl}
                                download={att.original_name}
                                title="Download evidence image"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-slate-400 hover:text-purple-600 rounded transition-colors shrink-0"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* QA Retest History Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-purple-600" />
                    <span>QA Retest History ({bug.retests?.length || 0})</span>
                  </h4>

                  {!bug.retests || bug.retests.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No retest attempts recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {bug.retests.map((rt) => {
                        const isPass = rt.result === 'PASS';
                        return (
                          <div
                            key={rt.id}
                            className={`p-3.5 rounded-2xl border ${
                              isPass ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">Attempt #{rt.attempt_number}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {rt.result}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {new Date(rt.created_at).toLocaleDateString()} &bull;{' '}
                                {new Date(rt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 space-y-1">
                              <div>
                                <span className="font-semibold text-slate-700">Tested Build:</span>{' '}
                                <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                                  {rt.tested_build}
                                </span>
                              </div>
                              <p className="text-slate-700 text-xs mt-1 bg-white p-2 rounded-lg border border-slate-100">
                                {rt.notes}
                              </p>
                              <div className="text-[11px] text-slate-400 pt-0.5">
                                Verified by: <strong className="text-slate-700">{rt.retester?.name || rt.retester?.email}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Threaded Discussion */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    <span>Defect Discussion ({bug.comments?.length || 0})</span>
                  </h4>

                  <div className="space-y-2 mb-3">
                    {bug.comments?.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <strong className="text-slate-800">{c.author?.name || 'Team Member'}</strong>
                          <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line">{c.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add Comment Input */}
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add investigation note or comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Post</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Triage, Assignment & Metadata (1 Col) */}
              <div className="space-y-4">
                {/* Assignment & Triage Panel */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assignment & Triage</h4>
                    {!isEditingTriage && canTriage && (
                      <button
                        onClick={() => setIsEditingTriage(true)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {!isEditingTriage ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assignee</span>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{bug.current_assignee?.name || bug.current_assignee?.email || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority</span>
                        <span className="font-bold text-slate-800">{bug.priority}</span>
                      </div>

                      {bug.triage_notes && (
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Triage Notes</span>
                          <p className="text-slate-600 text-xs mt-0.5 bg-white p-2 rounded-lg border border-slate-200">
                            {bug.triage_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign to Member</label>
                        <select
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                        >
                          <option value="">-- Unassigned --</option>
                          {projectMembers.map((m) => {
                            const u = m.user || m;
                            const roleName = m.project_role || '';
                            const roleLabel = roleName ? (PROJECT_ROLE_LABELS[roleName] || roleName) : 'Not Assigned';
                            const isAssignable = Boolean(roleName && roleName !== 'NOT_ASSIGNED');
                            return (
                              <option key={u.id} value={u.id} disabled={!isAssignable}>
                                {u.name || u.email} ({roleLabel}{!isAssignable ? ' - cannot assign' : ''})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Priority</label>
                        <select
                          value={selectedPriority}
                          onChange={(e) => setSelectedPriority(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Triage Notes</label>
                        <textarea
                          rows={2}
                          placeholder="Technical notes for development..."
                          value={triageNotes}
                          onChange={(e) => setTriageNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingTriage(false)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingTriage}
                          onClick={handleSaveTriage}
                          className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {savingTriage ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata & Audit */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Record Meta</h4>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Reporter:</span>
                    <span className="font-semibold text-slate-800">
                      {bug.origin_report?.reporter?.name || bug.origin_report?.reporter?.email || 'System'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Created:</span>
                    <span>{new Date(bug.created_at).toLocaleDateString()}</span>
                  </div>

                  {bug.closed_at && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Resolved:</span>
                      <span className="font-semibold text-emerald-700">{new Date(bug.closed_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Retest Execution Modal */}
            <RetestModal
              isOpen={isRetestModalOpen}
              onClose={() => setIsRetestModalOpen(false)}
              projectId={projectId}
              bug={bug}
              onRetested={() => {
                fetchBug();
                onUpdated?.();
              }}
              onToast={onToast}
            />

            {/* Lightbox for Image Preview */}
            {selectedPreviewImage && (
              <div
                onClick={() => setSelectedPreviewImage(null)}
                className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="text-xs font-semibold truncate">{selectedPreviewImage.name || 'Evidence Preview'}</span>
                      {selectedPreviewImage.size && (
                        <span className="text-[10px] text-slate-400 shrink-0">({selectedPreviewImage.size})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedPreviewImage.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Full Screen</span>
                      </a>
                      {selectedPreviewImage.downloadUrl && (
                        <a
                          href={selectedPreviewImage.downloadUrl}
                          download={selectedPreviewImage.name || 'evidence.png'}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewImage(null)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Image View */}
                  <div className="p-4 overflow-auto flex items-center justify-center bg-black/40 min-h-[300px]">
                    <img
                      src={selectedPreviewImage.url}
                      alt={selectedPreviewImage.name || 'Evidence'}
                      className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
