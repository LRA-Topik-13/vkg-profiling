import { useEffect, useState } from 'react'
import { Search, FileText } from 'lucide-react'
import {
  getClasses,
  getProperties,
  getConcisenessIntraSource,
  getConcisenessCrossSource,
} from '../api'
import { Card, CardBody } from '../components/Card'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { Tooltip } from '../components/Tooltip'
import { ErrorBox, LoadingSkeleton } from '../components/Feedback'
import { CircularProgress } from '../components/CircularProgress'
import { ClassSelector } from '../components/ClassSelector'
import { IdentityPropertySelector } from '../components/IdentityPropertySelector'

// ─── Configuration ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'extensional', label: 'Extensional (Intra-Source)' },
  { id: 'ambiguous',   label: 'Ambiguous Instance Detection (Cross-Source)' },
]

const DEFAULT_SOURCE_A = 'http://example.org/voc#uni1/'
const DEFAULT_SOURCE_B = 'http://example.org/voc#uni2/'
const DEFAULT_SOURCE_C = 'http://example.org/voc#uni3/'

const SOURCE_OPTIONS = [
  { value: DEFAULT_SOURCE_A, label: 'uni1 (MySQL)' },
  { value: DEFAULT_SOURCE_B, label: 'uni2 (PostgreSQL)' },
  { value: DEFAULT_SOURCE_C, label: 'uni3 (MSSQL)' },
]

// Shared size for the inline F1/F2/CN3 ring cards across both tabs
const RING_SIZE = 110
const RING_STROKE = 8

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 90) return 'var(--success)'
  if (score >= 70) return 'var(--warning)'
  return 'var(--danger)'
}

function scoreColorClass(score) {
  if (score >= 90) return 'text-[var(--success)]'
  if (score >= 70) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

function scoreBgClass(score) {
  if (score >= 90) return 'bg-[var(--success-soft)] border-[var(--success)]/30'
  if (score >= 70) return 'bg-[var(--warning-soft)] border-[var(--warning)]/30'
  return 'bg-[var(--danger-soft)] border-[var(--danger)]/30'
}

function shortUri(uri) {
  if (!uri) return ''
  const hash = uri.lastIndexOf('#')
  if (hash !== -1) {
    const afterHash = uri.substring(hash + 1)
    if (afterHash) return afterHash
  }
  try {
    const u = new URL(uri)
    return u.pathname.substring(1) + u.hash
  } catch {
    return uri
  }
}

// ─── Formula display card ────────────────────────────────────────────────────
function FormulaCard({ title, formula, description }) {
  return (
    <div className="bg-muted border border-border rounded-md px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </p>
      <p className="text-sm font-mono text-text">{formula}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}

// ─── Score card: plain number, centered ──────────────────────────────────────
function ScoreCard({ label, value, sub, colorClass }) {
  // Long numbers (e.g. 1,247,890) shrink to keep the card tidy
  const display = String(value ?? '')
  const numberClass =
    display.length > 7 ? 'text-xl' : display.length > 4 ? 'text-2xl' : 'text-3xl'

  return (
    <Card className="p-5 h-full flex flex-col items-center justify-center text-center gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`${numberClass} font-bold ${colorClass || 'text-text'} break-words`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ─── Score card: circular ring with label, used for F1/F2/CN3 inline ─────────
function ScoreRingCard({ label, percentage, sub }) {
  return (
    <Card className="p-5 h-full flex flex-col items-center justify-center text-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <CircularProgress
        percentage={percentage}
        color={scoreColor(percentage)}
        size={RING_SIZE}
        strokeWidth={RING_STROKE}
      />
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ─── Duplicate Groups Table ──────────────────────────────────────────────────
function DuplicateGroupsTable({ groups }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="bg-[var(--success-soft)] border border-[var(--success)]/30 text-[var(--success)] rounded-md px-4 py-3 text-sm">
        No duplicate instances found. All instances have unique identity values.
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Duplicate Groups</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Instances sharing identical identity property values
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">Identity Values</th>
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">Duplicate URIs</th>
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground text-center">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((g, i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="px-4 py-2">
                  <div className="space-y-0.5">
                    {Object.entries(g.identity_values).map(([k, v]) => (
                      <span key={k} className="inline-block mr-2 text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {k}: <span className="font-medium text-text">{v}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-0.5">
                    {g.uris.map((uri, j) => (
                      <p key={j} className="text-xs font-mono text-muted-foreground truncate max-w-xs" title={uri}>
                        {shortUri(uri)}
                      </p>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="inline-block bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-semibold rounded-full px-2 py-0.5">
                    {g.count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Ambiguous Pairs Table ───────────────────────────────────────────────────
function AmbiguousGroupsTable({ groups }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="bg-[var(--success-soft)] border border-[var(--success)]/30 text-[var(--success)] rounded-md px-4 py-3 text-sm">
        No ambiguous instances found across sources. All cross-source identities are distinct.
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Ambiguous Instance Groups</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Entities with identical identity values across sources without owl:sameAs links
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">Identity Values</th>
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">Matching Entities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((g, i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="px-4 py-2">
                  <div className="space-y-0.5">
                    {Object.entries(g.identity_values).map(([k, v]) => (
                      <span key={k} className="inline-block mr-2 text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {k}: <span className="font-medium text-text">{v}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    {g.entities.map((e, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="text-xs bg-[var(--navy-soft)] text-navy rounded px-1.5 py-0.5 font-mono whitespace-nowrap">
                          {shortUri(e.source)}
                        </span>
                        <p className="text-xs font-mono text-muted-foreground truncate max-w-[250px]" title={e.uri}>
                          {shortUri(e.uri)}
                        </p>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="mx-auto mb-4 w-12 h-12 text-muted-foreground/40" />
      <p className="text-sm font-medium">
        Select a class and identity properties, then click Analyze.
      </p>
    </div>
  )
}

// ─── Extensional Tab (CN2) ───────────────────────────────────────────────────
function ExtensionalTab({ classes }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [allProperties, setAllProperties] = useState([])
  const [selectedProps, setSelectedProps] = useState([])
  const [sourcePrefix, setSourcePrefix] = useState(DEFAULT_SOURCE_A)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metaLoading, setMetaLoading] = useState(false)

  useEffect(() => {
    if (!selectedClass) {
      setAllProperties([])
      setSelectedProps([])
      setResult(null)
      return
    }
    setMetaLoading(true)
    getProperties(selectedClass)
      .then((d) => {
        const dp = d.properties.filter((p) => p.type === 'data')
        setAllProperties(dp)
        setSelectedProps(dp.map((p) => p.uri))
      })
      .catch(() => {
        setAllProperties([])
        setSelectedProps([])
      })
      .finally(() => setMetaLoading(false))
    setResult(null)
  }, [selectedClass])

  const selectedClassObj = classes.find((c) => c.localName === selectedClass)

  const handleAnalyze = async () => {
    if (!selectedClassObj || selectedProps.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await getConcisenessIntraSource({
        classUri: selectedClassObj.uri,
        identityProps: selectedProps.join(','),
        sourcePrefix,
      })
      setResult(data)
    } catch (e) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Formulas */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold text-text">
            <Tooltip text="CN2 measures extensional conciseness within a single data source by detecting duplicate instance representations.">
              CN2 — Extensional Conciseness (Intra-Source)
            </Tooltip>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormulaCard
              title="Formula F1"
              formula="unique_instances / total_representations"
              description="Ratio of unique instances to total instance representations"
            />
            <FormulaCard
              title="Formula F2"
              formula="1 − (violating_instances / total)"
              description="1 minus the ratio of instances violating the uniqueness rule"
            />
          </div>
        </CardBody>
      </Card>

      {/* Configuration */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClassSelector
              classes={classes}
              value={selectedClass}
              onChange={setSelectedClass}
              loading={metaLoading}
            />
            {selectedClass && (
              <IdentityPropertySelector
                properties={allProperties}
                selected={selectedProps}
                onChange={setSelectedProps}
              />
            )}
          </div>

          {selectedClass && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                <Tooltip text="URI prefix that scopes the analysis to a single data source.">
                  Source Prefix
                </Tooltip>
              </label>
              <Select
                value={sourcePrefix}
                onChange={(e) => setSourcePrefix(e.target.value)}
                className="md:w-1/2"
              >
                {SOURCE_OPTIONS.map((src) => (
                  <option key={src.value} value={src.value}>
                    {src.label} — {src.value}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="accent"
              onClick={handleAnalyze}
              disabled={!selectedClass || !selectedProps.length || loading}
            >
              <Search className="w-4 h-4" />
              {loading ? 'Analyzing…' : 'Analyze'}
            </Button>
            {selectedProps.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedProps.length} identity propert
                {selectedProps.length === 1 ? 'y' : 'ies'} selected
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {error && <ErrorBox message={error} onRetry={handleAnalyze} />}
      {loading && <LoadingSkeleton count={3} />}

      {result && !loading && (
        <>
          {/* Score cards — all four equal height, centered */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
            <ScoreCard
              label="Total Representations"
              value={result.total_representations}
              sub="In selected source"
            />
            <ScoreCard
              label="Unique Instances"
              value={result.unique_instances}
              sub="Distinct entities"
            />
            <ScoreRingCard
              label="Score F1"
              percentage={result.score_f1}
              sub="unique / total"
            />
            <ScoreRingCard
              label="Score F2"
              percentage={result.score_f2}
              sub="1 − (violations / total)"
            />
          </div>

          {/* Pass/fail banner */}
          <div
            className={`rounded-md border px-4 py-3 text-sm font-medium ${
              result.passed
                ? 'bg-[var(--success-soft)] border-[var(--success)]/30 text-[var(--success)]'
                : 'bg-[var(--danger-soft)] border-[var(--danger)]/30 text-[var(--danger)]'
            }`}
          >
            {result.passed
              ? 'Passed — No duplicate instances detected within this source.'
              : `Failed — ${result.violating_instances} instance(s) violate the uniqueness rule.`}
          </div>

          <DuplicateGroupsTable groups={result.duplicate_groups} />
        </>
      )}

      {!result && !loading && !error && <EmptyState />}
    </div>
  )
}

// ─── Ambiguous Instance Detection Tab (CN3) ──────────────────────────────────
function AmbiguousTab({ classes }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [allProperties, setAllProperties] = useState([])
  const [selectedProps, setSelectedProps] = useState([])
  const [selectedSources, setSelectedSources] = useState([DEFAULT_SOURCE_A, DEFAULT_SOURCE_B])
  const [crossResult, setCrossResult] = useState(null)
  const [intraResults, setIntraResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metaLoading, setMetaLoading] = useState(false)

  const toggleSource = (src) => {
    setSelectedSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    )
  }

  useEffect(() => {
    if (!selectedClass) {
      setAllProperties([])
      setSelectedProps([])
      setCrossResult(null)
      setIntraResults([])
      return
    }
    setMetaLoading(true)
    getProperties(selectedClass)
      .then((d) => {
        const dp = d.properties.filter((p) => p.type === 'data')
        setAllProperties(dp)
        setSelectedProps(dp.map((p) => p.uri))
      })
      .catch(() => {
        setAllProperties([])
        setSelectedProps([])
      })
      .finally(() => setMetaLoading(false))
    setCrossResult(null)
    setIntraResults([])
  }, [selectedClass])

  const selectedClassObj = classes.find((c) => c.localName === selectedClass)

  const handleAnalyze = async () => {
    if (!selectedClassObj || selectedProps.length === 0 || selectedSources.length < 2) return
    setLoading(true)
    setError(null)
    setCrossResult(null)
    setIntraResults([])
    try {
      const identityProps = selectedProps.join(',')
      const sourcesParam = selectedSources.join(',')

      const intraPromises = selectedSources.map((src) =>
        getConcisenessIntraSource({
          classUri: selectedClassObj.uri,
          identityProps,
          sourcePrefix: src,
        }).then((r) => ({ source: src, ...r }))
      )

      const [cross, ...intras] = await Promise.all([
        getConcisenessCrossSource({
          classUri: selectedClassObj.uri,
          identityProps,
          sources: sourcesParam,
        }),
        ...intraPromises,
      ])
      setCrossResult(cross)
      setIntraResults(intras)
    } catch (e) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Formulas */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold text-text">
            <Tooltip text="CN3 detects ambiguous instances across multiple data sources — entities sharing the same identity property values without an owl:sameAs link. CN2-F2 scores for each source are also shown.">
              CN3 — Ambiguous Instance Detection (Cross-Source)
            </Tooltip>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormulaCard
              title="CN3 Formula"
              formula="1 − (ambiguous_instances / total_in_semantic_metadata_set)"
              description="Detects unresolved cross-source identity overlaps across all pairwise source combinations"
            />
            <FormulaCard
              title="CN2-F2 — Per Source"
              formula="1 − (violating_instances / total)"
              description="Intra-source uniqueness computed for each selected source"
            />
          </div>
        </CardBody>
      </Card>

      {/* Configuration */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClassSelector
              classes={classes}
              value={selectedClass}
              onChange={setSelectedClass}
              loading={metaLoading}
            />
            {selectedClass && (
              <IdentityPropertySelector
                properties={allProperties}
                selected={selectedProps}
                onChange={setSelectedProps}
              />
            )}
          </div>

          {selectedClass && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Data Sources (select 2 or more)
              </label>
              <div className="flex flex-wrap gap-3">
                {SOURCE_OPTIONS.map((src) => (
                  <label
                    key={src.value}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(src.value)}
                      onChange={() => toggleSource(src.value)}
                      className="rounded border-border accent-[var(--navy)]"
                    />
                    <span className="text-sm text-text group-hover:text-black">
                      {src.label}
                    </span>
                  </label>
                ))}
              </div>
              {selectedSources.length < 2 && (
                <p className="text-xs text-[var(--danger)] mt-1">
                  At least 2 sources required for cross-source analysis.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="accent"
              onClick={handleAnalyze}
              disabled={
                !selectedClass ||
                !selectedProps.length ||
                selectedSources.length < 2 ||
                loading
              }
            >
              <Search className="w-4 h-4" />
              {loading ? 'Analyzing…' : 'Analyze'}
            </Button>
            {selectedProps.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedProps.length} identity propert
                {selectedProps.length === 1 ? 'y' : 'ies'} selected ·{' '}
                {selectedSources.length} source
                {selectedSources.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {error && <ErrorBox message={error} onRetry={handleAnalyze} />}
      {loading && <LoadingSkeleton count={3} />}

      {crossResult && !loading && (
        <>
          {/* CN3 Score cards — same layout pattern as Extensional */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
            <ScoreCard
              label="Total Entities"
              value={crossResult.total_entities}
              sub={`Across ${crossResult.sources?.length || 0} sources`}
            />
            <ScoreCard
              label="Ambiguous Instances"
              value={crossResult.ambiguous_instances}
              sub="Overlapping identities"
              colorClass={crossResult.ambiguous_instances > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}
            />
            <ScoreRingCard
              label="CN3 Score"
              percentage={crossResult.cn3_score}
              sub="Cross-source conciseness"
            />
            <ScoreCard
              label="Sample Size"
              value={crossResult.sample_size}
              sub="Groups shown below"
            />
          </div>

          {/* CN2-F2 per source */}
          {intraResults.length > 0 && (
            <Card>
              <CardBody className="space-y-3">
                <h3 className="text-sm font-semibold text-text">
                  CN2-F2 — Intra-Source Uniqueness per Source
                </h3>
                <div
                  className={`grid grid-cols-1 gap-4 ${
                    intraResults.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
                  }`}
                >
                  {intraResults.map((intra, idx) => (
                    <div
                      key={idx}
                      className={`rounded-md border p-4 ${scoreBgClass(intra.score_f2)}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {shortUri(intra.source)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mb-2" title={intra.source}>
                        {intra.source}
                      </p>
                      <p className={`text-2xl font-bold ${scoreColorClass(intra.score_f2)}`}>
                        {intra.score_f2}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {intra.unique_instances} unique / {intra.total_representations} total
                        {intra.violating_instances > 0 && ` · ${intra.violating_instances} violations`}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Note */}
          {crossResult.note && (
            <div className="bg-[var(--navy-soft)] border border-navy/20 text-navy rounded-md px-4 py-3 text-xs">
              <strong>Note:</strong> {crossResult.note}
            </div>
          )}

          <AmbiguousGroupsTable groups={crossResult.ambiguous_groups} />
        </>
      )}

      {!crossResult && !loading && !error && <EmptyState />}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ConcisenessPage() {
  const [activeTab, setActiveTab] = useState('extensional')
  const [classes, setClasses] = useState([])

  useEffect(() => {
    getClasses()
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]))
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-navy">Conciseness</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detect duplicate and ambiguous instances within and across data sources.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                activeTab === tab.id
                  ? 'border-navy text-navy'
                  : 'border-transparent text-muted-foreground hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'extensional' && <ExtensionalTab classes={classes} />}
      {activeTab === 'ambiguous' && <AmbiguousTab classes={classes} />}
    </div>
  )
}