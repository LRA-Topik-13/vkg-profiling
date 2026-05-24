import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  completenessApi,
  Interlinking,
  InterlinkingClass,
  InterlinkingEntities,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge } from './_shared';

const PAGE = 25;

export default function InterlinkingCompleteness() {
  const [data, setData] = useState<Interlinking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    completenessApi.interlinking().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const sel = data.classes.find((c) => c.class === selected) || null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.overall_ratio} label="Overall Linked Ratio" sub="Entities with ≥ 1 link / total" />
        <Headline
          value={data.classes.reduce((s, c) => s + c.linked, 0)}
          label="Linked Entities"
          sub="Across all classes"
          color="var(--navy)"
        />
        <Headline
          value={data.classes.reduce((s, c) => s + c.not_linked, 0)}
          label="Isolated Entities"
          sub="No incoming or outgoing link"
          color={statusColor(100 - data.overall_ratio)}
        />
      </div>

      <Section
        title="Linked vs Isolated per Class"
        subtitle="Stacked horizontal bar — linked count layered against not-linked. Superposition makes proportion immediately readable while parallelism enables ranking across classes."
      >
        <StackedLinkChart classes={data.classes} onSelect={setSelected} selected={selected} />
      </Section>

      {sel ? (
        <ClassDetail entry={sel} onClose={() => setSelected(null)} />
      ) : (
        <Section
          title="Class Detail"
          subtitle="Select a class from the chart above to drill into its outgoing/incoming links and individual entities."
        >
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No class selected.</div>
        </Section>
      )}
    </div>
  );
}

function StackedLinkChart({
  classes,
  onSelect,
  selected,
}: {
  classes: InterlinkingClass[];
  onSelect: (c: string) => void;
  selected: string | null;
}) {
  const sorted = useMemo(
    () =>
      [...classes]
        .filter((c) => c.total_entities > 0)
        .sort((a, b) => a.ratio - b.ratio)
        .map((c) => ({
          name: c.label || c.class,
          rawClass: c.class,
          linked: c.linked,
          not_linked: c.not_linked,
          ratio: c.ratio,
        })),
    [classes],
  );

  return (
    <div className="always-scrollbar max-h-[500px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(220, sorted.length * 44)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" stroke="var(--muted-foreground)" />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            formatter={(v: number, name: string, p) =>
              name === 'linked'
                ? [`${v} linked (${p.payload.ratio.toFixed(1)}%)`, 'Linked']
                : [`${v} isolated`, 'Not linked']
            }
          />
          <Legend />
          <Bar
            dataKey="linked"
            stackId="a"
            fill="#1F8A4C"
            radius={[0, 0, 0, 0]}
            onClick={(d: any) => onSelect(d.rawClass)}
            style={{ cursor: 'pointer' }}
            fillOpacity={(d: any) => (selected && d.rawClass !== selected ? 0.35 : 1)}
          />
          <Bar
            dataKey="not_linked"
            stackId="a"
            fill="#9E2B0A"
            radius={[0, 6, 6, 0]}
            onClick={(d: any) => onSelect(d.rawClass)}
            style={{ cursor: 'pointer' }}
            fillOpacity={(d: any) => (selected && d.rawClass !== selected ? 0.35 : 1)}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClassDetail({ entry, onClose }: { entry: InterlinkingClass; onClose: () => void }) {
  const outgoing = entry.links.filter((l) => l.direction === 'outgoing');
  const incoming = entry.links.filter((l) => l.direction === 'incoming');

  return (
    <Section
      title={`Detail · ${entry.label || entry.class}`}
      subtitle="Drill-down: breakdown of outgoing/incoming object properties and per-entity link status."
      right={
        <button onClick={onClose} className="text-sm" style={{ color: 'var(--accent)' }}>
          Clear selection
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Linked" value={entry.linked} color="#1F8A4C" sub={`${entry.ratio.toFixed(1)}%`} />
        <Stat label="Not Linked" value={entry.not_linked} color="#9E2B0A" sub={`${(100 - entry.ratio).toFixed(1)}%`} />
        <Stat label="Total Entities" value={entry.total_entities} color="var(--navy)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <LinkList title="Outgoing properties" links={outgoing} icon={<ArrowRight className="w-4 h-4" />} />
        <LinkList title="Incoming properties" links={incoming} icon={<ArrowLeft className="w-4 h-4" />} />
      </div>

      <EntityDrilldown classUri={entry.uri} />
    </Section>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-2xl" style={{ color }}>{value.toLocaleString()}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>}
    </div>
  );
}

function LinkList({ title, links, icon }: { title: string; links: import('../../lib/api').LinkDetail[]; icon: React.ReactNode }) {
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--navy)' }}>
        {icon}
        <span>{title}</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {links.length}
        </span>
      </div>
      {links.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>None</div>
      ) : (
        <ul className="always-scrollbar space-y-2 max-h-72 overflow-y-scroll pr-1">
          {links.map((l, i) => (
            <li key={`${l.direction}-${l.property}-${i}`} className="text-sm">
              <div style={{ color: 'var(--text)' }}>{l.propertyLabel || l.property}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                {l.direction === 'outgoing' ? (
                  <>→ {l.targetClass || '?'} · {l.count} links</>
                ) : (
                  <>← {l.sourceClass || '?'} · {l.count} links</>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntityDrilldown({ classUri }: { classUri: string }) {
  const [status, setStatus] = useState<'linked' | 'not_linked'>('not_linked');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<InterlinkingEntities | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOffset(0);
  }, [classUri, status]);

  useEffect(() => {
    setLoading(true);
    completenessApi
      .interlinkingEntities({ class_uri: classUri, status, limit: PAGE, offset })
      .then(setData)
      .finally(() => setLoading(false));
  }, [classUri, status, offset]);

  const total = data?.pagination.total ?? null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setStatus('not_linked')}
          className="px-3 py-1 text-sm border"
          style={{
            backgroundColor: status === 'not_linked' ? 'var(--accent-soft)' : 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: status === 'not_linked' ? 'var(--accent)' : 'var(--text)',
          }}
        >
          Isolated
        </button>
        <button
          onClick={() => setStatus('linked')}
          className="px-3 py-1 text-sm border"
          style={{
            backgroundColor: status === 'linked' ? 'var(--info-soft)' : 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: status === 'linked' ? 'var(--navy)' : 'var(--text)',
          }}
        >
          Linked
        </button>
        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {total != null ? `${total.toLocaleString()} entities` : ' '}
        </span>
      </div>

      {loading && !data ? (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
      ) : data && data.entities.length > 0 ? (
        <>
          <ul className="space-y-1 text-sm">
            {data.entities.map((e) => (
              <li key={e.uri} className="flex items-center gap-2">
                <StatusBadge percent={status === 'linked' ? 100 : 0} />
                <span className="truncate" style={{ color: 'var(--text)' }} title={e.uri}>
                  {e.label || shortenUri(e.uri)}
                </span>
                <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>
                  {shortenUri(e.uri)}
                </span>
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
      ) : (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No entities in this category.
        </div>
      )}
    </div>
  );
}

function shortenUri(uri: string): string {
  if (!uri) return '';
  const i = Math.max(uri.lastIndexOf('#'), uri.lastIndexOf('/'));
  return i > 0 ? uri.slice(i + 1) : uri;
}
