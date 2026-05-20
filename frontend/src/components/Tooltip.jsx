import { useState, useId } from 'react'

/**
 * Inline tooltip rendered next to a label.
 * Shows a "?" badge that reveals help text on hover/focus.
 */
export function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  const id = useId()

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        tabIndex={0}
        role="button"
        aria-describedby={show ? id : undefined}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold cursor-help shrink-0 leading-none
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        ?
      </span>
      {show && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-56 px-3 py-2 text-xs text-text bg-white border border-border rounded-lg shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  )
}
