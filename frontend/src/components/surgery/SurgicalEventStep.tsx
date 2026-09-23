import { useValueSet } from '../../hooks/useValueSet'
import { VALUESET_URLS } from '../../types/fhir'
import type { Condition } from '../../types/fhir'

export interface SurgicalProcedureFormItem {
  procedureCode: string
  // status is not collected here — every procedure recorded through this
  // retrospective wizard is 'completed' by construction (surgeon feedback,
  // ADR-0108; see buildProcedureResource). Incision/closure time-of-day
  // moved to the surgical-event level (ADR-0121) — a concomitant procedure
  // shares the same skin incision and closure as the index procedure, so
  // it is no longer asked per procedure row.
  outcome: '' | 'successful' | 'unsuccessful'
  notes: string
  // Postcoordinated procedure-technique axes (ADR-0108), decoupled from
  // procedureCode — each optional (0..1), emitted as a sibling Observation
  // linked back to this procedure via partOf.
  procedureApproach: string
  reconstructionExtent: string
  fixationTechnique: string
  // ADR-0159: which diagnosis this procedure addresses. Only meaningful for
  // a concomitant procedure (the index procedure always addresses the index
  // RotatorCuffCondition, wired unconditionally in SurgeryWizard.tsx) — a
  // concomitant procedure may instead address a coexisting non-rotator-cuff
  // diagnosis (ShoulderDiagnosisCondition, ADR-0077's otherDiagnosis slice),
  // widened onto RotatorCuffProcedure.reasonReference by ADR-0127. Empty
  // string falls back to the index Condition, same as before this ADR.
  diagnosisConditionId: string
}

export interface ProcedureFormState {
  index: SurgicalProcedureFormItem
  concomitant: SurgicalProcedureFormItem[]
}

// Day-of-surgery + setting + one incision/closure time (ADR-0110, refined
// by ADR-0121) — captured once at the wizard level, alongside the procedure
// list, instead of on a separate "Encounter" step. All procedures recorded
// in this surgical event (index + any concomitant) share one skin incision
// and one closure — e.g. a rotator cuff repair plus a concomitant biceps
// tenodesis performed through the same arthroscopic portals — so incision
// and closure time are asked once, not per procedure. Encounter.period is
// composed directly from these two times; each Procedure.performedPeriod
// is composed from the same pair.
//
// performerName (not Hurley-named — verified against the full Hurley et al.
// 2024 text, absent from all 13 questions/sub-items — pure Layer 2
// scaffolding, Procedure.performer.actor, L3.H.1) follows the same
// one-per-surgical-event pattern: this IG has no Practitioner directory, so
// it's a free-text name applied to every procedure in the event via
// Reference.display only, not a managed Practitioner reference.
export interface SurgicalEventFormState {
  surgeryDate: string
  setting: 'IMP' | 'AMB'
  incisionTime: string
  sutureTime: string
  performerName: string
}

const blankItem = (): SurgicalProcedureFormItem => ({
  procedureCode: '',
  outcome: '',
  notes: '',
  procedureApproach: '',
  reconstructionExtent: '',
  fixationTechnique: '',
  diagnosisConditionId: '',
})

interface Props {
  event: SurgicalEventFormState
  onEventChange: (next: SurgicalEventFormState) => void
  value: ProcedureFormState
  onChange: (next: ProcedureFormState) => void
  laterality: 'left' | 'right' | ''
  /** ADR-0159: coexisting non-rotator-cuff diagnoses a concomitant procedure can be wired to. */
  otherDiagnoses: Condition[]
  onComplete: () => void
  onBack: () => void
}

function conditionLabel(c: Condition): string {
  return c.code?.coding?.[0]?.display ?? c.code?.coding?.[0]?.code ?? c.id ?? 'Condition'
}

function ProcedureRow({
  label,
  item,
  procedureOptions,
  approachOptions,
  extentOptions,
  fixationOptions,
  otherDiagnoses,
  onChange,
  onRemove,
}: {
  label: string
  item: SurgicalProcedureFormItem
  procedureOptions: Array<{ code: string; display: string }>
  approachOptions: Array<{ code: string; display: string }>
  extentOptions: Array<{ code: string; display: string }>
  fixationOptions: Array<{ code: string; display: string }>
  /** ADR-0159: pass a non-empty list to render the diagnosis picker (concomitant rows only). */
  otherDiagnoses?: Condition[]
  onChange: (next: SurgicalProcedureFormItem) => void
  onRemove?: () => void
}) {
  return (
    <div className="border border-gray-200 rounded p-4 mb-4">
      <div className="flex justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{label}</h4>
        {onRemove && (
          <button type="button" className="text-sm text-red-600 hover:underline" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group sm:col-span-2">
          <label className="form-label">Procedure code *</label>
          <select
            className="form-input"
            value={item.procedureCode}
            onChange={(e) => onChange({ ...item, procedureCode: e.target.value })}
            required
          >
            <option value="">-- Select procedure --</option>
            {procedureOptions.map((p) => (
              <option key={p.code} value={p.code}>{p.display}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Approach</label>
          <select
            className="form-input"
            value={item.procedureApproach}
            onChange={(e) => onChange({ ...item, procedureApproach: e.target.value })}
          >
            <option value="">Not assessed</option>
            {approachOptions.map((o) => (
              <option key={o.code} value={o.code}>{o.display}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reconstruction Extent</label>
          <select
            className="form-input"
            value={item.reconstructionExtent}
            onChange={(e) => onChange({ ...item, reconstructionExtent: e.target.value })}
          >
            <option value="">Not assessed / not applicable</option>
            {extentOptions.map((o) => (
              <option key={o.code} value={o.code}>{o.display}</option>
            ))}
          </select>
        </div>
        <div className="form-group sm:col-span-2">
          <label className="form-label">Fixation Technique</label>
          <select
            className="form-input"
            value={item.fixationTechnique}
            onChange={(e) => onChange({ ...item, fixationTechnique: e.target.value })}
          >
            <option value="">Not assessed</option>
            {fixationOptions.map((o) => (
              <option key={o.code} value={o.code}>{o.display}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Intraoperative Success</label>
          <select
            className="form-input"
            value={item.outcome}
            onChange={(e) => onChange({ ...item, outcome: e.target.value as SurgicalProcedureFormItem['outcome'] })}
          >
            <option value="">--</option>
            <option value="successful">Successful</option>
            <option value="unsuccessful">Unsuccessful</option>
          </select>
        </div>
        <div className="form-group sm:col-span-2">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={2}
            value={item.notes}
            onChange={(e) => onChange({ ...item, notes: e.target.value })}
          />
        </div>
        {otherDiagnoses && otherDiagnoses.length > 0 && (
          <div className="form-group sm:col-span-2">
            <label className="form-label">Diagnosis addressed</label>
            <select
              className="form-input"
              value={item.diagnosisConditionId}
              onChange={(e) => onChange({ ...item, diagnosisConditionId: e.target.value })}
            >
              <option value="">Index rotator cuff diagnosis (default)</option>
              {otherDiagnoses.map((c) => (
                <option key={c.id} value={c.id}>{conditionLabel(c)}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Only needed if this procedure addresses a different, already-recorded diagnosis
              (e.g. a distal clavicle excision for coexisting AC joint arthritis) rather than
              the index rotator cuff tear.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SurgicalEventStep({ event, onEventChange, value: state, onChange, laterality, otherDiagnoses, onComplete, onBack }: Props) {
  const { options: procedureOptions, loading, error } = useValueSet(VALUESET_URLS.ROTATOR_CUFF_PROCEDURE_TYPE)
  const { options: approachOptions } = useValueSet(VALUESET_URLS.PROCEDURE_APPROACH)
  const { options: extentOptions } = useValueSet(VALUESET_URLS.RECONSTRUCTION_EXTENT)
  const { options: fixationOptions } = useValueSet(VALUESET_URLS.FIXATION_TECHNIQUE)

  const updateIndex = (next: SurgicalProcedureFormItem) =>
    onChange({ ...state, index: next })

  const updateConcomitant = (idx: number, next: SurgicalProcedureFormItem) => {
    const copy = [...state.concomitant]
    copy[idx] = next
    onChange({ ...state, concomitant: copy })
  }

  const removeConcomitant = (idx: number) =>
    onChange({ ...state, concomitant: state.concomitant.filter((_, i) => i !== idx) })

  const addConcomitant = () =>
    onChange({ ...state, concomitant: [...state.concomitant, blankItem()] })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onComplete()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Surgical Event</h3>
        <p className="text-sm text-gray-600 mb-4">
          When and how the surgery was performed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Day of surgery *</label>
            <input
              type="date"
              className="form-input"
              value={event.surgeryDate}
              onChange={(e) => onEventChange({ ...event, surgeryDate: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Setting *</label>
            <select
              className="form-input"
              value={event.setting}
              onChange={(e) => onEventChange({ ...event, setting: e.target.value as 'IMP' | 'AMB' })}
              required
            >
              <option value="AMB">Day surgery (outpatient)</option>
              <option value="IMP">Inpatient</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Incision time *</label>
            <input
              type="time"
              className="form-input"
              value={event.incisionTime}
              onChange={(e) => onEventChange({ ...event, incisionTime: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Closure time *</label>
            <input
              type="time"
              className="form-input"
              value={event.sutureTime}
              onChange={(e) => onEventChange({ ...event, sutureTime: e.target.value })}
              required
            />
          </div>
          <div className="form-group sm:col-span-2">
            <label className="form-label">Surgeon / Performer</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Jane Smith"
              value={event.performerName}
              onChange={(e) => onEventChange({ ...event, performerName: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          One incision, one closure, and one performer for the whole surgical event — applies
          to the index procedure and any concomitant procedure below, since they share the
          same skin incision, closure, and surgeon.
        </p>
      </div>

      <div className="card mb-6">
        <h3 className="card-header">Surgical Procedures</h3>
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          Shoulder: <strong>{laterality === 'left' ? 'Left' : laterality === 'right' ? 'Right' : '—'}</strong>
          {' '}(inherited from the existing diagnosis)
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        {loading && <p className="text-xs text-gray-500 mb-2">Loading procedure codes…</p>}

        <ProcedureRow
          label="Index procedure (primary)"
          item={state.index}
          procedureOptions={procedureOptions}
          approachOptions={approachOptions}
          extentOptions={extentOptions}
          fixationOptions={fixationOptions}
          onChange={updateIndex}
        />

        {state.concomitant.map((item, i) => (
          <ProcedureRow
            key={i}
            label={`Concomitant procedure #${i + 1}`}
            item={item}
            procedureOptions={procedureOptions}
            approachOptions={approachOptions}
            extentOptions={extentOptions}
            fixationOptions={fixationOptions}
            otherDiagnoses={otherDiagnoses}
            onChange={(next) => updateConcomitant(i, next)}
            onRemove={() => removeConcomitant(i)}
          />
        ))}

        <button type="button" onClick={addConcomitant} className="btn btn-secondary text-sm">
          + Add concomitant procedure
        </button>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <button type="submit" className="btn btn-primary">Next: Intra-op Findings →</button>
      </div>
    </form>
  )
}

export default SurgicalEventStep
