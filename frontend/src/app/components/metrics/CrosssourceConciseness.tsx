import { useState } from 'react';
import { Search } from 'lucide-react';
import CircularProgress from '../CircularProgress';

export default function CrosssourceConciseness() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedFacet, setSelectedFacet] = useState('');
  const [identifyingProperties, setIdentifyingProperties] = useState<string[]>([]);
  const [selectedDatasources, setSelectedDatasources] = useState<string[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const classes = ['Person', 'Organization', 'Location', 'Product', 'Event'];
  const facets = ['rdfs:label', 'foaf:name', 'dc:identifier', 'skos:prefLabel', 'schema:name'];
  const properties = ['name', 'id', 'email', 'identifier', 'title', 'description'];
  const datasources = ['DBpedia', 'Wikidata', 'YAGO', 'Freebase', 'GeoNames'];

  const handlePropertyToggle = (property: string) => {
    setIdentifyingProperties((prev) =>
      prev.includes(property)
        ? prev.filter((p) => p !== property)
        : [...prev, property]
    );
  };

  const handleDatasourceToggle = (datasource: string) => {
    setSelectedDatasources((prev) =>
      prev.includes(datasource)
        ? prev.filter((d) => d !== datasource)
        : [...prev, datasource]
    );
  };

  const handleAnalyze = () => {
    setAnalyzed(true);
  };

  // Mock results
  const results = {
    f3Score: 0.93,
    datasourceResults: [
      { name: 'DBpedia', f1Score: 0.95, f2Score: 0.92, entities: 543 },
      { name: 'Wikidata', f1Score: 0.91, f2Score: 0.89, entities: 487 },
      { name: 'YAGO', f1Score: 0.94, f2Score: 0.93, entities: 512 },
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

          {/* Data Sources Selection */}
          <div>
            <label className="block mb-2" style={{ color: 'var(--text)' }}>
              Select Data Sources (minimum 2)
            </label>
            <div className="space-y-2">
              {datasources.map((datasource) => (
                <label
                  key={datasource}
                  className="flex items-center gap-3 p-3 border cursor-pointer hover:bg-opacity-50"
                  style={{
                    backgroundColor: selectedDatasources.includes(datasource)
                      ? 'var(--info-soft)'
                      : 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDatasources.includes(datasource)}
                    onChange={() => handleDatasourceToggle(datasource)}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--navy)' }}
                  />
                  <span style={{ color: 'var(--text)' }}>{datasource}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={
              !selectedClass ||
              !selectedFacet ||
              identifyingProperties.length === 0 ||
              selectedDatasources.length < 2
            }
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
            Cross-Source Analysis Results
          </h3>

          {/* F3 Overall Score */}
          <div className="mb-8 flex justify-center">
            <CircularProgress
              percentage={results.f3Score * 100}
              color="var(--accent)"
              label="F3 Score (Overall Cross-Source Conciseness)"
              size={150}
              strokeWidth={10}
            />
          </div>

          {/* Individual Datasource Results */}
          <div>
            <h4 className="mb-4" style={{ color: 'var(--text)' }}>
              Datasource Breakdown
            </h4>
            <div className="space-y-4">
              {results.datasourceResults.map((ds) => (
                <div
                  key={ds.name}
                  className="p-4 border"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="mb-4">
                    <h5 className="text-lg text-center mb-1" style={{ color: 'var(--navy)' }}>
                      {ds.name}
                    </h5>
                    <div className="text-center" style={{ color: 'var(--muted-foreground)' }}>
                      {ds.entities} entities
                    </div>
                  </div>

                  {/* F1 and F2 Scores */}
                  <div className="grid grid-cols-2 gap-6">
                    <CircularProgress
                      percentage={ds.f1Score * 100}
                      color="var(--navy)"
                      label="F1 (Intensional)"
                      size={100}
                    />
                    <CircularProgress
                      percentage={ds.f2Score * 100}
                      color="var(--accent)"
                      label="F2 (Extensional)"
                      size={100}
                    />
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
