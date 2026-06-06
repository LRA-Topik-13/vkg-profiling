import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Search, FileText } from 'lucide-react';
import { completenessApi, PopulationSummary, PopulationEntry, PopulationEntities, statusColor } from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusLegend, PaginatedTable, SearchInput, prettyId } from './_shared';
import { SourceBadge } from './accuracyShared';

const PAGE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export default function PopulationCompleteness() {
  const [data, setData] = useState<PopulationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUri, setSelectedUri] = useState<string>('');
  const [analyzedUri, setAnalyzedUri] = useState<string | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    completenessApi.population().then(setData).catch((e) => setError(String(e)));
  }, []);

  function pickFromChart(uri: string) {
    setSelectedUri(uri);
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function analyze() {
    if (!selectedUri) return;
    setAnalyzedUri(selectedUri);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  if (error) return <ErrorState message={error} />;

  const loading = !data;
  const sel = data ? data.classes.find((c) => c.uri === analyzedUri) || null : null;
  const reachable = data ? data.source_reachable : false;
  const stale = sel !== null && selectedUri !== '' && selectedUri !== analyzedUri;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline
          value={!data ? '…' : reachable && data.overall_completeness != null ? data.overall_completeness : '—'}
          label="Overall Population Completeness"
          sub="Represented in VKG / objects in source DBs"
        />
        <Headline value={data ? String(data.total_represented) : '…'} label="Represented (VKG)" sub="Instances via SPARQL" color="var(--navy)" />
        <Headline
          value={!data ? '…' : reachable && data.total_source_population != null ? String(data.total_source_population) : '—'}
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

      {data && !reachable && (
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

      {loading ? (
        <Section title="Population Completeness of All Classes" subtitle="Click a bar to select that class below, then Analyze." collapsible>
          <LoadingState />
        </Section>
      ) : reachable ? (
        <Section title="Population Completeness of All Classes" subtitle="Click a bar to select that class below, then Analyze." collapsible>
          <Ranking entries={data.classes} onSelect={pickFromChart} selected={selectedUri || null} />
        </Section>
      ) : null}

      <div ref={configRef}>
        <Section
          title="Population Completeness of a Class"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Class">
              <select
                value={selectedUri}
                onChange={(e) => setSelectedUri(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{loading ? 'Loading…' : 'Choose a class…'}</option>
                {data ? data.classes.map((c) => (
                  <option key={c.uri} value={c.uri}>{c.label || c.class}</option>
                )) : null}
              </select>
            </Field>
          </div>

          <button
            onClick={analyze}
            disabled={!selectedUri || loading}
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
            reachable={reachable}
            onClose={() => {
              setAnalyzedUri(null);
              setSelectedUri('');
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
    <>
    <StatusLegend className="justify-end mb-2" />
    <div className="always-scrollbar max-h-[340px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(200, ranked.length * 36)}>
        <BarChart data={ranked} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload?.length) return null;
              const d = props.payload[0].payload;
              const missing = Math.max(0, d.source - d.represented);
              return (
                <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: 13 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>{d.name}</div>
                  <ul style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                    <li>{Number(d.represented).toLocaleString()} represented (VKG)</li>
                    <li>{Number(d.source).toLocaleString()} source objects</li>
                    <li>{missing.toLocaleString()} not represented</li>
                    <li>completeness: {Number(d.completeness).toFixed(2)}%</li>
                  </ul>
                </div>
              );
            }}
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
    </>
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
  const [pageSize, setPageSize] = useState(PAGE);
  const [data, setData] = useState<PopulationEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  useEffect(() => {
    setOffset(0);
    setData(null);
    setQuery('');
    setAppliedQuery('');
  }, [classUri]);

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
      .populationEntities({ class_uri: classUri, limit: pageSize, offset, q: appliedQuery.trim() || undefined })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classUri, offset, pageSize, appliedQuery]);

  if (loading && !data) {
    return <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>;
  }

  return (
    <>
    <div className="flex justify-end mb-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search entities…" />
    </div>
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
          <p className="text-sm font-medium">{appliedQuery.trim() ? `No entities match “${appliedQuery.trim()}”.` : 'No entities for this class.'}</p>
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
        <tr key={e.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <td className="px-4 py-2 text-sm" style={{ color: 'var(--text)' }} title={e.uri}>
            <span className="block truncate max-w-[420px]">{e.label || prettyId(e.uri)}</span>
          </td>
          <td className="px-4 py-2 text-left">
            {e.source ? <SourceBadge source={e.source} /> : null}
          </td>
        </tr>
      ))}
    </PaginatedTable>
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
