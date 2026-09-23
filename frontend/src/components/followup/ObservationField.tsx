import { useEffect, useState } from 'react'
import { expandValueSet, type TermOption } from '../../lib/terminologyService'
import type { ObservationMeta, ObservationGroup } from '../../config/followupObservationMetadata'
import { OBSERVATION_PROFILE_URLS, PROVOCATION_TEST_RESULT } from '../../types/fhir'
import { useQuantityBounds } from '../../hooks/useQuantityBounds'

export type FieldValue =
  | { kind: 'quantity'; value: number }
  | { kind: 'coded'; coding: { system: string; code: string; display: string } }
  | { kind: 'string'; value: string }
  // Test not performed — e.g. contraindicated or not safely possible this
  // soon after surgery (surgeon feedback, ADR-0109). Built as
  // dataAbsentReason = #not-performed with no value[x] (see
  // buildNotDoneObservation in observationBuilder.ts) — FHIR R4's
  // Observation.status has no 'not-done' code (only Procedure does).
  | { kind: 'not-done' }
  | undefined

// "Not applicable / not possible" is only offered for the post-op exam
// groups a surgeon might genuinely be unable to perform this soon after
// surgery (ROM, strength, provocation tests) — not for visual inspection
// (exam-finding, always safely observable) or patient-reported PROMs
// (prom-score/prom-coded, not physically constrained). Surgeon feedback,
// ADR-0109.
const NOT_DONE_GROUPS: ObservationGroup[] = ['rom-active', 'rom-passive', 'strength', 'provocation']

interface Props {
  fieldKey: string
  meta: ObservationMeta
  value: FieldValue
  onChange: (next: FieldValue) => void
}

function ObservationField({ fieldKey, meta, value, onChange }: Props) {
  const [options, setOptions] = useState<TermOption[]>([])
  const [optError, setOptError] = useState<string | null>(null)
  // Read min/max from the profile's StructureDefinition. Falls back to
  // meta.min/meta.max for fields whose FSH profile doesn't declare bounds
  // (e.g. composite PROM scores).
  const profileUrl = meta.valueType === 'quantity' ? (OBSERVATION_PROFILE_URLS[fieldKey] ?? null) : null
  const { min: profileMin, max: profileMax } = useQuantityBounds(profileUrl)
  const effectiveMin = profileMin ?? meta.min
  const effectiveMax = profileMax ?? meta.max

  useEffect(() => {
    if (meta.valueType !== 'codeable') return
    // Provocation tests use a small fixed positive/negative set, no $expand needed
    if (meta.group === 'provocation') {
      setOptions([
        {
          code: PROVOCATION_TEST_RESULT.POSITIVE.code,
          display: PROVOCATION_TEST_RESULT.POSITIVE.display,
          system: PROVOCATION_TEST_RESULT.SYSTEM,
        },
        {
          code: PROVOCATION_TEST_RESULT.NEGATIVE.code,
          display: PROVOCATION_TEST_RESULT.NEGATIVE.display,
          system: PROVOCATION_TEST_RESULT.SYSTEM,
        },
      ])
      return
    }
    if (!meta.valueSetUrl) return
    let cancelled = false
    expandValueSet(meta.valueSetUrl)
      .then((opts) => {
        if (!cancelled) setOptions(opts)
      })
      .catch((err) => {
        if (!cancelled) setOptError(err?.message ?? 'ValueSet expansion failed')
      })
    return () => {
      cancelled = true
    }
  }, [meta.group, meta.valueType, meta.valueSetUrl])

  const id = `field-${fieldKey}`
  const isNotDone = value?.kind === 'not-done'
  const notDoneToggle = NOT_DONE_GROUPS.includes(meta.group) && (
    <label
      className="flex items-center gap-2 text-xs text-gray-600 mb-1"
      title="Not applicable / not possible (e.g. contraindicated this soon after surgery)"
    >
      <input
        type="checkbox"
        checked={isNotDone}
        onChange={(e) => onChange(e.target.checked ? { kind: 'not-done' } : undefined)}
      />
      N/A
    </label>
  )

  if (meta.valueType === 'quantity') {
    const current = value?.kind === 'quantity' ? value.value : ''
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={id}>
          {meta.label}
          {meta.required && ' *'}
          {meta.unitDisplay && <span className="text-gray-500 font-normal"> ({meta.unitDisplay})</span>}
        </label>
        {meta.helpText && <p className="text-xs text-gray-500 mb-1">{meta.helpText}</p>}
        {notDoneToggle}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="form-input"
          min={effectiveMin}
          max={effectiveMax}
          step={meta.step ?? 'any'}
          required={meta.required}
          disabled={isNotDone}
          value={current}
          onChange={(e) => {
            const v = e.target.value
            if (v === '') onChange(undefined)
            else onChange({ kind: 'quantity', value: Number(v) })
          }}
        />
      </div>
    )
  }

  if (meta.valueType === 'codeable') {
    const current = value?.kind === 'coded' ? value.coding.code : ''
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={id}>
          {meta.label}
          {meta.required && ' *'}
        </label>
        {meta.helpText && <p className="text-xs text-gray-500 mb-1">{meta.helpText}</p>}
        {notDoneToggle}
        <select
          id={id}
          className="form-input"
          value={current}
          disabled={isNotDone}
          onChange={(e) => {
            const picked = options.find((o) => o.code === e.target.value)
            if (!picked) onChange(undefined)
            else
              onChange({
                kind: 'coded',
                coding: { system: picked.system, code: picked.code, display: picked.display },
              })
          }}
        >
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={`${o.system}|${o.code}`} value={o.code}>
              {o.display}
            </option>
          ))}
        </select>
        {optError && <p className="text-xs text-red-600 mt-1">{optError}</p>}
      </div>
    )
  }

  // string
  const current = value?.kind === 'string' ? value.value : ''
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {meta.label}
      </label>
      <textarea
        id={id}
        rows={3}
        className="form-input"
        value={current}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(undefined)
          else onChange({ kind: 'string', value: v })
        }}
      />
    </div>
  )
}

export default ObservationField
