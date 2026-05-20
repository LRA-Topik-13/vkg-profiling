import { cn } from '../lib/cn'

/**
 * Styled native <select> wrapper.
 * Use children to pass <option> elements like a normal select.
 */
export function Select({ className, ...props }) {
  return (
    <select
      className={cn(
        'w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-navy',
        'disabled:bg-muted disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}
