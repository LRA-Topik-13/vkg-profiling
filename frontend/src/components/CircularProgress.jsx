/**
 * Circular progress ring with percentage label in the middle.
 * Used for F1/F2/F3 scores on the Conciseness page.
 *
 * The percentage font scales with `size` so a 90px ring stays readable
 * while a 150px ring still feels prominent.
 */
export function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 8,
  color = 'var(--navy)',
  label,
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  // Percentage text fills ~22% of the ring diameter — keeps "99.9%" readable
  // at every size without overflowing the inner circle.
  const fontSize = Math.max(14, Math.round(size * 0.22))

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold leading-none"
          style={{ color, fontSize: `${fontSize}px` }}
        >
          {percentage.toFixed(1)}%
        </div>
      </div>
      {label && (
        <div className="mt-2 text-sm text-center text-text">{label}</div>
      )}
    </div>
  )
}