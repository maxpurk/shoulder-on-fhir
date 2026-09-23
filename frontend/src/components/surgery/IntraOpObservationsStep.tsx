import { useValueSet } from '../../hooks/useValueSet'
import { VALUESET_URLS } from '../../types/fhir'

export interface IntraOpFormState {
  tearSize: string
  tearSizeClassification: string
}

interface Props {
  laterality: 'left' | 'right' | ''
  value: IntraOpFormState
  onChange: (next: IntraOpFormState) => void
  onComplete: () => void
  onBack: () => void
}

// Cofield boundaries (ADR-0047): <1 small, 1–3 medium, 3–5 large, >5 massive.
// Same helper as StepImaging.tsx (Registration's imaging-side tear-size step).
function deriveCofieldBucket(cm: number): 'small' | 'medium' | 'large' | 'massive' {
  if (cm < 1) return 'small'
  if (cm <= 3) return 'medium'
  if (cm <= 5) return 'large'
  return 'massive'
}

/**
 * Intra-operative Findings step (ADR-0104) — the surgical-context sibling of
 * Registration's StepImaging tear-size fields. A pure controlled form: unlike
 * StepImaging (which builds FHIR Observations itself), this component only
 * lifts form state via onChange — SurgeryWizard.tsx's own `entries` useMemo
 * builds the actual Observations, matching how SurgicalEventStep already
 * works in this wizard (SurgeryWizard already has one FHIR-construction
 * site; this keeps it that way rather than introducing a second).
 *
 * Entirely optional — both fields may be left blank, in which case
 * SurgeryWizard's useMemo emits no Observation for this step at all.
 */
function IntraOpObservationsStep({ laterality, value: formData, onChange, onComplete, onBack }: Props) {
  const { options: cofieldOptions, loading: cofieldLoading, error: cofieldError } = useValueSet(VALUESET_URLS.COFIELD_TEAR_SIZE_CLASSIFICATION)

  const { tearSize, tearSizeClassification } = formData

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onComplete()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Intra-operative Findings (optional)</h3>
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          Shoulder: <strong>{laterality === 'left' ? 'Left' : laterality === 'right' ? 'Right' : '—'}</strong>
          {' '}(measured during surgery)
        </div>

        <div className="form-group">
          <label className="form-label">Confirmed Tear Size (cm)</label>
          <p className="text-xs text-gray-500 mb-2">
            Maximum tear diameter measured directly during surgery — may differ from the pre-operative imaging estimate.
          </p>
          <input
            type="number"
            inputMode="decimal"
            value={tearSize}
            onChange={(e) => {
              const next = e.target.value
              const cm = parseFloat(next)
              // Auto-suggest Cofield bucket only when the field was empty or
              // still matches the previously auto-derived bucket. Explicit
              // overrides survive subsequent cm edits. Same logic as
              // StepImaging's imaging-side tear-size field.
              const prevCm = parseFloat(tearSize)
              const prevAutoBucket = !isNaN(prevCm) ? deriveCofieldBucket(prevCm) : ''
              const shouldAutoFill =
                !tearSizeClassification || tearSizeClassification === prevAutoBucket
              const autoBucket = !isNaN(cm) && next.trim() !== '' ? deriveCofieldBucket(cm) : ''
              onChange({
                ...formData,
                tearSize: next,
                tearSizeClassification: shouldAutoFill ? autoBucket : tearSizeClassification,
              })
            }}
            min={0}
            max={10}
            step={0.1}
            placeholder="e.g. 2.5"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tear Size Classification (Cofield)</label>
          <p className="text-xs text-gray-500 mb-2">
            Auto-suggested from cm value (small &lt;1, medium 1–3, large 3–5, massive &gt;5). Override if needed.
          </p>
          {cofieldError && <p className="text-xs text-red-600 mb-1">Could not load options: {cofieldError}</p>}
          <select
            value={tearSizeClassification}
            onChange={(e) => onChange({ ...formData, tearSizeClassification: e.target.value })}
            disabled={cofieldLoading}
            className="form-input"
          >
            {cofieldLoading && <option value="">Loading…</option>}
            {!cofieldLoading && <option value="">-- Select bucket --</option>}
            {cofieldOptions.map((o) => (
              <option key={o.code} value={o.code}>{o.display}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <button type="submit" className="btn btn-primary">Next: Review →</button>
      </div>
    </form>
  )
}

export default IntraOpObservationsStep
