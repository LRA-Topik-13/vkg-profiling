import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, AlertTriangle, Check, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  completenessApi,
  metadataApi,
  ClassMeta,
  PropertyMeta,
  CompletenessMatrix,
  ClassSummary,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge, PaginatedTable, SearchInput, EmptyState, prettyId } from './_shared';

const PAGE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface Facet {
  propUri: string;
  propLabel: string;
  valueUri: string;
}

interface FacetDraft {
  propUri: string;
  valueUri: string;
  values: string[];
  loading: boolean;
  error: string | null;
}

const EMPTY_DRAFT: FacetDraft = {
  propUri: '',
  valueUri: '',
  values: [],
  loading: false,
  error: null,
};

export default function PropertyCompleteness() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [props, setProps] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState<string>('');
  const [selectedPropUris, setSelectedPropUris] = useState<string[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [draft, setDraft] = useState<FacetDraft>(EMPTY_DRAFT);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const [data, setData] = useState<CompletenessMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedSignature, setAnalyzedSignature] = useState<string | null>(null);
  const [tableQuery, setTableQuery] = useState('');
  const configRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSignature = useMemo(() => {
    if (!selectedClassUri || selectedPropUris.length === 0) return null;
    const facetKey = facets.map((f) => `${f.propUri}::${f.valueUri}`).sort().join('|');
    const propKey = [...selectedPropUris].sort().join('|');
    return `${selectedClassUri}::${propKey}::${facetKey}`;
  }, [selectedClassUri, selectedPropUris, facets]);

  const stale = data !== null && currentSignature !== null && analyzedSignature !== currentSignature;

  const selectedClass = useMemo(
    () => classes.find((c) => c.uri === selectedClassUri) || null,
    [classes, selectedClassUri],
  );

  useEffect(() => {
    metadataApi.mappedClasses().then((r) => setClasses(r.classes)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setSelectedPropUris([]);
    setFacets([]);
    setDraft(EMPTY_DRAFT);
    setData(null);
    setAnalyzedSignature(null);
    setTableQuery('');
    if (!selectedClass) {
      setProps([]);
      return;
    }
    metadataApi
      .mappedProperties(selectedClass.uri)
      .then((r) => {
        setProps(r.properties);
        setSelectedPropUris(r.properties.map((p) => p.uri));
      })
      .catch((e) => setError(String(e)));
  }, [selectedClass]);

  useEffect(() => {
    if (!draft.propUri || !selectedClass) {
      setDraft((d) => ({ ...d, valueUri: '', values: [], loading: false, error: null }));
      return;
    }
    const propEntry = props.find((p) => p.uri === draft.propUri);
    if (!propEntry) {
      setDraft((d) => ({ ...d, valueUri: '', values: [], loading: false, error: null }));
      return;
    }
    setDraft((d) => ({ ...d, valueUri: '', loading: true, error: null }));
    metadataApi
      .facets(selectedClass.uri, propEntry.uri)
      .then((r) => setDraft((d) => ({ ...d, values: r.values, loading: false })))
      .catch((e) => setDraft((d) => ({ ...d, values: [], loading: false, error: String(e) })));
  }, [selectedClass, draft.propUri, props]);

  const objectProps = useMemo(() => props.filter((p) => p.type === 'object'), [props]);

  const overlappingProps = useMemo(() => {
    const facetUris = new Set(facets.map((f) => f.propUri));
    return selectedPropUris
      .filter((uri) => facetUris.has(uri))
      .map((uri) => {
        const p = props.find((pp) => pp.uri === uri);
        return p ? (p.label || p.localName) : uri;
      });
  }, [facets, selectedPropUris, props]);

  function togglePropUri(uri: string) {
    setSelectedPropUris((prev) => (prev.includes(uri) ? prev.filter((p) => p !== uri) : [...prev, uri]));
  }

  function addFacet(valueUri: string) {
    if (!draft.propUri || !valueUri) return;
    const propEntry = props.find((p) => p.uri === draft.propUri);
    if (!propEntry) return;
    const duplicate = facets.some((f) => f.propUri === draft.propUri && f.valueUri === valueUri);
    if (!duplicate) {
      setFacets((prev) => [
        ...prev,
        {
          propUri: draft.propUri,
          propLabel: propEntry.label || propEntry.localName,
          valueUri,
        },
      ]);
    }
    setDraft((d) => ({ ...d, propUri: '', valueUri: '' }));
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
  }

  async function analyze(newOffset = 0, newPageSize = pageSize, q = tableQuery) {
    if (!selectedClassUri || selectedPropUris.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await completenessApi.matrix({
        class_uri: selectedClassUri,
        properties: selectedPropUris.join(','),
        filter_facets: facets.length > 0 ? facets.map((f) => `${f.propUri}::${f.valueUri}`).join(',') : undefined,
        limit: newPageSize,
        offset: newOffset,
        sort: 'completeness',
        q: q.trim() || undefined,
      });
      setData(r);
      setOffset(newOffset);
      setPageSize(newPageSize);
      setAnalyzedSignature(currentSignature);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Debounced re-query of the entity table when the search text changes.
  function onTableSearch(value: string) {
    setTableQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => analyze(0, pageSize, value), 300);
  }

  return (
    <div className="space-y-6">
      <ClassCompletenessOverview onBarClick={(classUri) => {
        setSelectedClassUri(classUri);
        setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }} />

      <div ref={configRef}>
      <Section
        title="Property Completeness of a Class"
        subtitle="Filter the analysis to one class and a subset of its properties. Optional facets (predicate + object) narrow entities further using AND semantics."
      >
        <Field label="Class">
          <select
            value={selectedClassUri}
            onChange={(e) => setSelectedClassUri(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border"
            style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
          >
            <option value="">Choose a class…</option>
            {classes.map((c) => (
              <option key={c.uri} value={c.uri}>{c.label || c.localName}</option>
            ))}
          </select>
        </Field>

        <div className="mt-4">
          <Field label="Add facet filter (optional)">
            <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Facet filters limit which entities are evaluated before completeness is calculated.
            </p>
            <div className="flex gap-2 w-full">
              <select
                disabled={!selectedClassUri || objectProps.length === 0}
                value={draft.propUri}
                onChange={(e) => setDraft((d) => ({ ...d, propUri: e.target.value }))}
                className="w-1/2 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">Select predicate...</option>
                {objectProps.map((p) => (
                  <option key={p.uri} value={p.uri}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!draft.propUri || draft.loading}
                value={draft.valueUri}
                onChange={(e) => { if (e.target.value) addFacet(e.target.value); }}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{draft.loading ? 'Loading values...' : 'Select a value...'}</option>
                {draft.values.map((v) => (
                  <option key={v} value={v}>{shortenUri(v)}</option>
                ))}
              </select>
            </div>
            {draft.error && (
              <div className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
                Failed to load facet values. Check API connectivity.
              </div>
            )}
          </Field>
        </div>

        {facets.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2 text-sm" style={{ color: 'var(--text)' }}>
              <span>
                Active facets <span style={{ color: 'var(--muted-foreground)' }}>(AND)</span>
              </span>
              <button
                onClick={() => setFacets([])}
                className="text-xs underline"
                style={{ color: 'var(--accent)' }}
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {facets.map((f, i) => (
                <span
                  key={`${f.propUri}::${f.valueUri}`}
                  className="inline-flex items-center gap-2 px-2 py-1 text-xs border"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span>
                    <span style={{ color: 'var(--text)' }}>{f.propLabel}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}> = </span>
                    <span>{shortenUri(f.valueUri)}</span>
                  </span>
                  <button
                    onClick={() => removeFacet(i)}
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
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm" style={{ color: 'var(--text)' }}>Properties to evaluate</div>
            {props.length > 0 && (
              <button
                onClick={() => setSelectedPropUris(selectedPropUris.length === props.length ? [] : props.map((p) => p.uri))}
                className="text-xs underline"
                style={{ color: 'var(--navy)' }}
              >
                {selectedPropUris.length === props.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {props.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Pick a class first.</div>
          ) : (
            <div className="always-scrollbar grid grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-scroll pr-2">
              {props.map((p) => {
                const active = selectedPropUris.includes(p.uri);
                return (
                  <label
                    key={p.uri}
                    className="flex items-center gap-2 px-3 py-2 border cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <input type="checkbox" checked={active} onChange={() => togglePropUri(p.uri)} style={{ accentColor: 'var(--accent)' }} />
                    <span className="truncate" style={{ color: 'var(--text)' }} title={p.label || p.localName}>
                      {p.label || p.localName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {overlappingProps.length > 0 && (
          <div
            className="mt-4 flex items-start gap-2 px-3 py-2 text-sm border"
            style={{
              backgroundColor: '#FEF7E6',
              color: '#8A5A00',
              borderColor: 'rgba(224,139,26,0.4)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div>
                {overlappingProps.length === 1 ? 'Property' : 'Properties'}{' '}
                <strong>{overlappingProps.join(', ')}</strong>{' '}
                {overlappingProps.length === 1 ? 'is' : 'are'} used as both a facet predicate and an evaluated property.
              </div>
              <div className="text-xs mt-1" style={{ color: '#8A5A00' }}>
                Its completeness will be 100% by construction (facet forces the predicate to exist).
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => { setTableQuery(''); analyze(0, pageSize, ''); }}
          disabled={!selectedClassUri || selectedPropUris.length === 0 || loading}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
        >
          <Search className="w-4 h-4" />
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </Section>
      </div>

      {error && <ErrorState message={error} />}
      {loading && !data && <LoadingState />}

      {data && stale && (
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
          <div>Configuration changed since last analysis. Click <strong>Analyze</strong> to refresh results.</div>
        </div>
      )}

      {data && (
        <ResultsView
          data={data}
          offset={offset}
          pageSize={pageSize}
          loading={loading}
          search={tableQuery}
          onSearch={onTableSearch}
          onPage={(o) => analyze(o)}
          onPageSizeChange={(s) => analyze(0, s)}
        />
      )}

      {!data && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Select a class and properties, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}

function ResultsView({
  data,
  offset,
  pageSize,
  loading,
  search,
  onSearch,
  onPage,
  onPageSizeChange,
}: {
  data: CompletenessMatrix;
  offset: number;
  pageSize: number;
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  onPage: (o: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const labelOf = (uri: string) =>
    data.property_info.find((p) => p.uri === uri)?.label ||
    data.property_info.find((p) => p.uri === uri)?.localName ||
    shortenUri(uri);

  const barData = [...data.summary.by_property]
    .sort((a, b) => {
      const diff = a.completeness - b.completeness;
      if (diff !== 0) return diff;
      return labelOf(a.property).localeCompare(labelOf(b.property));
    })
    .map((p) => ({
      name: labelOf(p.property),
      completeness: p.completeness,
      filled: p.filled,
      missing: p.missing,
    }));

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.summary.overall_completeness} label="Overall Completeness" sub={`Class: ${data.class}`} />
        <Headline value={String(data.summary.total_entities)} label="Total Entities" sub="Entities in scope" color="var(--navy)" />
        <Headline value={String(data.properties.length)} label="Properties Analyzed" sub="Active selection" color="var(--navy)" />
      </div>

      <Section
        title="Completeness per Property"
      >
        <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 48)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 24, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const d = props.payload[0].payload;
                const total = d.filled + d.missing;
                return (
                  <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: 13 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>{d.name}</div>
                    <ul style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                      <li>{Number(d.filled).toLocaleString()} of {Number(total).toLocaleString()} entities filled</li>
                      <li>{Number(d.missing).toLocaleString()} missing</li>
                      <li>completeness: {Number(d.completeness).toFixed(2)}%</li>
                    </ul>
                  </div>
                );
              }}
            />
            <Bar dataKey="completeness" radius={[0, 6, 6, 0]}>
              {barData.map((d, i) => (
                <Cell key={i} fill={statusColor(d.completeness)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section
        title="Completeness per Entity"
        subtitle="Each row is an entity; ✓ marks a filled property. Ordered by lowest completeness first."
        right={<SearchInput value={search} onChange={onSearch} placeholder="Search entities…" />}
      >
        <PaginatedTable
          colSpan={data.properties.length + 2}
          pagination={data.pagination ?? null}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={loading}
          onPageSizeChange={onPageSizeChange}
          onPrev={() => onPage(Math.max(0, offset - pageSize))}
          onNext={() => onPage(offset + pageSize)}
          emptyState={
            <EmptyState message={search.trim() ? `No entities match “${search.trim()}”.` : 'No entities.'} />
          }
          head={
            <>
              <th
                className="text-left px-4 py-3"
                style={{ color: 'var(--text-on-dark)', position: 'sticky', left: 0, zIndex: 3, backgroundColor: 'var(--navy)' }}
              >
                Entity
              </th>
              {data.properties.map((p) => (
                <th key={p} className="text-center px-2 py-3" style={{ color: 'var(--text-on-dark)' }} title={labelOf(p)}>
                  {shortText(labelOf(p))}
                </th>
              ))}
              <th
                className="text-right px-4 py-3"
                style={{ color: 'var(--text-on-dark)', position: 'sticky', right: 0, zIndex: 3, backgroundColor: 'var(--navy)' }}
              >
                Score
              </th>
            </>
          }
        >
          {data.entities.map((e) => (
            <tr key={e.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
              <td
                className="px-4 py-2 truncate max-w-[280px] text-sm"
                style={{ color: 'var(--text)', position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'var(--card)' }}
                title={e.uri}
              >
                {e.label || prettyId(e.uri)}
              </td>
              {data.properties.map((p) => {
                const has = e.scores[p];
                return (
                  <td key={p} className="px-2 py-2 text-center">
                    {has ? (
                      <span
                        className="inline-flex items-center justify-center align-middle"
                        style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: '#1F8A4C' }}
                        aria-label="Filled"
                      >
                        <Check className="w-3 h-3" strokeWidth={3} style={{ color: '#fff' }} />
                      </span>
                    ) : (
                      <span className="align-middle" style={{ color: 'var(--muted-foreground)', opacity: 0.35 }} aria-label="Missing">–</span>
                    )}
                  </td>
                );
              })}
              <td
                className="px-4 py-2 text-right"
                style={{ position: 'sticky', right: 0, zIndex: 1, backgroundColor: 'var(--card)' }}
              >
                <StatusBadge percent={e.completeness} />
              </td>
            </tr>
          ))}
        </PaginatedTable>
      </Section>
    </>
  );
}

function ClassCompletenessOverview({ onBarClick }: { onBarClick: (classUri: string) => void }) {
  const [data, setData] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    completenessApi.classSummary()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    if (!data) return [];
    return [...data.classes]
      .filter((c) => c.total_entities > 0)
      .sort((a, b) => a.completeness - b.completeness)
      .map((c) => {
        const filled = c.by_property.reduce((s, p) => s + p.filled, 0);
        const missing = c.by_property.reduce((s, p) => s + p.missing, 0);
        return {
          name: c.label || c.class,
          uri: c.uri,
          completeness: c.completeness,
          entities: c.total_entities,
          properties: c.properties_count,
          filled,
          missing,
        };
      });
  }, [data]);

  if (loading) {
    return (
      <Section title="Property Completeness of All Classes" collapsible>
        <LoadingState />
      </Section>
    );
  }

  if (!data || ranked.length === 0) return null;

  return (
    <Section title="Property Completeness of All Classes" subtitle="Click a bar to select that class below, then Analyze." collapsible>
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
                return (
                  <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: 13 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>
                      {d.name} (across all {d.properties} mapped {d.properties === 1 ? 'property' : 'properties'})
                    </div>
                    <ul style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                      <li>{Number(d.entities).toLocaleString()} total entities</li>
                      <li>
                        {Number(d.filled).toLocaleString()} of {Number(d.filled + d.missing).toLocaleString()} property values filled
                        <span style={{ color: 'var(--muted-foreground)' }}> ({Number(d.entities).toLocaleString()} entities × {Number(d.properties).toLocaleString()} properties)</span>
                      </li>
                      <li>{Number(d.missing).toLocaleString()} missing</li>
                      <li>completeness: {Number(d.completeness).toFixed(2)}%</li>
                    </ul>
                  </div>
                );
              }}
            />
            <Bar dataKey="completeness" radius={[0, 6, 6, 0]} style={{ cursor: 'pointer' }} onClick={(d) => onBarClick(d.uri)}>
              {ranked.map((d, i) => (
                <Cell key={i} fill={statusColor(d.completeness)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
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

function shortenUri(uri: string): string {
  if (!uri) return '';
  const hash = uri.lastIndexOf('#');
  if (hash !== -1) {
    const after = uri.slice(hash + 1);
    if (after) return after;
  }
  try {
    const u = new URL(uri);
    return u.pathname.replace(/^\//, '') + u.hash;
  } catch {
    return uri;
  }
}

function shortText(t: string, n = 14): string {
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
