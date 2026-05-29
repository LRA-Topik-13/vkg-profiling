import { useEffect, useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import {
  accuracyApi,
  AccuracyPropertyMisuseResult,
  ClassMeta,
  metadataApi,
  PropertyMeta,
} from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, Section } from './_shared';
import {
  AccuracyScoreDonut,
  Field,
  MetricCard,
  StatusPill,
  TableFrame,
  errorMessage,
  formatCount,
  labelFromLookup,
  labelForProperty,
  makeClassLabelLookup,
  makePropertyLabelLookup,
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
  const [showAllClasses, setShowAllClasses] = useState(false);

  const selectedProperty = useMemo(() => properties.find((prop) => prop.uri === selectedPropertyUri) || null, [properties, selectedPropertyUri]);
  const classLabelLookup = useMemo(() => makeClassLabelLookup(classes), [classes]);
  const propertyLabelLookup = useMemo(() => makePropertyLabelLookup(properties), [properties]);
  const selectedPropertyLabel = selectedProperty ? labelForProperty(selectedProperty) : '';
  const resultPropertyLabel = result ? selectedPropertyLabel || labelFromLookup(result.property, propertyLabelLookup) : selectedPropertyLabel;
  const classLabelFor = (value: string) => labelFromLookup(value, classLabelLookup);
  const classRows = useMemo(() => {
    if (!result) return [];
    return result.classes
      .filter((row) => showAllClasses || !row.expected)
      .sort((a, b) => (
        Number(a.expected) - Number(b.expected)
        || b.count - a.count
        || classLabelFor(a.uri || a.class).localeCompare(classLabelFor(b.uri || b.class))
      ));
  }, [result, showAllClasses, classLabelLookup]);

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
    setShowAllClasses(false);
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
      <Section title="Configuration">
        <div className="space-y-4">
          <Field label="Property" hint={metadataLoading ? 'Loading properties...' : undefined}>
            <select disabled={metadataLoading} value={selectedPropertyUri} onChange={(e) => { setSelectedPropertyUri(e.target.value); setResult(null); setError(null); setShowAllClasses(false); }} className="w-full px-4 py-2 border disabled:opacity-50" style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)' }}>
              <option value="">Choose a property...</option>
              {properties.map((prop) => <option key={prop.uri} value={prop.uri}>{labelForProperty(prop)} ({prop.type})</option>)}
            </select>
          </Field>

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
            <MetricCard value={formatCount(result.total_property_uses)} label="Observed Uses" sub={resultPropertyLabel} />
            <MetricCard value={formatCount(result.total_expected_count)} label="Expected Uses" sub="Ontology domain" color="#1F8A4C" />
            <MetricCard value={formatCount(result.total_misuse_count)} label="Misuse Uses" sub="Unexpected domain" color={result.total_misuse_count > 0 ? '#9E2B0A' : '#1F8A4C'} />
            <AccuracyScoreDonut title="Property Misuse Score" percentage={result.sa4_score} sub="expected / observed" />
          </div>

          <Section title="Expected Domain" subtitle={`Expected domain for ${resultPropertyLabel} based on the ontology.`}>
            {expectedDomain.length === 0 ? (
              <EmptyState message="No expected classes are defined for this property." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {expectedDomain.map((uri) => {
                  return (
                    <span key={uri} className="px-3 py-1.5 text-sm border" style={{ backgroundColor: 'var(--info-soft)', color: 'var(--navy)', borderColor: 'rgba(0,54,99,0.2)', borderRadius: 'var(--radius-sm)' }} title={uri}>
                      {classLabelFor(uri)}
                    </span>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title="Class Breakdown"
            subtitle="Misuse means the property appears on a class outside the expected ontology domain."
            right={
              <button
                onClick={() => setShowAllClasses((value) => !value)}
                className="px-3 py-2 border text-sm"
                style={{
                  backgroundColor: showAllClasses ? 'var(--accent-soft)' : 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: showAllClasses ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {showAllClasses ? 'Show misuse only' : 'Show all classes'}
              </button>
            }
          >
            {classRows.length === 0 ? (
              <EmptyState message="No misuse classes were found." />
            ) : (
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
                    {classRows.map((row) => {
                      const remaining = Math.max(0, row.count - row.entity_uris.length);
                      return (
                        <tr key={row.uri} style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-3">
                            <div className="text-sm" style={{ color: 'var(--text)' }}>{classLabelFor(row.uri || row.class)}</div>
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
            )}
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
