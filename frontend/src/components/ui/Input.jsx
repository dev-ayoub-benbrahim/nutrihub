import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, className = '', id, ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          'w-full bg-forest border rounded-[10px] px-3.5 py-2.5',
          'text-cream text-sm font-sans placeholder:text-muted',
          'outline-none transition-all duration-200',
          error
            ? 'border-red-500/60 focus:border-red-400'
            : 'border-[rgba(74,124,89,0.25)] focus:border-sage',
          className,
        ].join(' ')}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-xs mt-0.5">{error}</p>
      )}
    </div>
  );
});

export default Input;