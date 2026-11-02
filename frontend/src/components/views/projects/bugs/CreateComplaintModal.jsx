import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Image as ImageIcon, Trash2, Loader2, CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';
import { bugsService } from '../../../../services/bugs.service';

export default function CreateComplaintModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
  onToast,
}) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [environment, setEnvironment] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [description, setDescription] = useState('');

  // Assigned QA tester state
  const [assignedQaId, setAssignedQaId] = useState('');
  const [qaTesters, setQaTesters] = useState([]);
  const [loadingQaTesters, setLoadingQaTesters] = useState(false);
  const [qaTestersError, setQaTestersError] = useState('');

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch eligible QA testers for the project whenever modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      setLoadingQaTesters(true);
      setQaTestersError('');
      bugsService
        .getEligibleQaTesters(projectId)
        .then((testers) => {
          const list = Array.isArray(testers) ? testers : [];
          setQaTesters(list);
          if (list.length === 1) {
            setAssignedQaId(list[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to load eligible QA testers:', err);
          setQaTestersError('Could not load project QA testers');
        })
        .finally(() => setLoadingQaTesters(false));
    } else {
      setAssignedQaId('');
      setQaTesters([]);
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    if (files.length + selected.length > 5) {
      setError('You can upload a maximum of 5 evidence screenshots.');
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    for (const f of selected) {
      if (!f.type.startsWith('image/')) {
        setError(`File '${f.name}' is not an image. Only PNG, JPEG, GIF, and WebP are supported.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError(`File '${f.name}' exceeds the 10MB size limit.`);
        return;
      }
      validFiles.push(f);
      newPreviews.push({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        url: URL.createObjectURL(f),
      });
    }

    setError('');
    setFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index]?.url);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!stepsToReproduce.trim()) {
      setError('Steps to reproduce are required');
      return;
    }
    if (!expectedResult.trim()) {
      setError('Expected result is required');
      return;
    }
    if (!actualResult.trim()) {
      setError('Actual result is required');
      return;
    }

    if (qaTesters.length > 0 && !assignedQaId) {
      setError('Please select an eligible QA tester responsible for reviewing this complaint.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('severity', severity);
      formData.append('environment', environment.trim());
      formData.append('steps_to_reproduce', stepsToReproduce.trim());
      formData.append('expected_result', expectedResult.trim());
      formData.append('actual_result', actualResult.trim());
      formData.append('description', description.trim() || actualResult.trim());
      if (assignedQaId) {
        formData.append('assigned_qa_id', assignedQaId);
      }

      for (const file of files) {
        formData.append('evidence', file);
      }

      const res = await bugsService.createComplaint(projectId, formData);
      onToast?.({
        title: 'Defect Complaint Submitted',
        message: 'Your report has been submitted to the QA Verification queue.',
        type: 'success',
      });
      onCreated?.(res.complaint);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to submit defect complaint');
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
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Report Defect / Complaint</h3>
              <p className="text-[11px] text-slate-500">Defects will be verified by QA before entering technical triage.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Title & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Defect Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Broken login session timeout on mobile Safari"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          {/* Environment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Environment / Device / Build Version
            </label>
            <input
              type="text"
              placeholder="e.g. Windows 11, Chrome 124, Build v2.1.0-staging"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Assign QA Tester */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Assign QA Tester {qaTesters.length > 0 && <span className="text-rose-500">*</span>}</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {loadingQaTesters
                  ? 'Checking eligible testers...'
                  : qaTesters.length > 0
                  ? `${qaTesters.length} eligible QA tester${qaTesters.length === 1 ? '' : 's'} available`
                  : 'No QA testers assigned to project'}
              </span>
            </div>

            {loadingQaTesters ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 shrink-0" />
                <span>Loading eligible project QA testers...</span>
              </div>
            ) : qaTesters.length > 0 ? (
              <select
                value={assignedQaId}
                onChange={(e) => setAssignedQaId(e.target.value)}
                required={qaTesters.length > 0}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="">-- Select Responsible QA Tester --</option>
                {qaTesters.map((tester) => (
                  <option key={tester.id} value={tester.id}>
                    {tester.name} ({tester.email})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No QA testers are currently assigned to this project.</strong> Your complaint will be placed in the general <strong className="font-semibold">Pending QA Review</strong> queue and can be verified once a team member is assigned the QA Tester role.
                </span>
              </div>
            )}
          </div>

          {/* Steps to Reproduce */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Steps to Reproduce <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="1. Navigate to Project Workspace&#10;2. Click on Timesheets&#10;3. Click clock out at 6:15 PM"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Expected vs Actual Result */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Result <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Session should automatically clock out at 6:15 PM IST"
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Actual Result <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Timer continued running indefinitely without auto-cutoff"
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Evidence Screenshots Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Screenshot / Image Evidence (Up to 5 images)
              </label>
              <span className="text-[10px] text-slate-400">PNG, JPG, WebP &bull; Max 10MB</span>
            </div>

            <label className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-rose-50/30">
              <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-700">Click to upload screenshot evidence</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Files are cryptographically verified for authenticity</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Thumbnail Previews */}
            {previews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                {previews.map((item, idx) => (
                  <div key={idx} className="relative group rounded-xl border border-slate-200 p-1.5 bg-white shadow-xs">
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-20 object-cover rounded-lg bg-slate-100"
                    />
                    <div className="mt-1 px-1 flex items-center justify-between text-[10px]">
                      <span className="truncate max-w-[100px] text-slate-700 font-medium" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-slate-400">{item.size}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submit to QA Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
