import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Plus, X, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  completenessApi,
  metadataApi,
  ClassMeta,
  PropertyMeta,
  CompletenessMatrix,
  statusColor,
} from '../../lib/api';
import { Headline, Section, LoadingState, ErrorState, StatusBadge } from './_shared';

const PAGE = 25;

interface Facet {
  propUri: string;
  propLabel: string;
  valueUri: string;
  valueLabel: string;
}

export default function PropertyCompleteness() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [props, setProps] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState<string>('');
  const [selectedPropUris, setSelectedPropUris] = useState<string[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [draftPropUri, setDraftPropUri] = useState<string>('');
  const [draftValueUri, setDraftValueUri] = useState<string>('');
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<CompletenessMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setDraftPropUri('');
    setDraftValueUri('');
    setDraftValues([]);
    setData(null);
    if (!selectedClass) {
      setProps([]);
      return;
    }
    metadataApi
      .mappedProperties(selectedClass.uri)
      .then((r) => setProps(r.properties))
      .catch((e) => setError(String(e)));
  }, [selectedClass]);

  useEffect(() => {
    setDraftValueUri('');
    if (!draftPropUri || !selectedClass) {
      setDraftValues([]);
      return;
    }
    const propEntry = props.find((p) => p.uri === draftPropUri);
    if (!propEntry) {
      setDraftValues([]);
      return;
    }
    metadataApi
      .facets(selectedClass.uri, propEntry.uri)
      .then((r) => setDraftValues(r.values))
      .catch(() => setDraftValues([]));
  }, [selectedClass, draftPropUri, props]);

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
    if (!draftPropUri || !draftValueUri) return;
    const propEntry = props.find((p) => p.uri === draftPropUri);
    if (!propEntry) return;
    const duplicate = facets.some((f) => f.propUri === draftPropUri && f.valueUri === draftValueUri);
    if (duplicate) return;
    setFacets((prev) => [
      ...prev,
      {
        propUri: draftPropUri,
        propLabel: propEntry.label || propEntry.localName,
        valueUri: draftValueUri,
        valueLabel: shortenUri(draftValueUri),
      },
    ]);
    setDraftValueUri('');
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
  }

  async function analyze(newOffset = 0) {
    if (!selectedClassUri || selectedPropUris.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await completenessApi.matrix({
        class_uri: selectedClassUri,
        properties: selectedPropUris.join(','),
        filter_facets: facets.length > 0 ? facets.map((f) => `${f.propUri}::${f.valueUri}`).join(',') : undefined,
        limit: PAGE,
        offset: newOffset,
      });
      setData(r);
      setOffset(newOffset);
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
                value={draftPropUri}
                onChange={(e) => setDraftPropUri(e.target.value)}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">— predicate —</option>
                {objectProps.map((p) => (
                  <option key={p.uri} value={p.uri}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!draftPropUri || draftValues.length === 0}
                value={draftValueUri}
                onChange={(e) => setDraftValueUri(e.target.value)}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">— object —</option>
                {draftValues.map((v) => (
                  <option key={v} value={v}>{shortenUri(v)}</option>
                ))}
              </select>
              <button
                onClick={addFacet}
                disabled={!draftPropUri || !draftValueUri}
                className="inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
                title="Add facet"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </Field>
        </div>

        {facets.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-sm" style={{ color: 'var(--text)' }}>
              Active facets <span style={{ color: 'var(--muted-foreground)' }}>(AND)</span>
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
                    <span>{f.valueLabel}</span>
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
          <div className="mb-2 text-sm" style={{ color: 'var(--text)' }}>Properties to evaluate</div>
          {props.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Pick a class first.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

      {data && <ResultsView data={data} offset={offset} onPage={(o) => analyze(o)} />}
    </div>
  );
}

function ResultsView({ data, offset, onPage }: { data: CompletenessMatrix; offset: number; onPage: (o: number) => void }) {
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

  const total = data.pagination?.total ?? data.summary.total_entities;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Headline value={data.summary.overall_completeness} label="Overall Completeness" sub={`Class: ${data.class}`} />
        <Headline value={data.summary.total_entities} label="Total Entities" sub="Entities in scope" color="var(--navy)" />
        <Headline value={data.properties.length} label="Properties Analyzed" sub="Active selection" color="var(--navy)" />
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
        subtitle="Each row is an entity, each column a property. Filled cells use status color, missing cells stay muted."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--muted-foreground)' }}>
                <th className="text-left py-2 pr-4">Entity</th>
                {data.properties.map((p) => (
                  <th key={p} className="text-center py-2 px-2" title={labelOf(p)}>{shortText(labelOf(p))}</th>
                ))}
                <th className="text-right py-2 pl-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.entities.map((e) => (
                <tr key={e.uri} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 pr-4 truncate max-w-[280px]" style={{ color: 'var(--text)' }} title={e.uri}>
                    {shortenUri(e.uri)}
                  </td>
                  {data.properties.map((p) => {
                    const has = e.scores[p];
                    return (
                      <td key={p} className="py-2 px-2 text-center">
                        <span
                          className="inline-block"
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            backgroundColor: has ? statusColor(e.completeness) : 'var(--muted)',
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 pl-2 text-right">
                    <StatusBadge percent={e.completeness} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <span>
            Showing {offset + 1}–{offset + data.entities.length}
            {total != null ? ` of ${total}` : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPage(Math.max(0, offset - PAGE))}
              disabled={offset === 0}
              className="inline-flex items-center gap-1 px-3 py-1 border disabled:opacity-40"
              style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => onPage(offset + PAGE)}
              disabled={total != null && offset + data.entities.length >= total}
              className="inline-flex items-center gap-1 px-3 py-1 border disabled:opacity-40"
              style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
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
