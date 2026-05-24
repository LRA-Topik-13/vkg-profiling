import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, AlertTriangle, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  completenessApi,
  metadataApi,
  ClassMeta,
  PropertyMeta,
  CompletenessMatrix,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge, PaginatedTable } from './_shared';

const PAGE = 25;

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

  function addFacet() {
    if (!draft.propUri || !draft.valueUri) return;
    const propEntry = props.find((p) => p.uri === draft.propUri);
    if (!propEntry) return;
    const duplicate = facets.some((f) => f.propUri === draft.propUri && f.valueUri === draft.valueUri);
    if (duplicate) return;
    setFacets((prev) => [
      ...prev,
      {
        propUri: draft.propUri,
        propLabel: propEntry.label || propEntry.localName,
        valueUri: draft.valueUri,
      },
    ]);
    setDraft((d) => ({ ...d, valueUri: '' }));
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
  }

  async function analyze(newOffset = 0, newPageSize = pageSize) {
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

  return (
    <div className="space-y-6">
      <Section
        title="Configuration"
        subtitle="Filter the analysis to one class and a subset of its properties. Optional facets (predicate + object) narrow entities further using AND semantics."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Class">
            <select
              value={selectedClassUri}
              onChange={(e) => setSelectedClassUri(e.target.value)}
              className="w-full px-3 py-2 border"
              style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              <option value="">Choose a class…</option>
              {classes.map((c) => (
                <option key={c.uri} value={c.uri}>{c.label || c.localName}</option>
              ))}
            </select>
          </Field>

          <Field label="Add facet (optional)">
            <div className="flex gap-2">
              <select
                disabled={!selectedClassUri || objectProps.length === 0}
                value={draft.propUri}
                onChange={(e) => setDraft((d) => ({ ...d, propUri: e.target.value }))}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">— predicate —</option>
                {objectProps.map((p) => (
                  <option key={p.uri} value={p.uri}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!draft.propUri || draft.values.length === 0}
                value={draft.valueUri}
                onChange={(e) => setDraft((d) => ({ ...d, valueUri: e.target.value }))}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">
                  {draft.loading ? 'Loading…' : draft.error ? 'Failed to load' : '— object —'}
                </option>
                {draft.values.map((v) => (
                  <option key={v} value={v}>{shortenUri(v)}</option>
                ))}
              </select>
              <button
                onClick={addFacet}
                disabled={!draft.propUri || !draft.valueUri}
                className="inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
                title="Add facet"
              >
                <Plus className="w-4 h-4" />
              </button>
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
          onClick={() => analyze(0)}
          disabled={!selectedClassUri || selectedPropUris.length === 0 || loading}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
        >
          <Search className="w-4 h-4" />
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </Section>

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
          onPage={(o) => analyze(o)}
          onPageSizeChange={(s) => analyze(0, s)}
        />
      )}
    </div>
  );
}

function ResultsView({
  data,
  offset,
  pageSize,
  loading,
  onPage,
  onPageSizeChange,
}: {
  data: CompletenessMatrix;
  offset: number;
  pageSize: number;
  loading: boolean;
  onPage: (o: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const labelOf = (uri: string) =>
    data.property_info.find((p) => p.uri === uri)?.label ||
    data.property_info.find((p) => p.uri === uri)?.localName ||
    shortenUri(uri);

  const barData = data.summary.by_property.map((p) => ({
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
        subtitle="Horizontal bar chart; each bar's length encodes the completeness percentage and color encodes status."
      >
        <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 48)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 24, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
              formatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <Bar dataKey="completeness" radius={[0, 6, 6, 0]}>
              {barData.map((d, i) => (
                <Cell key={i} fill={statusColor(d.completeness)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.summary.by_property.map((p) => (
            <div
              key={p.property}
              className="p-3 border flex items-center justify-between"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
            >
              <div className="text-sm" style={{ color: 'var(--text)' }}>
                {labelOf(p.property)}
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  filled {p.filled} · missing {p.missing}
                </div>
              </div>
              <StatusBadge percent={p.completeness} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Entity × Property Matrix"
        subtitle="Each row is an entity, each column a property. A green check marks a filled value; a dash marks a missing one. Entity and Score columns stay pinned while you scroll horizontally."
      >
        <PaginatedTable
          colSpan={data.properties.length + 2}
          pagination={data.pagination ?? null}
          pageSize={pageSize}
          loading={loading}
          onPageSizeChange={onPageSizeChange}
          onPrev={() => onPage(Math.max(0, offset - pageSize))}
          onNext={() => onPage(offset + pageSize)}
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
                {shortenUri(e.uri)}
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
