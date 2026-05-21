import { useEffect, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { Headline, ScoreDonut, Section, LoadingState, ErrorState } from './_shared';
import {
  metadataApi,
  concisenessApi,
  ClassMeta,
  PropertyMeta,
  IntraSourceResult,
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

function DuplicateGroupsTable({ groups }: { groups: IntraSourceResult['duplicate_groups'] }) {
  if (!groups || groups.length === 0) {
    return (
      <div
        className="px-4 py-3 text-sm border"
        style={{ backgroundColor: '#e6f4ea', borderColor: 'rgba(31,138,76,0.3)', color: '#1F8A4C', borderRadius: 'var(--radius-md)' }}
      >
        No duplicate instances found. All instances have unique identity values.
      </div>
    );
  }

  return (
    <div className="border overflow-hidden" style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Duplicate Groups</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Instances sharing identical identity property values
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--muted)' }}>
              <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Identity Values</th>
              <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Duplicate URIs</th>
              <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Count</th>
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
                  <div className="space-y-0.5">
                    {g.uris.map((uri, j) => (
                      <p key={j} className="text-xs font-mono truncate max-w-xs" style={{ color: 'var(--muted-foreground)' }} title={uri}>
                        {shortUri(uri)}
                      </p>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className="inline-block text-xs font-semibold rounded-full px-2 py-0.5"
                    style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {g.count}
                  </span>
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

export default function IntrasourceConciseness() {
  // Metadata
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [allProperties, setAllProperties] = useState<PropertyMeta[]>([]);

  // Selection
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [sourcePrefix, setSourcePrefix] = useState(SOURCE_OPTIONS[0].value);

  // Results
  const [result, setResult] = useState<IntraSourceResult | null>(null);
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
      setResult(null);
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
    setResult(null);
  }, [selectedClass]);

  const selectedClassObj = classes.find((c) => c.localName === selectedClass);

  const handleAnalyze = async () => {
    if (!selectedClassObj || selectedProps.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await concisenessApi.intraSource({
        class_uri: selectedClassObj.uri,
        identity_props: selectedProps.join(','),
        source_prefix: sourcePrefix,
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Formulas */}
      <Section title="CN2 -- Extensional Conciseness (Intra-Source)" subtitle="Detect duplicate instance representations within a single data source.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormulaCard
            title="Formula F1"
            formula="unique_instances / total_representations"
            description="Ratio of unique instances to total instance representations"
          />
          <FormulaCard
            title="Formula F2"
            formula="1 - (violating_instances / total)"
            description="1 minus the ratio of instances violating the uniqueness rule"
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

          {/* Source prefix */}
          {selectedClass && (
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Source Prefix</label>
              <select
                value={sourcePrefix}
                onChange={(e) => setSourcePrefix(e.target.value)}
                className="w-full md:w-1/2 px-4 py-2 border"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                {SOURCE_OPTIONS.map((src) => (
                  <option key={src.value} value={src.value}>
                    {src.label} -- {src.value}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Analyze button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAnalyze}
              disabled={!selectedClass || selectedProps.length === 0 || loading}
              className="px-6 py-2.5 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
            >
              <Search className="w-4 h-4" />
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
            {selectedProps.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {selectedProps.length} identity propert{selectedProps.length === 1 ? 'y' : 'ies'} selected
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
      {loading && <LoadingState message="Analyzing conciseness..." />}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Count cards (Headline style) + Ring cards (DonutCard style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Headline value={String(result.total_representations)} label="Total Representations" sub="In selected source" color="var(--navy)" />
            <Headline value={String(result.unique_instances)} label="Unique Instances" sub="Distinct entities" color="var(--navy)" />
            <ScoreDonut title="Score F1" percentage={result.score_f1} sub="unique / total" />
            <ScoreDonut title="Score F2" percentage={result.score_f2} sub="1 - (violations / total)" />
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

          <DuplicateGroupsTable groups={result.duplicate_groups} />
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
