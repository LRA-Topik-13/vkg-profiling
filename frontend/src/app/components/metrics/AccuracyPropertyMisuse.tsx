import { useEffect, useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyPropertyMisuseResult,
  ClassMeta,
  metadataApi,
  PropertyMeta,
} from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, ScoreDonut, Section } from './_shared';
import {
  Field,
  FormulaCard,
  MetricCard,
  StatusPill,
  TableFrame,
  errorMessage,
  formatCount,
  labelForProperty,
  shortUri,
} from './accuracyShared';

export default function AccuracyPropertyMisuse() {
  const [properties, setProperties] = useState<PropertyMeta[]>([]);
  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [selectedPropertyUri, setSelectedPropertyUri] = useState('');
  const [result, setResult] = useState<AccuracyPropertyMisuseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProperty = useMemo(() => properties.find((prop) => prop.uri === selectedPropertyUri) || null, [properties, selectedPropertyUri]);
  const classByUri = useMemo(() => new Map(classes.map((cls) => [cls.uri, cls])), [classes]);

  useEffect(() => {
    setMetadataLoading(true);
    Promise.all([metadataApi.allProperties(), metadataApi.mappedClasses()])
      .then(([propData, classData]) => {
        setProperties(propData.properties);
        setClasses(classData.classes);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setMetadataLoading(false));
  }, []);

  async function analyze() {
    if (!selectedPropertyUri) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await accuracyApi.propertyMisuseByProperty(selectedPropertyUri);
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const expectedDomain = result?.expected_for_classes || [];

  return (
    <div className="space-y-6">
      <Section title="SA4, Property Misuse" subtitle="Check whether a property is used only by classes where the ontology expects it.">
        <FormulaCard title="Property Domain Check" formula="expected uses / all observed uses" description="Unexpected class-property combinations are treated as semantic misuse evidence." />
      </Section>

      <Section title="Configuration">
        <div className="space-y-4">
          <Field label="Property" hint={metadataLoading ? 'Loading properties...' : 'Select one mapped property to evaluate across all mapped classes.'}>
            <select disabled={metadataLoading} value={selectedPropertyUri} onChange={(e) => { setSelectedPropertyUri(e.target.value); setResult(null); setError(null); }} className="w-full px-4 py-2 border disabled:opacity-50" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
              <option value="">Choose a property...</option>
              {properties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)} ({prop.type})</option>)}
            </select>
          </Field>

          {selectedProperty && (
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Selected property: <span className="font-mono" style={{ color: 'var(--text)' }}>{shortUri(selectedProperty.uri)}</span>
            </div>
          )}

          <button onClick={analyze} disabled={!selectedPropertyUri || loading} className="px-6 py-2.5 inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-md)' }}>
            <Search className="w-4 h-4" />
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </Section>

      {error && <ErrorState message={error} />}
      {loading && <LoadingState message="Analyzing property usage..." />}

      {result && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard value={formatCount(result.total_property_uses)} label="Observed Uses" sub={result.property} />
            <MetricCard value={formatCount(result.total_expected_count)} label="Expected Uses" sub="Ontology domain" color="#1F8A4C" />
            <MetricCard value={formatCount(result.total_misuse_count)} label="Misuse Uses" sub="Unexpected domain" color={result.total_misuse_count > 0 ? '#9E2B0A' : '#1F8A4C'} />
            <ScoreDonut title="SA4 Score" percentage={result.sa4_score} sub="expected / observed" />
          </div>

          <Section title="Expected Domain" subtitle={`Expected domain for ${result.property}.`}>
            {expectedDomain.length === 0 ? (
              <EmptyState message="No expected classes are defined for this property." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {expectedDomain.map((uri) => {
                  const cls = classByUri.get(uri);
                  return (
                    <span key={uri} className="px-3 py-1.5 text-sm border" style={{ backgroundColor: 'var(--info-soft)', color: 'var(--navy)', borderColor: 'rgba(0,54,99,0.2)', borderRadius: 'var(--radius-sm)' }} title={uri}>
                      {cls?.label || cls?.localName || shortUri(uri)}
                    </span>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Class Breakdown" subtitle="Expected classes are shown for context. Misuse rows include sampled entity evidence.">
            <TableFrame>
              <table className="w-full table-fixed">
                <thead style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left w-[24%]" style={{ color: 'var(--text-on-dark)' }}>Class</th>
                    <th className="px-4 py-3 text-left w-[14%]" style={{ color: 'var(--text-on-dark)' }}>Status</th>
                    <th className="px-4 py-3 text-left w-[14%]" style={{ color: 'var(--text-on-dark)' }}>Uses</th>
                    <th className="px-4 py-3 text-left w-[48%]" style={{ color: 'var(--text-on-dark)' }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.classes.map((row) => {
                    const remaining = Math.max(0, row.count - row.entity_uris.length);
                    return (
                      <tr key={row.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text)' }}>{classByUri.get(row.uri)?.label || row.class}</div>
                          <div className="text-xs font-mono truncate" style={{ color: 'var(--muted-foreground)' }} title={row.uri}>{shortUri(row.uri)}</div>
                        </td>
                        <td className="px-4 py-3"><StatusPill tone={row.expected ? 'good' : 'bad'}>{row.expected ? 'Expected' : 'Misuse'}</StatusPill></td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{formatCount(row.count)}</td>
                        <td className="px-4 py-3">
                          {row.expected ? (
                            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Expected domain.</span>
                          ) : row.entity_uris.length === 0 ? (
                            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Misuse detected.</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {row.entity_uris.map((uri) => (
                                <span key={uri} className="px-2 py-1 text-xs font-mono truncate max-w-[220px]" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)' }} title={uri}>
                                  {shortUri(uri)}
                                </span>
                              ))}
                              {remaining > 0 && <span className="px-2 py-1 text-xs" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius-sm)' }}>+{remaining} more</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableFrame>
          </Section>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <FileText className="mx-auto mb-4 w-12 h-12 opacity-40" />
          <p className="text-sm font-medium">Choose a property, then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
