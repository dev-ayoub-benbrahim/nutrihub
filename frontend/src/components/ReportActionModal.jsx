import { useState } from 'react';
import toast from 'react-hot-toast';

const ACTION_CONFIG = {
  dismiss: {
    title:       'Dismiss Report',
    description: 'No violation was found. The reporter will be notified that their report was reviewed and dismissed.',
    color:       'text-muted',
    border:      'border-[rgba(74,124,89,0.25)]',
    btnClass:    'bg-forest3 hover:bg-forest2 text-cream border border-[rgba(74,124,89,0.3)]',
    btnLabel:    'Dismiss Report',
    messagePlaceholder: 'Optional: explain why no action was taken, e.g. "The content does not violate community guidelines."',
    messageRequired: false,
  },
  warn: {
    title:       'Warn Content Owner',
    description: 'The content will remain but the owner receives a formal warning notification. The reporter will also be notified.',
    color:       'text-gold',
    border:      'border-gold/25',
    btnClass:    'bg-[rgba(212,168,67,0.15)] hover:bg-[rgba(212,168,67,0.25)] text-gold border border-gold/30',
    btnLabel:    'Send Warning',
    messagePlaceholder: 'Write the warning message to send to the content owner, e.g. "Your recipe contains misleading nutritional information. Please review our community guidelines."',
    messageRequired: true,
  },
  delete: {
    title:       'Delete Content',
    description: 'The recipe will be permanently deleted. Both the reporter and the content owner will be notified with your reason.',
    color:       'text-red-400',
    border:      'border-red-500/25',
    btnClass:    'bg-[rgba(196,98,45,0.15)] hover:bg-[rgba(196,98,45,0.25)] text-red-400 border border-red-500/30',
    btnLabel:    'Delete & Notify',
    messagePlaceholder: 'Required: explain why the content is being removed, e.g. "This recipe contains harmful misinformation about dietary supplements."',
    messageRequired: true,
  },
};

export default function ReportActionModal({ report, action, onConfirm, onClose }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!report || !action) return null;

  const cfg = ACTION_CONFIG[action];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cfg.messageRequired && !message.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(report.id, action, message.trim());
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to resolve report — check console');
      console.error('resolveReport error:', err?.response?.data || err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className={`relative bg-forest2 border ${cfg.border} rounded-2xl w-full max-w-md z-10 overflow-hidden`}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${cfg.border}`}>
          <h2 className={`font-semibold text-[16px] ${cfg.color}`}>{cfg.title}</h2>
          <button onClick={onClose} className="text-muted hover:text-cream text-2xl leading-none">×</button>
        </div>

        {/* Report summary */}
        <div className="px-5 py-3 bg-forest/50 border-b border-[rgba(74,124,89,0.1)]">
          <p className="text-[11px] text-muted uppercase tracking-wide font-semibold mb-1">Report details</p>
          <p className="text-[13px] text-cream">
            <span className="text-muted">Recipe:</span> {report.recipe?.title || 'Unknown'}
          </p>
          <p className="text-[13px] text-cream mt-0.5">
            <span className="text-muted">Category:</span> {report.category}
          </p>
          <p className="text-[13px] text-cream/80 mt-0.5 leading-snug">
            <span className="text-muted">Reason:</span> {report.reason}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-muted leading-relaxed mb-3">{cfg.description}</p>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted block mb-1.5">
              Message {cfg.messageRequired
                ? <span className="text-red-400">*</span>
                : <span className="font-normal text-muted/60">(optional)</span>
              }
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={cfg.messagePlaceholder}
              rows={4}
              required={cfg.messageRequired}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                         px-3.5 py-3 text-cream text-sm placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
            />
            {cfg.messageRequired && !message.trim() && (
              <p className="text-[11px] text-red-400 mt-1">A message is required for this action</p>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit"
                    disabled={submitting || (cfg.messageRequired && !message.trim())}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                                disabled:opacity-40 ${cfg.btnClass}`}>
              {submitting ? 'Sending…' : cfg.btnLabel}
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