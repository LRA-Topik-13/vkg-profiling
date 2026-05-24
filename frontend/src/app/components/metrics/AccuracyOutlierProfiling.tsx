import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyOutlierResult,
  AccuracyPresenceEntity,
  AccuracyRelationshipEntity,
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
  SourceBadge,
  StatusPill,
  TableFrame,
  TablePager,
  errorMessage,
  formatCount,
  formatPercent,
  getEntitySource,
  labelForClass,
  labelForProperty,
  shortUri,
} from './accuracyShared';

type OutlierMode = 'relationship_count' | 'property_presence_anomaly';

type SortableEntity = AccuracyRelationshipEntity | AccuracyPresenceEntity;

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
  const domainMin = Math.min(min, lower);
  const domainMax = Math.max(max, upper);
  const span = domainMax === domainMin ? 1 : domainMax - domainMin;
  const width = 760;
  const height = 190;
  const left = 64;
  const right = 44;
  const plotWidth = width - left - right;
  const x = (value: number) => left + ((value - domainMin) / span) * plotWidth;
  const y = 82;
  const boxH = 42;
  const outliers = rows.filter((row) => row.is_outlier);

  const groupedLabels = new Map<number, string[]>();
  [
    ['Min', min],
    ['Lower fence', lower],
    ['Q1', q1],
    ['Median', med],
    ['Q3', q3],
    ['Upper fence', upper],
    ['Max', max],
  ].forEach(([label, raw]) => {
    const value = Number(raw);
    const key = Math.round(value * 10000) / 10000;
    groupedLabels.set(key, [...(groupedLabels.get(key) || []), String(label)]);
  });

  return (
    <Section title="Distribution" subtitle="Relationship counts are evaluated with Tukey fences.">
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full" role="img" aria-label="Relationship count box plot">
          <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--border)" strokeWidth="2" />
          <line x1={x(min)} x2={x(q1)} y1={y} y2={y} stroke="var(--navy)" strokeWidth="3" />
          <line x1={x(q3)} x2={x(max)} y1={y} y2={y} stroke="var(--navy)" strokeWidth="3" />
          <rect x={x(q1)} y={y - boxH / 2} width={Math.max(2, x(q3) - x(q1))} height={boxH} fill="var(--info-soft)" stroke="var(--navy)" strokeWidth="2" rx="4" />
          <line x1={x(med)} x2={x(med)} y1={y - boxH / 2} y2={y + boxH / 2} stroke="var(--accent)" strokeWidth="3" />
          {[min, max].map((value, index) => (
            <line key={index} x1={x(value)} x2={x(value)} y1={y - 28} y2={y + 28} stroke="var(--navy)" strokeWidth="2" />
          ))}
          {[lower, upper].map((value, index) => (
            <line key={index} x1={x(value)} x2={x(value)} y1={y - 36} y2={y + 36} stroke="#9E2B0A" strokeDasharray="5 4" strokeWidth="2" />
          ))}
          {outliers.map((row, index) => (
            <circle key={`${row.uri}-${index}`} cx={x(row.count)} cy={y - 46 - (index % 3) * 8} r="5" fill="#9E2B0A" opacity="0.9" />
          ))}
          {Array.from(groupedLabels.entries()).map(([value, labels], index) => {
            const above = index % 2 === 0;
            return (
              <g key={value}>
                <line x1={x(value)} x2={x(value)} y1={above ? y + 34 : y + 48} y2={above ? y + 42 : y + 56} stroke="var(--border)" />
                <text x={x(value)} y={above ? y + 58 : y + 76} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                  <tspan x={x(value)}>{labels.join(' / ')}</tspan>
                  <tspan x={x(value)} dy="14" fill="var(--text)">{value}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Section>
  );
}

function RelationshipEntityTable({ result }: { result: AccuracyOutlierResult }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);

  const rows = useMemo(() => {
    return result.entities
      .filter(isRelationshipEntity)
      .filter((row) => sourceFilter === 'all' || getEntitySource(row.uri) === sourceFilter)
      .filter((row) => !onlyOutliers || row.is_outlier);
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
            <option value="http://example.org/voc#uni1/">uni1</option>
            <option value="http://example.org/voc#uni2/">uni2</option>
            <option value="http://example.org/voc#uni3/">uni3</option>
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

function PresenceResult({ result }: { result: AccuracyOutlierResult }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);

  const rows = useMemo(() => result.entities
    .filter(isPresenceEntity)
    .filter((row) => sourceFilter === 'all' || getEntitySource(row.uri) === sourceFilter)
    .filter((row) => !onlyOutliers || row.is_outlier), [result.entities, sourceFilter, onlyOutliers]);

  useEffect(() => setOffset(0), [sourceFilter, onlyOutliers, pageSize, result]);

  const page = rows.slice(offset, offset + pageSize);

  return (
    <>
      <Section title="Property Fill Rates" subtitle="Properties above 50% are common. Properties below 50% are rare.">
        <TableFrame>
          <table className="w-full table-fixed">
            <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Property</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Filled</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Fill Rate</th>
                <th className="px-4 py-3 text-left" style={{ color: 'var(--text-on-dark)' }}>Pattern</th>
              </tr>
            </thead>
            <tbody>
              {(result.property_stats || []).map((stat) => (
                <tr key={stat.property} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{stat.property}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatCount(stat.fill_count)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatPercent(stat.fill_rate * 100)}</td>
                  <td className="px-4 py-3"><StatusPill tone={stat.fill_rate === 0.5 ? 'neutral' : stat.is_majority ? 'good' : 'warn'}>{stat.fill_rate === 0.5 ? 'No majority' : stat.is_majority ? 'Common' : 'Rare'}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </Section>

      <Section
        title="Entity Evidence"
        subtitle="Rows are flagged when their property pattern differs from the class majority."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 border text-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
              <option value="all">All sources</option>
              <option value="http://example.org/voc#uni1/">uni1</option>
              <option value="http://example.org/voc#uni2/">uni2</option>
              <option value="http://example.org/voc#uni3/">uni3</option>
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
            <table className="w-full table-fixed">
              <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left w-[30%]" style={{ color: 'var(--text-on-dark)' }}>Entity</th>
                  <th className="px-4 py-3 text-left w-[12%]" style={{ color: 'var(--text-on-dark)' }}>Source</th>
                  <th className="px-4 py-3 text-left w-[16%]" style={{ color: 'var(--text-on-dark)' }}>Filled</th>
                  <th className="px-4 py-3 text-left w-[12%]" style={{ color: 'var(--text-on-dark)' }}>Status</th>
                  <th className="px-4 py-3 text-left w-[30%]" style={{ color: 'var(--text-on-dark)' }}>Violation</th>
                </tr>
              </thead>
              <tbody>
                {page.map((entity) => (
                  <tr key={entity.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-sm truncate" style={{ color: 'var(--navy)' }} title={entity.uri}>{shortUri(entity.uri)}</td>
                    <td className="px-4 py-3"><SourceBadge source={getEntitySource(entity.uri)} /></td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{entity.filled_count} of {entity.total_props}</td>
                    <td className="px-4 py-3"><StatusPill tone={entity.is_outlier ? 'warn' : 'good'}>{entity.is_outlier ? 'Anomaly' : 'OK'}</StatusPill></td>
                    <td className="px-4 py-3 text-sm" style={{ color: entity.is_outlier ? 'var(--accent)' : 'var(--muted-foreground)' }}>{entity.violations?.[0]?.message || 'No violation'}</td>
                  </tr>
                ))}
              </tbody>
              <TablePager pageSize={pageSize} onPageSizeChange={setPageSize} offset={offset} total={rows.length} count={page.length} loading={false} onPrev={() => setOffset(Math.max(0, offset - pageSize))} onNext={() => setOffset(offset + pageSize)} colSpan={5} />
            </table>
          </TableFrame>
        )}
      </Section>
    </>
  );
}

function OutlierSummary({ result }: { result: AccuracyOutlierResult }) {
  const cleanScore = result.total ? ((result.total - result.outlier_count) / result.total) * 100 : 100;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard value={formatCount(result.total)} label="Total Entities" sub={result.class} />
      <MetricCard value={formatCount(result.outlier_count)} label="Flagged Entities" sub="Potential semantic anomalies" color={result.outlier_count > 0 ? '#9E2B0A' : '#1F8A4C'} />
      <ScoreDonut title="SA1 Score" percentage={cleanScore} sub="Entities without flags" />
      <MetricCard value={result.type === 'relationship_count' ? result.property || '-' : formatCount(result.properties_checked?.length || 0)} label={result.type === 'relationship_count' ? 'Property' : 'Properties Checked'} sub={result.type === 'relationship_count' ? 'Object property' : 'Mapped class properties'} />
    </div>
  );
}

export default function AccuracyOutlierProfiling() {
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [selectedClassUri, setSelectedClassUri] = useState('');
  const [selectedPropertyUri, setSelectedPropertyUri] = useState('');
  const [mode, setMode] = useState<OutlierMode>('relationship_count');
  const [result, setResult] = useState<AccuracyOutlierResult | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(() => classes.find((cls) => cls.uri === selectedClassUri) || null, [classes, selectedClassUri]);
  const objectProperties = useMemo(() => properties.filter((prop) => prop.type === 'object'), [properties]);
  const selectedProperty = useMemo(() => properties.find((prop) => prop.uri === selectedPropertyUri) || null, [properties, selectedPropertyUri]);

  useEffect(() => {
    metadataApi.mappedClasses().then((data) => setClasses(data.classes)).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
    setSelectedPropertyUri('');
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
      <Section title="SA1, Outlier Profiling" subtitle="Find entities whose relationship counts or property-presence pattern differ from the class distribution.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormulaCard title="Relationship Count" formula="count(entity, property) outside Tukey fences" description="Useful for object properties such as attends or teaches." />
          <FormulaCard title="Property-Presence Anomaly" formula="entity pattern differs from property majority" description="Common missing values and rare present values are flagged." />
        </div>
      </Section>

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
                <select disabled={!selectedClassUri || objectProperties.length === 0 || metadataLoading} value={selectedPropertyUri} onChange={(e) => setSelectedPropertyUri(e.target.value)} className="w-full px-4 py-2 border disabled:opacity-50" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
                  <option value="">Choose an object property...</option>
                  {objectProperties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)}</option>)}
                </select>
              </Field>
            )}
          </div>

          {selectedClass && (
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Selected class: <span className="font-mono" style={{ color: 'var(--text)' }}>{shortUri(selectedClass.uri)}</span>
              {selectedProperty && <> , property: <span className="font-mono" style={{ color: 'var(--text)' }}>{shortUri(selectedProperty.uri)}</span></>}
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
