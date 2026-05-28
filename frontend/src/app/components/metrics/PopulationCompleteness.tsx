import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { completenessApi, PopulationSummary, PopulationEntry, PopulationEntities, statusColor } from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge, ClassSelectList, EntityRow } from './_shared';

const PAGE = 25;

export default function PopulationCompleteness() {
  const [data, setData] = useState<PopulationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.populationSummary().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const sel = data.classes.find((c) => c.uri === selected) || null;
  const reachable = data.source_reachable;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline
          value={reachable && data.overall_completeness != null ? data.overall_completeness : '—'}
          label="Overall Population Completeness"
          sub="Represented in VKG / objects in source DBs"
        />
        <Headline value={String(data.total_represented)} label="Represented (VKG)" sub="Instances via SPARQL" color="var(--navy)" />
        <Headline
          value={reachable && data.total_source_population != null ? String(data.total_source_population) : '—'}
          label="Source Objects (Teiid)"
          sub="Rows via SQL on source DBs"
          color="var(--navy)"
        />
      </div>

      <div
        className="p-6 border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}
      >
        <div className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>How this is measured</div>
        <div className="text-base" style={{ color: 'var(--text)' }}>
          Represented in VKG ÷ Source objects in databases (Teiid)
        </div>
        <div className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          The share of source-database objects that are represented as instances in the virtual knowledge graph.
        </div>
      </div>

      {!reachable && (
        <div
          className="flex items-start gap-2 px-4 py-3 text-sm border"
          style={{ backgroundColor: '#FEF7E6', color: '#8A5A00', borderColor: 'rgba(224,139,26,0.4)', borderRadius: 'var(--radius-md)' }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Source layer (Teiid) is unreachable, so completeness cannot be computed — showing represented (VKG) counts only.
            {data.source_error ? <div className="text-xs mt-1">{data.source_error}</div> : null}
          </div>
        </div>
      )}

      {reachable && (
        <Section title="Completeness Ranking" collapsible>
          <Ranking entries={data.classes} onSelect={setSelected} selected={selected} />
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2">
          <ClassSelectList
            title="Classes"
            items={[...data.classes]}
            getKey={(c) => c.uri}
            getSearchText={(c) => `${c.label || ''} ${c.class}`}
            selectedKey={selected}
            onSelect={(k) => setSelected(k === selected ? null : k)}
            renderRow={(c) => <ClassRow entry={c} reachable={reachable} />}
            maxHeight={560}
          />
        </div>
        <div className="lg:col-span-3 lg:sticky lg:top-4">
          {sel ? (
            <ClassDetail entry={sel} reachable={reachable} onClose={() => setSelected(null)} />
          ) : (
            <Section title="Class Detail">
              <div className="py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No class selected.</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassRow({ entry, reachable }: { entry: PopulationEntry; reachable: boolean }) {
  return (
    <>
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--text)' }}>{entry.label || entry.class}</div>
        <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{entry.class}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
          {entry.represented.toLocaleString()}
          {reachable && entry.source_population != null ? ` / ${entry.source_population.toLocaleString()}` : ''}
        </span>
        {reachable && entry.completeness != null ? <StatusBadge percent={entry.completeness} /> : null}
      </div>
    </>
  );
}

function Ranking({
  entries,
  onSelect,
  selected,
}: {
  entries: PopulationEntry[];
  onSelect: (c: string) => void;
  selected: string | null;
}) {
  const ranked = useMemo(
    () =>
      entries
        .filter((c) => c.completeness != null && c.source_population != null && c.source_population > 0)
        .sort((a, b) => (a.completeness! - b.completeness!))
        .map((c) => ({
          name: c.label || c.class,
          rawUri: c.uri,
          completeness: c.completeness!,
          represented: c.represented,
          source: c.source_population!,
        })),
    [entries],
  );

  if (ranked.length === 0) {
    return <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No classes with source population.</div>;
  }

  return (
    <div className="always-scrollbar max-h-[500px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(220, ranked.length * 40)}>
        <BarChart data={ranked} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            formatter={(v: number, _n, p) => [`${v.toFixed(2)}%`, `${p.payload.represented} / ${p.payload.source}`]}
          />
          <Bar
            dataKey="completeness"
            radius={[0, 6, 6, 0]}
            onClick={(d: any) => onSelect(d.rawUri)}
            style={{ cursor: 'pointer' }}
          >
            {ranked.map((d, i) => (
              <Cell key={i} fill={statusColor(d.completeness)} fillOpacity={selected && d.rawUri !== selected ? 0.35 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassDetail({ entry, reachable, onClose }: { entry: PopulationEntry; reachable: boolean; onClose: () => void }) {
  const hasSource = reachable && entry.source_population != null;
  const color = entry.completeness != null ? statusColor(entry.completeness) : 'var(--navy)';

  return (
    <Section
      title={entry.label || entry.class}
      subtitle={entry.label ? entry.class : undefined}
      right={
        <button onClick={onClose} className="text-sm" style={{ color: 'var(--accent)' }}>
          Clear selection
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Completeness" value={entry.completeness != null ? `${entry.completeness.toFixed(1)}%` : '—'} color={color} />
        <Stat label="Represented (VKG)" value={entry.represented.toLocaleString()} color="var(--navy)" />
        <Stat label="Source objects" value={hasSource ? entry.source_population!.toLocaleString() : '—'} color="var(--navy)" />
      </div>

      {hasSource && entry.missing != null && entry.missing > 0 && (
        <div
          className="flex items-start gap-2 px-3 py-2 text-sm border mb-6"
          style={{ backgroundColor: '#FEF7E6', color: '#8A5A00', borderColor: 'rgba(224,139,26,0.4)', borderRadius: 'var(--radius-md)' }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>{entry.missing.toLocaleString()}</strong> source object(s) are not represented in the VKG.
          </div>
        </div>
      )}

      <div className="text-sm mb-2" style={{ color: 'var(--navy)' }}>Source population by entity group</div>
      {entry.by_source.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {hasSource ? 'No source tables.' : 'Source layer unavailable.'}
        </div>
      ) : (
        <ul className="space-y-1 text-sm">
          {entry.by_source.map((s) => (
            <li
              key={s.table}
              className="flex items-center justify-between px-3 py-2 border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
            >
              <span style={{ color: 'var(--text)' }}>{s.table}</span>
              <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{s.source_population.toLocaleString()} rows</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm mb-3" style={{ color: 'var(--navy)' }}>Represented entities</div>
        <EntityDrilldown classUri={entry.uri} />
      </div>
    </Section>
  );
}

function EntityDrilldown({ classUri }: { classUri: string }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PopulationEntities | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOffset(0);
    setData(null);
  }, [classUri]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    completenessApi
      .populationEntities({ class_uri: classUri, limit: PAGE, offset })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classUri, offset]);

  const total = data?.pagination.total ?? null;

  if (loading && !data) {
    return <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>;
  }
  if (!data || data.entities.length === 0) {
    return <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No entities for this class.</div>;
  }

  return (
    <>
      <ul className="space-y-1 text-sm">
        {data.entities.map((e) => (
          <li key={e.uri}>
            <EntityRow
              uri={e.uri}
              label={e.label}
              right={e.source ? (
                <span
                  className="text-xs px-2 py-0.5"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}
                >
                  {e.source}
                </span>
              ) : undefined}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <span>
          {offset + 1}–{offset + data.entities.length}
          {total != null ? ` of ${total}` : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            disabled={offset === 0}
            className="inline-flex items-center gap-1 px-3 py-1 border disabled:opacity-40"
            style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            onClick={() => setOffset(offset + PAGE)}
            disabled={total != null && offset + data.entities.length >= total}
            className="inline-flex items-center gap-1 px-3 py-1 border disabled:opacity-40"
            style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
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
