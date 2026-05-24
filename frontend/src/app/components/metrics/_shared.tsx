import { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { statusColor, PaginationInfo } from '../../lib/api';

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export function PaginatedTable({
  title,
  head,
  colSpan,
  children,
  pagination,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  onPrev,
  onNext,
  loading = false,
  emptyState,
}: {
  title?: string;
  head: ReactNode;
  colSpan: number;
  children: ReactNode;
  pagination: PaginationInfo | null;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
  emptyState?: ReactNode;
}) {
  if (!pagination) return null;
  if (pagination.total === 0 && emptyState) return <>{emptyState}</>;

  const currentPage = Math.floor(pagination.offset / pageSize) + 1;
  const totalPages = pagination.total != null ? Math.ceil(pagination.total / pageSize) : null;
  const hasPrev = pagination.offset > 0;
  const hasNext =
    pagination.total != null ? pagination.offset + pageSize < pagination.total : pagination.count === pageSize;

  const table = (
    <div
      className="border overflow-hidden"
      style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
            <tr>{head}</tr>
          </thead>
          <tbody>{children}</tbody>
          <tfoot>
            <tr>
              <td colSpan={colSpan} className="px-4 py-3" style={{ backgroundColor: 'var(--card)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="px-3 py-1 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                      }}
                    >
                      {pageSizeOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>
                      {totalPages != null ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onPrev}
                        disabled={!hasPrev || loading}
                        className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--navy)',
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onNext}
                        disabled={!hasNext || loading}
                        className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--navy)',
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  if (!title) return table;

  return (
    <div
      className="p-6 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}
    >
      <h3 className="text-xl mb-4" style={{ color: 'var(--navy)' }}>{title}</h3>
      {table}
    </div>
  );
}

export function Headline({
  value,
  label,
  sub,
  color,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
}) {
  const tone = color ?? (typeof value === 'number' ? statusColor(value) : 'var(--navy)');
  return (
    <div
      className="p-6 border"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-5xl" style={{ color: tone, lineHeight: 1.1 }}>
        {typeof value === 'number' ? `${value.toFixed(1)}%` : value}
      </div>
      {sub && (
        <div className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>
      )}
    </div>
  );
}

export function StatusBadge({ percent }: { percent: number }) {
  const c = statusColor(percent);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
      style={{ backgroundColor: `${c}1A`, color: c, borderRadius: 'var(--radius-sm)' }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: c }} />
      {percent.toFixed(1)}%
    </span>
  );
}

export function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="p-6 border"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="text-xl" style={{ color: 'var(--navy)' }}>{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function ScoreDonut({
  title,
  percentage,
  sub,
}: {
  title: string;
  percentage: number;
  sub?: string;
}) {
  const color = statusColor(percentage);
  const remainder = Math.max(0, 100 - percentage);
  const chart = [
    { name: 'Score', value: percentage, color },
    { name: 'Remaining', value: remainder, color: 'var(--muted)' },
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
            <Pie data={chart} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2} startAngle={90} endAngle={-270}>
              {chart.map((c, i) => (
                <Cell key={i} fill={c.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl" style={{ color }}>{percentage.toFixed(1)}%</div>
        </div>
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
      {message}
    </div>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="p-4 text-sm border"
      style={{
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--accent)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {message}
    </div>
  );
}
