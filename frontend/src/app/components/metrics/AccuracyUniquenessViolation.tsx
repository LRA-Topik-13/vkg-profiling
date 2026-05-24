import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyCrossSourceSummaryEntry,
  AccuracyPairRow,
  AccuracyValueConflictSummary,
  AccuracyWithinSourceSummaryEntry,
  ClassMeta,
  metadataApi,
  PropertyMeta,
} from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, ScoreDonut, Section } from './_shared';
import {
  DEFAULT_PAGE_SIZE,
  Field,
  FormulaCard,
  MetricCard,
  SOURCE_OPTIONS,
  SourceBadge,
  StatusPill,
  TableFrame,
  TablePager,
  errorMessage,
  formatCount,
  formatPercent,
  labelForClass,
  labelForProperty,
  shortUri,
  sortSources,
} from './accuracyShared';

type EvidenceMode = 'cross' | 'intra';

interface RowState {
  rows: AccuracyPairRow[];
  offset: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const emptyRows = (): RowState => ({ rows: [], offset: 0, pageSize: DEFAULT_PAGE_SIZE, loading: false, error: null });

function scoreFromSummary(summary: AccuracyValueConflictSummary | null, mode: EvidenceMode) {
  if (!summary) return 100;
  return mode === 'cross' ? Number(summary.sa2_cross_score ?? 100) : Number(summary.sa2_score ?? 100);
}

function summaryLabel(mode: EvidenceMode) {
  return mode === 'cross' ? 'Cross-Source' : 'Intra-Source';
}

function PairEvidenceTable({
  mode,
  summary,
  state,
  onPageSizeChange,
  onPrev,
  onNext,
}: {
  mode: EvidenceMode;
  summary: AccuracyValueConflictSummary | null;
  state: RowState;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!summary) return null;
  const total = summary.conflicting_pairs;
  const title = `${summaryLabel(mode)} Conflict Evidence`;

  if (state.loading) {
    return <LoadingState message={`Loading ${summaryLabel(mode).toLowerCase()} conflict evidence...`} />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  if (total === 0) {
    return (
      <div className="px-4 py-3 text-sm border" style={{ backgroundColor: '#e6f4ea', borderColor: 'rgba(31,138,76,0.3)', color: '#1F8A4C', borderRadius: 'var(--radius-md)' }}>
        No conflicting pairs found for this rule.
      </div>
    );
  }

  return (
    <Section title={title} subtitle="Rows show pairs that share the identity values but disagree on the target value.">
      <TableFrame>
        <table className="w-full table-fixed" style={{ opacity: state.loading ? 0.5 : 1 }}>
          <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th className="px-4 py-3 text-left w-[22%]" style={{ color: 'var(--text-on-dark)' }}>Identity Values</th>
              <th className="px-4 py-3 text-left w-[22%]" style={{ color: 'var(--text-on-dark)' }}>Entity A</th>
              <th className="px-4 py-3 text-left w-[16%]" style={{ color: 'var(--text-on-dark)' }}>Value A</th>
              <th className="px-4 py-3 text-left w-[22%]" style={{ color: 'var(--text-on-dark)' }}>Entity B</th>
              <th className="px-4 py-3 text-left w-[18%]" style={{ color: 'var(--text-on-dark)' }}>Value B</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((pair, index) => (
              <tr key={`${pair.e1.uri}-${pair.e2.uri}-${index}`} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 align-top">
                  <div className="space-y-1">
                    {Object.entries(pair.identity_values).map(([key, value]) => (
                      <div key={key} className="text-xs px-2 py-1" style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)', color: 'var(--muted-foreground)' }}>
                        <span>{key}: </span><span style={{ color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2 mb-1"><SourceBadge source={pair.e1.source} /></div>
                  <div className="font-mono text-sm truncate" style={{ color: 'var(--navy)' }} title={pair.e1.uri}>{shortUri(pair.e1.uri)}</div>
                </td>
                <td className="px-4 py-3 align-top text-sm break-words" style={{ color: 'var(--text)' }}>{pair.e1.value || pair.e1.values?.join(', ') || '-'}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2 mb-1"><SourceBadge source={pair.e2.source} /></div>
                  <div className="font-mono text-sm truncate" style={{ color: 'var(--navy)' }} title={pair.e2.uri}>{shortUri(pair.e2.uri)}</div>
                </td>
                <td className="px-4 py-3 align-top text-sm break-words" style={{ color: 'var(--text)' }}>{pair.e2.value || pair.e2.values?.join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
          <TablePager
            pageSize={state.pageSize}
            onPageSizeChange={onPageSizeChange}
            offset={state.offset}
            total={total}
            count={state.rows.length}
            loading={state.loading}
            onPrev={onPrev}
            onNext={onNext}
            colSpan={5}
          />
        </table>
      </TableFrame>
    </Section>
  );
}

function BreakdownTable({ summary, mode }: { summary: AccuracyValueConflictSummary; mode: EvidenceMode }) {
  const rows: Array<AccuracyCrossSourceSummaryEntry | AccuracyWithinSourceSummaryEntry> = mode === 'cross' ? summary.source_pair_summary || [] : summary.source_summary || [];
  if (rows.length === 0) return null;

  return (
    <Section title={`${summaryLabel(mode)} Breakdown`} subtitle="Counts are calculated over the full selected population.">
      <TableFrame>
        <table className="w-full table-fixed">
          <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>{mode === 'cross' ? 'Source Pair' : 'Source'}</th>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Matched Pairs</th>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Conflicts</th>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Conflict Rate</th>
              <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isCrossRow = 'source_a_label' in row;
              const score = isCrossRow ? row.sa2_cross_score : row.sa2_score;
              const label = isCrossRow ? `${row.source_a_label} to ${row.source_b_label}` : row.source_label;
              return (
                <tr key={index} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{label}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatCount(row.total_matched)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: row.conflicting_pairs > 0 ? 'var(--accent)' : 'var(--text)' }}>{formatCount(row.conflicting_pairs)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatPercent(row.conflict_rate)}</td>
                  <td className="px-4 py-3"><StatusPill tone={score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad'}>{formatPercent(score)}</StatusPill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableFrame>
    </Section>
  );
}

export default function AccuracyUniquenessViolation() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [targetPropUri, setTargetPropUri] = useState('');
  const [identityPropUris, setIdentityPropUris] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([SOURCE_OPTIONS[0].value]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intraSummary, setIntraSummary] = useState<AccuracyValueConflictSummary | null>(null);
  const [crossSummary, setCrossSummary] = useState<AccuracyValueConflictSummary | null>(null);
  const [activeMode, setActiveMode] = useState<EvidenceMode>('intra');
  const [intraRows, setIntraRows] = useState<RowState>(emptyRows);
  const [crossRows, setCrossRows] = useState<RowState>(emptyRows);

  const selectedClass = useMemo(() => classes.find((cls) => cls.uri === selectedClassUri) || null, [classes, selectedClassUri]);
  const dataProperties = useMemo(() => properties.filter((prop) => prop.type === 'data'), [properties]);
  const identityCandidates = useMemo(() => dataProperties.filter((prop) => prop.uri !== targetPropUri), [dataProperties, targetPropUri]);
  const targetProp = useMemo(() => dataProperties.find((prop) => prop.uri === targetPropUri) || null, [dataProperties, targetPropUri]);
  const identityLabels = useMemo(() => identityPropUris.map((uri) => labelForProperty(dataProperties.find((prop) => prop.uri === uri))).filter(Boolean), [identityPropUris, dataProperties]);
  const canAnalyze = Boolean(selectedClassUri && targetPropUri && identityPropUris.length > 0 && selectedSources.length > 0);
  const hasCross = selectedSources.length >= 2;
  const activeSummary = activeMode === 'cross' ? crossSummary : intraSummary;
  const activeRows = activeMode === 'cross' ? crossRows : intraRows;

  useEffect(() => {
    metadataApi.mappedClasses().then((data) => setClasses(data.classes)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setProperties([]);
    setTargetPropUri('');
    setIdentityPropUris([]);
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
    setError(null);
    if (!selectedClassUri) return;
    setMetadataLoading(true);
    metadataApi.mappedProperties(selectedClassUri)
      .then((data) => {
        const dataProps = data.properties.filter((prop) => prop.type === 'data');
        setProperties(data.properties);
        setTargetPropUri(dataProps[0]?.uri || '');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setMetadataLoading(false));
  }, [selectedClassUri]);

  useEffect(() => {
    setIdentityPropUris((prev) => prev.filter((uri) => uri !== targetPropUri));
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }, [targetPropUri]);

  useEffect(() => {
    if (selectedSources.length < 2 && activeMode === 'cross') setActiveMode('intra');
  }, [selectedSources.length, activeMode]);

  const fetchRows = useCallback(async (mode: EvidenceMode, offset: number, limit: number) => {
    if (!selectedClassUri || !targetPropUri || identityPropUris.length === 0 || selectedSources.length === 0) return;
    const setState = mode === 'cross' ? setCrossRows : setIntraRows;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const params = {
        class_uri: selectedClassUri,
        identity_props: identityPropUris.join(','),
        target_prop: targetPropUri,
        sources: selectedSources.join(','),
        limit,
        offset,
      };
      const data = mode === 'cross'
        ? await accuracyApi.valueConflictCrossSourceRows(params)
        : await accuracyApi.valueConflictRows(params);
      setState({ rows: data.pairs || [], offset, pageSize: limit, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: errorMessage(err) }));
    }
  }, [selectedClassUri, targetPropUri, identityPropUris, selectedSources]);

  async function analyze() {
    if (!canAnalyze) return;
    setSummaryLoading(true);
    setError(null);
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
    const nextMode: EvidenceMode = hasCross ? 'cross' : 'intra';
    setActiveMode(nextMode);
    try {
      const params = {
        class_uri: selectedClassUri,
        identity_props: identityPropUris.join(','),
        target_prop: targetPropUri,
        sources: selectedSources.join(','),
      };
      if (hasCross) {
        const [intra, cross] = await Promise.all([
          accuracyApi.valueConflictSummary(params),
          accuracyApi.valueConflictCrossSourceSummary(params),
        ]);
        setIntraSummary(intra);
        setCrossSummary(cross);
        setSummaryLoading(false);
        await fetchRows('cross', 0, crossRows.pageSize);
      } else {
        const intra = await accuracyApi.valueConflictSummary(params);
        setIntraSummary(intra);
        setSummaryLoading(false);
        await fetchRows('intra', 0, intraRows.pageSize);
      }
    } catch (err) {
      setError(errorMessage(err));
      setSummaryLoading(false);
    }
  }

  function toggleIdentity(uri: string) {
    setIdentityPropUris((prev) => prev.includes(uri) ? prev.filter((item) => item !== uri) : [...prev, uri]);
  }

  function toggleSource(uri: string) {
    setSelectedSources((prev) => {
      const next = prev.includes(uri) ? prev.filter((item) => item !== uri) : [...prev, uri];
      return sortSources(next);
    });
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }

  function switchMode(mode: EvidenceMode) {
    setActiveMode(mode);
    const state = mode === 'cross' ? crossRows : intraRows;
    const summary = mode === 'cross' ? crossSummary : intraSummary;
    if (summary && summary.conflicting_pairs > 0 && state.rows.length === 0 && !state.loading && !state.error) {
      fetchRows(mode, 0, state.pageSize);
    }
  }

  function pageSizeChange(mode: EvidenceMode, size: number) {
    if (mode === 'cross') setCrossRows((prev) => ({ ...prev, pageSize: size, offset: 0 }));
    else setIntraRows((prev) => ({ ...prev, pageSize: size, offset: 0 }));
    fetchRows(mode, 0, size);
  }

  return (
    <div className="space-y-6">
      <Section title="SA2, Uniqueness Violation" subtitle="Check whether selected identity properties determine one target property.">
        <FormulaCard title="Functional Dependency" formula="identity properties -> target property" description="Pairs with the same identity values should not disagree on the target value." />
      </Section>

      <Section title="Configuration">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Class">
              <select value={selectedClassUri} onChange={(e) => setSelectedClassUri(e.target.value)} className="w-full px-4 py-2 border" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
                <option value="">Choose a class...</option>
                {classes.map((cls) => <option key={cls.uri} value={cls.uri}>{labelForClass(cls)}</option>)}
              </select>
            </Field>

            <Field label="Target Property" hint={metadataLoading ? 'Loading properties...' : selectedClassUri && dataProperties.length === 0 ? 'No data properties found for this class.' : 'The right side of the functional dependency.'}>
              <select disabled={!selectedClassUri || dataProperties.length === 0 || metadataLoading} value={targetPropUri} onChange={(e) => setTargetPropUri(e.target.value)} className="w-full px-4 py-2 border disabled:opacity-50" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
                <option value="">Choose a target property...</option>
                {dataProperties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Identity Properties" hint="The left side of the functional dependency. Select one or more data properties.">
            {!selectedClassUri ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Choose a class first.</p>
            ) : identityCandidates.length === 0 ? (
              <div className="px-4 py-3 text-sm border" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                This class does not have another data property to use as identity. Select one data source or choose a class with more data properties.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {identityCandidates.map((prop) => {
                  const active = identityPropUris.includes(prop.uri);
                  return (
                    <label key={prop.uri} className="flex items-center gap-2 px-3 py-2 border cursor-pointer" style={{ backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <input type="checkbox" checked={active} onChange={() => toggleIdentity(prop.uri)} style={{ accentColor: 'var(--accent)' }} />
                      <span className="truncate text-sm" style={{ color: 'var(--text)' }} title={labelForProperty(prop)}>{labelForProperty(prop)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label="Data Sources" hint={selectedSources.length === 1 ? 'One selected source runs intra-source checking only.' : 'Two or more selected sources also run cross-source checking.'}>
            <div className="flex flex-wrap gap-3">
              {SOURCE_OPTIONS.map((source) => (
                <label key={source.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedSources.includes(source.value)} onChange={() => toggleSource(source.value)} className="w-4 h-4" style={{ accentColor: 'var(--navy)' }} />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{source.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {selectedClass && targetProp && identityLabels.length > 0 && (
            <div className="px-4 py-3 text-sm border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
              Rule: <span className="font-medium">{identityLabels.join(' + ')}</span> determines <span className="font-medium">{labelForProperty(targetProp)}</span> for <span className="font-medium">{labelForClass(selectedClass)}</span>.
            </div>
          )}

          <button onClick={analyze} disabled={!canAnalyze || summaryLoading} className="px-6 py-2.5 inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}>
            <Search className="w-4 h-4" />
            {summaryLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </Section>

      {error && <ErrorState message={error} />}
      {summaryLoading && <LoadingState message="Calculating SA2 summaries..." />}

      {(intraSummary || crossSummary) && !summaryLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard value={formatCount(activeSummary?.total_matched || 0)} label="Matched Pairs" sub={summaryLabel(activeMode)} />
            <MetricCard value={formatCount(activeSummary?.conflicting_pairs || 0)} label="Conflicting Pairs" sub="Evidence rows" color={(activeSummary?.conflicting_pairs || 0) > 0 ? '#9E2B0A' : '#1F8A4C'} />
            <MetricCard value={formatPercent(activeSummary?.conflict_rate || 0)} label="Conflict Rate" sub="conflicts / matched pairs" color={(activeSummary?.conflict_rate || 0) > 0 ? '#9E2B0A' : '#1F8A4C'} />
            <ScoreDonut title="SA2 Score" percentage={scoreFromSummary(activeSummary, activeMode)} sub="1 - conflict rate" />
          </div>

          {hasCross && (
            <div className="inline-flex border overflow-hidden" style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
              <button onClick={() => switchMode('cross')} className="px-4 py-2 text-sm" style={{ backgroundColor: activeMode === 'cross' ? 'var(--navy)' : 'var(--card)', color: activeMode === 'cross' ? 'var(--text-on-dark)' : 'var(--text)' }}>
                Cross-Source
              </button>
              <button onClick={() => switchMode('intra')} className="px-4 py-2 text-sm" style={{ backgroundColor: activeMode === 'intra' ? 'var(--navy)' : 'var(--card)', color: activeMode === 'intra' ? 'var(--text-on-dark)' : 'var(--text)' }}>
                Intra-Source
              </button>
            </div>
          )}

          {activeSummary && <BreakdownTable summary={activeSummary} mode={activeMode} />}
          <PairEvidenceTable
            mode={activeMode}
            summary={activeSummary}
            state={activeRows}
            onPageSizeChange={(size) => pageSizeChange(activeMode, size)}
            onPrev={() => fetchRows(activeMode, Math.max(0, activeRows.offset - activeRows.pageSize), activeRows.pageSize)}
            onNext={() => fetchRows(activeMode, activeRows.offset + activeRows.pageSize, activeRows.pageSize)}
          />
        </>
      )}

      {!intraSummary && !crossSummary && !summaryLoading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Choose a class, rule, and data source, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
