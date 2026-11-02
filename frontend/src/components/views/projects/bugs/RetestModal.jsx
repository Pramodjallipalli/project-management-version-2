import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Upload,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { bugsService } from '../../../../services/bugs.service';

export default function RetestModal({
  isOpen,
  onClose,
  projectId,
  bug,
  onRetested,
  onToast,
}) {
  const [testedBuild, setTestedBuild] = useState('');
  const [result, setResult] = useState('PASS'); // 'PASS' | 'FAIL'
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !bug) return null;

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
        setError(`File '${f.name}' is not an image.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError(`File '${f.name}' exceeds the 10MB limit.`);
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

    if (!testedBuild.trim()) {
      setError('Tested build/version is required (e.g. v2.1.0-build45).');
      return;
    }
    if (!notes.trim()) {
      setError('Retest observations and notes are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('tested_build', testedBuild.trim());
      formData.append('result', result);
      formData.append('notes', notes.trim());

      for (const f of files) {
        formData.append('evidence', f);
      }

      const res = await bugsService.recordRetest(projectId, bug.id, formData);
      onToast?.({
        title: result === 'PASS' ? 'Defect Verified & Closed' : 'Defect Retest Failed',
        message:
          result === 'PASS'
            ? `Retest passed on build ${testedBuild}! Bug ${bug.bug_code} is now CLOSED.`
            : `Retest failed on build ${testedBuild}. Bug ${bug.bug_code} has been REOPENED.`,
        type: result === 'PASS' ? 'success' : 'warning',
      });

      onRetested?.(res.retest);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to record QA retest result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">QA Retest Execution</h3>
              <p className="text-[11px] text-slate-500">
                [{bug.bug_code}] {bug.title}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pass / Fail Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Retest Verification Result <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResult('PASS')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  result === 'PASS'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>PASS &bull; Close Defect</span>
              </button>

              <button
                type="button"
                onClick={() => setResult('FAIL')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  result === 'FAIL'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>FAIL &bull; Reopen Defect</span>
              </button>
            </div>
          </div>

          {/* Tested Build */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tested Build / Release Version <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. v2.4.0-rc2 (commit: a3f890)"
              value={testedBuild}
              onChange={(e) => setTestedBuild(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Retest Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Retest Observations & Log Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe tests executed, verification steps, and confirmation that defect is resolved or still persists..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Retest Evidence */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Retest Screenshots / Proof (Optional, Up to 5)
              </label>
              <span className="text-[10px] text-slate-400">PNG, JPG, WebP</span>
            </div>

            <label className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-purple-50/30">
              <ImageIcon className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-700">Upload screenshot proof of retest</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {previews.map((item, idx) => (
                  <div key={idx} className="relative group rounded-xl border border-slate-200 p-1 bg-white shadow-xs">
                    <img src={item.url} alt={item.name} className="w-full h-16 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
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
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${
                result === 'PASS' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Retest...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Retest &bull; {result === 'PASS' ? 'Close Bug' : 'Reopen Bug'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
