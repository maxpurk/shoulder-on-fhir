import { GROUP_LABELS, Q9_FIELDS, type ObservationGroup } from '../../config/followupObservationMetadata'
import ObservationField, { type FieldValue } from './ObservationField'

export type Q9FormState = Record<string, FieldValue>

interface Props {
  state: Q9FormState
  onChange: (next: Q9FormState) => void
}

const GROUP_ORDER: ObservationGroup[] = [
  'exam-finding',
  'rom-active',
  'rom-passive',
  'strength',
  'provocation',
]

function Q9ExamForm({ state, onChange }: Props) {
  function setField(key: string, value: FieldValue) {
    const next = { ...state }
    if (value === undefined) delete next[key]
    else next[key] = value
    onChange(next)
  }

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    fields: Object.entries(Q9_FIELDS).filter(([, m]) => m.group === g),
  })).filter((b) => b.fields.length > 0)

  return (
    <div className="card">
      <h2 className="card-header">Step 3 — Post-op exam</h2>
      <p className="text-sm text-gray-600 mb-4">
        Capture only the fields you have measured at this visit. Empty fields are not submitted —
        partial visits are allowed. Check a field's <strong>N/A</strong> box if it is not
        applicable or not possible to test (e.g. contraindicated this soon after surgery).
      </p>
      {grouped.map((block) => (
        <fieldset key={block.group} className="mb-6">
          <legend className="text-sm font-semibold text-gray-700 mb-2">{block.label}</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {block.fields.map(([key, meta]) => (
              <ObservationField
                key={key}
                fieldKey={key}
                meta={meta}
                value={state[key]}
                onChange={(v) => setField(key, v)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export default Q9ExamForm
