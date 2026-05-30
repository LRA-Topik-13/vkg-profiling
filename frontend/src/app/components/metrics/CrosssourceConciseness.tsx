import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Headline, Section, LoadingState, ErrorState, PaginatedTable } from './_shared';
import { makePropertyLabelLookup, labelFromLookup } from './accuracyShared';
import {
  metadataApi,
  concisenessApi,
  ClassMeta,
  PropertyMeta,
  CrossSourceResult,
  CrossDuplicateGroup,
  CrossClassSummaryEntry,
  PaginationInfo,
  statusColor,
} from '../../lib/api';
import { useSources } from '../../lib/sources';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const FACET_ANY_VALUE = '__any_value_exists__';

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortUri(uri: string) {
  if (!uri) return '';
  const hash = uri.lastIndexOf('#');
  if (hash !== -1) {
    const after = uri.substring(hash + 1);
    if (after) return after;
  }
  try {
    const u = new URL(uri);
    return u.pathname.substring(1) + u.hash;
  } catch {
    return uri;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Facet {
  propUri: string;
  propLabel: string;
  valueUri: string | null;
  valueLabel: string;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}

function AmbiguousGroupsTable({
  items,
  pagination,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  loading,
  propertyLabelFor,
}: {
  items: CrossDuplicateGroup[];
  pagination: PaginationInfo | null;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
  propertyLabelFor: (key: string) => string;
}) {
  return (
    <PaginatedTable
      title="Ambiguous Instance Groups"
      colSpan={2}
      pagination={pagination}
      pageSize={pageSize}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageSizeChange={onPageSizeChange}
      onPrev={onPrev}
      onNext={onNext}
      loading={loading}
      emptyState={
        <div
          className="px-4 py-3 text-sm border"
          style={{ backgroundColor: '#e6f4ea', borderColor: 'rgba(31,138,76,0.3)', color: '#1F8A4C', borderRadius: 'var(--radius-md)' }}
        >
          No ambiguous instances found across sources. All cross-source identities are distinct.
        </div>
      }
      head={
        <>
          <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Identity Values</th>
          <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Matching Entities</th>
        </>
      }
    >
      {items.map((g, i) => (
        <tr key={i} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <td className="px-4 py-3">
            <div className="space-y-1">
              {Object.entries(g.identity_values).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-block mr-2 text-sm px-1.5 py-0.5"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}
                >
                  {propertyLabelFor(k)}: <span className="font-medium" style={{ color: 'var(--text)' }}>{v}</span>
                </span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="space-y-1">
              {g.entities.map((e, j) => (
                <div key={j} className="flex items-center gap-2">
                  <span
                    className="text-sm font-mono whitespace-nowrap px-1.5 py-0.5"
                    style={{ backgroundColor: 'var(--info-soft)', color: 'var(--navy)', borderRadius: 'var(--radius-sm)' }}
                  >
                    {shortUri(e.source)}
                  </span>
                  <p className="text-sm font-mono truncate max-w-[250px]" style={{ color: 'var(--navy)' }} title={e.uri}>
                    {shortUri(e.uri)}
                  </p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ))}
    </PaginatedTable>
  );
}

// ── Class Summary Section ─────────────────────────────────────────────────────

function CrossClassSummarySection({ onBarClick }: { onBarClick: (classUri: string) => void }) {
  const [data, setData] = useState<CrossClassSummaryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    concisenessApi.crossSourceClassSummary()
      .then((d) => setData(d.classes))
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter((c) => c.total_entities > 0)
      .sort((a, b) => a.cn3_score - b.cn3_score)
      .map((c) => ({
        name: c.label || c.class,
        uri: c.uri,
        score: c.cn3_score,
        props: c.identity_props_count,
        total: c.total_entities,
        ambiguous: c.ambiguous_instances,
        unique: c.total_entities - c.ambiguous_instances,
      }));
  }, [data]);

  return (
    <Section title="Cross-Source Conciseness of All Classes" collapsible>
      {loading && <LoadingState message="Loading class summary..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && ranked.length === 0 && data && (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No data available.</div>
      )}
      {!loading && !error && ranked.length > 0 && (
        <div className="always-scrollbar max-h-[400px] overflow-y-auto">
          <ResponsiveContainer width="100%" height={Math.max(200, ranked.length * 44)}>
            <BarChart data={ranked} layout="vertical" margin={{ left: 24, right: 48 }}>
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
                        {d.name} (using all {d.props} identity properties)
                      </div>
                      <ul style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                        <li>{Number(d.total).toLocaleString()} total entities</li>
                        <li>{Number(d.ambiguous).toLocaleString()} ambiguous instances</li>
                        <li>score: {Number(d.score).toFixed(2)}%</li>
                      </ul>
                    </div>
                  );
                }}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} style={{ cursor: 'pointer' }} onClick={(d) => onBarClick(d.uri)}>
                {ranked.map((d, i) => (
                  <Cell key={i} fill={statusColor(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CrosssourceConciseness() {
  const configRef = useRef<HTMLDivElement>(null);

  // Metadata
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [allProperties, setAllProperties] = useState<PropertyMeta[]>([]);

  // Selection
  const sources = useSources();
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const sourcesInit = useRef(false);

  // Facets
  const [facets, setFacets] = useState<Facet[]>([]);
  const [draftPropUri, setDraftPropUri] = useState('');
  const [draftValueUri, setDraftValueUri] = useState('');
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Results
  const [crossResult, setCrossResult] = useState<CrossSourceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Pagination
  const [dupItems, setDupItems] = useState<CrossDuplicateGroup[]>([]);
  const [dupPagination, setDupPagination] = useState<PaginationInfo | null>(null);
  const [dupPageSize, setDupPageSize] = useState(10);
  const [dupOffset, setDupOffset] = useState(0);
  const [dupLoading, setDupLoading] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.uri === selectedClassUri) || null,
    [classes, selectedClassUri],
  );

  const objectProps = useMemo(
    () => allProperties.filter((p) => p.type === 'object'),
    [allProperties],
  );

  const dataProps = useMemo(
    () => allProperties.filter((p) => p.type === 'data'),
    [allProperties],
  );

  const propertyLabelLookup = useMemo(() => makePropertyLabelLookup(allProperties), [allProperties]);
  const propertyLabelFor = (key: string) => labelFromLookup(key, propertyLabelLookup);

  // Fetch classes on mount
  useEffect(() => {
    metadataApi.mappedClasses()
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!sourcesInit.current && sources.length > 0) {
      sourcesInit.current = true;
      setSelectedSources(sources.map((s) => s.uri));
    }
  }, [sources]);

  // Fetch properties when class changes
  useEffect(() => {
    setSelectedProps([]);
    setFacets([]);
    setDraftPropUri('');
    setDraftValueUri('');
    setDraftValues([]);
    setCrossResult(null);
    setDupItems([]);
    setDupPagination(null);
    if (!selectedClass) {
      setAllProperties([]);
      return;
    }
    setMetaLoading(true);
    metadataApi.mappedProperties(selectedClass.uri)
      .then((d) => {
        setAllProperties(d.properties);
        const dp = d.properties.filter((p) => p.type === 'data');
        setSelectedProps(dp.map((p) => p.uri));
      })
      .catch(() => { setAllProperties([]); setSelectedProps([]); })
      .finally(() => setMetaLoading(false));
  }, [selectedClass]);

  // Fetch facet values when draft property changes
  useEffect(() => {
    setDraftValueUri('');
    setDraftValues([]);
    setDraftError(null);
    if (!draftPropUri || !selectedClass) return;
    const propEntry = allProperties.find((p) => p.uri === draftPropUri);
    if (!propEntry) return;
    let cancelled = false;
    setDraftLoading(true);
    metadataApi
      .facets(selectedClass.uri, propEntry.uri)
      .then((r) => { if (!cancelled) setDraftValues(r.values); })
      .catch(() => { if (!cancelled) setDraftError('Failed to load facet values.'); })
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
  }, [selectedClass, draftPropUri, allProperties]);

  const facetString = useMemo(() => {
    if (facets.length === 0) return undefined;
    return facets.map((f) => f.valueUri ? `${f.propUri}::${f.valueUri}` : f.propUri).join(',');
  }, [facets]);

  const fetchDuplicates = useCallback(async (offset: number, limit: number) => {
    if (!selectedClass) return;
    setDupLoading(true);
    try {
      const data = await concisenessApi.crossSourceDuplicates({
        class_uri: selectedClass.uri,
        identity_props: selectedProps.join(','),
        sources: selectedSources.join(','),
        filter_facets: facetString,
        limit,
        offset,
      });
      setDupItems(data.items);
      setDupPagination(data.pagination);
      setDupOffset(offset);
    } catch {
      // silently fail for pagination
    } finally {
      setDupLoading(false);
    }
  }, [selectedClass, selectedProps, selectedSources, facetString]);

  const noExactFacetValues = Boolean(draftPropUri && !draftLoading && !draftError && draftValues.length === 0);

  function addFacet(valueUri: string) {
    if (!draftPropUri || !valueUri) return;
    const propEntry = allProperties.find((p) => p.uri === draftPropUri);
    if (!propEntry) return;
    const actualValueUri = valueUri === FACET_ANY_VALUE ? null : valueUri;
    const duplicate = facets.some(
      (f) => f.propUri === draftPropUri && f.valueUri === actualValueUri,
    );
    if (!duplicate) {
      setFacets((prev) => [
        ...prev,
        {
          propUri: draftPropUri,
          propLabel: propEntry.label || propEntry.localName,
          valueUri: actualValueUri,
          valueLabel: actualValueUri ? shortUri(actualValueUri) : '(exists)',
        },
      ]);
      setCrossResult(null);
    }
    setDraftPropUri('');
    setDraftValueUri('');
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
    setCrossResult(null);
  }

  function clearFacets() {
    setFacets([]);
    setCrossResult(null);
  }

  const toggleSource = (src: string) => {
    setSelectedSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  const toggleProp = (uri: string) => {
    setSelectedProps((prev) =>
      prev.includes(uri) ? prev.filter((p) => p !== uri) : [...prev, uri]
    );
  };

  const toggleAll = () => {
    if (selectedProps.length === dataProps.length) {
      setSelectedProps([]);
    } else {
      setSelectedProps(dataProps.map((p) => p.uri));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedClass || selectedProps.length === 0 || selectedSources.length < 2) return;
    setLoading(true);
    setError(null);
    setCrossResult(null);
    setDupItems([]);
    setDupPagination(null);
    setDupOffset(0);
    try {
      const identityProps = selectedProps.join(',');
      const sourcesParam = selectedSources.join(',');

      const cross = await concisenessApi.crossSource({
        class_uri: selectedClass.uri,
        identity_props: identityProps,
        sources: sourcesParam,
        filter_facets: facetString,
      });
      setCrossResult(cross);

      // Fetch first page of duplicates
      const dupData = await concisenessApi.crossSourceDuplicates({
        class_uri: selectedClass.uri,
        identity_props: identityProps,
        sources: sourcesParam,
        filter_facets: facetString,
        limit: dupPageSize,
        offset: 0,
      });
      setDupItems(dupData.items);
      setDupPagination(dupData.pagination);
    } catch (e: any) {
      setError(e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <CrossClassSummarySection onBarClick={(classUri) => {
        setSelectedClassUri(classUri);
        setSelectedSources(sources.map((s) => s.uri));
        setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }} />

      {/* Configuration */}
      <div ref={configRef}>
      <Section title="Cross-Source Conciseness of a Class">
        {/* Class */}
        <Field label="Class">
          <select
            value={selectedClassUri}
            onChange={(e) => setSelectedClassUri(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border"
            style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
          >
            <option value="">Choose a class...</option>
            {classes.map((c) => (
              <option key={c.uri} value={c.uri}>{c.label || c.localName}</option>
            ))}
          </select>
        </Field>

        {/* Facet filter */}
        <div className="mt-4">
          <Field label="Add facet filter (optional)">
            <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Facet filters limit which entities are checked before the score is calculated.
            </p>
            <div className="flex gap-2 w-full">
              <select
                disabled={!selectedClassUri || objectProps.length === 0}
                value={draftPropUri}
                onChange={(e) => setDraftPropUri(e.target.value)}
                className="w-1/2 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">Select predicate...</option>
                {objectProps.map((p) => (
                  <option key={p.uri} value={p.uri}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!draftPropUri || draftLoading}
                value={draftValueUri}
                onChange={(e) => { if (e.target.value) addFacet(e.target.value); }}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{draftLoading ? 'Loading values...' : 'Select a value...'}</option>
                <option value={FACET_ANY_VALUE}>Any value (exists)</option>
                {draftValues.map((v) => (
                  <option key={v} value={v}>{shortUri(v)}</option>
                ))}
              </select>
            </div>
            {draftError && (
              <div className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
                Failed to load facet values. You can still choose Any value (exists).
              </div>
            )}
            {noExactFacetValues && (
              <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                No exact values were found for this class and property. You can still choose Any value (exists).
              </div>
            )}
          </Field>
        </div>

        {facets.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2 text-sm" style={{ color: 'var(--text)' }}>
              <span>Active facets <span style={{ color: 'var(--muted-foreground)' }}>(AND)</span></span>
              <button onClick={clearFacets} className="text-xs underline" style={{ color: 'var(--accent)' }}>Clear all</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {facets.map((f, i) => (
                <span
                  key={`${f.propUri}::${f.valueUri ?? ''}`}
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

        {/* Data sources */}
        <div className="mt-4">
          <div className="mb-2 text-sm" style={{ color: 'var(--text)' }}>
            Data Sources (select 2 or more)
          </div>
          <div className="flex flex-wrap gap-3">
            {sources.map((src) => (
              <label key={src.uri} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(src.uri)}
                  onChange={() => toggleSource(src.uri)}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--navy)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text)' }}>{src.localName}</span>
              </label>
            ))}
          </div>
          {selectedSources.length < 2 && (
            <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
              At least 2 sources required for cross-source analysis.
            </p>
          )}
        </div>

        {/* Identity properties */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm" style={{ color: 'var(--text)' }}>Identity Properties (data properties only)</div>
            {dataProps.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-xs underline"
                style={{ color: 'var(--navy)' }}
              >
                {selectedProps.length === dataProps.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {!selectedClassUri ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Pick a class first.</div>
          ) : metaLoading ? (
            <LoadingState message="Loading properties..." />
          ) : dataProps.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No data properties found for this class.</div>
          ) : (
            <div className="always-scrollbar grid grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-scroll pr-2">
              {dataProps.map((p) => {
                const active = selectedProps.includes(p.uri);
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
                    <input type="checkbox" checked={active} onChange={() => toggleProp(p.uri)} style={{ accentColor: 'var(--accent)' }} />
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
          onClick={handleAnalyze}
          disabled={!selectedClassUri || selectedProps.length === 0 || selectedSources.length < 2 || loading}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
        >
          <Search className="w-4 h-4" />
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </Section>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between">
          <ErrorState message={error} />
          <button
            onClick={handleAnalyze}
            className="ml-4 text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingState message="Analyzing cross-source conciseness..." />}

      {/* Results */}
      {crossResult && !loading && (
        <>
          {/* Score cards: 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Headline
              value={String(crossResult.total_entities)}
              label="Total Entities"
              sub={`Across ${crossResult.sources?.length || 0} sources`}
              color="var(--navy)"
            />
            <Headline
              value={String(crossResult.ambiguous_instances)}
              label="Ambiguous Instances"
              sub="Overlapping identities"
              color={crossResult.ambiguous_instances > 0 ? '#9E2B0A' : '#1F8A4C'}
            />
            <Headline
              value={crossResult.cn3_score}
              label="Conciseness Score"
              sub="1 - (ambiguous instances / total)"
            />
          </div>

          {/* Note */}
          {crossResult.note && (
            <div
              className="px-4 py-3 text-xs border"
              style={{ backgroundColor: 'var(--info-soft)', borderColor: 'rgba(0,54,99,0.2)', color: 'var(--navy)', borderRadius: 'var(--radius-md)' }}
            >
              <strong>Note:</strong> {crossResult.note}
            </div>
          )}

          <AmbiguousGroupsTable
            items={dupItems}
            pagination={dupPagination}
            pageSize={dupPageSize}
            onPageSizeChange={(size) => {
              setDupPageSize(size);
              fetchDuplicates(0, size);
            }}
            onPrev={() => fetchDuplicates(Math.max(0, dupOffset - dupPageSize), dupPageSize)}
            onNext={() => fetchDuplicates(dupOffset + dupPageSize, dupPageSize)}
            loading={dupLoading}
            propertyLabelFor={propertyLabelFor}
          />
        </>
      )}

      {/* Empty state */}
      {!crossResult && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Select a class and identity properties, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
