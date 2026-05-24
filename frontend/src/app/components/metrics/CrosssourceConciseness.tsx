import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, X, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScoreDonut, Section, LoadingState, ErrorState } from './_shared';
import {
  metadataApi,
  concisenessApi,
  ClassMeta,
  PropertyMeta,
  CrossSourceResult,
  CrossDuplicateGroup,
  PaginationInfo,
} from '../../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'http://example.org/voc#uni1/', label: 'uni1 (MySQL)' },
  { value: 'http://example.org/voc#uni2/', label: 'uni2 (PostgreSQL)' },
  { value: 'http://example.org/voc#uni3/', label: 'uni3 (MSSQL)' },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

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

function FormulaCard({ title, formula, description }: { title: string; formula: string; description?: string }) {
  return (
    <div
      className="px-4 py-3 border"
      style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
        {title}
      </p>
      <p className="text-sm font-mono mt-1" style={{ color: 'var(--text)' }}>{formula}</p>
      {description && (
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
      )}
    </div>
  );
}

function HeadlineCard({ value, label, sub, color }: { value: string; label: string; sub?: string; color?: string }) {
  return (
    <div
      className="p-6 border flex flex-col justify-center"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)',
        minHeight: 260,
      }}
    >
      <div className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      <div className="text-5xl" style={{ color: color ?? 'var(--navy)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{sub}</div>
      )}
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

function AmbiguousGroupsTable({
  items,
  pagination,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  loading,
}: {
  items: CrossDuplicateGroup[];
  pagination: PaginationInfo | null;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  if (!pagination) return null;

  if (pagination.total === 0) {
    return (
      <div
        className="px-4 py-3 text-sm border"
        style={{ backgroundColor: '#e6f4ea', borderColor: 'rgba(31,138,76,0.3)', color: '#1F8A4C', borderRadius: 'var(--radius-md)' }}
      >
        No ambiguous instances found across sources. All cross-source identities are distinct.
      </div>
    );
  }

  const currentPage = Math.floor(pagination.offset / pageSize) + 1;
  const totalPages = pagination.total != null ? Math.ceil(pagination.total / pageSize) : null;
  const hasPrev = pagination.offset > 0;
  const hasNext = pagination.total != null ? pagination.offset + pageSize < pagination.total : pagination.count === pageSize;

  return (
    <div
      className="p-6 border"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <h3 className="text-xl mb-4" style={{ color: 'var(--navy)' }}>Ambiguous Instance Groups</h3>

      <div
        className="border overflow-hidden"
        style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
      >
        <table className="w-full" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <thead
            style={{
              backgroundColor: 'var(--navy)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <tr>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Identity Values</th>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Matching Entities</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g, i) => (
              <tr
                key={i}
                style={{
                  backgroundColor: 'var(--card)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {Object.entries(g.identity_values).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-block mr-2 text-sm px-1.5 py-0.5"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}
                      >
                        {k}: <span className="font-medium" style={{ color: 'var(--text)' }}>{v}</span>
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
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="px-4 py-3" style={{ backgroundColor: 'var(--card)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="px-3 py-1 border"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>
                      {totalPages != null ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onPrev}
                        disabled={!hasPrev || loading}
                        className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--navy)',
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onNext}
                        disabled={!hasNext || loading}
                        className="p-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--navy)',
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CrosssourceConciseness() {
  // Metadata
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [allProperties, setAllProperties] = useState<PropertyMeta[]>([]);

  // Selection
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([
    SOURCE_OPTIONS[0].value,
    SOURCE_OPTIONS[1].value,
  ]);

  // Facets
  const [facets, setFacets] = useState<Facet[]>([]);
  const [draftPropUri, setDraftPropUri] = useState('');
  const [draftValueUri, setDraftValueUri] = useState('');
  const [draftValues, setDraftValues] = useState<string[]>([]);

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

  // Fetch classes on mount
  useEffect(() => {
    metadataApi.mappedClasses()
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]));
  }, []);

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
    if (!draftPropUri || !selectedClass) {
      setDraftValues([]);
      return;
    }
    const propEntry = allProperties.find((p) => p.uri === draftPropUri);
    if (!propEntry) {
      setDraftValues([]);
      return;
    }
    metadataApi
      .facets(selectedClass.uri, propEntry.uri)
      .then((r) => setDraftValues(r.values))
      .catch(() => setDraftValues([]));
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

  function addFacet() {
    if (!draftPropUri) return;
    const propEntry = allProperties.find((p) => p.uri === draftPropUri);
    if (!propEntry) return;
    const duplicate = facets.some(
      (f) => f.propUri === draftPropUri && f.valueUri === (draftValueUri || null),
    );
    if (duplicate) return;
    setFacets((prev) => [
      ...prev,
      {
        propUri: draftPropUri,
        propLabel: propEntry.label || propEntry.localName,
        valueUri: draftValueUri || null,
        valueLabel: draftValueUri ? shortUri(draftValueUri) : '(exists)',
      },
    ]);
    setDraftValueUri('');
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
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
      {/* Formulas */}
      <Section title="CN3 -- Ambiguous Instance Detection (Cross-Source)" subtitle="Detect ambiguous instances across multiple data sources.">
        <FormulaCard
          title="CN3 Formula"
          formula="1 - (ambiguous_instances / total_in_semantic_metadata_set)"
          description="Detects unresolved cross-source identity overlaps across all pairwise source combinations"
        />
      </Section>

      {/* Configuration */}
      <Section
        title="Configuration"
        subtitle="Select a class, identity properties, data sources, and optional facet filters."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Class">
            <select
              value={selectedClassUri}
              onChange={(e) => setSelectedClassUri(e.target.value)}
              className="w-full px-3 py-2 border"
              style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              <option value="">Choose a class...</option>
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
                <option value="">-- predicate --</option>
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
                <option value="">-- object --</option>
                {draftValues.map((v) => (
                  <option key={v} value={v}>{shortUri(v)}</option>
                ))}
              </select>
              <button
                onClick={addFacet}
                disabled={!draftPropUri}
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
            {SOURCE_OPTIONS.map((src) => (
              <label key={src.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(src.value)}
                  onChange={() => toggleSource(src.value)}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--navy)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text)' }}>{src.label}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
          <div className="grid grid-cols-3 gap-4">
            <HeadlineCard
              value={String(crossResult.total_entities)}
              label="Total Entities"
              sub={`Across ${crossResult.sources?.length || 0} sources`}
              color="var(--navy)"
            />
            <ScoreDonut
              title="CN3 Score"
              percentage={crossResult.cn3_score}
              sub="Cross-source conciseness"
            />
            <HeadlineCard
              value={String(crossResult.ambiguous_instances)}
              label="Ambiguous Instances"
              sub="Overlapping identities"
              color={crossResult.ambiguous_instances > 0 ? '#9E2B0A' : '#1F8A4C'}
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
