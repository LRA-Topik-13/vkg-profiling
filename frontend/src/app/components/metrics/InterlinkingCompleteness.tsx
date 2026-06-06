import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, Search, AlertTriangle, FileText } from 'lucide-react';
import {
  completenessApi,
  Interlinking,
  InterlinkingClass,
  InterlinkingClassDetail,
  InterlinkingEntities,
  InterlinkingEntityDetail,
  InterlinkingEntityGroup,
  LinkDetail,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, SwatchLegend, PaginatedTable, SearchInput, prettyId } from './_shared';
import { SourceBadge, getEntitySource } from './accuracyShared';
import { useSources } from '../../lib/sources';

const LINK_LEGEND = [
  { label: 'Linked', color: '#1F8A4C' },
  { label: 'Not Linked', color: '#9E2B0A' },
];

const PAGE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

// Strip the datasource prefix from an entity URI so chips/tables show just the
// local id (e.g. "course/1"); the source is surfaced separately via <SourceBadge>.
function entityLocalId(uri: string): string {
  const src = getEntitySource(uri);
  if (src !== 'unknown' && uri.startsWith(src)) {
    const tail = uri.slice(src.length);
    if (tail) {
      try {
        return decodeURIComponent(tail);
      } catch {
        return tail;
      }
    }
  }
  return prettyId(uri);
}

export default function InterlinkingCompleteness() {
  const [data, setData] = useState<Interlinking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [analyzedClass, setAnalyzedClass] = useState<string | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    completenessApi.interlinking().then(setData).catch((e) => setError(String(e)));
  }, []);

  function pickFromChart(classKey: string) {
    setSelectedClass(classKey);
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function analyze() {
    if (!selectedClass) return;
    setAnalyzedClass(selectedClass);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  if (error) return <ErrorState message={error} />;

  const loading = !data;
  const classOptions = data
    ? [...data.classes].filter((c) => c.total_entities > 0).sort((a, b) => a.ratio - b.ratio)
    : [];
  const sel = data ? data.classes.find((c) => c.class === analyzedClass) || null : null;
  const stale = sel !== null && selectedClass !== '' && selectedClass !== analyzedClass;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline
          value={data ? data.overall_ratio : '…'}
          label="Overall Linked Ratio"
          sub="Entities with ≥ 1 link / total"
        />
        <Headline
          value={data ? String(data.classes.reduce((s, c) => s + c.linked, 0)) : '…'}
          label="Linked Entities"
          sub="Across all classes"
          color="var(--navy)"
        />
        <Headline
          value={data ? String(data.classes.reduce((s, c) => s + c.not_linked, 0)) : '…'}
          label="Not Linked Entities"
          sub="No incoming or outgoing link"
          color={data ? statusColor(100 - data.overall_ratio) : 'var(--navy)'}
        />
      </div>

      <Section
        title="Interlinking Completeness of All Classes"
        subtitle="Click a bar to select that class below, then Analyze."
        collapsible
      >
        {loading ? (
          <LoadingState />
        ) : (
          <StackedLinkChart classes={data.classes} onSelect={pickFromChart} selected={selectedClass || null} />
        )}
      </Section>

      <div ref={configRef}>
        <Section
          title="Interlinking Completeness of a Class"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Class">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{loading ? 'Loading…' : 'Choose a class…'}</option>
                {classOptions.map((c) => (
                  <option key={c.class} value={c.class}>{c.label || c.class}</option>
                ))}
              </select>
            </Field>
          </div>

          <button
            onClick={analyze}
            disabled={!selectedClass || loading}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
          >
            <Search className="w-4 h-4" />
            Analyze
          </button>
        </Section>
      </div>

      {stale && (
        <div
          className="flex items-start gap-2 px-3 py-2 text-sm border"
          style={{ backgroundColor: '#FEF7E6', color: '#8A5A00', borderColor: 'rgba(224,139,26,0.4)', borderRadius: 'var(--radius-md)' }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>Selection changed since last analysis. Click <strong>Analyze</strong> to refresh results.</div>
        </div>
      )}

      <div ref={resultRef}>
        {sel ? (
          <ClassDetail
            entry={sel}
            onClose={() => {
              setAnalyzedClass(null);
              setSelectedClass('');
            }}
          />
        ) : !loading ? (
          <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
            <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
            <p className="text-sm font-medium">Select a class, then click Analyze.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
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
          total: c.total_entities,
        })),
    [classes],
  );

  return (
    <>
    <SwatchLegend items={LINK_LEGEND} className="justify-end mb-2" />
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
                    <li>{Number(d.not_linked).toLocaleString()} not linked ({(100 - d.ratio).toFixed(1)}%)</li>
                  </ul>
                </div>
              );
            }}
          />
          <Bar
            dataKey="linked"
            name="Linked"
            stackId="a"
            fill="#1F8A4C"
            radius={[0, 0, 0, 0]}
            onClick={(d: any) => onSelect(d.rawClass)}
            style={{ cursor: 'pointer' }}
            fillOpacity={(d: any) => (selected && d.rawClass !== selected ? 0.35 : 1)}
          />
          <Bar
            dataKey="not_linked"
            name="Not Linked"
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
    </>
  );
}

function ClassDetail({ entry, onClose }: { entry: InterlinkingClass; onClose: () => void }) {
  const [detail, setDetail] = useState<InterlinkingClassDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    completenessApi
      .interlinkingClass({ class_uri: entry.uri })
      .then((r) => !cancelled && setDetail(r))
      .catch((e) => !cancelled && setDetailError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [entry.uri]);

  const outgoing = detail ? detail.links.filter((l) => l.direction === 'outgoing') : [];
  const incoming = detail ? detail.links.filter((l) => l.direction === 'incoming') : [];

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

      {detailError ? (
        <div className="mb-6"><ErrorState message={detailError} /></div>
      ) : !detail ? (
        <div className="mb-6"><LoadingState /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <LinkList title="Outgoing properties" links={outgoing} />
          <LinkList title="Incoming properties" links={incoming} />
        </div>
      )}

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

function LinkCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div
      className="p-4 border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="font-medium" style={{ color: 'var(--navy)' }}>{title}</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyText({ text = 'None' }: { text?: string }) {
  return <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{text}</div>;
}

function LinkList({ title, links }: { title: string; links: LinkDetail[] }) {
  return (
    <LinkCard title={title} count={links.length}>
      {links.length === 0 ? (
        <EmptyText />
      ) : (
        <ul className="always-scrollbar space-y-2.5 max-h-72 overflow-y-scroll pr-1">
          {links.map((l, i) => {
            const otherClass = l.direction === 'outgoing' ? l.targetClass : l.sourceClass;
            const prep = l.direction === 'outgoing' ? 'to' : 'from';
            return (
              <li key={`${l.direction}-${l.property}-${i}`} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-medium" style={{ color: 'var(--text)' }}>
                    {l.propertyLabel || l.property}
                  </span>
                  <span className="ml-auto tabular-nums whitespace-nowrap text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {l.count} {l.count === 1 ? 'link' : 'links'}
                  </span>
                </div>
                <div className="mt-0.5 text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {prep}{' '}
                  {otherClass ? (
                    <span style={{ color: 'var(--text)' }}>{otherClass}</span>
                  ) : (
                    <span
                      className="italic"
                      title="Linked resource has no known class in the data (not resolved from the source)"
                    >
                      an unknown class
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LinkCard>
  );
}

function EntityLinkColumn({ title, groups }: { title: string; groups: InterlinkingEntityGroup[] }) {
  useSources(); // ensure source labels resolve and re-render once loaded
  const total = groups.reduce((s, g) => s + g.count, 0);
  return (
    <LinkCard title={title} count={total}>
      {groups.length === 0 ? (
        <EmptyText />
      ) : (
        <ul className="always-scrollbar space-y-3 max-h-96 overflow-y-scroll pr-1">
          {groups.map((g) => (
            <li key={g.class.uri}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="truncate font-medium" style={{ color: 'var(--text)' }}>
                  {g.class.label || prettyId(g.class.uri)}
                </span>
                <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  {g.count}
                </span>
              </div>
              <ul className="mt-1.5 ml-1 space-y-1 pl-3" style={{ borderLeft: '1px solid var(--border)' }}>
                {g.properties.map((p) => (
                  <li
                    key={p.uri}
                    className="text-xs flex items-baseline gap-2"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <span className="truncate">{p.label || p.localName}</span>
                    <span className="ml-auto tabular-nums whitespace-nowrap">{p.count}</span>
                  </li>
                ))}
              </ul>
              {g.entities.length > 0 && (
                <div className="mt-2 ml-3 flex flex-wrap items-center gap-1">
                  {g.entities.map((e) => (
                    <span
                      key={e.uri}
                      className="inline-flex items-center gap-1 text-xs pl-1 pr-2 py-0.5 max-w-[220px]"
                      style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
                      title={e.uri}
                    >
                      <SourceBadge source={getEntitySource(e.uri)} />
                      <span className="truncate">{e.label || entityLocalId(e.uri)}</span>
                    </span>
                  ))}
                  {g.entity_count > g.entities.length && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      +{(g.entity_count - g.entities.length).toLocaleString()} more
                    </span>
                  )}
                </div>
              )}
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
      .interlinkingEntityDetail({ class_uri: classUri, entity_uri: entityUri })
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
          <EntityLinkColumn title="Outgoing links" groups={data.outgoing} />
          <EntityLinkColumn title="Incoming links" groups={data.incoming} />
        </div>
      )}
    </div>
  );
}

function EntityDrilldown({ classUri }: { classUri: string }) {
  useSources(); // ensure source labels resolve and re-render once loaded
  const [status, setStatus] = useState<'linked' | 'not_linked'>('not_linked');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const [data, setData] = useState<InterlinkingEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ uri: string; label?: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  useEffect(() => {
    setOffset(0);
    setData(null);
    setSelected(null);
    setQuery('');
    setAppliedQuery('');
  }, [classUri, status]);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQuery(query);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    completenessApi
      .interlinkingEntities({ class_uri: classUri, status, limit: pageSize, offset, q: appliedQuery.trim() || undefined })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classUri, status, offset, pageSize, appliedQuery]);

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
          Not Linked
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
        <div className="ml-auto flex items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search entities…" compact width="w-48" />
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
            {total != null ? `${total.toLocaleString()} entities` : ' '}
          </span>
        </div>
      </div>

      {data && data.entities.length > 0 && (
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--navy)' }}>
          Click a row to see that entity's outgoing &amp; incoming links.
        </p>
      )}

      {loading && !data ? (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
      ) : (
        <PaginatedTable
          colSpan={2}
          pagination={data?.pagination ?? null}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={loading}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setOffset(0);
          }}
          onPrev={() => setOffset(Math.max(0, offset - pageSize))}
          onNext={() => setOffset(offset + pageSize)}
          emptyState={
            <div className="py-10 text-center" style={{ color: 'var(--muted-foreground)' }}>
              <FileText className="mx-auto mb-3 w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">{appliedQuery.trim() ? `No entities match “${appliedQuery.trim()}”.` : 'No entities in this category.'}</p>
            </div>
          }
          head={
            <>
              <th className="text-left px-4 py-3" style={{ color: 'var(--text-on-dark)' }}>Entity</th>
              <th className="text-left px-4 py-3" style={{ color: 'var(--text-on-dark)' }}>Source</th>
            </>
          }
        >
          {data?.entities.map((e) => (
            <tr
              key={e.uri}
              onClick={() => setSelected({ uri: e.uri, label: e.label })}
              className="group cursor-pointer transition-colors hover:bg-[var(--muted)]"
              style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}
            >
              <td className="px-4 py-2 text-sm" title={e.uri}>
                <span
                  className="truncate underline decoration-dotted underline-offset-2 group-hover:decoration-solid"
                  style={{ color: 'var(--navy)' }}
                >
                  {e.label || entityLocalId(e.uri)}
                </span>
              </td>
              <td className="px-4 py-2 text-sm">
                <span className="flex items-center justify-between gap-2">
                  <SourceBadge source={getEntitySource(e.uri)} />
                  <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--navy)' }} />
                </span>
              </td>
            </tr>
          ))}
        </PaginatedTable>
      )}
    </div>
  );
}

