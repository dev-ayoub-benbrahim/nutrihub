import { useState } from 'react';

/**
 * ConfirmModal — replaces all window.confirm and window.prompt dialogs.
 *
 * Props:
 *   isOpen        bool
 *   onClose       fn
 *   onConfirm     fn
 *   title         string
 *   message       string | ReactNode
 *   confirmLabel  string  (default "Confirm")
 *   danger        bool    (red confirm button)
 *   requireType   string  (if set, user must type this to confirm e.g. "DELETE")
 */
export default function ConfirmModal({
  isOpen, onClose, onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = false,
  requireType = null,
}) {
  const [typed,   setTyped]   = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const canConfirm = requireType ? typed === requireType : true;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setTyped('');
    }
  };

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>

      <div className="relative bg-forest2 border border-[rgba(74,124,89,0.25)]
                      rounded-2xl w-full max-w-md z-10 overflow-hidden shadow-2xl"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`px-6 py-5 border-b border-[rgba(74,124,89,0.12)]
                         ${danger ? 'bg-[rgba(196,98,45,0.06)]' : 'bg-forest/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                             ${danger ? 'bg-[rgba(196,98,45,0.15)] border border-rust/30' : 'bg-[rgba(74,124,89,0.15)] border border-sage/30'}`}>
              {danger ? (
                <span className="text-[16px]">⚠</span>
              ) : (
                <span className="text-[16px]">?</span>
              )}
            </div>
            <h2 className="text-[16px] font-semibold text-cream">{title}</h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {message && (
            <p className="text-[13px] text-cream/80 leading-relaxed mb-4">{message}</p>
          )}

          {requireType && (
            <div className="mt-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted block mb-2">
                Type <span className="text-rust-l font-bold">{requireType}</span> to confirm
              </label>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={`Type ${requireType} here`}
                autoFocus
                className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                           px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                           outline-none focus:border-rust/50 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl text-sm border border-[rgba(74,124,89,0.25)]
                       text-muted hover:text-cream hover:border-sage/40 transition-all">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${danger
                          ? 'bg-[rgba(196,98,45,0.15)] hover:bg-[rgba(196,98,45,0.25)] text-rust-l border border-rust/30'
                          : 'bg-sage/20 hover:bg-sage/30 text-sage-l border border-sage/40'}`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin"/>
                {confirmLabel}…
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}