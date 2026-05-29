import { useEffect, useMemo, useState, MouseEvent } from 'react';
import { BarChart3, FileText, Plus, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyOutlierResult,
  AccuracyPresenceEntity,
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
  formatPercent,
  getEntitySource,
  labelForClass,
  labelForProperty,
  shortUri,
} from './accuracyShared';

type OutlierMode = 'relationship_count' | 'property_presence_anomaly';
type SortableEntity = AccuracyRelationshipEntity | AccuracyPresenceEntity;

const EMPTY_FACET_DRAFT = {
  propUri: '',
  valueUri: '',
  values: [] as string[],
  loading: false,
  error: null as string | null,
};

function isRelationshipEntity(entity: SortableEntity): entity is AccuracyRelationshipEntity {
  return 'count' in entity;
}

function isPresenceEntity(entity: SortableEntity): entity is AccuracyPresenceEntity {
  return 'prop_status' in entity;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatStat(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function groupedStats(items: Array<{ label: string; value: number }>) {
  const groups = new Map<number, string[]>();
  items.forEach((item) => {
    const key = Math.round(item.value * 10000) / 10000;
    groups.set(key, [...(groups.get(key) || []), item.label]);
  });
  return Array.from(groups.entries()).map(([value, labels]) => ({ value, labels }));
}

interface CountGroup {
  count: number;
  total: number;
  outliers: number;
}

function RelationshipCountBoxPlot({ result }: { result: AccuracyOutlierResult }) {
  const rows = result.entities.filter(isRelationshipEntity);
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
    { label: 'Lower Fence', value: lower },
    { label: 'Q1', value: q1 },
    { label: 'Median', value: med },
    { label: 'Q3', value: q3 },
    { label: 'Upper Fence', value: upper },
    { label: 'Max', value: max },
  ];
  const countGroups = Array.from(rows.reduce((acc, row) => {
    const current = acc.get(row.count) || { count: row.count, total: 0, outliers: 0 };
    current.total += 1;
    if (row.is_outlier) current.outliers += 1;
    acc.set(row.count, current);
    return acc;
  }, new Map<number, CountGroup>()).values()).sort((a, b) => a.count - b.count);
  const axisTicks = groupedStats([
    { label: 'Min', value: min },
    { label: 'Q1', value: q1 },
    { label: 'Median', value: med },
    { label: 'Q3', value: q3 },
    { label: 'Max', value: max },
  ]);
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
          Blue dots are relationship counts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: '#9E2B0A', opacity: 0.88 }} />
          Red dots are flagged counts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 18, borderTop: '3px solid var(--navy)' }} />
          Blue whiskers show the non-outlier range
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
                onMouseEnter={(event) => showTooltip(event, group)}
                onMouseMove={(event) => showTooltip(event, group)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          <line x1={left} x2={width - right} y1={height - 52} y2={height - 52} stroke="var(--border)" strokeWidth="1" />
          {axisTicks.map((tick) => (
            <g key={`${tick.labels.join('-')}-${tick.value}`}>
              <line x1={x(tick.value)} x2={x(tick.value)} y1={height - 56} y2={height - 48} stroke="var(--border)" />
              <text x={x(tick.value)} y={height - 32} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{formatStat(tick.value)}</text>
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
      <div className="mt-3 flex flex-wrap gap-2">
        {statItems.map((item) => (
          <span key={item.label} className="px-2.5 py-1 text-xs border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
            <span style={{ color: 'var(--muted-foreground)' }}>{item.label}:</span> {formatStat(item.value)}
          </span>
        ))}
      </div>
    </Section>
  );
}

function RelationshipEntityTable({ result }: { result: AccuracyOutlierResult }) {
  const sources = useSources();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);

  const rows = useMemo(() => {
    return result.entities
      .filter(isRelationshipEntity)
      .filter((row) => sourceFilter === 'all' || getEntitySource(row.uri) === sourceFilter)
      .filter((row) => !onlyOutliers || row.is_outlier)
      .sort((a, b) => Number(b.is_outlier) - Number(a.is_outlier) || a.uri.localeCompare(b.uri));
  }, [result.entities, sourceFilter, onlyOutliers]);

  useEffect(() => setOffset(0), [sourceFilter, onlyOutliers, pageSize, result]);

  const page = rows.slice(offset, offset + pageSize);

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
          <button onClick={() => setOnlyOutliers((v) => !v)} className="px-3 py-2 border text-sm" style={{ backgroundColor: onlyOutliers ? 'var(--accent-soft)' : 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: onlyOutliers ? 'var(--accent)' : 'var(--text)' }}>
            {onlyOutliers ? 'Showing outliers' : 'Show outliers'}
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState message="No rows match the current filters." />
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
                  <td className="px-4 py-3 text-sm" style={{ color: entity.is_outlier ? 'var(--accent)' : 'var(--muted-foreground)' }}>{entity.violations?.[0]?.message || 'No violation'}</td>
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

function PresenceMatrix({ result }: { result: AccuracyOutlierResult }) {
  const sources = useSources();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const props = result.properties_checked || [];
  const rows = useMemo(() => result.entities
    .filter(isPresenceEntity)
    .filter((row) => sourceFilter === 'all' || getEntitySource(row.uri) === sourceFilter)
    .filter((row) => !onlyOutliers || row.is_outlier)
    .sort((a, b) => Number(b.is_outlier) - Number(a.is_outlier) || a.uri.localeCompare(b.uri)), [result.entities, sourceFilter, onlyOutliers]);

  useEffect(() => setOffset(0), [sourceFilter, onlyOutliers, pageSize, result]);

  const page = rows.slice(offset, offset + pageSize);
  const minWidth = Math.max(1080, 340 + props.length * 132 + 380);

  function propertyPattern(prop: string) {
    const stat = result.property_stats?.find((item) => item.property === prop);
    if (!stat) return 'No pattern';
    if (stat.fill_rate > 0.5) return 'Usually present';
    if (stat.fill_rate === 0.5) return 'No majority';
    return 'Usually absent';
  }

  function cellState(entity: AccuracyPresenceEntity, prop: string) {
    const anomaly = entity.outlier_properties.find((item) => item.property === prop);
    if (anomaly && anomaly.has_value) return { label: 'Present', tone: 'bad', title: 'Present, but the property is usually absent' };
    if (anomaly) return { label: 'Absent', tone: 'bad', title: 'Absent, but the property is usually present' };
    const hasValue = entity.prop_status[prop];
    return hasValue
      ? { label: 'Present', tone: 'good', title: 'Present and consistent' }
      : { label: 'Absent', tone: 'neutral', title: 'Absent and consistent' };
  }

  function violationText(entity: AccuracyPresenceEntity) {
    return entity.violations?.map((violation) => violation.message).join(' | ') || 'No violation';
  }

  return (
    <Section
      title="Property Matrix"
      subtitle="Cells show whether each entity has each checked property. Highlighted cells are property-presence anomalies."
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 border text-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
            <option value="all">All sources</option>
            {sources.map((s) => <option key={s.uri} value={s.uri}>{s.localName}</option>)}
          </select>
          <button onClick={() => setOnlyOutliers((v) => !v)} className="px-3 py-2 border text-sm" style={{ backgroundColor: onlyOutliers ? 'var(--accent-soft)' : 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: onlyOutliers ? 'var(--accent)' : 'var(--text)' }}>
            {onlyOutliers ? 'Showing anomalies' : 'Show anomalies'}
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState message="No rows match the current filters." />
      ) : (
        <TableFrame>
          <div className="overflow-x-auto">
            <table style={{ minWidth }}>
              <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left w-[240px]" style={{ color: 'var(--text-on-dark)' }}>Entity</th>
                  <th className="px-4 py-3 text-left w-[90px]" style={{ color: 'var(--text-on-dark)' }}>Source</th>
                  {props.map((prop) => (
                    <th key={prop} className="px-3 py-3 text-left text-sm" style={{ color: 'var(--text-on-dark)' }}>
                      <div>{prop}</div>
                      <div className="text-xs font-normal opacity-80">{propertyPattern(prop)}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left w-[100px]" style={{ color: 'var(--text-on-dark)' }}>Status</th>
                  <th className="px-4 py-3 text-left w-[280px]" style={{ color: 'var(--text-on-dark)' }}>Violations</th>
                </tr>
              </thead>
              <tbody>
                {page.map((entity) => (
                  <tr key={entity.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-sm truncate max-w-[240px]" style={{ color: 'var(--navy)' }} title={entity.uri}>{shortUri(entity.uri)}</td>
                    <td className="px-4 py-3"><SourceBadge source={getEntitySource(entity.uri)} /></td>
                    {props.map((prop) => {
                      const state = cellState(entity, prop);
                      return (
                        <td key={prop} className="px-3 py-3 text-sm">
                          <span
                            className="inline-flex px-2 py-1 text-xs"
                            title={state.title}
                            style={{
                              backgroundColor: state.tone === 'bad' ? 'var(--accent-soft)' : state.tone === 'good' ? '#e6f4ea' : 'var(--muted)',
                              color: state.tone === 'bad' ? 'var(--accent)' : state.tone === 'good' ? '#1F8A4C' : 'var(--muted-foreground)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {state.label}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3"><StatusPill tone={entity.is_outlier ? 'warn' : 'good'}>{entity.is_outlier ? 'Anomaly' : 'OK'}</StatusPill></td>
                    <td className="px-4 py-3 text-sm" style={{ color: entity.is_outlier ? 'var(--accent)' : 'var(--muted-foreground)' }}>{violationText(entity)}</td>
                  </tr>
                ))}
              </tbody>
              <TablePager pageSize={pageSize} onPageSizeChange={setPageSize} offset={offset} total={rows.length} count={page.length} loading={false} onPrev={() => setOffset(Math.max(0, offset - pageSize))} onNext={() => setOffset(offset + pageSize)} colSpan={4 + props.length} />
            </table>
          </div>
        </TableFrame>
      )}
    </Section>
  );
}

function PresenceResult({ result }: { result: AccuracyOutlierResult }) {
  return (
    <>
      <Section title="Property Presence Rates" subtitle="Properties above 50% are usually present. Properties below 50% are usually absent.">
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusPill tone="good">Usually present</StatusPill>
          <StatusPill tone="neutral">No majority</StatusPill>
          <StatusPill tone="warn">Usually absent</StatusPill>
        </div>
        <TableFrame>
          <table className="w-full table-fixed">
            <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Property</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Present</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Presence Rate</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Pattern</th>
              </tr>
            </thead>
            <tbody>
              {(result.property_stats || []).map((stat) => (
                <tr key={stat.property} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{stat.property}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatCount(stat.fill_count)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatPercent(stat.fill_rate * 100)}</td>
                  <td className="px-4 py-3"><StatusPill tone={stat.fill_rate === 0.5 ? 'neutral' : stat.is_majority ? 'good' : 'warn'}>{stat.fill_rate === 0.5 ? 'No majority' : stat.is_majority ? 'Usually present' : 'Usually absent'}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </Section>

      <div
        className="px-4 py-3 text-sm border"
        style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
      >
        <span className="font-medium" style={{ color: 'var(--navy)' }}>Matrix rule:</span>{' '}
        Usually present means presence rate is above 50%, so absence is anomalous. Usually absent means presence rate is below 50%, so presence is anomalous. At exactly 50%, no anomaly is assigned.
      </div>

      <PresenceMatrix result={result} />
    </>
  );
}

function OutlierSummary({ result }: { result: AccuracyOutlierResult }) {
  const cleanScore = result.total ? ((result.total - result.outlier_count) / result.total) * 100 : null;
  const isRelationship = result.type === 'relationship_count';
  const scoreTitle = isRelationship ? 'Relationship Count Score' : 'Property-Presence Anomaly Score';
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard value={formatCount(result.total)} label="Total Entities" sub={result.class} />
      <MetricCard value={formatCount(result.outlier_count)} label="Flagged Entities" sub="Potential semantic anomalies" color={result.outlier_count > 0 ? '#9E2B0A' : '#1F8A4C'} />
      <AccuracyScoreDonut title={scoreTitle} percentage={cleanScore} sub="Entities without flags" />
      <MetricCard value={isRelationship ? result.property || '-' : formatCount(result.properties_checked?.length || 0)} label={isRelationship ? 'Property' : 'Properties Checked'} sub={isRelationship ? 'Object property' : 'Mapped class properties'} />
    </div>
  );
}

export default function AccuracyOutlierProfiling() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedPropertyUri, setSelectedPropertyUri] = useState('');
  const [mode, setMode] = useState<OutlierMode>('relationship_count');
  const [facets, setFacets] = useState<AccuracyFacet[]>([]);
  const [facetDraft, setFacetDraft] = useState(EMPTY_FACET_DRAFT);
  const [result, setResult] = useState<AccuracyOutlierResult | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(() => classes.find((cls) => cls.uri === selectedClassUri) || null, [classes, selectedClassUri]);
  const objectProperties = useMemo(() => properties.filter((prop) => prop.type === 'object'), [properties]);
  const selectedProperty = useMemo(() => properties.find((prop) => prop.uri === selectedPropertyUri) || null, [properties, selectedPropertyUri]);
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

  function addFacet() {
    if (!facetDraft.propUri) return;
    const propEntry = objectProperties.find((prop) => prop.uri === facetDraft.propUri);
    if (!propEntry) return;
    const valueUri = facetDraft.valueUri || null;
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
    setResult(null);
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
    if (mode === 'relationship_count' && !selectedPropertyUri) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await accuracyApi.outliers({
        class_uri: selectedClassUri,
        type: mode,
        property_uri: mode === 'relationship_count' ? selectedPropertyUri : undefined,
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
      <Section title="Configuration">
        <div className="space-y-4">
          <Field label="Outlier Type">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { value: 'relationship_count', label: 'Relationship Count', hint: 'Counts values for one object property.' },
                { value: 'property_presence_anomaly', label: 'Property-Presence Anomaly', hint: 'Checks property presence across mapped properties.' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setMode(option.value as OutlierMode);
                    setResult(null);
                    setError(null);
                  }}
                  className="text-left p-4 border transition-colors"
                  style={{ backgroundColor: mode === option.value ? 'var(--accent-soft)' : 'var(--card)', borderColor: mode === option.value ? 'var(--accent)' : 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{option.hint}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Class">
              <select value={selectedClassUri} onChange={(e) => setSelectedClassUri(e.target.value)} className="w-full px-4 py-2 border" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
                <option value="">Choose a class...</option>
                {classes.map((cls) => <option key={cls.uri} value={cls.uri}>{labelForClass(cls)}</option>)}
              </select>
            </Field>

            {mode === 'relationship_count' && (
              <Field label="Object Property" hint={metadataLoading ? 'Loading properties...' : objectProperties.length === 0 && selectedClassUri ? 'No object properties found for this class.' : undefined}>
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
            )}
          </div>

          <Field label="Add facet (optional)" hint="Facet filters narrow the evaluated entities before the score is calculated.">
            <div className="flex gap-2">
              <select
                disabled={!selectedClassUri || objectProperties.length === 0 || metadataLoading}
                value={facetDraft.propUri}
                onChange={(event) => setFacetDraft((draft) => ({ ...draft, propUri: event.target.value }))}
                className="flex-1 px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">predicate</option>
                {objectProperties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)}</option>)}
              </select>
              <select
                disabled={!facetDraft.propUri}
                value={facetDraft.valueUri}
                onChange={(event) => setFacetDraft((draft) => ({ ...draft, valueUri: event.target.value }))}
                className="flex-1 px-4 py-2 border disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}
              >
                <option value="">{facetDraft.loading ? 'Loading values...' : 'Any value (exists)'}</option>
                {facetDraft.values.map((value) => <option key={value} value={value}>{shortUri(value)}</option>)}
              </select>
              <button
                onClick={addFacet}
                disabled={!facetDraft.propUri}
                className="inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}
                title="Add facet"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {facetDraft.error && (
              <div className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
                Failed to load facet values. You can still add an existence facet.
              </div>
            )}
            {noExactFacetValues && (
              <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                No exact values were found for this class and property. You can still add an existence facet.
              </div>
            )}
          </Field>

          <ActiveFacetList facets={facets} onRemove={removeFacet} onClear={clearFacets} />

          {selectedClass && (
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Selected class: <span className="font-mono" style={{ color: 'var(--text)' }}>{shortUri(selectedClass.uri)}</span>
              {mode === 'relationship_count' && selectedProperty && <> , property: <span className="font-mono" style={{ color: 'var(--text)' }}>{shortUri(selectedProperty.uri)}</span></>}
            </div>
          )}

          <button onClick={analyze} disabled={!selectedClassUri || loading || (mode === 'relationship_count' && !selectedPropertyUri)} className="px-6 py-2.5 inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}>
            <Search className="w-4 h-4" />
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </Section>

      {error && <ErrorState message={error} />}
      {loading && <LoadingState message="Analyzing outlier profile..." />}

      {result && !loading && (
        <>
          <OutlierSummary result={result} />
          {result.type === 'relationship_count' && <RelationshipCountBoxPlot result={result} />}
          {result.type === 'relationship_count' ? <RelationshipEntityTable result={result} /> : <PresenceResult result={result} />}
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          {mode === 'relationship_count' ? <BarChart3 className="mx-auto mb-4 w-12 h-12 opacity-40" /> : <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />}
          <p className="text-sm font-medium">Choose a class, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
