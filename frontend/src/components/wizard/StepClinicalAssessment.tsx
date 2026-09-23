import type { Observation, WizardEntry } from '../../types/fhir'
import {
  SHOULDER_LATERALITY,
  OBSERVATION_CODES,
  OBSERVATION_CODINGS,
  PROVOCATION_TEST_RESULT,
  PRESENT_ABSENT_RESULT,
  PROFILE_URLS,
  OBSERVATION_PROFILE_URLS,
  VALUESET_URLS,
  IG_CANONICAL,
} from '../../types/fhir'
import { useQuantityBounds } from '../../hooks/useQuantityBounds'
import { useValueSet, type TermOption } from '../../hooks/useValueSet'
import type { ClinicalAssessmentFormData } from './stepFormData'

interface ROMFieldProps {
  name: keyof ClinicalAssessmentFormData
  label: string
  profileKey: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  // Bounds always come from the profile's own StructureDefinition
  // (useQuantityBounds) rather than a hardcoded literal, so ROM and
  // strength/dynamometry fields alike stay in sync with the IG if a
  // profile's min/maxValueQuantity ever changes.
  unit?: string
  step?: string
  helpText?: string
}

function ROMField({ name, label, profileKey, value, onChange, unit = '°', step, helpText }: ROMFieldProps) {
  const profileUrl = OBSERVATION_PROFILE_URLS[profileKey] ?? null
  const { min, max } = useQuantityBounds(profileUrl)
  const placeholder = min !== undefined && max !== undefined ? `${min}–${max}` : ''
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {helpText && <p className="text-xs text-gray-500 mb-1">{helpText}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          name={name}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          className="form-input"
          placeholder={placeholder}
        />
        {unit && <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  )
}

interface StepClinicalAssessmentProps {
  patientUuid: string
  encounterUuid: string
  laterality: string
  value: ClinicalAssessmentFormData
  onChange: (next: ClinicalAssessmentFormData) => void
  onComplete: (entries: WizardEntry[]) => void
  onSkip: () => void
  onBack: () => void
}

function StepClinicalAssessment({ patientUuid, encounterUuid, laterality, value: formData, onChange, onComplete, onSkip, onBack }: StepClinicalAssessmentProps) {
  const { options: presentAbsentOptions } = useValueSet(VALUESET_URLS.PRESENT_ABSENT)
  // ADR-0088: at-side Internal Rotation "hand behind back" ordinal
  const { options: internalRotationOptions } = useValueSet(VALUESET_URLS.INTERNAL_ROTATION_VERTEBRAL_LEVEL)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value: fieldValue } = e.target
    onChange({ ...formData, [name]: fieldValue })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const effectiveDate = new Date().toISOString().split('T')[0]
    const encounterRef = { reference: `urn:uuid:${encounterUuid}` }
    const bodySite = {
      coding: [
        {
          system: SHOULDER_LATERALITY.SYSTEM,
          code: laterality === 'left' ? SHOULDER_LATERALITY.LEFT : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT : undefined,
          display: laterality === 'left' ? SHOULDER_LATERALITY.LEFT_DISPLAY : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT_DISPLAY : undefined,
        },
      ],
    }

    const makeROMObservation = (code: string, value: string): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [OBSERVATION_CODINGS[code]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: effectiveDate,
      valueQuantity: { value: parseFloat(value), unit: 'degrees', system: 'http://unitsofmeasure.org', code: 'deg' },
      bodySite,
    })

    const makeStrengthObservation = (code: string, value: string): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [OBSERVATION_CODINGS[code]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: effectiveDate,
      valueQuantity: { value: parseFloat(value), unit: 'MMT grade', system: 'http://unitsofmeasure.org', code: '{score}' },
      bodySite,
    })

    // Supraspinatus dynamometry (ADR-0089) — continuous kg force, sibling to
    // the ordinal MMT grade, not a replacement.
    const makeDynamometryObservation = (code: string, value: string): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [OBSERVATION_CODINGS[code]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: effectiveDate,
      valueQuantity: { value: parseFloat(value), unit: 'kilograms', system: 'http://unitsofmeasure.org', code: 'kg' },
      bodySite,
    })

    // Pain severity (ADR-0087) — 4 context-specific 0-10 axes, replacing the
    // single generic LOINC 72514-3 field.
    const makePainObservation = (code: string, value: string): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [OBSERVATION_CODINGS[code]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: effectiveDate,
      valueQuantity: { value: parseFloat(value), unit: 'pain score', system: 'http://unitsofmeasure.org', code: '{score}' },
      bodySite,
    })

    const makeProvocationObservation = (code: string, result: string): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [OBSERVATION_CODINGS[code]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: effectiveDate,
      valueCodeableConcept: {
        coding: [
          {
            system: PROVOCATION_TEST_RESULT.SYSTEM,
            code: result === 'positive' ? PROVOCATION_TEST_RESULT.POSITIVE.code : PROVOCATION_TEST_RESULT.NEGATIVE.code,
            display: result === 'positive' ? PROVOCATION_TEST_RESULT.POSITIVE.display : PROVOCATION_TEST_RESULT.NEGATIVE.display,
          },
        ],
      },
      bodySite,
    })

    // Coded-select Observations backed by a dynamically fetched ValueSet.
    // `selectedCode` is the code chosen in the <select>, resolved back to its
    // full {system, code, display} via the supplied `options` list.
    // Originally written for the 3 present/absent visual-inspection findings
    // (ADR-0086, replacing the retired free-text InspectionObservation);
    // reused for at-side Internal Rotation's vertebral-level ordinal
    // (ADR-0088) — same pattern as sleepDisturbanceOption in StepPatient.tsx.
    const makeCodedFromOptions = (code: string, selectedCode: string, options: TermOption[], fallbackSystem: string): Observation => {
      const option = options.find((o) => o.code === selectedCode)
      return {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[code] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
        code: { coding: [OBSERVATION_CODINGS[code]] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: encounterRef,
        effectiveDateTime: effectiveDate,
        valueCodeableConcept: {
          coding: [
            {
              system: option?.system ?? fallbackSystem,
              code: selectedCode,
              display: option?.display,
            },
          ],
        },
        bodySite,
      }
    }
    const makePresentAbsentObservation = (code: string, selectedCode: string): Observation =>
      makeCodedFromOptions(code, selectedCode, presentAbsentOptions, PRESENT_ABSENT_RESULT.SYSTEM)
    // ADR-0088: at-side Internal Rotation "hand behind back" ordinal — falls
    // back to the local ShoulderObservationCS system (no external system).
    const makeInternalRotationObservation = (code: string, selectedCode: string): Observation =>
      makeCodedFromOptions(code, selectedCode, internalRotationOptions, `${IG_CANONICAL}/CodeSystem/internal-rotation-vertebral-level`)

    const observations: Observation[] = []

    // Active ROM
    if (formData.forwardFlexion) observations.push(makeROMObservation(OBSERVATION_CODES.FORWARD_FLEXION, formData.forwardFlexion))
    if (formData.externalRotation) observations.push(makeROMObservation(OBSERVATION_CODES.EXTERNAL_ROTATION, formData.externalRotation))
    // ADR-0088: at-side Internal Rotation holds a vertebral-level code
    if (formData.internalRotation) observations.push(makeInternalRotationObservation(OBSERVATION_CODES.INTERNAL_ROTATION, formData.internalRotation))
    if (formData.abduction) observations.push(makeROMObservation(OBSERVATION_CODES.ABDUCTION, formData.abduction))
    // ADR-0088: rotation measured at 90° abduction — new fields
    if (formData.externalRotation90Abduction) observations.push(makeROMObservation(OBSERVATION_CODES.EXTERNAL_ROTATION_90_ABDUCTION, formData.externalRotation90Abduction))
    if (formData.internalRotation90Abduction) observations.push(makeROMObservation(OBSERVATION_CODES.INTERNAL_ROTATION_90_ABDUCTION, formData.internalRotation90Abduction))

    // Passive ROM
    if (formData.passiveForwardFlexion) observations.push(makeROMObservation(OBSERVATION_CODES.PASSIVE_FORWARD_FLEXION, formData.passiveForwardFlexion))
    if (formData.passiveExternalRotation) observations.push(makeROMObservation(OBSERVATION_CODES.PASSIVE_EXTERNAL_ROTATION, formData.passiveExternalRotation))
    // ADR-0088: at-side Internal Rotation holds a vertebral-level code
    if (formData.passiveInternalRotation) observations.push(makeInternalRotationObservation(OBSERVATION_CODES.PASSIVE_INTERNAL_ROTATION, formData.passiveInternalRotation))
    if (formData.passiveAbduction) observations.push(makeROMObservation(OBSERVATION_CODES.PASSIVE_ABDUCTION, formData.passiveAbduction))
    // ADR-0088: rotation measured at 90° abduction — new fields
    if (formData.passiveExternalRotation90Abduction) observations.push(makeROMObservation(OBSERVATION_CODES.PASSIVE_EXTERNAL_ROTATION_90_ABDUCTION, formData.passiveExternalRotation90Abduction))
    if (formData.passiveInternalRotation90Abduction) observations.push(makeROMObservation(OBSERVATION_CODES.PASSIVE_INTERNAL_ROTATION_90_ABDUCTION, formData.passiveInternalRotation90Abduction))

    // Strength
    if (formData.supraspinatusStrength) observations.push(makeStrengthObservation(OBSERVATION_CODES.SUPRASPINATUS_STRENGTH, formData.supraspinatusStrength))
    if (formData.externalRotationStrength) observations.push(makeStrengthObservation(OBSERVATION_CODES.EXTERNAL_ROTATION_STRENGTH, formData.externalRotationStrength))
    if (formData.subscapularisStrength) observations.push(makeStrengthObservation(OBSERVATION_CODES.SUBSCAPULARIS_STRENGTH, formData.subscapularisStrength))
    // ADR-0089: new sibling strength axes
    if (formData.internalRotationStrength) observations.push(makeStrengthObservation(OBSERVATION_CODES.INTERNAL_ROTATION_STRENGTH, formData.internalRotationStrength))
    if (formData.supraspinatusStrengthDynamometry) observations.push(makeDynamometryObservation(OBSERVATION_CODES.SUPRASPINATUS_STRENGTH_DYNAMOMETRY, formData.supraspinatusStrengthDynamometry))

    // Provocation tests
    if (formData.jobeTest) observations.push(makeProvocationObservation(OBSERVATION_CODES.JOBE_TEST, formData.jobeTest))
    if (formData.liftOffTest) observations.push(makeProvocationObservation(OBSERVATION_CODES.LIFT_OFF_TEST, formData.liftOffTest))
    if (formData.bellyPressTest) observations.push(makeProvocationObservation(OBSERVATION_CODES.BELLY_PRESS_TEST, formData.bellyPressTest))
    if (formData.bearHugTest) observations.push(makeProvocationObservation(OBSERVATION_CODES.BEAR_HUG_TEST, formData.bearHugTest))
    if (formData.hornblowerTest) observations.push(makeProvocationObservation(OBSERVATION_CODES.HORNBLOWER_TEST, formData.hornblowerTest))

    // Pain severity (ADR-0087) — 4 context-specific 0-10 axes: Q1.h / Q8.a / Q12.a
    if (formData.painAverage) observations.push(makePainObservation(OBSERVATION_CODES.PAIN_AVERAGE, formData.painAverage))
    if (formData.painActiveMovement) observations.push(makePainObservation(OBSERVATION_CODES.PAIN_ACTIVE_MOVEMENT, formData.painActiveMovement))
    if (formData.painPassiveMovement) observations.push(makePainObservation(OBSERVATION_CODES.PAIN_PASSIVE_MOVEMENT, formData.painPassiveMovement))
    if (formData.painRest) observations.push(makePainObservation(OBSERVATION_CODES.PAIN_REST, formData.painRest))

    // Visual inspection findings (Q2.a) — 3 structured yes/no questions (ADR-0086)
    if (formData.atrophy) observations.push(makePresentAbsentObservation(OBSERVATION_CODES.ATROPHY, formData.atrophy))
    if (formData.deformity) observations.push(makePresentAbsentObservation(OBSERVATION_CODES.DEFORMITY, formData.deformity))
    if (formData.normalShoulderContour) observations.push(makePresentAbsentObservation(OBSERVATION_CODES.NORMAL_SHOULDER_CONTOUR, formData.normalShoulderContour))

    if (observations.length === 0) {
      onSkip()
      return
    }

    onComplete(observations.map(resource => ({ uuid: crypto.randomUUID(), resource })))
  }

  const provocationOptions = [
    { value: '', label: 'Not assessed' },
    { value: 'positive', label: 'Positive' },
    { value: 'negative', label: 'Negative' },
  ]

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Clinical Assessment</h3>

        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          Shoulder: <strong>{laterality === 'left' ? 'Left' : laterality === 'right' ? 'Right' : '—'}</strong> — Leave fields empty to skip individual measurements.
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Visual Inspection</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {([
            { name: 'atrophy', label: 'Atrophy' },
            { name: 'deformity', label: 'Deformity' },
            { name: 'normalShoulderContour', label: 'Normal Shoulder Contour' },
          ] as const).map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">{field.label}</label>
              <select
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">Not assessed</option>
                {presentAbsentOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.display}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Pain</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {([
            { name: 'painAverage', label: 'Pain — On Average (0–10)' },
            { name: 'painActiveMovement', label: 'Pain — With Active Movement (0–10)' },
            { name: 'painPassiveMovement', label: 'Pain — With Passive Movement (0–10)' },
            { name: 'painRest', label: 'Pain — At Rest (0–10)' },
          ] as const).map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">{field.label}</label>
              <p className="text-xs text-gray-500 mb-1">0 = no pain, 10 = worst pain imaginable.</p>
              <input
                type="number"
                inputMode="decimal"
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                min={0}
                max={10}
                step={1}
                className="form-input"
                placeholder="0–10"
              />
            </div>
          ))}
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Active Range of Motion (degrees)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {([
            { name: 'forwardFlexion', label: 'Forward Flexion', profileKey: 'forward-flexion' },
            { name: 'externalRotation', label: 'External Rotation, at side', profileKey: 'external-rotation' },
            { name: 'abduction', label: 'Abduction', profileKey: 'abduction' },
            { name: 'externalRotation90Abduction', label: 'External Rotation, at 90° abduction', profileKey: 'external-rotation-90-abduction' },
            { name: 'internalRotation90Abduction', label: 'Internal Rotation, at 90° abduction', profileKey: 'internal-rotation-90-abduction' },
          ] as const).map((field) => (
            <ROMField
              key={field.name}
              name={field.name}
              label={field.label}
              profileKey={field.profileKey}
              value={formData[field.name]}
              onChange={handleChange}
            />
          ))}
          {/* ADR-0088: at-side Internal Rotation is a "hand behind back" vertebral-level
              ordinal, not degrees — rendered as a select, not a ROMField. */}
          <div className="form-group">
            <label className="form-label">Internal Rotation, at side (hand behind back)</label>
            <select
              name="internalRotation"
              value={formData.internalRotation}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">Not assessed</option>
              {internalRotationOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Passive Range of Motion (degrees)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {([
            { name: 'passiveForwardFlexion', label: 'Passive Forward Flexion', profileKey: 'passive-forward-flexion' },
            { name: 'passiveExternalRotation', label: 'Passive External Rotation, at side', profileKey: 'passive-external-rotation' },
            { name: 'passiveAbduction', label: 'Passive Abduction', profileKey: 'passive-abduction' },
            { name: 'passiveExternalRotation90Abduction', label: 'Passive External Rotation, at 90° abduction', profileKey: 'passive-external-rotation-90-abduction' },
            { name: 'passiveInternalRotation90Abduction', label: 'Passive Internal Rotation, at 90° abduction', profileKey: 'passive-internal-rotation-90-abduction' },
          ] as const).map((field) => (
            <ROMField
              key={field.name}
              name={field.name}
              label={field.label}
              profileKey={field.profileKey}
              value={formData[field.name]}
              onChange={handleChange}
            />
          ))}
          {/* ADR-0088: at-side Internal Rotation is a "hand behind back" vertebral-level
              ordinal, not degrees — rendered as a select, not a ROMField. */}
          <div className="form-group">
            <label className="form-label">Passive Internal Rotation, at side (hand behind back)</label>
            <select
              name="passiveInternalRotation"
              value={formData.passiveInternalRotation}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">Not assessed</option>
              {internalRotationOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Muscle Strength (0–5 Janda / MRC scale, plus Supraspinatus dynamometry)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <ROMField
            name="supraspinatusStrength"
            label="Supraspinatus Strength (Janda)"
            profileKey="supraspinatus-strength"
            value={formData.supraspinatusStrength}
            onChange={handleChange}
            unit=""
            helpText="Tested at the empty-can/Jobe position (scapular-plane abduction, internally rotated)."
          />
          <ROMField
            name="externalRotationStrength"
            label="External Rotation Strength (Janda)"
            profileKey="external-rotation-strength"
            value={formData.externalRotationStrength}
            onChange={handleChange}
            unit=""
          />
          <ROMField
            name="subscapularisStrength"
            label="Subscapularis Strength (Janda)"
            profileKey="subscapularis-strength"
            value={formData.subscapularisStrength}
            onChange={handleChange}
            unit=""
          />
          {/* ADR-0089: new sibling strength axes */}
          <ROMField
            name="internalRotationStrength"
            label="Internal Rotation Strength (Janda)"
            profileKey="internal-rotation-strength"
            value={formData.internalRotationStrength}
            onChange={handleChange}
            unit=""
          />
          <ROMField
            name="supraspinatusStrengthDynamometry"
            label="Supraspinatus Strength (Dynamometry)"
            profileKey="supraspinatus-strength-dynamometry"
            value={formData.supraspinatusStrengthDynamometry}
            onChange={handleChange}
            unit="kg"
            step="any"
            helpText="Same test position as the Janda grade above."
          />
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Provocation Tests</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'jobeTest', label: 'Jobe Test (Empty Can)', hint: 'Supraspinatus' },
            { name: 'liftOffTest', label: 'Lift-off Test (Gerber)', hint: 'Subscapularis' },
            { name: 'bellyPressTest', label: 'Belly Press Test', hint: 'Subscapularis' },
            { name: 'bearHugTest', label: 'Bear Hug Test', hint: 'Subscapularis' },
            { name: 'hornblowerTest', label: 'Hornblower Test', hint: 'Teres minor' },
          ].map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">{field.label}</label>
              <p className="text-xs text-gray-500 mb-1">{field.hint}</p>
              <select
                name={field.name}
                value={formData[field.name as keyof typeof formData]}
                onChange={handleChange}
                className="form-input"
              >
                {provocationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onSkip} className="btn btn-secondary">Skip this step</button>
          <button type="submit" className="btn btn-primary">
            Next: Outcome Scores →
          </button>
        </div>
      </div>
    </form>
  )
}

export default StepClinicalAssessment
