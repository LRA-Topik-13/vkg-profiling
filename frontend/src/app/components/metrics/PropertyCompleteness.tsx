import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function PropertyCompleteness() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [props, setProps] = useState<PropertyMeta[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [facetProp, setFacetProp] = useState<string>('');
  const [facetVal, setFacetVal] = useState<string>('');
  const [facetValues, setFacetValues] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<CompletenessMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    metadataApi.mappedClasses().then((r) => setClasses(r.classes)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setSelectedProps([]);
    setFacetProp('');
    setFacetVal('');
    setData(null);
    if (!selectedClass) {
      setProps([]);
      return;
    }
    metadataApi.mappedProperties(selectedClass).then((r) => setProps(r.properties)).catch((e) => setError(String(e)));
  }, [selectedClass]);

  useEffect(() => {
    setFacetVal('');
    if (!facetProp || !selectedClass) {
      setFacetValues([]);
      return;
    }
    metadataApi.facets(selectedClass, facetProp).then((r) => setFacetValues(r.values)).catch(() => setFacetValues([]));
  }, [selectedClass, facetProp]);

  const objectProps = useMemo(() => props.filter((p) => p.type === 'object'), [props]);

  function toggleProp(name: string) {
    setSelectedProps((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  }

  async function analyze(newOffset = 0) {
    if (!selectedClass || selectedProps.length === 0) return;
    setLoading(true);
    setError(null);
    setOffset(newOffset);
    try {
      const r = await completenessApi.matrix({
        class_name: selectedClass,
        properties: selectedProps.join(','),
        filter_property: facetProp || undefined,
        filter_value: facetVal || undefined,
        limit: PAGE,
        offset: newOffset,
      });
      setData(r);
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
        subtitle="Filter the analysis to one class and a subset of its properties. An optional facet narrows entities further (interaction → filtering)."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Class">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border"
              style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              <option value="">Choose a class…</option>
              {classes.map((c) => (
                <option key={c.localName} value={c.localName}>{c.label || c.localName}</option>
              ))}
            </select>
          </Field>

          <Field label="Facet filter (optional)">
            <div className="flex gap-2">
              <select
                disabled={!selectedClass}
                value={facetProp}
                onChange={(e) => setFacetProp(e.target.value)}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">— no facet —</option>
                {objectProps.map((p) => (
                  <option key={p.localName} value={p.localName}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!facetProp}
                value={facetVal}
                onChange={(e) => setFacetVal(e.target.value)}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">— any value —</option>
                {facetValues.map((v) => (
                  <option key={v} value={v}>{shortenUri(v)}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-sm" style={{ color: 'var(--text)' }}>Properties to evaluate</div>
          {props.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Pick a class first.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {props.map((p) => {
                const active = selectedProps.includes(p.localName);
                return (
                  <label
                    key={p.localName}
                    className="flex items-center gap-2 px-3 py-2 border cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <input type="checkbox" checked={active} onChange={() => toggleProp(p.localName)} style={{ accentColor: 'var(--accent)' }} />
                    <span className="truncate" style={{ color: 'var(--text)' }} title={p.label || p.localName}>
                      {p.label || p.localName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => analyze(0)}
          disabled={!selectedClass || selectedProps.length === 0 || loading}
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
  const labelOf = (name: string) =>
    data.property_info.find((p) => p.localName === name)?.label || name;

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
        subtitle="Horizontal bar chart; each bar's length encodes the completeness percentage and color encodes status (encoding comparison – explicit encoding; color semaphore)."
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
        subtitle="Schematic encoding of completeness: each row is an entity, each column a property. Filled cells use status color, missing cells stay muted. Lets the user spot row-wise (entity) and column-wise (property) gaps simultaneously."
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
  const hashIdx = uri.lastIndexOf('#');
  const slashIdx = uri.lastIndexOf('/');
  const i = Math.max(hashIdx, slashIdx);
  return i > 0 ? uri.slice(i + 1) : uri;
}

function shortText(t: string, n = 14): string {
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
