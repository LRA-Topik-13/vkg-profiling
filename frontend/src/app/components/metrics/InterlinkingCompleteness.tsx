import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  completenessApi,
  Interlinking,
  InterlinkingClass,
  InterlinkingEntities,
  InterlinkingEntityDetail,
  InterlinkingEntityGroup,
  LinkDetail,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge, ClassSelectList, EntityRow, prettyId } from './_shared';

const PAGE = 25;

export default function InterlinkingCompleteness() {
  const [data, setData] = useState<Interlinking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    completenessApi.interlinking().then(setData).catch((e) => setError(String(e)));
  }, []);

  function selectAndScroll(key: string | null) {
    setSelected(key);
    if (key) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const sel = data.classes.find((c) => c.class === selected) || null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.overall_ratio} label="Overall Linked Ratio" sub="Entities with ≥ 1 link / total" />
        <Headline
          value={String(data.classes.reduce((s, c) => s + c.linked, 0))}
          label="Linked Entities"
          sub="Across all classes"
          color="var(--navy)"
        />
        <Headline
          value={String(data.classes.reduce((s, c) => s + c.not_linked, 0))}
          label="Isolated Entities"
          sub="No incoming or outgoing link"
          color={statusColor(100 - data.overall_ratio)}
        />
      </div>

      <Section
        title="Linked vs Isolated per Class"
        subtitle="Click a bar to inspect that class below."
        collapsible
      >
        <StackedLinkChart classes={data.classes} onSelect={selectAndScroll} selected={selected} />
      </Section>

      <div ref={detailRef} className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2">
          <ClassSelectList
            title="Classes"
            subtitle="Search or pick a class to see its details."
            items={[...data.classes].filter((c) => c.total_entities > 0).sort((a, b) => a.ratio - b.ratio)}
            getKey={(c) => c.class}
            getSearchText={(c) => `${c.label || ''} ${c.class}`}
            selectedKey={selected}
            onSelect={(k) => selectAndScroll(k === selected ? null : k)}
            renderRow={(c) => <ClassRow entry={c} />}
            maxHeight={560}
          />
        </div>
        <div className="lg:col-span-3">
          {sel ? (
            <ClassDetail entry={sel} onClose={() => setSelected(null)} />
          ) : (
            <Section
              title="Class Detail"
            >
              <div className="py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No class selected.</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassRow({ entry }: { entry: InterlinkingClass }) {
  return (
    <>
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--text)' }}>{entry.label || entry.class}</div>
        <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{entry.class}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
          {entry.linked.toLocaleString()}/{entry.total_entities.toLocaleString()}
        </span>
        <StatusBadge percent={entry.ratio} />
      </div>
    </>
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
          total: c.total_entities,
        })),
    [classes],
  );

  return (
    <div className="always-scrollbar max-h-[340px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 36)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" stroke="var(--muted-foreground)" />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload?.length) return null;
              const d = props.payload[0].payload;
              return (
                <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: 13 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>{d.name}</div>
                  <ul style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                    <li>{Number(d.total).toLocaleString()} total entities</li>
                    <li>{Number(d.linked).toLocaleString()} linked ({d.ratio.toFixed(1)}%)</li>
                    <li>{Number(d.not_linked).toLocaleString()} isolated ({(100 - d.ratio).toFixed(1)}%)</li>
                  </ul>
                </div>
              );
            }}
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
      title={entry.label || entry.class}
      subtitle={entry.label ? entry.class : undefined}
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

function LinkCard({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--navy)' }}>
        {icon}
        <span>{title}</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyText({ text = 'None' }: { text?: string }) {
  return <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{text}</div>;
}

function LinkList({ title, links, icon }: { title: string; links: LinkDetail[]; icon: React.ReactNode }) {
  return (
    <LinkCard title={title} icon={icon} count={links.length}>
      {links.length === 0 ? (
        <EmptyText />
      ) : (
        <ul className="always-scrollbar space-y-2 max-h-72 overflow-y-scroll pr-1">
          {links.map((l, i) => {
            const otherClass = l.direction === 'outgoing' ? l.targetClass : l.sourceClass;
            const arrow = l.direction === 'outgoing' ? '→' : '←';
            return (
              <li key={`${l.direction}-${l.property}-${i}`} className="text-sm">
                <div style={{ color: 'var(--text)' }}>{l.propertyLabel || l.property}</div>
                <div className="text-xs flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="truncate">
                    {arrow}{' '}
                    {otherClass ? (
                      otherClass
                    ) : (
                      <span
                        className="italic"
                        style={{ opacity: 0.6 }}
                        title="Linked resource has no known class in the data (not resolved from the source)"
                      >
                        Unknown
                      </span>
                    )}
                  </span>
                  <span className="ml-auto tabular-nums whitespace-nowrap">{l.count} links</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LinkCard>
  );
}

function EntityLinkColumn({ title, icon, groups }: { title: string; icon: React.ReactNode; groups: InterlinkingEntityGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);
  return (
    <LinkCard title={title} icon={icon} count={total}>
      {groups.length === 0 ? (
        <EmptyText />
      ) : (
        <ul className="always-scrollbar space-y-3 max-h-96 overflow-y-scroll pr-1">
          {groups.map((g) => (
            <li key={g.class.uri}>
              <div className="flex items-center gap-2 text-sm">
                <span className="truncate" style={{ color: 'var(--text)' }}>
                  {g.class.label || prettyId(g.class.uri)}
                </span>
                <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  {g.count}
                </span>
              </div>
              <ul className="mt-1 ml-3 space-y-1">
                {g.properties.map((p) => (
                  <li
                    key={p.uri}
                    className="text-xs flex items-center gap-2"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <span className="truncate">{p.label || p.localName}</span>
                    <span className="ml-auto tabular-nums whitespace-nowrap">{p.count}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </LinkCard>
  );
}

function EntityDetailCard({
  classUri,
  entityUri,
  fallbackLabel,
  onBack,
}: {
  classUri: string;
  entityUri: string;
  fallbackLabel?: string | null;
  onBack: () => void;
}) {
  const [data, setData] = useState<InterlinkingEntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    completenessApi
      .interlinkingEntity({ class_uri: classUri, entity_uri: entityUri })
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [classUri, entityUri]);

  const displayLabel = data?.label || fallbackLabel || prettyId(entityUri);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 px-3 py-1 border shrink-0"
          style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="min-w-0">
          <div className="truncate" style={{ color: 'var(--text)' }} title={entityUri}>
            {displayLabel}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {prettyId(entityUri)}
            {data?.class ? ` · ${data.class}` : ''}
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EntityLinkColumn title="Outgoing" icon={<ArrowRight className="w-4 h-4" />} groups={data.outgoing} />
          <EntityLinkColumn title="Incoming" icon={<ArrowLeft className="w-4 h-4" />} groups={data.incoming} />
        </div>
      )}
    </div>
  );
}

function EntityDrilldown({ classUri }: { classUri: string }) {
  const [status, setStatus] = useState<'linked' | 'not_linked'>('not_linked');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<InterlinkingEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ uri: string; label?: string | null } | null>(null);

  useEffect(() => {
    setOffset(0);
    setData(null);
    setSelected(null);
  }, [classUri, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    completenessApi
      .interlinkingEntities({ class_uri: classUri, status, limit: PAGE, offset })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classUri, status, offset]);

  if (selected) {
    return (
      <EntityDetailCard
        classUri={classUri}
        entityUri={selected.uri}
        fallbackLabel={selected.label}
        onBack={() => setSelected(null)}
      />
    );
  }

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
              <li key={e.uri}>
                <EntityRow
                  uri={e.uri}
                  label={e.label}
                  onClick={() => setSelected({ uri: e.uri, label: e.label })}
                  right={e.direction ? <DirectionBadge direction={e.direction} /> : undefined}
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
      ) : (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No entities in this category.
        </div>
      )}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: 'outgoing' | 'incoming' | 'both' }) {
  const map = {
    outgoing: { sym: '→', label: 'out' },
    incoming: { sym: '←', label: 'in' },
    both: { sym: '↔', label: 'both' },
  } as const;
  const { sym, label } = map[direction];
  return (
    <span
      className="text-xs px-2 py-0.5 shrink-0 whitespace-nowrap"
      style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}
      title={`Has ${direction} link${direction === 'both' ? 's (incoming and outgoing)' : ''}`}
    >
      {sym} {label}
    </span>
  );
}
