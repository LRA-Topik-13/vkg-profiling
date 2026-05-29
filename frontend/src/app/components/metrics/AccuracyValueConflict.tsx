import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
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
import { useSources } from '../../lib/sources';
import { EmptyState, ErrorState, LoadingState, Section } from './_shared';
import {
  AccuracyFacet,
  AccuracyScoreDonut,
  ActiveFacetList,
  DEFAULT_PAGE_SIZE,
  Field,
  MetricCard,
  SourceBadge,
  StatusPill,
  TableFrame,
  TablePager,
  errorMessage,
  facetsToParam,
  formatCount,
  formatNullablePercent,
  labelFromLookup,
  labelForClass,
  labelForProperty,
  makePropertyLabelLookup,
  shortUri,
  sortSources,
} from './accuracyShared';

type EvidenceMode = 'cross' | 'intra';

const EMPTY_FACET_DRAFT = {
  propUri: '',
  valueUri: '',
  values: [] as string[],
  loading: false,
  error: null as string | null,
};
const FACET_ANY_VALUE = '__any_value_exists__';

interface RowState {
  rows: AccuracyPairRow[];
  offset: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const emptyRows = (): RowState => ({ rows: [], offset: 0, pageSize: DEFAULT_PAGE_SIZE, loading: false, error: null });

function scoreFromSummary(summary: AccuracyValueConflictSummary | null, mode: EvidenceMode) {
  if (!summary) return null;
  return mode === 'cross' ? summary.sa2_cross_score ?? null : summary.sa2_score ?? null;
}

function summaryLabel(mode: EvidenceMode) {
  return mode === 'cross' ? 'Cross-Source' : 'Intra-Source';
}

function scoreTone(score: number | null | undefined) {
  if (score == null) return 'neutral';
  if (score >= 90) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

function PairEvidenceTable({
  mode,
  summary,
  state,
  onPageSizeChange,
  onPrev,
  onNext,
  propertyLabelFor,
  targetPropertyLabel,
}: {
  mode: EvidenceMode;
  summary: AccuracyValueConflictSummary | null;
  state: RowState;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  propertyLabelFor: (property: string) => string;
  targetPropertyLabel: string;
}) {
  if (!summary) return null;
  const total = summary.conflicting_pairs;
  const title = `${summaryLabel(mode)} Conflict Evidence`;
  const targetLabel = targetPropertyLabel || propertyLabelFor(summary.target_property || summary.target_prop_uri) || 'Value';

  if (state.loading) {
    return <LoadingState message={`Loading ${summaryLabel(mode).toLowerCase()} conflict evidence...`} />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  if (summary.total_matched === 0) {
    return (
      <div className="px-4 py-3 text-sm border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-md)' }}>
        No comparable pairs found for this rule.
      </div>
    );
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
              <th className="px-4 py-3 text-left w-[16%]" style={{ color: 'var(--text-on-dark)' }}>{targetLabel} (A)</th>
              <th className="px-4 py-3 text-left w-[22%]" style={{ color: 'var(--text-on-dark)' }}>Entity B</th>
              <th className="px-4 py-3 text-left w-[18%]" style={{ color: 'var(--text-on-dark)' }}>{targetLabel} (B)</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((pair, index) => (
              <tr key={`${pair.e1.uri}-${pair.e2.uri}-${index}`} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 align-top">
                  <div className="space-y-1">
                    {Object.entries(pair.identity_values).map(([key, value]) => (
                      <div key={key} className="text-xs px-2 py-1" style={{ backgroundColor: 'var(--muted)', borderRadius: 'var(--radius-sm)', color: 'var(--muted-foreground)' }}>
                        <span>{propertyLabelFor(key)}: </span><span style={{ color: 'var(--text)' }}>{value}</span>
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
  const rows: Array<AccuracyCrossSourceSummaryEntry | AccuracyWithinSourceSummaryEntry> = [
    ...(mode === 'cross' ? summary.source_pair_summary || [] : summary.source_summary || []),
  ].sort((a, b) => (
    b.conflicting_pairs - a.conflicting_pairs
    || b.total_matched - a.total_matched
  ));
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
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatNullablePercent(row.conflict_rate)}</td>
                  <td className="px-4 py-3"><StatusPill tone={scoreTone(score)}>{formatNullablePercent(score)}</StatusPill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableFrame>
    </Section>
  );
}

export default function AccuracyValueConflict() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [targetPropUri, setTargetPropUri] = useState('');
  const [identityPropUris, setIdentityPropUris] = useState<string[]>([]);
  const sources = useSources();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const sourcesInit = useRef(false);
  const [facets, setFacets] = useState<AccuracyFacet[]>([]);
  const [facetDraft, setFacetDraft] = useState(EMPTY_FACET_DRAFT);
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
  const objectProperties = useMemo(() => properties.filter((prop) => prop.type === 'object'), [properties]);
  const identityCandidates = useMemo(() => dataProperties.filter((prop) => prop.uri !== targetPropUri), [dataProperties, targetPropUri]);
  const targetProp = useMemo(() => dataProperties.find((prop) => prop.uri === targetPropUri) || null, [dataProperties, targetPropUri]);
  const propertyLabelLookup = useMemo(() => makePropertyLabelLookup(properties), [properties]);
  const propertyLabelFor = (property: string) => labelFromLookup(property, propertyLabelLookup);
  const targetPropertyLabel = targetProp ? labelForProperty(targetProp) : '';
  const identityLabels = useMemo(() => identityPropUris.map((uri) => labelForProperty(dataProperties.find((prop) => prop.uri === uri))).filter(Boolean), [identityPropUris, dataProperties]);
  const facetString = useMemo(() => facetsToParam(facets), [facets]);
  const canAnalyze = Boolean(selectedClassUri && targetPropUri && identityPropUris.length > 0 && selectedSources.length > 0);
  const hasCross = selectedSources.length >= 2;
  const noExactFacetValues = Boolean(
    facetDraft.propUri && !facetDraft.loading && !facetDraft.error && facetDraft.values.length === 0,
  );
  const canAddFacet = Boolean(facetDraft.propUri && facetDraft.valueUri && !facetDraft.loading);
  const activeSummary = activeMode === 'cross' ? crossSummary : intraSummary;
  const activeRows = activeMode === 'cross' ? crossRows : intraRows;
  const activeScore = scoreFromSummary(activeSummary, activeMode);
  const ruleText = targetProp && identityLabels.length > 0 ? `${identityLabels.join(' + ')} -> ${labelForProperty(targetProp)}` : '';

  useEffect(() => {
    metadataApi.mappedClasses().then((data) => setClasses(data.classes)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!sourcesInit.current && sources.length > 0) {
      sourcesInit.current = true;
      setSelectedSources([sources[0].uri]);
    }
  }, [sources]);

  useEffect(() => {
    setProperties([]);
    setTargetPropUri('');
    setIdentityPropUris([]);
    setFacets([]);
    setFacetDraft(EMPTY_FACET_DRAFT);
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
    setIdentityPropUris(dataProperties.filter((p) => p.uri !== targetPropUri).map((p) => p.uri));
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }, [targetPropUri]);

  useEffect(() => {
    setFacetDraft((draft) => ({ ...draft, valueUri: '', values: [], loading: false, error: null }));
    if (!facetDraft.propUri || !selectedClassUri) return;
    let cancelled = false;
    const propUri = facetDraft.propUri;
    setFacetDraft((draft) => ({ ...draft, loading: true, error: null }));
    metadataApi
      .facets(selectedClassUri, propUri)
      .then((data) => {
        if (!cancelled) setFacetDraft((draft) => draft.propUri === propUri ? { ...draft, values: data.values, loading: false } : draft);
      })
      .catch((err) => {
        if (!cancelled) setFacetDraft((draft) => draft.propUri === propUri ? { ...draft, values: [], loading: false, error: errorMessage(err) } : draft);
      });
    return () => { cancelled = true; };
  }, [facetDraft.propUri, selectedClassUri]);

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
        filter_facets: facetString,
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
  }, [selectedClassUri, targetPropUri, identityPropUris, selectedSources, facetString]);

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
        filter_facets: facetString,
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
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }

  function addFacet() {
    if (!canAddFacet) return;
    const propEntry = objectProperties.find((prop) => prop.uri === facetDraft.propUri);
    if (!propEntry) return;
    const valueUri = facetDraft.valueUri === FACET_ANY_VALUE ? null : facetDraft.valueUri;
    const duplicate = facets.some((facet) => facet.propUri === facetDraft.propUri && facet.valueUri === valueUri);
    if (duplicate) return;
    setFacets((prev) => [
      ...prev,
      {
        propUri: facetDraft.propUri,
        propLabel: labelForProperty(propEntry),
        valueUri,
        valueLabel: valueUri ? shortUri(valueUri) : '(exists)',
      },
    ]);
    setFacetDraft((draft) => ({ ...draft, valueUri: '' }));
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
  }

  function clearFacets() {
    setFacets([]);
    setIntraSummary(null);
    setCrossSummary(null);
    setIntraRows(emptyRows());
    setCrossRows(emptyRows());
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
      <Section title="How It Works">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          This check uses a functional dependency rule, where selected identity properties should determine one target property. For example, Start Time + End Time -&gt; Day means that two comparable Time Slot entities with the same start and end time should also have the same day. If the target values are different, the pair is flagged as a conflict.
        </p>
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Identity Properties</div>
              {identityCandidates.length > 0 && (
                <button
                  onClick={() => {
                    setIdentityPropUris(identityPropUris.length === identityCandidates.length ? [] : identityCandidates.map((p) => p.uri));
                    setIntraSummary(null);
                    setCrossSummary(null);
                    setIntraRows(emptyRows());
                    setCrossRows(emptyRows());
                  }}
                  className="text-xs underline"
                  style={{ color: 'var(--navy)' }}
                >
                  {identityPropUris.length === identityCandidates.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <div className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>The left side of the functional dependency. Select one or more data properties.</div>
            {!selectedClassUri ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Choose a class first.</p>
            ) : identityCandidates.length === 0 ? (
              <div className="px-4 py-3 text-sm border" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)' }}>
                This class does not have another data property to use as identity. Select one data source or choose a class with more data properties.
              </div>
            ) : (
              <div className="always-scrollbar grid grid-cols-1 md:grid-cols-3 gap-2 max-h-36 overflow-y-scroll pr-2">
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
          </div>

          <Field label="Add facet (optional)">
            <p className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Facet filters limit which entities are checked before the score is calculated.
            </p>
            <div className="flex gap-2">
              <select
                disabled={!selectedClassUri || objectProperties.length === 0 || metadataLoading}
                value={facetDraft.propUri}
                onChange={(event) => setFacetDraft((draft) => ({ ...draft, propUri: event.target.value }))}
                className="flex-1 px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">Select predicate...</option>
                {objectProperties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)}</option>)}
              </select>
              <select
                disabled={!facetDraft.propUri || facetDraft.loading}
                value={facetDraft.valueUri}
                onChange={(event) => setFacetDraft((draft) => ({ ...draft, valueUri: event.target.value }))}
                className="flex-1 px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{facetDraft.loading ? 'Loading values...' : 'Select a value...'}</option>
                <option value={FACET_ANY_VALUE}>Any value (exists)</option>
                {facetDraft.values.map((value) => <option key={value} value={value}>{shortUri(value)}</option>)}
              </select>
              <button
                onClick={addFacet}
                disabled={!canAddFacet}
                className="inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: canAddFacet ? 'var(--accent)' : 'var(--muted)',
                  color: canAddFacet ? 'var(--text-on-accent)' : 'var(--muted-foreground)',
                  borderRadius: 'var(--radius-md)',
                }}
                title="Add facet"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {facetDraft.error && (
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

          <ActiveFacetList facets={facets} onRemove={removeFacet} onClear={clearFacets} />

          <Field label="Data Sources" hint={selectedSources.length === 1 ? 'One selected source runs intra-source checking only.' : 'Two or more selected sources also run cross-source checking.'}>
            <div className="flex flex-wrap gap-3">
              {sources.map((source) => (
                <label key={source.uri} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedSources.includes(source.uri)} onChange={() => toggleSource(source.uri)} className="w-4 h-4" style={{ accentColor: 'var(--navy)' }} />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{source.localName}</span>
                </label>
              ))}
            </div>
          </Field>

          {selectedClass && targetProp && identityLabels.length > 0 && (
            <div className="px-4 py-3 text-sm border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
              <div className="font-mono text-base mb-1" style={{ color: 'var(--navy)' }}>{ruleText}</div>
              <div>Rule: <span className="font-medium">{identityLabels.join(' + ')}</span> determines <span className="font-medium">{labelForProperty(targetProp)}</span> for <span className="font-medium">{labelForClass(selectedClass)}</span>.</div>
            </div>
          )}

          <button onClick={analyze} disabled={!canAnalyze || summaryLoading} className="px-6 py-2.5 inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}>
            <Search className="w-4 h-4" />
            {summaryLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </Section>

      {error && <ErrorState message={error} />}
      {summaryLoading && <LoadingState message="Calculating value conflict summaries..." />}

      {(intraSummary || crossSummary) && !summaryLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard value={formatCount(activeSummary?.total_matched || 0)} label="Matched Pairs" sub={activeSummary?.total_matched === 0 ? 'No comparable pairs' : summaryLabel(activeMode)} />
            <MetricCard value={formatCount(activeSummary?.conflicting_pairs || 0)} label="Conflicting Pairs" sub="Evidence rows" color={(activeSummary?.conflicting_pairs || 0) > 0 ? '#9E2B0A' : '#1F8A4C'} />
            <MetricCard value={formatNullablePercent(activeSummary?.conflict_rate)} label="Conflict Rate" sub={activeSummary?.total_matched === 0 ? 'No comparable pairs' : 'conflicts / matched pairs'} color={(activeSummary?.conflict_rate || 0) > 0 ? '#9E2B0A' : 'var(--navy)'} />
            <AccuracyScoreDonut title="Value Conflict Score" percentage={activeScore} sub={activeSummary?.total_matched === 0 ? 'No comparable pairs' : '1 - conflict rate'} />
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
            propertyLabelFor={propertyLabelFor}
            targetPropertyLabel={targetPropertyLabel}
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
