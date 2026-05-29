import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle, FileText, Target } from 'lucide-react';
import { metadataApi } from '../lib/api';

export default function LandingPage() {
  const [sources, setSources] = useState<number | null>(null);
  const [classes, setClasses] = useState<number | null>(null);
  const [properties, setProperties] = useState<number | null>(null);

  useEffect(() => {
    metadataApi.sources().then((d) => setSources(d.sources.length));
    metadataApi.mappedClasses().then((d) => setClasses(d.classes.length));
    metadataApi.mappedProperties().then((d) => setProperties(d.properties.length));
  }, []);
  const dimensions = [
    {
      id: 'accuracy',
      title: 'Accuracy',
      description: 'Measure the correctness and precision of your data',
      icon: Target,
      path: '/accuracy',
      tabs: ['Outlier Profiling', 'Value Conflict', 'Property Misuse'],
    },
    {
      id: 'completeness',
      title: 'Completeness',
      description: 'Assess the presence of all required data elements',
      icon: CheckCircle,
      path: '/completeness',
      tabs: ['Schema Completeness', 'Property Completeness', 'Interlinking Completeness', 'Population Completeness'],
    },
    {
      id: 'conciseness',
      title: 'Conciseness',
      description: 'Evaluate the efficiency and brevity of data representation',
      icon: FileText,
      path: '/conciseness',
      tabs: ['Intrasource', 'Cross-source'],
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl mb-4" style={{ color: 'var(--navy)' }}>
            VKG Data Quality Profiling
          </h2>
          <p className="text-xl" style={{ color: 'var(--muted-foreground)' }}>
            Monitor and improve your knowledge graph data across three critical dimensions
          </p>
        </div>

        {/* Dimension Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {dimensions.map((dimension) => {
            const Icon = dimension.icon;
            return (
              <Link
                key={dimension.id}
                to={dimension.path}
                className="group block p-8 border transition-all"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  className="w-16 h-16 flex items-center justify-center mb-6 transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Icon
                    className="w-8 h-8 transition-colors"
                    style={{ color: 'var(--accent)' }}
                  />
                </div>
                <h3
                  className="text-2xl mb-3 group-hover:underline"
                  style={{ color: 'var(--navy)' }}
                >
                  {dimension.title}
                </h3>
                <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>
                  {dimension.description}
                </p>
                <ul className="space-y-1">
                  {dimension.tabs.map((tab) => (
                    <li key={tab} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                      {tab}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats Overview */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="p-6"
            style={{
              backgroundColor: 'var(--info-soft)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="text-4xl mb-2" style={{ color: 'var(--navy)' }}>
              {sources ?? '—'}
            </div>
            <div style={{ color: 'var(--text)' }}>Data Sources</div>
          </div>
          <div
            className="p-6"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="text-4xl mb-2" style={{ color: 'var(--accent)' }}>
              {classes ?? '—'}
            </div>
            <div style={{ color: 'var(--text)' }}>Mapped Classes</div>
          </div>
          <div
            className="p-6"
            style={{
              backgroundColor: 'var(--info-soft)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="text-4xl mb-2" style={{ color: 'var(--navy)' }}>
              {properties ?? '—'}
            </div>
            <div style={{ color: 'var(--text)' }}>Mapped Properties</div>
          </div>
        </div>
      </section>
    </div>
  );
}
