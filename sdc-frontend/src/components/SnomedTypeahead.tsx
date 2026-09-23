/**
 * SnomedTypeahead — multi-select typeahead bound to a ValueSet canonical URL.
 * Ported from the unified frontend's identical component (ADR-0137).
 * Backed by `useSnomedTypeahead` (debounced, server-side filter). Selected
 * items render as removable chips. Duplicate codes are filtered out on add.
 */

import { useState } from 'react'
import { useSnomedTypeahead } from '../hooks/useSnomedTypeahead'
import type { TermOption } from '../lib/terminologyService'

interface Props {
  valueSetUrl: string
  value: TermOption[]
  onChange: (next: TermOption[]) => void
  label?: string
  placeholder?: string
  helpText?: string
  /** Codes belonging to this ValueSet (or the union of several) are filtered out client-side (ADR-0084). */
  excludeValueSetUrl?: string | readonly string[]
}

function SnomedTypeahead({
  valueSetUrl,
  value,
  onChange,
  label,
  placeholder = 'Type at least 2 characters…',
  helpText,
  excludeValueSetUrl,
}: Props) {
  const [query, setQuery] = useState('')
  const { options, loading, error } = useSnomedTypeahead(valueSetUrl, query, 250, excludeValueSetUrl)

  const filteredOptions = options.filter(
    (o) => !value.some((v) => v.code === o.code && v.system === o.system),
  )

  function addItem(item: TermOption) {
    if (value.some((v) => v.code === item.code && v.system === item.system)) return
    onChange([...value, item])
    setQuery('')
  }

  function removeItem(item: TermOption) {
    onChange(value.filter((v) => !(v.code === item.code && v.system === item.system)))
  }

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {value.map((v) => (
            <li
              key={`${v.system}|${v.code}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-900 rounded text-sm"
            >
              <span>{v.display}</span>
              <span className="text-xs text-blue-700">({v.code})</span>
              <button
                type="button"
                aria-label={`Remove ${v.display}`}
                onClick={() => removeItem(v)}
                className="ml-1 text-blue-700 hover:text-blue-900 font-bold"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="form-input"
        autoComplete="off"
      />
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {query.trim().length >= 2 && (
        <div className="mt-1 border border-gray-200 rounded shadow-sm max-h-60 overflow-y-auto bg-white">
          {loading && <div className="px-2 py-1 text-sm text-gray-500">Searching…</div>}
          {!loading && filteredOptions.length === 0 && !error && (
            <div className="px-2 py-1 text-sm text-gray-500">No matches.</div>
          )}
          {!loading &&
            filteredOptions.map((o) => (
              <button
                key={`${o.system}|${o.code}`}
                type="button"
                onClick={() => addItem(o)}
                className="block w-full text-left px-2 py-1 text-sm hover:bg-blue-50"
              >
                <span>{o.display}</span>
                <span className="ml-2 text-xs text-gray-500">{o.code}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default SnomedTypeahead
