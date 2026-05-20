import { Tooltip } from './Tooltip'

/**
 * Multi-select checkbox list for identity properties.
 * Only data properties are passed in (object properties are filtered upstream
 * because Ontop deduplicates RDF triples at the mapping level).
 */
export function IdentityPropertySelector({ properties, selected, onChange }) {
  const toggle = (uri) => {
    if (selected.includes(uri)) {
      onChange(selected.filter((p) => p !== uri))
    } else {
      onChange([...selected, uri])
    }
  }

  const toggleAll = () => {
    if (selected.length === properties.length) {
      onChange([])
    } else {
      onChange(properties.map((p) => p.uri))
    }
  }

  if (!properties.length) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-text">
          <Tooltip text="Select data properties that together define a unique identity for instances. Only data properties are shown — object properties are excluded because Ontop deduplicates RDF triples at the mapping level, which would mask real duplicates.">
            Identity Properties (data only)
          </Tooltip>
        </label>
        <button
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-text hover:underline"
        >
          {selected.length === properties.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="border border-border rounded-md p-3 bg-white space-y-1.5 max-h-48 overflow-y-auto">
        {properties.map((prop) => (
          <label
            key={prop.uri}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={selected.includes(prop.uri)}
              onChange={() => toggle(prop.uri)}
              className="rounded border-border accent-[var(--navy)]"
            />
            <span className="text-sm text-text group-hover:text-black">
              {prop.localName}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                prop.type === 'data'
                  ? 'bg-[var(--navy-soft)] text-navy'
                  : 'bg-[var(--accent-soft)] text-accent'
              }`}
            >
              {prop.type}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
