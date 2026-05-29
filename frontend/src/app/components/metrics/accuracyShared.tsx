import { ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ClassMeta, PropertyMeta, statusColor } from '../../lib/api';
import { sourceLabel, getEntitySource, sortSources } from '../../lib/sources';

export { sourceLabel, getEntitySource, sortSources };

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

export function humanizeIdentifier(value: string | undefined | null) {
  if (!value) return '';
  const local = shortUri(value).split('/').filter(Boolean).pop() || value;
  const cleaned = local
    .replace(/^:/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function labelForClass(cls?: ClassMeta | null) {
  return cls ? cls.label || humanizeIdentifier(cls.localName || cls.uri) : '';
}

export function labelForProperty(prop?: PropertyMeta | null) {
  return prop ? prop.label || humanizeIdentifier(prop.localName || prop.uri) : '';
}

export function makeClassLabelLookup(classes: ClassMeta[]) {
  const lookup = new Map<string, string>();
  classes.forEach((cls) => {
    const label = labelForClass(cls);
    if (!label) return;
    lookup.set(cls.uri, label);
    lookup.set(cls.localName, label);
    lookup.set(shortUri(cls.uri), label);
  });
  return lookup;
}

export function makePropertyLabelLookup(properties: PropertyMeta[]) {
  const lookup = new Map<string, string>();
  properties.forEach((prop) => {
    const label = labelForProperty(prop);
    if (!label) return;
    lookup.set(prop.uri, label);
    lookup.set(prop.localName, label);
    lookup.set(shortUri(prop.uri), label);
  });
  return lookup;
}

export function labelFromLookup(value: string | undefined | null, lookup: Map<string, string>) {
  if (!value) return '';
  const short = shortUri(value);
  return lookup.get(value) || lookup.get(short) || humanizeIdentifier(short || value);
}

export function formatCount(value: number | undefined | null) {
  return Number(value || 0).toLocaleString('en-US');
}

export function formatPercent(value: number | undefined | null) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatNullablePercent(value: number | undefined | null) {
  return value == null ? 'N/A' : `${Number(value).toFixed(1)}%`;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

export interface AccuracyFacet {
  propUri: string;
  propLabel: string;
  valueUri: string | null;
  valueLabel: string;
}

export function facetsToParam(facets: AccuracyFacet[]) {
  if (facets.length === 0) return undefined;
  return facets.map((facet) => facet.valueUri ? `${facet.propUri}::${facet.valueUri}` : facet.propUri).join(',');
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


export function AccuracyScoreDonut({ title, percentage, sub }: { title: string; percentage: number | null; sub?: string }) {
  const isAvailable = percentage != null;
  const value = isAvailable ? Math.max(0, Math.min(100, percentage)) : 0;
  const color = isAvailable ? statusColor(value) : 'var(--muted-foreground)';
  const chart = isAvailable
    ? [
        { name: 'Score', value, color },
        { name: 'Remaining', value: Math.max(0, 100 - value), color: 'var(--muted)' },
      ]
    : [
        { name: 'Not applicable', value: 100, color: 'var(--muted)' },
      ];

  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>{title}</div>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chart} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={isAvailable ? 2 : 0} startAngle={90} endAngle={-270} isAnimationActive={false}>
              {chart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl" style={{ color }}>{isAvailable ? `${value.toFixed(1)}%` : 'N/A'}</div>
        </div>
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>}
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

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 text-sm border"
      style={{
        backgroundColor: '#FEF7E6',
        color: '#8A5A00',
        borderColor: 'rgba(224,139,26,0.4)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function ActiveFacetList({
  facets,
  onRemove,
  onClear,
}: {
  facets: AccuracyFacet[];
  onRemove: (index: number) => void;
  onClear?: () => void;
}) {
  if (facets.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2 text-sm" style={{ color: 'var(--text)' }}>
        <span>
          Active facets <span style={{ color: 'var(--muted-foreground)' }}>(AND)</span>
        </span>
        {onClear && (
          <button onClick={onClear} className="text-xs underline" style={{ color: 'var(--accent)' }}>
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {facets.map((facet, index) => (
          <span
            key={`${facet.propUri}::${facet.valueUri || ''}`}
            className="inline-flex items-center gap-2 px-2 py-1 text-xs border"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span>
              <span style={{ color: 'var(--text)' }}>{facet.propLabel}</span>
              <span style={{ color: 'var(--muted-foreground)' }}> = </span>
              <span>{facet.valueLabel}</span>
            </span>
            <button
              onClick={() => onRemove(index)}
              className="inline-flex items-center"
              style={{ color: 'var(--accent)' }}
              title="Remove facet"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
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
