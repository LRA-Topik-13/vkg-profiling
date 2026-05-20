import { cn } from '../lib/cn'

/**
 * Card — basic white surface with border + shadow.
 * Used for grouping content (form, results, score blocks).
 */
export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('px-5 py-4 border-b border-border', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return (
    <h2
      className={cn('text-sm font-semibold text-text', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />
}
