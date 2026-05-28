import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, X, FileText } from 'lucide-react';
import { Headline, Section, LoadingState, ErrorState, PaginatedTable } from './_shared';
import {
  metadataApi,
  concisenessApi,
  ClassMeta,
  PropertyMeta,
  IntraSourceResult,
  IntraDuplicateGroup,
  PaginationInfo,
} from '../../lib/api';
import { useSources } from '../../lib/sources';

// ── Constants ────────────────────────────────────────────────────────────────

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}

function DuplicateGroupsTable({
  items,
  pagination,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  loading,
}: {
  items: IntraDuplicateGroup[];
  pagination: PaginationInfo | null;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <PaginatedTable
      title="Duplicate Groups"
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
          No duplicate instances found. All instances have unique identity values.
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
                  {k}: <span className="font-medium" style={{ color: 'var(--text)' }}>{v}</span>
                </span>
              ))}
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="space-y-1">
              {g.uris.map((uri, j) => (
                <p key={j} className="text-sm font-mono truncate max-w-xs" style={{ color: 'var(--navy)' }} title={uri}>
                  {shortUri(uri)}
                </p>
              ))}
            </div>
          </td>
        </tr>
      ))}
    </PaginatedTable>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function IntrasourceConciseness() {
  // Metadata
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [allProperties, setAllProperties] = useState<PropertyMeta[]>([]);

  // Selection
  const sources = useSources();
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [sourcePrefix, setSourcePrefix] = useState('');

  // Facets
  const [facets, setFacets] = useState<Facet[]>([]);
  const [draftPropUri, setDraftPropUri] = useState('');
  const [draftValueUri, setDraftValueUri] = useState('');
  const [draftValues, setDraftValues] = useState<string[]>([]);

  // Results
  const [result, setResult] = useState<IntraSourceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Pagination
  const [dupItems, setDupItems] = useState<IntraDuplicateGroup[]>([]);
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

  useEffect(() => {
    if (!sourcePrefix && sources.length > 0) {
      setSourcePrefix(sources[0].uri);
    }
  }, [sources, sourcePrefix]);

  // Fetch properties when class changes
  useEffect(() => {
    setSelectedProps([]);
    setFacets([]);
    setDraftPropUri('');
    setDraftValueUri('');
    setDraftValues([]);
    setResult(null);
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
      const data = await concisenessApi.intraSourceDuplicates({
        class_uri: selectedClass.uri,
        identity_props: selectedProps.join(','),
        source_prefix: sourcePrefix,
        filter_facets: facetString,
        limit,
        offset,
      });
      setDupItems(data.items);
      setDupPagination(data.pagination);
      setDupOffset(offset);
    } catch {
      // silently fail for pagination — scores are already shown
    } finally {
      setDupLoading(false);
    }
  }, [selectedClass, selectedProps, sourcePrefix, facetString]);

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
    if (!selectedClass || selectedProps.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDupItems([]);
    setDupPagination(null);
    setDupOffset(0);
    try {
      const data = await concisenessApi.intraSource({
        class_uri: selectedClass.uri,
        identity_props: selectedProps.join(','),
        source_prefix: sourcePrefix,
        filter_facets: facetString,
      });
      setResult(data);
      // Fetch first page of duplicates
      const dupData = await concisenessApi.intraSourceDuplicates({
        class_uri: selectedClass.uri,
        identity_props: selectedProps.join(','),
        source_prefix: sourcePrefix,
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
      {/* Configuration */}
      <Section
        title="Configuration"
        subtitle="Select a class, identity properties, source prefix, and optional facet filters to detect duplicate instances within a single data source."
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
                <option value="">predicate</option>
                {objectProps.map((p) => (
                  <option key={p.uri} value={p.uri}>{p.label || p.localName}</option>
                ))}
              </select>
              <select
                disabled={!draftPropUri}
                value={draftValueUri}
                onChange={(e) => setDraftValueUri(e.target.value)}
                className="flex-1 px-3 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">Any value (exists)</option>
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

        {/* Source prefix */}
        <div className="mt-4">
          <Field label="Source Prefix">
            <select
              value={sourcePrefix}
              onChange={(e) => setSourcePrefix(e.target.value)}
              className="w-full md:w-1/2 px-3 py-2 border"
              style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              {sources.map((src) => (
                <option key={src.uri} value={src.uri}>
                  {src.localName} -- {src.uri}
                </option>
              ))}
            </select>
          </Field>
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
          disabled={!selectedClassUri || selectedProps.length === 0 || loading}
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
      {loading && <LoadingState message="Analyzing conciseness..." />}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Headline value={String(result.total_representations)} label="Total Representations" sub="In selected source" color="var(--navy)" />
            <Headline value={String(result.unique_instances)} label="Unique Instances" sub="Distinct entities" color="var(--navy)" />
            <Headline value={result.score_f1} label="Score for Formula 1" sub="unique / total" />
            <Headline value={result.score_f2} label="Score for Formula 2" sub="1 - (violations / total)" />
          </div>

          {/* Pass/fail banner */}
          <div
            className="px-4 py-3 text-sm font-medium border"
            style={{
              backgroundColor: result.passed ? '#e6f4ea' : 'var(--accent-soft)',
              borderColor: result.passed ? 'rgba(31,138,76,0.3)' : 'rgba(158,43,10,0.3)',
              color: result.passed ? '#1F8A4C' : 'var(--accent)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {result.passed
              ? 'Passed -- No duplicate instances detected within this source.'
              : `Failed -- ${result.violating_instances} instance(s) violate the uniqueness rule.`}
          </div>

          <DuplicateGroupsTable
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
      {!result && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Select a class and identity properties, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
