import { useEffect, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { Headline, ScoreDonut, Section, LoadingState, ErrorState } from './_shared';
import {
  metadataApi,
  concisenessApi,
  statusColor,
  ClassMeta,
  PropertyMeta,
  IntraSourceResult,
  CrossSourceResult,
} from '../../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'http://example.org/voc#uni1/', label: 'uni1 (MySQL)' },
  { value: 'http://example.org/voc#uni2/', label: 'uni2 (PostgreSQL)' },
  { value: 'http://example.org/voc#uni3/', label: 'uni3 (MSSQL)' },
];

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

function AmbiguousGroupsTable({ groups }: { groups: CrossSourceResult['ambiguous_groups'] }) {
  if (!groups || groups.length === 0) {
    return (
      <div
        className="px-4 py-3 text-sm border"
        style={{ backgroundColor: '#e6f4ea', borderColor: 'rgba(31,138,76,0.3)', color: '#1F8A4C', borderRadius: 'var(--radius-md)' }}
      >
        No ambiguous instances found across sources. All cross-source identities are distinct.
      </div>
    );
  }

  return (
    <div className="border overflow-hidden" style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Ambiguous Instance Groups</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Entities with identical identity values across sources without owl:sameAs links
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--muted)' }}>
              <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Identity Values</th>
              <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Matching Entities</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <td className="px-4 py-2">
                  <div className="space-y-0.5">
                    {Object.entries(g.identity_values).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-block mr-2 text-xs px-1.5 py-0.5"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}
                      >
                        {k}: <span className="font-medium" style={{ color: 'var(--text)' }}>{v}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    {g.entities.map((e, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono whitespace-nowrap px-1.5 py-0.5"
                          style={{ backgroundColor: 'var(--info-soft)', color: 'var(--navy)', borderRadius: 'var(--radius-sm)' }}
                        >
                          {shortUri(e.source)}
                        </span>
                        <p className="text-xs font-mono truncate max-w-[250px]" style={{ color: 'var(--muted-foreground)' }} title={e.uri}>
                          {shortUri(e.uri)}
                        </p>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface IntraWithSource extends IntraSourceResult {
  source: string;
}

export default function CrosssourceConciseness() {
  // Metadata
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [allProperties, setAllProperties] = useState<PropertyMeta[]>([]);

  // Selection
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([
    SOURCE_OPTIONS[0].value,
    SOURCE_OPTIONS[1].value,
  ]);

  // Results
  const [crossResult, setCrossResult] = useState<CrossSourceResult | null>(null);
  const [intraResults, setIntraResults] = useState<IntraWithSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Fetch classes on mount
  useEffect(() => {
    metadataApi.mappedClasses()
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]));
  }, []);

  // Fetch properties when class changes
  useEffect(() => {
    if (!selectedClass) {
      setAllProperties([]);
      setSelectedProps([]);
      setCrossResult(null);
      setIntraResults([]);
      return;
    }
    setMetaLoading(true);
    metadataApi.mappedProperties(selectedClass)
      .then((d) => {
        const dp = d.properties.filter((p) => p.type === 'data');
        setAllProperties(dp);
        setSelectedProps(dp.map((p) => p.uri));
      })
      .catch(() => { setAllProperties([]); setSelectedProps([]); })
      .finally(() => setMetaLoading(false));
    setCrossResult(null);
    setIntraResults([]);
  }, [selectedClass]);

  const selectedClassObj = classes.find((c) => c.localName === selectedClass);

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
    if (selectedProps.length === allProperties.length) {
      setSelectedProps([]);
    } else {
      setSelectedProps(allProperties.map((p) => p.uri));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedClassObj || selectedProps.length === 0 || selectedSources.length < 2) return;
    setLoading(true);
    setError(null);
    setCrossResult(null);
    setIntraResults([]);
    try {
      const identityProps = selectedProps.join(',');
      const sourcesParam = selectedSources.join(',');

      // Run cross-source and all intra-source requests in parallel
      const intraPromises = selectedSources.map((src) =>
        concisenessApi.intraSource({
          class_uri: selectedClassObj.uri,
          identity_props: identityProps,
          source_prefix: src,
        }).then((r) => ({ source: src, ...r }))
      );

      const [cross, ...intras] = await Promise.all([
        concisenessApi.crossSource({
          class_uri: selectedClassObj.uri,
          identity_props: identityProps,
          sources: sourcesParam,
        }),
        ...intraPromises,
      ]);
      setCrossResult(cross);
      setIntraResults(intras);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormulaCard
            title="CN3 Formula"
            formula="1 - (ambiguous_instances / total_in_semantic_metadata_set)"
            description="Detects unresolved cross-source identity overlaps across all pairwise source combinations"
          />
          <FormulaCard
            title="CN2-F2 -- Per Source"
            formula="1 - (violating_instances / total)"
            description="Intra-source uniqueness computed for each selected source"
          />
        </div>
      </Section>

      {/* Configuration */}
      <Section title="Configuration">
        <div className="space-y-4">
          {/* Class selector */}
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border"
              style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
            >
              <option value="">Choose a class...</option>
              {classes.map((cls) => (
                <option key={cls.localName} value={cls.localName}>
                  {cls.label || cls.localName}
                </option>
              ))}
            </select>
          </div>

          {/* Identity properties */}
          {selectedClass && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm" style={{ color: 'var(--text)' }}>
                  Identity Properties (data properties only)
                </label>
                {allProperties.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs underline"
                    style={{ color: 'var(--navy)' }}
                  >
                    {selectedProps.length === allProperties.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              {metaLoading ? (
                <LoadingState message="Loading properties..." />
              ) : allProperties.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No data properties found for this class.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allProperties.map((p) => (
                    <label
                      key={p.uri}
                      className="flex items-center gap-3 px-3 py-2 border cursor-pointer"
                      style={{
                        backgroundColor: selectedProps.includes(p.uri) ? 'var(--accent-soft)' : 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProps.includes(p.uri)}
                        onChange={() => toggleProp(p.uri)}
                        className="w-4 h-4"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {p.label || p.localName}
                      </span>
                      <span className="text-xs ml-auto truncate max-w-[200px]" style={{ color: 'var(--muted-foreground)' }}>
                        {shortUri(p.uri)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data sources */}
          {selectedClass && (
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text)' }}>
                Data Sources (select 2 or more)
              </label>
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
          )}

          {/* Analyze button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAnalyze}
              disabled={!selectedClass || selectedProps.length === 0 || selectedSources.length < 2 || loading}
              className="px-6 py-2.5 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
            >
              <Search className="w-4 h-4" />
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
            {selectedProps.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {selectedProps.length} identity propert{selectedProps.length === 1 ? 'y' : 'ies'} selected
                {' '}&middot; {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
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
          {/* Count cards (Headline style) + Ring card (DonutCard style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <ScoreDonut
              title="CN3 Score"
              percentage={crossResult.cn3_score}
              sub="Cross-source conciseness"
            />
            <Headline
              value={String(crossResult.sample_size)}
              label="Sample Size"
              sub="Groups shown below"
              color="var(--navy)"
            />
          </div>

          {/* CN2-F2 per source */}
          {intraResults.length > 0 && (
            <Section title="CN2-F2 -- Intra-Source Uniqueness per Source">
              <div className={`grid grid-cols-1 gap-4 ${intraResults.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {intraResults.map((intra, idx) => {
                  const scoreC = statusColor(intra.score_f2);
                  return (
                    <div
                      key={idx}
                      className="p-4 border"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                        {shortUri(intra.source)}
                      </p>
                      <p className="text-xs truncate mb-2" style={{ color: 'var(--muted-foreground)' }} title={intra.source}>
                        {intra.source}
                      </p>
                      <p className="text-2xl font-bold" style={{ color: scoreC }}>
                        {intra.score_f2}%
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        {intra.unique_instances} unique / {intra.total_representations} total
                        {intra.violating_instances > 0 && ` · ${intra.violating_instances} violations`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Note */}
          {crossResult.note && (
            <div
              className="px-4 py-3 text-xs border"
              style={{ backgroundColor: 'var(--info-soft)', borderColor: 'rgba(0,54,99,0.2)', color: 'var(--navy)', borderRadius: 'var(--radius-md)' }}
            >
              <strong>Note:</strong> {crossResult.note}
            </div>
          )}

          <AmbiguousGroupsTable groups={crossResult.ambiguous_groups} />
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
