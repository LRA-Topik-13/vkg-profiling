import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClassMeta, PropertyMeta, statusColor } from '../../lib/api';

export const SOURCE_OPTIONS = [
  { value: 'http://example.org/voc#uni1/', label: 'uni1 (MySQL)', short: 'uni1' },
  { value: 'http://example.org/voc#uni2/', label: 'uni2 (PostgreSQL)', short: 'uni2' },
  { value: 'http://example.org/voc#uni3/', label: 'uni3 (MSSQL)', short: 'uni3' },
];

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
export const DEFAULT_PAGE_SIZE = 10;

export function shortUri(uri: string) {
  if (!uri) return '';
  const hash = uri.lastIndexOf('#');
  if (hash !== -1) {
    const after = uri.substring(hash + 1);
    if (after) return after;
  }
  try {
    const u = new URL(uri);
    return `${u.pathname.substring(1)}${u.hash}`;
  } catch {
    return uri;
  }
}

export function labelForClass(cls?: ClassMeta | null) {
  return cls ? cls.label || cls.localName : '';
}

export function labelForProperty(prop?: PropertyMeta | null) {
  return prop ? prop.label || prop.localName : '';
}

export function sourceLabel(source: string) {
  const found = SOURCE_OPTIONS.find((s) => s.value === source || source.startsWith(s.value));
  return found?.short || shortUri(source).replace(/\/$/, '');
}

export function getEntitySource(uri: string) {
  return SOURCE_OPTIONS.find((source) => uri.startsWith(source.value))?.value || 'unknown';
}

export function sortSources(values: string[]) {
  const order = new Map(SOURCE_OPTIONS.map((source, index) => [source.value, index]));
  return [...values].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

export function formatCount(value: number | undefined | null) {
  return Number(value || 0).toLocaleString('en-US');
}

export function formatPercent(value: number | undefined | null) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

export function scoreTone(score: number) {
  return statusColor(score);
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>{hint}</p>}
    </div>
  );
}

export function FormulaCard({ title, formula, description }: { title: string; formula: string; description?: string }) {
  return (
    <div
      className="px-4 py-3 border"
      style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{title}</p>
      <p className="text-sm font-mono mt-1" style={{ color: 'var(--text)' }}>{formula}</p>
      {description && <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{description}</p>}
    </div>
  );
}

export function MetricCard({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <div
      className="p-6 border flex flex-col justify-center"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', minHeight: 160 }}
    >
      <div className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-4xl" style={{ color: color ?? 'var(--navy)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>}
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-mono whitespace-nowrap"
      style={{ backgroundColor: 'var(--info-soft)', color: 'var(--navy)', borderRadius: 'var(--radius-sm)' }}
    >
      {sourceLabel(source)}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  const color = tone === 'good' ? '#1F8A4C' : tone === 'warn' ? '#E08B1A' : tone === 'bad' ? '#9E2B0A' : 'var(--muted-foreground)';
  const bg = tone === 'neutral' ? 'var(--muted)' : `${color}1A`;
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs" style={{ backgroundColor: bg, color, borderRadius: 'var(--radius-sm)' }}>
      {children}
    </span>
  );
}

export function TablePager({
  pageSize,
  onPageSizeChange,
  offset,
  total,
  count,
  loading,
  onPrev,
  onNext,
  colSpan,
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  offset: number;
  total: number;
  count: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  colSpan: number;
}) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = offset > 0;
  const hasNext = offset + count < total;

  return (
    <tfoot>
      <tr>
        <td colSpan={colSpan} className="px-4 py-3" style={{ backgroundColor: 'var(--card)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text)' }}>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-3 py-1 border"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onPrev}
                  disabled={!hasPrev || loading}
                  className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--navy)' }}
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext || loading}
                  className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--navy)' }}
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </tfoot>
  );
}

export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="border overflow-hidden" style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
      {children}
    </div>
  );
}
