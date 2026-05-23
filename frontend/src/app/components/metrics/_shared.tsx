import { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { statusColor } from '../../lib/api';

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
