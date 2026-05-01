import { useState } from 'react';
import api from '../utils/axios';
import Button from './ui/Button';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'Spam',           label: '🚫 Spam',                desc: 'Unwanted, repetitive, or promotional content' },
  { value: 'Inappropriate',  label: '⚠️ Inappropriate',       desc: 'Offensive, adult, or disturbing content' },
  { value: 'Misinformation', label: '❌ Misinformation',      desc: 'False or misleading health/nutrition claims' },
  { value: 'Harassment',     label: '🛑 Harassment',          desc: 'Bullying, threats, or targeted abuse' },
  { value: 'Other',          label: '📋 Other',               desc: 'Something else not listed above' },
];

export default function ReportModal({ isOpen, onClose, recipeId, reportedUserId, context }) {
  const [category, setCategory] = useState('');
  const [reason,   setReason]   = useState('');
  const [loading,  setLoading]  = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) { toast.error('Please select a category'); return; }
    if (reason.trim().length < 10) { toast.error('Please provide more detail (minimum 10 characters)'); return; }

    setLoading(true);
    try {
      await api.post('/reports', {
        category,
        reason: reason.trim(),
        ...(recipeId       && { recipeId }),
        ...(reportedUserId && { reportedUserId }),
      });
      toast.success('Report submitted — thank you for keeping NutriHub safe');
      setCategory('');
      setReason('');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(74,124,89,0.18)]">
          <div>
            <h2 className="font-serif text-xl font-light text-cream">Report Content</h2>
            {context && <p className="text-[12px] text-muted mt-0.5">Reporting: <span className="text-cream/70">{context}</span></p>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream transition-colors text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Category */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-2">
              What's the issue?
            </p>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map(cat => (
                <label key={cat.value}
                       className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer
                                   transition-all duration-200
                                   ${category === cat.value
                                     ? 'border-sage bg-[rgba(74,124,89,0.14)]'
                                     : 'border-[rgba(74,124,89,0.18)] hover:border-sage/40'}`}>
                  <input type="radio" name="category" value={cat.value}
                         checked={category === cat.value}
                         onChange={() => setCategory(cat.value)}
                         className="mt-0.5 flex-shrink-0 accent-sage"/>
                  <div>
                    <p className="text-[13px] font-medium text-cream">{cat.label}</p>
                    <p className="text-[11px] text-muted">{cat.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
              Additional detail
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please describe the issue in more detail..."
              rows={3}
              maxLength={500}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                         px-4 py-3 text-sm text-cream placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
            />
            <div className="flex justify-between">
              <p className="text-[11px] text-muted">Be specific — it helps us act faster</p>
              <p className="text-[11px] text-muted">{reason.length}/500</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={loading} fullWidth>Submit Report</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}