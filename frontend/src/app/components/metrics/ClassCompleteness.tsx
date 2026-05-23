import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { completenessApi, ClassSummary, ClassSummaryEntry, statusColor } from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge } from './_shared';

export default function ClassCompleteness() {
  const [data, setData] = useState<ClassSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.classSummary().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.overall_completeness} label="Overall Class Completeness" sub="Average across classes with data" />
        <Headline value={data.total_entities} label="Total Entities" sub={`${data.classes.length} classes`} color="var(--navy)" />
        <Headline value={data.classes.filter((c) => c.total_entities > 0).length} label="Populated Classes" sub="Classes with ≥ 1 entity" color="var(--navy)" />
      </div>

      <Section
        title="Completeness Ranking"
        subtitle="Single sorted bar chart so the user can immediately spot the lowest- and highest-scoring classes (parallelism + ranking)."
      >
        <Ranking entries={data.classes} />
      </Section>

      <Section
        title="Per-Class Cards"
        subtitle="Small multiples — identical card structure per class (entities, properties, completeness gauge). Lets the user scan across classes with consistent encoding (Bach et al., 2023)."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.classes.map((c) => (
            <ClassCard
              key={c.class}
              entry={c}
              expanded={expanded === c.class}
              onToggle={() => setExpanded(expanded === c.class ? null : c.class)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Ranking({ entries }: { entries: ClassSummaryEntry[] }) {
  const ranked = useMemo(
    () =>
      [...entries]
        .filter((c) => c.total_entities > 0)
        .sort((a, b) => a.completeness - b.completeness)
        .map((c) => ({ name: c.label || c.class, completeness: c.completeness, entities: c.total_entities })),
    [entries],
  );
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, ranked.length * 40)}>
      <BarChart data={ranked} layout="vertical" margin={{ left: 24, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
        <Tooltip
          contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
          formatter={(v: number, _n, p) => [`${v.toFixed(2)}%`, `${p.payload.entities} entities`]}
        />
        <Bar dataKey="completeness" radius={[0, 6, 6, 0]}>
          {ranked.map((d, i) => (
            <Cell key={i} fill={statusColor(d.completeness)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ClassCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: ClassSummaryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = statusColor(entry.completeness);
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{entry.class}</div>
          <div style={{ color: 'var(--text)' }}>{entry.label || entry.class}</div>
        </div>
        <StatusBadge percent={entry.completeness} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex-1 h-2"
          style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)' }}
        >
          <div
            className="h-2"
            style={{
              width: `${entry.completeness}%`,
              backgroundColor: color,
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>
        <div className="text-sm" style={{ color }}>
          {entry.completeness.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: 'var(--text)' }}>
        <div>
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Entities</div>
          <div>{entry.total_entities.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Properties</div>
          <div>{entry.properties_count}</div>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={entry.by_property.length === 0}
        className="mt-3 inline-flex items-center gap-1 text-xs disabled:opacity-40"
        style={{ color: 'var(--accent)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {expanded ? 'Hide property breakdown' : 'Show property breakdown'}
      </button>

      {expanded && entry.by_property.length > 0 && (
        <div className="mt-3 space-y-2">
          {entry.by_property
            .slice()
            .sort((a, b) => a.completeness - b.completeness)
            .map((p) => (
              <div key={p.property}>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text)' }}>
                  <span className="truncate pr-2">{p.label || p.property}</span>
                  <span style={{ color: statusColor(p.completeness) }}>{p.completeness.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 mt-1" style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div
                    className="h-1.5"
                    style={{
                      width: `${p.completeness}%`,
                      backgroundColor: statusColor(p.completeness),
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
