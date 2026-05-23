import { useState } from 'react';
import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import IntrasourceConciseness from './metrics/IntrasourceConciseness';
import CrosssourceConciseness from './metrics/CrosssourceConciseness';
import SchemaCompleteness from './metrics/SchemaCompleteness';
import PropertyCompleteness from './metrics/PropertyCompleteness';
import InterlinkingCompleteness from './metrics/InterlinkingCompleteness';
import ClassCompleteness from './metrics/ClassCompleteness';

interface DimensionPageProps {
  dimension: 'accuracy' | 'completeness' | 'conciseness';
}

const dimensionConfig = {
  accuracy: {
    title: 'Accuracy',
    description: 'Measure the correctness and precision of your data',
    color: 'var(--accent)',
    score: 96.5,
    trend: '+2.3%',
    issues: 12,
    tabs: ['Semantic Accuracy', 'Syntactic Accuracy', 'Timeliness'],
  },
  completeness: {
    title: 'Completeness',
    description: 'Assess the presence of all required data elements',
    color: 'var(--navy)',
    score: 91.8,
    trend: '+1.5%',
    issues: 24,
    tabs: ['Schema Completeness', 'Property Completeness', 'Interlinking Completeness', 'Class Completeness'],
  },
  conciseness: {
    title: 'Conciseness',
    description: 'Evaluate the efficiency and brevity of data representation',
    color: '#5B8DBE',
    score: 94.2,
    trend: '+0.8%',
    issues: 8,
    tabs: ['Intrasource', 'Cross-source'],
  },
};

export default function DimensionPage({ dimension }: DimensionPageProps) {
  const config = dimensionConfig[dimension];
  const [activeTab, setActiveTab] = useState(0);

  const chartData = [
    { name: 'Jan', value: 88 },
    { name: 'Feb', value: 90 },
    { name: 'Mar', value: 89 },
    { name: 'Apr', value: 92 },
    { name: 'May', value: 94 },
    { name: 'Jun', value: config.score },
  ];

  const detailData = [
    { metric: 'Data Validation Rate', current: 98.2, target: 99.0, status: 'good' },
    { metric: 'Schema Compliance', current: 95.8, target: 95.0, status: 'good' },
    { metric: 'Data Freshness', current: 92.1, target: 93.0, status: 'warning' },
    { metric: 'Consistency Score', current: 97.5, target: 96.0, status: 'good' },
  ];

  const renderTabContent = () => {
    if (dimension === 'completeness') {
      if (activeTab === 0) {
        return <SchemaCompleteness />;
      } else if (activeTab === 1) {
        return <PropertyCompleteness />;
      } else if (activeTab === 2) {
        return <InterlinkingCompleteness />;
      } else if (activeTab === 3) {
        return <ClassCompleteness />;
      }
    }

    if (dimension === 'conciseness') {
      if (activeTab === 0) {
        return <IntrasourceConciseness />;
      } else if (activeTab === 1) {
        return <CrosssourceConciseness />;
      }
    }

    // Default content for other dimensions
    return (
      <>
        {/* Trend Chart */}
        <div
          className="mb-8 p-6 border"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <h3 className="text-xl mb-6" style={{ color: 'var(--navy)' }}>
            Trend (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" domain={[85, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={3}
                dot={{ fill: config.color, r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Metrics */}
        <div
          className="p-6 border"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <h3 className="text-xl mb-6" style={{ color: 'var(--navy)' }}>
            Detailed Metrics
          </h3>
          <div className="space-y-6">
            {detailData.map((item) => (
              <div key={item.metric}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--text)' }}>{item.metric}</span>
                  <div className="flex items-center gap-4">
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      Target: {item.target}%
                    </span>
                    <span style={{ color: config.color }}>
                      {item.current}%
                    </span>
                  </div>
                </div>
                <div
                  className="w-full h-2"
                  style={{
                    backgroundColor: 'var(--muted)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    className="h-2 transition-all"
                    style={{
                      width: `${item.current}%`,
                      backgroundColor: item.status === 'good' ? config.color : 'var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution Chart */}
        <div
          className="mt-8 p-6 border"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <h3 className="text-xl mb-6" style={{ color: 'var(--navy)' }}>
            Data Distribution by Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { category: 'Entities', score: 95 },
                { category: 'Properties', score: 92 },
                { category: 'Relations', score: 97 },
                { category: 'Literals', score: 89 },
                { category: 'URIs', score: 94 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="category" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar dataKey="score" fill={config.color} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics */}
        {dimension !== 'completeness' && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div
            className="p-6 border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--muted-foreground)' }}>Quality Score</span>
              <TrendingUp className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div className="text-4xl mb-1" style={{ color: config.color }}>
              {config.score}%
            </div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {config.trend} from last month
            </div>
          </div>

          <div
            className="p-6 border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--muted-foreground)' }}>Active Issues</span>
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-4xl mb-1" style={{ color: 'var(--text)' }}>
              {config.issues}
            </div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Requires attention
            </div>
          </div>

          <div
            className="p-6 border"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--muted-foreground)' }}>Checks Passed</span>
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--navy)' }} />
            </div>
            <div className="text-4xl mb-1" style={{ color: 'var(--text)' }}>
              432
            </div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Out of 450 total
            </div>
          </div>
        </div>}

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
