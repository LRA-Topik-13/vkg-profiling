import { useState } from 'react';
import { Search } from 'lucide-react';
import CircularProgress from '../CircularProgress';

export default function IntrasourceConciseness() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedFacet, setSelectedFacet] = useState('');
  const [identifyingProperties, setIdentifyingProperties] = useState<string[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const classes = ['Person', 'Organization', 'Location', 'Product', 'Event'];
  const facets = ['rdfs:label', 'foaf:name', 'dc:identifier', 'skos:prefLabel', 'schema:name'];
  const properties = ['name', 'id', 'email', 'identifier', 'title', 'description'];

  const handlePropertyToggle = (property: string) => {
    setIdentifyingProperties((prev) =>
      prev.includes(property)
        ? prev.filter((p) => p !== property)
        : [...prev, property]
    );
  };

  const handleAnalyze = () => {
    setAnalyzed(true);
  };

  // Mock results
  const results = {
    totalEntities: 1247,
    instances: 1189,
    f1Score: 0.94,
    f2Score: 0.91,
    duplicates: [
      {
        uri: 'http://example.org/person/john-doe-1',
        properties: { name: 'John Doe', email: 'john@example.com' },
      },
      {
        uri: 'http://example.org/person/john-doe-2',
        properties: { name: 'John Doe', email: 'john@example.com' },
      },
      {
        uri: 'http://example.org/person/jane-smith-1',
        properties: { name: 'Jane Smith', identifier: 'JS001' },
      },
      {
        uri: 'http://example.org/person/jane-smith-2',
        properties: { name: 'Jane Smith', identifier: 'JS001' },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <div
        className="p-6 border"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <h3 className="text-xl mb-6" style={{ color: 'var(--navy)' }}>
          Configuration
        </h3>

        <div className="space-y-6">
          {/* Class Selection */}
          <div>
            <label className="block mb-2" style={{ color: 'var(--text)' }}>
              Select Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border"
              style={{
                backgroundColor: 'var(--input-background)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
              }}
            >
              <option value="">Choose a class...</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Facet Filter */}
          <div>
            <label className="block mb-2" style={{ color: 'var(--text)' }}>
              Filter by Facet (Property to URI)
            </label>
            <select
              value={selectedFacet}
              onChange={(e) => setSelectedFacet(e.target.value)}
              className="w-full px-4 py-2 border"
              style={{
                backgroundColor: 'var(--input-background)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
              }}
            >
              <option value="">Choose a facet...</option>
              {facets.map((facet) => (
                <option key={facet} value={facet}>
                  {facet}
                </option>
              ))}
            </select>
          </div>

          {/* Identifying Properties */}
          <div>
            <label className="block mb-2" style={{ color: 'var(--text)' }}>
              Select Identifying Properties
            </label>
            <div className="space-y-2">
              {properties.map((property) => (
                <label
                  key={property}
                  className="flex items-center gap-3 p-3 border cursor-pointer hover:bg-opacity-50"
                  style={{
                    backgroundColor: identifyingProperties.includes(property)
                      ? 'var(--accent-soft)'
                      : 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={identifyingProperties.includes(property)}
                    onChange={() => handlePropertyToggle(property)}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ color: 'var(--text)' }}>{property}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!selectedClass || !selectedFacet || identifyingProperties.length === 0}
            className="w-full px-6 py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Search className="w-5 h-5" />
            Analyze
          </button>
        </div>
      </div>

      {/* Results */}
      {analyzed && (
        <div
          className="p-6 border"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <h3 className="text-xl mb-6" style={{ color: 'var(--navy)' }}>
            Analysis Results
          </h3>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="p-4"
              style={{
                backgroundColor: 'var(--info-soft)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
                Total Entities
              </div>
              <div className="text-3xl" style={{ color: 'var(--navy)' }}>
                {results.totalEntities}
              </div>
            </div>
            <div
              className="p-4"
              style={{
                backgroundColor: 'var(--info-soft)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
                Instances
              </div>
              <div className="text-3xl" style={{ color: 'var(--navy)' }}>
                {results.instances}
              </div>
            </div>
          </div>

          {/* F1 and F2 Scores */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <CircularProgress
              percentage={results.f1Score * 100}
              color="var(--navy)"
              label="F1 Score (Intensional Conciseness)"
            />
            <CircularProgress
              percentage={results.f2Score * 100}
              color="var(--accent)"
              label="F2 Score (Extensional Conciseness)"
            />
          </div>

          {/* Duplicates */}
          <div>
            <h4 className="mb-4" style={{ color: 'var(--text)' }}>
              Duplicates Found ({results.duplicates.length})
            </h4>
            <div className="space-y-3">
              {results.duplicates.map((duplicate, index) => (
                <div
                  key={index}
                  className="p-4 border"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="mb-2" style={{ color: 'var(--accent)' }}>
                    {duplicate.uri}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(duplicate.properties).map(([key, value]) => (
                      <div key={key} className="text-sm" style={{ color: 'var(--text)' }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
