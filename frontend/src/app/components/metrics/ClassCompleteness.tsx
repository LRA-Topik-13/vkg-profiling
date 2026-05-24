import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { completenessApi, ClassSummary, ClassSummaryEntry, statusColor } from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge, ClassSelectList } from './_shared';

export default function ClassCompleteness() {
  const [data, setData] = useState<ClassSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.classSummary().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const sel = data.classes.find((c) => c.class === selected) || null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.overall_completeness} label="Overall Class Completeness" sub="Average across classes with data" />
        <Headline value={data.total_entities} label="Total Entities" sub={`${data.classes.length} classes`} color="var(--navy)" />
        <Headline value={data.classes.filter((c) => c.total_entities > 0).length} label="Populated Classes" sub="Classes with ≥ 1 entity" color="var(--navy)" />
      </div>

      <Section
        title="Completeness Ranking"
        subtitle="Single sorted bar chart so the user can immediately spot the lowest- and highest-scoring classes. Click a bar to inspect that class."
        collapsible
      >
        <Ranking entries={data.classes} onSelect={setSelected} selected={selected} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2">
          <ClassSelectList
            title="Classes"
            subtitle="Search or pick a class to see its details."
            items={[...data.classes].sort((a, b) => a.completeness - b.completeness)}
            getKey={(c) => c.class}
            getSearchText={(c) => `${c.label || ''} ${c.class}`}
            selectedKey={selected}
            onSelect={(k) => setSelected(k === selected ? null : k)}
            renderRow={(c) => <ClassRow entry={c} />}
            maxHeight={560}
          />
        </div>
        <div className="lg:col-span-3 lg:sticky lg:top-4">
          {sel ? (
            <ClassDetail entry={sel} onClose={() => setSelected(null)} />
          ) : (
            <Section title="Class Detail" subtitle="Select a class on the left to drill into its per-property completeness.">
              <div className="py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No class selected.</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassRow({ entry }: { entry: ClassSummaryEntry }) {
  const color = statusColor(entry.completeness);
  return (
    <>
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--text)' }}>{entry.label || entry.class}</div>
        <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{entry.class}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:block w-24 h-1.5" style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)' }}>
          <div className="h-1.5" style={{ width: `${entry.completeness}%`, backgroundColor: color, borderRadius: 'var(--radius-sm)' }} />
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
          {entry.total_entities.toLocaleString()} ent.
        </span>
        <StatusBadge percent={entry.completeness} />
      </div>
    </>
  );
}

function Ranking({
  entries,
  onSelect,
  selected,
}: {
  entries: ClassSummaryEntry[];
  onSelect: (c: string) => void;
  selected: string | null;
}) {
  const ranked = useMemo(
    () =>
      [...entries]
        .filter((c) => c.total_entities > 0)
        .sort((a, b) => a.completeness - b.completeness)
        .map((c) => ({ name: c.label || c.class, rawClass: c.class, completeness: c.completeness, entities: c.total_entities })),
    [entries],
  );
  return (
    <div className="always-scrollbar max-h-[500px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(220, ranked.length * 40)}>
        <BarChart data={ranked} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            formatter={(v: number, _n, p) => [`${v.toFixed(2)}%`, `${p.payload.entities} entities`]}
          />
          <Bar
            dataKey="completeness"
            radius={[0, 6, 6, 0]}
            onClick={(d: any) => onSelect(d.rawClass)}
            style={{ cursor: 'pointer' }}
          >
            {ranked.map((d, i) => (
              <Cell
                key={i}
                fill={statusColor(d.completeness)}
                fillOpacity={selected && d.rawClass !== selected ? 0.35 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassDetail({ entry, onClose }: { entry: ClassSummaryEntry; onClose: () => void }) {
  const color = statusColor(entry.completeness);
  const props = [...entry.by_property].sort((a, b) => a.completeness - b.completeness);
  return (
    <Section
      title={`Detail · ${entry.label || entry.class}`}
      subtitle="Per-property completeness for the selected class, sorted from least to most complete."
      right={
        <button onClick={onClose} className="text-sm" style={{ color: 'var(--accent)' }}>
          Clear selection
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Completeness" value={`${entry.completeness.toFixed(1)}%`} color={color} />
        <Stat label="Entities" value={entry.total_entities.toLocaleString()} color="var(--navy)" />
        <Stat label="Properties" value={entry.properties_count.toLocaleString()} color="var(--navy)" />
      </div>

      {props.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No property data for this class.</div>
      ) : (
        <div className="always-scrollbar space-y-3 max-h-96 overflow-y-auto pr-1">
          {props.map((p) => (
            <div key={p.property}>
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text)' }}>
                <span className="truncate pr-2">{p.label || p.property}</span>
                <span style={{ color: statusColor(p.completeness) }}>{p.completeness.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 mt-1" style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)' }}>
                <div
                  className="h-1.5"
                  style={{ width: `${p.completeness}%`, backgroundColor: statusColor(p.completeness), borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {p.filled.toLocaleString()} filled · {p.missing.toLocaleString()} missing
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-2xl" style={{ color }}>{value}</div>
    </div>
  );
}
