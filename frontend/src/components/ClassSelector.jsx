import { Select } from './Select'

export function ClassSelector({ classes, value, onChange, loading }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1">Class</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">— Select a class —</option>
        {classes.map((cls) => (
          <option key={cls.uri} value={cls.localName}>
            {cls.label || cls.localName}
          </option>
        ))}
      </Select>
    </div>
  )
}
