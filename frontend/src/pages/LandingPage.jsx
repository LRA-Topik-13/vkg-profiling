import { Link } from 'react-router-dom'
import { Crosshair, CheckCircle, FileText, Target } from 'lucide-react'

const DIMENSIONS = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    description: 'Measure the correctness and precision of your data',
    icon: Crosshair,
    path: '/accuracy',
    available: false,
  },
  {
    id: 'completeness',
    title: 'Completeness',
    description: 'Assess the presence of all required data elements',
    icon: CheckCircle,
    path: '/completeness',
    available: false,
  },
  {
    id: 'conciseness',
    title: 'Conciseness',
    description: 'Evaluate the efficiency and brevity of data representation',
    icon: FileText,
    path: '/conciseness',
    available: true,
  },
  {
    id: 'consistency',
    title: 'Consistency',
    description: 'Verify logical coherence across schema, domains, and ranges',
    icon: Target,
    path: '/consistency',
    available: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-3 text-navy">
            Comprehensive Data Quality Analysis
          </h1>
          <p className="text-lg text-muted-foreground">
            Monitor and improve your knowledge graph data across four critical dimensions
          </p>
        </div>

        {/* Dimension Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {DIMENSIONS.map((d) => {
            const Icon = d.icon
            const inner = (
              <>
                <div
                  className="w-14 h-14 flex items-center justify-center mb-5 rounded-md"
                  style={{ backgroundColor: 'var(--accent-soft)' }}
                >
                  <Icon className="w-7 h-7 text-accent" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-navy">{d.title}</h3>
                  {!d.available && (
                    <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{d.description}</p>
              </>
            )

            if (!d.available) {
              return (
                <div
                  key={d.id}
                  className="block p-7 bg-card border border-border rounded-lg opacity-60 cursor-not-allowed"
                >
                  {inner}
                </div>
              )
            }

            return (
              <Link
                key={d.id}
                to={d.path}
                className="group block p-7 bg-card border border-border rounded-lg transition-all hover:shadow-md hover:border-navy/30"
              >
                {inner}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Stats Overview */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--navy-soft)' }}>
            <div className="text-4xl font-semibold mb-1 text-navy">94.2%</div>
            <div className="text-sm text-text">Overall Quality Score</div>
          </div>
          <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--accent-soft)' }}>
            <div className="text-4xl font-semibold mb-1 text-accent">1,247</div>
            <div className="text-sm text-text">Total Data Points</div>
          </div>
          <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--navy-soft)' }}>
            <div className="text-4xl font-semibold mb-1 text-navy">18</div>
            <div className="text-sm text-text">Active Monitors</div>
          </div>
        </div>
      </section>
    </div>
  )
}
