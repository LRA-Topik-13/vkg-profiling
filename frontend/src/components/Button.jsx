import { cn } from '../lib/cn'

/**
 * Button with three variants matching the Figma design system.
 *   - primary  → navy   (main action)
 *   - accent   → brick-red (CTA / analyze)
 *   - ghost    → transparent (cancel / secondary)
 */
export function Button({
  variant = 'primary',
  className,
  disabled,
  children,
  ...props
}) {
  const variants = {
    primary:
      'bg-navy text-white hover:bg-[color-mix(in_oklab,var(--navy)_85%,black)]',
    accent:
      'bg-accent text-white hover:bg-[var(--accent-hover)]',
    ghost:
      'bg-transparent text-text hover:bg-muted',
  }

  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
