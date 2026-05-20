import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names safely.
 * Resolves conflicts (e.g. cn('p-4', condition && 'p-2') → 'p-2').
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
