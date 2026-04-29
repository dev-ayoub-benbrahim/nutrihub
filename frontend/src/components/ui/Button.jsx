const variants = {
  primary:   'bg-sage hover:bg-sage-l text-cream border-transparent',
  secondary: 'bg-transparent hover:bg-forest3 text-muted hover:text-cream border-[rgba(74,124,89,0.3)]',
  danger:    'bg-transparent hover:bg-red-900/20 text-red-400 border-red-900/40',
  gold:      'bg-transparent hover:bg-[rgba(212,168,67,0.12)] text-gold border-[rgba(212,168,67,0.35)]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-sans font-medium',
        'rounded-[10px] border transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-sage focus-visible:outline-offset-2',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
          {children}
        </>
      ) : children}
    </button>
  );
}