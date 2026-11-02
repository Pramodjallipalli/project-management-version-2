import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Copy,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Eye,
} from 'lucide-react';
import { bugsService } from '../../../../services/bugs.service';

export default function QaReviewModal({
  isOpen,
  onClose,
  projectId,
  complaint,
  isQA = false,
  onReviewed,
  onToast,
}) {
  const [outcome, setOutcome] = useState('VERIFIED'); // 'VERIFIED' | 'INFO_REQUESTED' | 'REJECTED' | 'DUPLICATE'
  const [priority, setPriority] = useState('MEDIUM');
  const [notes, setNotes] = useState('');
  const [duplicateOfId, setDuplicateOfId] = useState('');
  const [existingBugs, setExistingBugs] = useState([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null); // { url, name, downloadUrl }
  const [brokenImages, setBrokenImages] = useState({});

  // When duplicate outcome selected, load existing bugs in project for selection
  useEffect(() => {
    if (outcome === 'DUPLICATE' && projectId) {
      setLoadingBugs(true);
      bugsService
        .listBugs(projectId)
        .then((bugs) => setExistingBugs(bugs || []))
        .catch((err) => console.error('Failed to load existing bugs for duplicate selection:', err))
        .finally(() => setLoadingBugs(false));
    }
  }, [outcome, projectId]);

  if (!isOpen || !complaint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!notes.trim()) {
      setError('Review notes / reason is mandatory for all QA decisions.');
      return;
    }

    if (outcome === 'DUPLICATE' && !duplicateOfId) {
      setError('Please select which existing bug this complaint duplicates.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await bugsService.reviewComplaint(projectId, complaint.id, {
        outcome,
        notes: notes.trim(),
        priority: outcome === 'VERIFIED' ? priority : undefined,
        duplicate_of_id: outcome === 'DUPLICATE' ? duplicateOfId : undefined,
      });

      onToast?.({
        title: 'QA Review Recorded',
        message:
          outcome === 'VERIFIED'
            ? `Complaint verified! Official bug ${res.officialBug?.bug_code || ''} has been created.`
            : `Complaint marked as ${outcome}.`,
        type: 'success',
      });

      onReviewed?.(res);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to submit QA review decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">QA Verification & Triage Gate</h3>
              <p className="text-[11px] text-slate-500">
                Reporter: <strong>{complaint.reporter?.name || complaint.reporter?.email}</strong> &bull; Severity: <strong className="text-rose-600">{complaint.severity}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Complaint Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-900">{complaint.title}</h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                {complaint.status}
              </span>
            </div>

            {complaint.environment && (
              <div className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Environment:</span> {complaint.environment}
              </div>
            )}

            {complaint.assigned_qa && (
              <div className="text-[11px] text-purple-700 bg-purple-50/70 border border-purple-200/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <span className="font-semibold">Assigned QA Reviewer:</span>
                <span>{complaint.assigned_qa.name || complaint.assigned_qa.email}</span>
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1.5 pt-1">
              <div>
                <span className="font-semibold text-slate-800">Steps to reproduce:</span>
                <p className="whitespace-pre-line text-slate-600 mt-0.5 bg-white p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                  {complaint.steps_to_reproduce}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                  <span className="font-semibold text-emerald-700">Expected Result:</span>
                  <p className="text-slate-600 mt-0.5">{complaint.expected_result}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                  <span className="font-semibold text-rose-700">Actual Result:</span>
                  <p className="text-slate-600 mt-0.5">{complaint.actual_result}</p>
                </div>
              </div>
            </div>

            {/* Evidence Attachments Previews */}
            {complaint.attachments && complaint.attachments.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Submitted Evidence Screenshots ({complaint.attachments.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {complaint.attachments.map((att) => {
                    const previewUrl = bugsService.getEvidencePreviewUrl(projectId, att.id);
                    const downloadUrl = bugsService.getEvidenceDownloadUrl(projectId, att.id);
                    const isBroken = brokenImages[att.id];

                    return (
                      <div
                        key={att.id}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs hover:border-purple-300 transition-all flex flex-col"
                      >
                        {isBroken ? (
                          <div className="w-full h-20 bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
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
                            className="w-full h-20 bg-slate-100 relative cursor-pointer overflow-hidden"
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
          </div>

          {/* QA Review Form or Read-Only Review Display */}
          {(!isQA || (complaint.status !== 'PENDING_REVIEW' && complaint.status !== 'NEED_INFO')) ? (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>QA Verification Status: {complaint.status.replace(/_/g, ' ')}</span>
                </div>
                {!isQA && (
                  <p className="text-xs text-slate-500">
                    Only QA Testers assigned to this project can perform defect verification, issue clarification requests, or reject complaints.
                  </p>
                )}
                {complaint.reviews && complaint.reviews.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 uppercase">Latest QA Review Notes</div>
                    <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                      {complaint.reviews[0]?.notes || 'No review notes recorded.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  QA Verification Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'VERIFIED', label: 'Verify Defect', icon: CheckCircle2, color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                    { id: 'INFO_REQUESTED', label: 'Need Info', icon: HelpCircle, color: 'border-amber-500 bg-amber-50 text-amber-800' },
                    { id: 'REJECTED', label: 'Reject', icon: XCircle, color: 'border-rose-500 bg-rose-50 text-rose-800' },
                    { id: 'DUPLICATE', label: 'Duplicate', icon: Copy, color: 'border-purple-500 bg-purple-50 text-purple-800' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = outcome === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setOutcome(item.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? item.color + ' ring-2 ring-offset-1 ring-slate-400'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outcome-specific fields */}
              {outcome === 'VERIFIED' && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-emerald-900">Official Bug Creation</span>
                    <p className="text-[11px] text-emerald-700">
                      Creates an official defect in 'OPEN' state with full complaint history preserved.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 focus:outline-none"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Priority</option>
                    </select>
                  </div>
                </div>
              )}

              {outcome === 'DUPLICATE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Existing Official Bug <span className="text-rose-500">*</span>
                  </label>
                  {loadingBugs ? (
                    <div className="p-2 text-xs text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading project defects...
                    </div>
                  ) : (
                    <select
                      required
                      value={duplicateOfId}
                      onChange={(e) => setDuplicateOfId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">-- Choose existing official defect --</option>
                      {existingBugs.map((b) => (
                        <option key={b.id} value={b.id}>
                          [{b.bug_code}] {b.title} ({b.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  QA Notes / Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={
                    outcome === 'VERIFIED'
                      ? 'Confirm reproduction steps and environment verification...'
                      : outcome === 'INFO_REQUESTED'
                      ? 'State precisely what information or logs the reporter needs to provide...'
                      : outcome === 'REJECTED'
                      ? 'State the reason for defect rejection (e.g. working as designed, cannot reproduce)...'
                      : 'Specify reason for linking this defect as duplicate...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving QA Decision...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply QA Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Evidence Image Lightbox Modal */}
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
                <span className="text-xs font-semibold truncate">{selectedPreviewImage.name}</span>
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
                <a
                  href={selectedPreviewImage.downloadUrl}
                  download={selectedPreviewImage.name}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
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
                alt={selectedPreviewImage.name}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
