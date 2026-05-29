import { useState, useEffect } from 'react';
import IntrasourceConciseness from './metrics/IntrasourceConciseness';
import CrosssourceConciseness from './metrics/CrosssourceConciseness';
import SchemaCompleteness from './metrics/SchemaCompleteness';
import PropertyCompleteness from './metrics/PropertyCompleteness';
import InterlinkingCompleteness from './metrics/InterlinkingCompleteness';
import PopulationCompleteness from './metrics/PopulationCompleteness';
import AccuracyOutlierProfiling from './metrics/AccuracyOutlierProfiling';
import AccuracyValueConflict from './metrics/AccuracyValueConflict';
import AccuracyPropertyMisuse from './metrics/AccuracyPropertyMisuse';

interface DimensionPageProps {
  dimension: 'accuracy' | 'completeness' | 'conciseness';
}

const dimensionConfig = {
  accuracy: {
    title: 'Accuracy',
    description: 'Measure the correctness and precision of your data',
    color: 'var(--accent)',
    tabs: ['Outlier Profiling', 'Value Conflict', 'Property Misuse'],
  },
  completeness: {
    title: 'Completeness',
    description: 'Assess the presence of all required data elements',
    color: 'var(--navy)',
    tabs: ['Schema Completeness', 'Property Completeness', 'Interlinking Completeness', 'Population Completeness'],
  },
  conciseness: {
    title: 'Conciseness',
    description: 'Evaluate the efficiency and brevity of data representation',
    color: '#5B8DBE',
    tabs: ['Intrasource', 'Cross-source'],
  },
};

export default function DimensionPage({ dimension }: DimensionPageProps) {
  const config = dimensionConfig[dimension];
  const [activeTab, setActiveTab] = useState(0);

  // Reset tab when switching dimensions
  useEffect(() => {
    setActiveTab(0);
  }, [dimension]);

  const renderTabContent = () => {
    if (dimension === 'completeness') {
      if (activeTab === 0) return <SchemaCompleteness />;
      if (activeTab === 1) return <PropertyCompleteness />;
      if (activeTab === 2) return <InterlinkingCompleteness />;
      if (activeTab === 3) return <PopulationCompleteness />;
    }

    if (dimension === 'conciseness') {
      if (activeTab === 0) return <IntrasourceConciseness />;
      if (activeTab === 1) return <CrosssourceConciseness />;
    }

    if (dimension === 'accuracy') {
      if (activeTab === 0) return <AccuracyOutlierProfiling />;
      if (activeTab === 1) return <AccuracyValueConflict />;
      if (activeTab === 2) return <AccuracyPropertyMisuse />;
    }

    return null;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
            {config.tabs.map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className="px-6 py-3 transition-all"
                style={{
                  color: activeTab === index ? 'var(--navy)' : 'var(--muted-foreground)',
                  borderBottom: activeTab === index ? '2px solid var(--navy)' : '2px solid transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
}
