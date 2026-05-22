import { useState } from 'react';
import api from '../utils/axios';
import toast from 'react-hot-toast';

const CATEGORIES = ['Spam', 'Inappropriate', 'Misinformation', 'Harassment', 'Other'];

export default function ReportModal({ isOpen, onClose, recipeId, reportedUserId, context }) {
  const [category, setCategory] = useState('Other');
  const [reason,   setReason]   = useState('');
  const [loading,  setLoading]  = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      toast.error('Please provide a reason (minimum 5 characters)');
      return;
    }
    setLoading(true);
    try {
      await api.post('/reports', {
        category,
        reason: reason.trim(),
        ...(recipeId       && { recipeId: parseInt(recipeId) }),
        ...(reportedUserId && { reportedUserId: parseInt(reportedUserId) }),
      }, { timeout: 8000 });
      toast.success('Report submitted — our team will review it');
      setReason('');
      setCategory('Other');
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to submit report';
      toast.error(msg, { duration: 4000 });
      console.error('Report error:', err?.response?.status, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative bg-forest2 border border-[rgba(74,124,89,0.25)]
                      rounded-2xl w-full max-w-md z-10 overflow-hidden"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4
                        border-b border-[rgba(74,124,89,0.15)]">
          <h2 className="font-semibold text-[16px] text-cream">Report Content</h2>
          <button onClick={onClose}
                  className="text-muted hover:text-cream text-2xl leading-none">×</button>
        </div>

        {context && (
          <div className="px-5 py-3 bg-forest/50 border-b border-[rgba(74,124,89,0.1)]">
            <p className="text-[12px] text-muted">
              Reporting: <span className="text-cream">{context}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted block mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                        className={`text-[12px] px-3 py-1.5 rounded-xl border transition-all
                                    ${category === c
                                      ? 'border-rust/50 bg-[rgba(196,98,45,0.12)] text-rust-l'
                                      : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted block mb-1.5">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the issue so our team can review it..."
              rows={4}
              required
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                         px-3.5 py-3 text-cream text-sm placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
            />
            <p className="text-[10px] text-muted mt-1">
              {reason.length} characters {reason.length < 5 ? '— minimum 5 required' : ''}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="submit"
                    disabled={loading || reason.trim().length < 5}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium
                               bg-[rgba(196,98,45,0.15)] hover:bg-[rgba(196,98,45,0.25)]
                               text-rust-l border border-rust/30 transition-all disabled:opacity-40">
              {loading ? 'Submitting…' : 'Submit Report'}
            </button>
            <button type="button" onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-sm text-muted hover:text-cream
                               border border-[rgba(74,124,89,0.2)] hover:border-sage transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}