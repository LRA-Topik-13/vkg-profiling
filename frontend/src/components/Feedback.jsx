export function ErrorBox({ message, onRetry }) {
  return (
    <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] rounded-lg px-4 py-3 text-sm flex items-center justify-between">
      <span><strong>Error:</strong> {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 text-xs font-semibold hover:underline underline-offset-2 shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function LoadingSkeleton({ count = 2 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg border border-border h-40 animate-pulse" />
      ))}
    </div>
  )
}
