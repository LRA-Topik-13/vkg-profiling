import { useEffect, useMemo, useState, MouseEvent } from 'react';
import { BarChart3, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyOutlierResult,
  AccuracyRelationshipEntity,
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
  getEntitySource,
  labelFromLookup,
  labelForClass,
  labelForProperty,
  makeClassLabelLookup,
  makePropertyLabelLookup,
  shortUri,
} from './accuracyShared';

const EMPTY_FACET_DRAFT = {
  propUri: '',
  valueUri: '',
  values: [] as string[],
  loading: false,
  error: null as string | null,
};
const FACET_ANY_VALUE = '__any_value_exists__';

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatStat(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function sampledCountTicks(groups: CountGroup[], maxTicks = 12) {
  if (groups.length <= maxTicks) return groups.map((group) => group.count);

  const ticks = new Set<number>();
  const last = groups.length - 1;
  for (let i = 0; i < maxTicks; i += 1) {
    const index = Math.round((i * last) / (maxTicks - 1));
    ticks.add(groups[index].count);
  }
  groups.forEach((group) => {
    if (group.outliers > 0) ticks.add(group.count);
  });
  return Array.from(ticks).sort((a, b) => a - b);
}

interface CountGroup {
  count: number;
  total: number;
  outliers: number;
}

function RelationshipCountBoxPlot({ result }: { result: AccuracyOutlierResult }) {
  const rows = result.entities;
  const counts = rows.map((row) => row.count);
  if (counts.length === 0) return null;

  const stats = result.statistics || {};
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const q1 = Number(stats.q1 ?? min);
  const q3 = Number(stats.q3 ?? max);
  const med = median(counts);
  const lower = Number(stats.lower_fence ?? min);
  const upper = Number(stats.upper_fence ?? max);
  const inliers = counts.filter((value) => value >= lower && value <= upper);
  const whiskerLow = inliers.length > 0 ? Math.min(...inliers) : min;
  const whiskerHigh = inliers.length > 0 ? Math.max(...inliers) : max;
  const rawMin = Math.min(min, lower, q1, med, q3, upper);
  const rawMax = Math.max(max, lower, q1, med, q3, upper);
  const rawSpan = rawMax - rawMin;
  const pad = rawSpan === 0 ? 0.5 : Math.max(rawSpan * 0.08, 0.5);
  const domainMin = rawSpan === 0 ? rawMin - pad : rawMin - pad;
  const domainMax = rawSpan === 0 ? rawMax + pad : rawMax + pad;
  const span = domainMax - domainMin || 1;
  const width = 820;
  const height = 210;
  const left = 54;
  const right = 54;
  const plotWidth = width - left - right;
  const x = (value: number) => left + ((value - domainMin) / span) * plotWidth;
  const y = 92;
  const boxH = 42;
  const pointY = 36;
  const statItems = [
    { label: 'Min', value: min },
    { label: 'Lower Fence', value: lower, isFence: true },
    { label: 'Q1', value: q1 },
    { label: 'Median', value: med },
    { label: 'Q3', value: q3 },
    { label: 'Upper Fence', value: upper, isFence: true },
    { label: 'Max', value: max },
  ];
  const countGroups = Array.from(rows.reduce((acc, row) => {
    const current = acc.get(row.count) || { count: row.count, total: 0, outliers: 0 };
    current.total += 1;
    if (row.is_outlier) current.outliers += 1;
    acc.set(row.count, current);
    return acc;
  }, new Map<number, CountGroup>()).values()).sort((a, b) => a.count - b.count);
  const axisTicks = sampledCountTicks(countGroups);
  const [hovered, setHovered] = useState<CountGroup | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });

  function showTooltip(event: MouseEvent<SVGCircleElement>, group: CountGroup) {
    setHovered(group);
    setTooltip({ x: event.clientX, y: event.clientY });
  }

  return (
    <Section title="Distribution" subtitle="Relationship counts are evaluated with Tukey fences. Every distinct count is plotted above the box plot.">
      <div className="mb-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: 'var(--navy)', opacity: 0.38 }} />
          Blue dots show counts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: '#9E2B0A', opacity: 0.88 }} />
          Red dots show outlier counts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 18, borderTop: '3px solid var(--navy)' }} />
          Whiskers show the lowest and highest counts within the fences
        </span>
      </div>
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full" role="img" aria-label="Relationship count box plot">
          <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--border)" strokeWidth="2" />
          <line x1={x(whiskerLow)} x2={x(q1)} y1={y} y2={y} stroke="var(--navy)" strokeWidth="3" />
          <line x1={x(q3)} x2={x(whiskerHigh)} y1={y} y2={y} stroke="var(--navy)" strokeWidth="3" />
          <line x1={x(whiskerLow)} x2={x(whiskerLow)} y1={y - 20} y2={y + 20} stroke="var(--navy)" strokeWidth="2" />
          <line x1={x(whiskerHigh)} x2={x(whiskerHigh)} y1={y - 20} y2={y + 20} stroke="var(--navy)" strokeWidth="2" />
          <rect x={x(q1)} y={y - boxH / 2} width={Math.max(4, x(q3) - x(q1))} height={boxH} fill="var(--info-soft)" stroke="var(--navy)" strokeWidth="2" rx="4" />
          <line x1={x(med)} x2={x(med)} y1={y - boxH / 2} y2={y + boxH / 2} stroke="var(--accent)" strokeWidth="3" />
          {countGroups.map((group) => {
            const cy = pointY;
            const isOutlier = group.outliers > 0;
            return (
              <circle
                key={group.count}
                cx={x(group.count)}
                cy={cy}
                r={Math.min(12, 4 + Math.sqrt(group.total) * 1.25)}
                fill={isOutlier ? '#9E2B0A' : 'var(--navy)'}
                opacity={isOutlier ? 0.88 : 0.34}
                stroke={isOutlier ? '#6F1D08' : 'var(--card)'}
                strokeWidth="2"
                onMouseEnter={(event) => showTooltip(event, group)}
                onMouseMove={(event) => showTooltip(event, group)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          <line x1={left} x2={width - right} y1={height - 52} y2={height - 52} stroke="var(--border)" strokeWidth="1" />
          {axisTicks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={height - 56} y2={height - 48} stroke="var(--border)" />
              <text x={x(tick)} y={height - 32} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{formatStat(tick)}</text>
            </g>
          ))}
        </svg>
        {hovered && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2 text-xs border shadow-sm"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
          >
            <div><span style={{ color: 'var(--muted-foreground)' }}>Count:</span> {formatStat(hovered.count)}</div>
            <div><span style={{ color: 'var(--muted-foreground)' }}>Entities:</span> {hovered.total}</div>
            <div><span style={{ color: 'var(--muted-foreground)' }}>Outliers:</span> {hovered.outliers}</div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Counts below the lower fence or above the upper fence are flagged as outliers. The fence values are shown below the plot.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {statItems.map((item) => (
          <span
            key={item.label}
            className="px-2.5 py-1 text-xs border"
            style={{
              backgroundColor: item.isFence ? 'var(--accent-soft)' : 'var(--card)',
              borderColor: item.isFence ? 'var(--accent)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: item.isFence ? 'var(--accent)' : 'var(--text)',
              fontWeight: item.isFence ? 600 : 400,
            }}
          >
            <span style={{ color: item.isFence ? 'var(--accent)' : 'var(--muted-foreground)' }}>{item.label}:</span> {formatStat(item.value)}
          </span>
        ))}
      </div>
    </Section>
  );
}

function RelationshipEntityTable({ result, propertyLabel }: { result: AccuracyOutlierResult; propertyLabel: string }) {
  const sources = useSources();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyOutliers, setOnlyOutliers] = useState(true);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);

  const rows = useMemo(() => {
    return result.entities
      .filter((row) => sourceFilter === 'all' || getEntitySource(row.uri) === sourceFilter)
      .filter((row) => !onlyOutliers || row.is_outlier)
      .sort((a, b) => Number(b.is_outlier) - Number(a.is_outlier) || a.uri.localeCompare(b.uri));
  }, [result.entities, sourceFilter, onlyOutliers]);

  useEffect(() => setOffset(0), [sourceFilter, onlyOutliers, pageSize, result]);

  const page = rows.slice(offset, offset + pageSize);
  const label = propertyLabel || 'Property';

  function violationText(entity: AccuracyRelationshipEntity) {
    const violation = entity.violations?.[0];
    if (!violation) return 'No violation';
    if (violation.criterion === 'tukey_lower_bound') {
      return `${label} count ${entity.count} is below the lower fence ${formatStat(Number(result.statistics.lower_fence ?? entity.count))}.`;
    }
    if (violation.criterion === 'tukey_upper_bound') {
      return `${label} count ${entity.count} is above the upper fence ${formatStat(Number(result.statistics.upper_fence ?? entity.count))}.`;
    }
    return violation.message;
  }

  return (
    <Section
      title="Entity Evidence"
      subtitle="Each row is one entity and its relationship count."
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 border text-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
            <option value="all">All sources</option>
            {sources.map((s) => <option key={s.uri} value={s.uri}>{s.localName}</option>)}
          </select>
          <button onClick={() => setOnlyOutliers((v) => !v)} className="px-3 py-2 border text-sm" style={{ backgroundColor: onlyOutliers ? 'var(--card)' : 'var(--accent-soft)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: onlyOutliers ? 'var(--text)' : 'var(--accent)' }}>
            {onlyOutliers ? 'Show all entities' : 'Show flagged only'}
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState message={onlyOutliers ? 'No flagged entities match the current filters.' : 'No rows match the current filters.'} />
      ) : (
        <TableFrame>
          <table className="w-full table-fixed">
            <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th className="px-4 py-3 text-left w-[34%]" style={{ color: 'var(--text-on-dark)' }}>Entity</th>
                <th className="px-4 py-3 text-left w-[12%]" style={{ color: 'var(--text-on-dark)' }}>Source</th>
                <th className="px-4 py-3 text-left w-[12%]" style={{ color: 'var(--text-on-dark)' }}>Count</th>
                <th className="px-4 py-3 text-left w-[12%]" style={{ color: 'var(--text-on-dark)' }}>Status</th>
                <th className="px-4 py-3 text-left w-[30%]" style={{ color: 'var(--text-on-dark)' }}>Violation</th>
              </tr>
            </thead>
            <tbody>
              {page.map((entity) => (
                <tr key={entity.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-sm truncate" style={{ color: 'var(--navy)' }} title={entity.uri}>{shortUri(entity.uri)}</td>
                  <td className="px-4 py-3"><SourceBadge source={getEntitySource(entity.uri)} /></td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{entity.count}</td>
                  <td className="px-4 py-3"><StatusPill tone={entity.is_outlier ? 'warn' : 'good'}>{entity.is_outlier ? 'Outlier' : 'OK'}</StatusPill></td>
                  <td className="px-4 py-3 text-sm" style={{ color: entity.is_outlier ? 'var(--accent)' : 'var(--muted-foreground)' }}>{violationText(entity)}</td>
                </tr>
              ))}
            </tbody>
            <TablePager pageSize={pageSize} onPageSizeChange={setPageSize} offset={offset} total={rows.length} count={page.length} loading={false} onPrev={() => setOffset(Math.max(0, offset - pageSize))} onNext={() => setOffset(offset + pageSize)} colSpan={5} />
          </table>
        </TableFrame>
      )}
    </Section>
  );
}

function OutlierSummary({
  result,
  classLabel,
  propertyLabel,
}: {
  result: AccuracyOutlierResult;
  classLabel: string;
  propertyLabel: string;
}) {
  const cleanScore = result.total ? ((result.total - result.outlier_count) / result.total) * 100 : null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard value={formatCount(result.total)} label="Total Entities" sub={classLabel} />
      <MetricCard value={formatCount(result.outlier_count)} label="Flagged Entities" sub="Potential outliers" color={result.outlier_count > 0 ? '#9E2B0A' : '#1F8A4C'} />
      <AccuracyScoreDonut title="Relationship Count Score" percentage={cleanScore} sub="Entities without flags" />
      <MetricCard value={propertyLabel || '-'} label="Property" sub="Object property" />
    </div>
  );
}

export default function AccuracyOutlierProfiling() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedPropertyUri, setSelectedPropertyUri] = useState('');
  const [facets, setFacets] = useState<AccuracyFacet[]>([]);
  const [facetDraft, setFacetDraft] = useState(EMPTY_FACET_DRAFT);
  const [result, setResult] = useState<AccuracyOutlierResult | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(() => classes.find((cls) => cls.uri === selectedClassUri) || null, [classes, selectedClassUri]);
  const objectProperties = useMemo(() => properties.filter((prop) => prop.type === 'object'), [properties]);
  const selectedProperty = useMemo(() => properties.find((prop) => prop.uri === selectedPropertyUri) || null, [properties, selectedPropertyUri]);
  const classLabelLookup = useMemo(() => makeClassLabelLookup(classes), [classes]);
  const propertyLabelLookup = useMemo(() => makePropertyLabelLookup(properties), [properties]);
  const selectedClassLabel = selectedClass ? labelForClass(selectedClass) : '';
  const selectedPropertyLabel = selectedProperty ? labelForProperty(selectedProperty) : '';
  const resultClassLabel = result ? selectedClassLabel || labelFromLookup(result.class, classLabelLookup) : selectedClassLabel;
  const resultPropertyLabel = result ? selectedPropertyLabel || labelFromLookup(result.property, propertyLabelLookup) : selectedPropertyLabel;
  const facetString = useMemo(() => facetsToParam(facets), [facets]);
  const noExactFacetValues = Boolean(
    facetDraft.propUri && !facetDraft.loading && !facetDraft.error && facetDraft.values.length === 0,
  );

  useEffect(() => {
    metadataApi.mappedClasses().then((data) => setClasses(data.classes)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
    setSelectedPropertyUri('');
    setFacets([]);
    setFacetDraft(EMPTY_FACET_DRAFT);
    if (!selectedClassUri) {
      setProperties([]);
      return;
    }
    setMetadataLoading(true);
    metadataApi.mappedProperties(selectedClassUri)
      .then((data) => {
        setProperties(data.properties);
        const firstObject = data.properties.find((prop) => prop.type === 'object');
        setSelectedPropertyUri(firstObject?.uri || '');
      })
      .catch((err) => {
        setProperties([]);
        setError(errorMessage(err));
      })
      .finally(() => setMetadataLoading(false));
  }, [selectedClassUri]);

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

  function addFacet(value: string) {
    if (!facetDraft.propUri || !value || facetDraft.loading) return;
    const propEntry = objectProperties.find((prop) => prop.uri === facetDraft.propUri);
    if (!propEntry) return;
    const valueUri = value === FACET_ANY_VALUE ? null : value;
    const duplicate = facets.some((facet) => facet.propUri === facetDraft.propUri && facet.valueUri === valueUri);
    if (!duplicate) {
      setFacets((prev) => [
        ...prev,
        {
          propUri: facetDraft.propUri,
          propLabel: labelForProperty(propEntry),
          valueUri,
          valueLabel: valueUri ? shortUri(valueUri) : '(exists)',
        },
      ]);
      setResult(null);
    }
    setFacetDraft(EMPTY_FACET_DRAFT);
  }

  function removeFacet(index: number) {
    setFacets((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }

  function clearFacets() {
    setFacets([]);
    setResult(null);
  }

  async function analyze() {
    if (!selectedClassUri) return;
    if (!selectedPropertyUri) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await accuracyApi.outliers({
        class_uri: selectedClassUri,
        property_uri: selectedPropertyUri,
        filter_facets: facetString,
      });
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="How It Works">
        <div className="space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <p>Relationship Count looks for entities that have an unusual number of relationships for one selected object property.</p>
          <p>Counts below the lower fence or above the upper fence are flagged as outliers.</p>
        </div>
      </Section>

      <Section title="Outlier Profiling of a Class">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Class">
              <select value={selectedClassUri} onChange={(e) => setSelectedClassUri(e.target.value)} className="w-full px-4 py-2 border" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
                <option value="">Choose a class...</option>
                {classes.map((cls) => <option key={cls.uri} value={cls.uri}>{labelForClass(cls)}</option>)}
              </select>
            </Field>

            <Field label="Object Property" hint={metadataLoading ? 'Loading properties...' : objectProperties.length === 0 && selectedClassUri ? 'No object properties found for this class.' : 'Counts how many relationships each entity has for this property.'}>
              <select
                disabled={!selectedClassUri || objectProperties.length === 0 || metadataLoading}
                value={selectedPropertyUri}
                onChange={(e) => {
                  setSelectedPropertyUri(e.target.value);
                  setResult(null);
                  setError(null);
                }}
                className="w-full px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">Choose an object property...</option>
                {objectProperties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Add facet filter (optional)">
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
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) addFacet(value);
                  else setFacetDraft((draft) => ({ ...draft, valueUri: '' }));
                }}
                className="flex-1 px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{facetDraft.loading ? 'Loading values...' : 'Select a value...'}</option>
                <option value={FACET_ANY_VALUE}>Any value (exists)</option>
                {facetDraft.values.map((value) => <option key={value} value={value}>{shortUri(value)}</option>)}
              </select>
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

          <button onClick={analyze} disabled={!selectedClassUri || !selectedPropertyUri || loading} className="px-6 py-2.5 inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}>
            <Search className="w-4 h-4" />
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </Section>

      {error && <ErrorState message={error} />}
      {loading && <LoadingState message="Analyzing outlier profile..." />}

      {result && !loading && (
        <>
          <OutlierSummary result={result} classLabel={resultClassLabel} propertyLabel={resultPropertyLabel} />
          <RelationshipCountBoxPlot result={result} />
          <RelationshipEntityTable result={result} propertyLabel={resultPropertyLabel} />
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <BarChart3 className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Choose a class and object property, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
