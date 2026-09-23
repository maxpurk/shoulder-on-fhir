import { useEffect } from 'react'
import type { Observation, WizardEntry } from '../../types/fhir'
import {
  OBSERVATION_CODES,
  OBSERVATION_CODINGS,
  PROFILE_URLS,
  OBSERVATION_PROFILE_URLS,
  VALUESET_URLS,
} from '../../types/fhir'
import { OBSERVATION_METADATA } from '../../config/observationMetadata'
import { useValueSet, type TermOption } from '../../hooks/useValueSet'
import { useQuantityBounds } from '../../hooks/useQuantityBounds'
import {
  computeConstantSubscores,
  derivePainItem2Points,
  bandRomDegrees,
  mapInternalRotationLadder,
  mapSleepToAdlPoints,
  parseFilled,
  isSubscoreComplete,
  PAIN_NORMAL_ACTIVITIES_OPTS,
  OCCUPATION_LIMIT_OPTS,
  LEISURE_LIMIT_OPTS,
  ARM_USE_OPTS,
  ER_POSITION_OPTS,
  type ScaleOption,
} from '../../lib/shared/constantScore'
import type { ClinicalAssessmentFormData, OutcomeScoresFormData, PatientFormData } from './stepFormData'

// ADR-0090: the four Constant-Murley component fields. Live-summed into
// `constantScore` whenever any is filled — the same semantics as the SDC
// Questionnaire's calculatedExpression, so both frontends behave identically.
const CONSTANT_COMPONENT_FIELDS = ['constantScorePain', 'constantScoreAdl', 'constantScoreRom', 'constantScoreStrength'] as const
const CONSTANT_COMPONENT_DEFS = [
  { key: 'constantScorePain', code: OBSERVATION_CODES.CONSTANT_SCORE_PAIN, label: 'Pain', max: 15 },
  { key: 'constantScoreAdl', code: OBSERVATION_CODES.CONSTANT_SCORE_ADL, label: 'Activities of Daily Living', max: 20 },
  { key: 'constantScoreRom', code: OBSERVATION_CODES.CONSTANT_SCORE_ROM, label: 'Range of Motion', max: 40 },
  { key: 'constantScoreStrength', code: OBSERVATION_CODES.CONSTANT_SCORE_STRENGTH, label: 'Strength', max: 25 },
] as const

interface StepOutcomeScoresProps {
  patientUuid: string
  encounterUuid: string
  // ADR-0156: aggregate/survey PROMs have no bodySite (ADR-0074) — focus
  // disambiguates which RotatorCuffCondition the score is about.
  conditionUuid: string
  value: OutcomeScoresFormData
  onChange: (next: OutcomeScoresFormData) => void
  // POOS-15 sub-item calculator inputs (see ../../lib/constantScore.ts) — the
  // granular exam/history data this Constant sub-item calculator derives from.
  assessment: ClinicalAssessmentFormData
  patient: PatientFormData
  // Lets this step edit the handful of Step 1/Step 4 answers the Constant-Murley
  // calculator depends on, in place, so a user who reaches this page and finds a
  // sub-score stuck at "not yet entered" can finish it here instead of paging
  // back — same shared form state either way, no duplication.
  onAssessmentChange: (next: ClinicalAssessmentFormData) => void
  onPatientChange: (next: PatientFormData) => void
  onComplete: (entries: WizardEntry[]) => void
  onSkip: () => void
  onBack: () => void
}

interface ScaleSelectProps {
  label: string
  name: keyof OutcomeScoresFormData
  value: string
  options: ScaleOption[]
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function ScaleSelect({ label, name, value, options, onChange }: ScaleSelectProps) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select name={name} value={value} onChange={onChange} className="form-input">
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label} ({o.points} pts)
          </option>
        ))}
      </select>
    </div>
  )
}

function ReferenceNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 mb-2">{children}</p>
}

// Editable stand-ins for what used to be read-only "go check Step N" text —
// same underlying Step 1/Step 4 field, so editing here updates that step too.
interface CrossStepNumberProps {
  label: string
  helpText?: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  hint?: string
}

function CrossStepNumberField({ label, helpText, value, onChange, min, max, step, unit, hint }: CrossStepNumberProps) {
  const placeholder = min !== undefined && max !== undefined ? `${min}–${max}` : ''
  return (
    <div className="form-group mb-2">
      <label className="form-label">{label} <span className="text-gray-400 font-normal">(shared field)</span></label>
      {helpText && <p className="text-xs text-gray-500 mb-1">{helpText}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="form-input"
          placeholder={placeholder}
        />
        {unit && <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{hint ?? 'Enter a value to include this in the sub-score.'}</p>
    </div>
  )
}

interface CrossStepSelectProps {
  label: string
  value: string
  options: TermOption[]
  onChange: (v: string) => void
  pointsFor: (code: string) => number | undefined
}

function CrossStepSelect({ label, value, options, onChange, pointsFor }: CrossStepSelectProps) {
  return (
    <div className="form-group mb-2">
      <label className="form-label">{label} <span className="text-gray-400 font-normal">(shared field)</span></label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input">
        <option value="">— not yet entered —</option>
        {options.map((o) => {
          const pts = pointsFor(o.code)
          return (
            <option key={o.code} value={o.code}>
              {o.display}
              {pts !== undefined ? ` (${pts} pts)` : ''}
            </option>
          )
        })}
      </select>
    </div>
  )
}

function partialFillHint(filled: number, total: number) {
  if (filled === 0 || filled === total) return null
  return (
    <p className="text-xs text-amber-600 mt-1">
      {filled} of {total} items entered — this sub-score stays blank until all {total} are filled.
    </p>
  )
}

function StepOutcomeScores({ patientUuid, encounterUuid, conditionUuid, value: formData, onChange, assessment, patient, onAssessmentChange, onPatientChange, onComplete, onSkip, onBack }: StepOutcomeScoresProps) {
  // Treat the scores fields as a sub-record for the rest of the handler that already
  // reads `scores.constantScore` etc. — avoids touching the resource-build logic.
  const scores = formData

  const { options: internalRotationOptions } = useValueSet(VALUESET_URLS.INTERNAL_ROTATION_VERTEBRAL_LEVEL)
  const { options: sleepDisturbanceOptions } = useValueSet(VALUESET_URLS.SLEEP_DISTURBANCE_SEVERITY)
  const { min: flexionMin, max: flexionMax } = useQuantityBounds(OBSERVATION_PROFILE_URLS['forward-flexion'])
  const { min: abductionMin, max: abductionMax } = useQuantityBounds(OBSERVATION_PROFILE_URLS['abduction'])

  const subscores = computeConstantSubscores(
    {
      painAverage: assessment.painAverage,
      sleepDisturbance: patient.sleepDisturbance,
      forwardFlexion: assessment.forwardFlexion,
      abduction: assessment.abduction,
      internalRotation: assessment.internalRotation,
    },
    {
      painNormalActivities: formData.constantPainNormalActivities,
      adlOccupation: formData.constantAdlOccupation,
      adlLeisure: formData.constantAdlLeisure,
      adlArmUse: formData.constantAdlArmUse,
      romExternalRotation: formData.constantRomExternalRotation,
      powerTest: formData.constantPowerTest,
    },
  )

  // ADR-0113/ADR-0118: the four Constant-Murley sub-scores and the total are
  // calculated, read-only outputs — never hand-typed. This effect
  // unconditionally mirrors the POOS-15 calculator's sub-item derivations
  // (auto-derived granular fields + the six manual sub-items above) into
  // form state. A sub-score is only written once ALL of its own contributing
  // sub-items are filled (isSubscoreComplete) — a partial sum/average is not
  // a valid POOS-15 sub-score, so it stays '' (blank) rather than showing a
  // half-computed number. The total is likewise only computed once ALL FOUR
  // sub-scores are complete — never as a sum of whichever sub-scores happen
  // to be present. Because every derive function in constantScore.ts clamps
  // its output (e.g. derivePowerPoints caps Strength at 25), the total can
  // never exceed 100 — closing the out-of-range corruption a manually-typed
  // sub-score previously allowed (e.g. typing 555 into Strength).
  useEffect(() => {
    const next = { ...formData }
    let changed = false
    const setSub = (key: (typeof CONSTANT_COMPONENT_FIELDS)[number], val: number | undefined) => {
      const str = val === undefined ? '' : String(val)
      if (next[key] !== str) {
        next[key] = str
        changed = true
      }
    }
    setSub('constantScorePain', isSubscoreComplete(subscores.pain) ? subscores.pain.value : undefined)
    setSub('constantScoreAdl', isSubscoreComplete(subscores.adl) ? subscores.adl.value : undefined)
    setSub('constantScoreRom', isSubscoreComplete(subscores.rom) ? subscores.rom.value : undefined)
    setSub('constantScoreStrength', isSubscoreComplete(subscores.strength) ? subscores.strength.value : undefined)

    const allComplete = [subscores.pain, subscores.adl, subscores.rom, subscores.strength].every(isSubscoreComplete)
    const total = allComplete
      ? String(
          (subscores.pain.value ?? 0) +
            (subscores.adl.value ?? 0) +
            (subscores.rom.value ?? 0) +
            (subscores.strength.value ?? 0),
        )
      : ''
    if (next.constantScore !== total) {
      next.constantScore = total
      changed = true
    }

    if (changed) onChange(next)
    // Depend on `.filled` too, not just `.value` — averageDefined()/sumDefined()
    // can produce the same numeric value both before and after a sub-score
    // transitions from partial to complete (e.g. Pain's two inputs averaging
    // to a value one of them alone already produced), which would otherwise
    // make React skip this effect and leave the sub-score/total silently
    // stuck unwritten despite isSubscoreComplete() now being true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subscores.pain.value,
    subscores.pain.filled,
    subscores.adl.value,
    subscores.adl.filled,
    subscores.rom.value,
    subscores.rom.filled,
    subscores.strength.value,
    subscores.strength.filled,
  ])

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value: fieldValue } = e.target
    onChange({ ...formData, [name]: fieldValue })
  }

  // Constant power test (kg) is the one manually-typed input feeding the
  // Strength sub-score. Clamped to [0, 50] on entry as data-entry hygiene —
  // not load-bearing for correctness, since derivePowerPoints() already
  // clamps its own output to 0–25 regardless of what's typed here.
  const handlePowerTestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange({ ...formData, constantPowerTest: '' })
      return
    }
    const n = Number(raw)
    if (Number.isNaN(n)) {
      onChange({ ...formData, constantPowerTest: raw })
      return
    }
    onChange({ ...formData, constantPowerTest: String(Math.min(50, Math.max(0, n))) })
  }

  const filledConstantComponents = CONSTANT_COMPONENT_FIELDS.filter((f) => formData[f] !== '').length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const effectiveDate = new Date().toISOString().split('T')[0]
    const encounterRef = { reference: `urn:uuid:${encounterUuid}` }
    // No bodySite: these are aggregate/survey scores with no physical target site
    // (laterality is conveyed by Condition/Encounter context, not a physical site element).

    // ADR-0183: the UCUM unit belongs to the profile — SSV and SANE are
    // percentages of a normal shoulder (#%), Constant-Murley is an arbitrary
    // {score}. Read it from the shared metadata map so a profile-side unit
    // change lands here too, instead of hardcoding one unit for all PROMs.
    const scoreQuantity = (profileKey: string, value: string) => {
      const unit = OBSERVATION_METADATA[profileKey]?.unit
      if (!unit) throw new Error(`Missing quantity metadata for PROM profile key: ${profileKey}`)
      return {
        value: parseFloat(value),
        unit: OBSERVATION_METADATA[profileKey]?.unitDisplay ?? unit,
        system: 'http://unitsofmeasure.org',
        code: unit,
      }
    }

    const makeScoreObservation = (profileKey: string, value: string): Observation => {
      const coding = OBSERVATION_CODINGS[profileKey]
      if (!coding) throw new Error(`Unknown PROM profile key: ${profileKey}`)
      return {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[profileKey] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
        code: { coding: [coding] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: encounterRef,
        effectiveDateTime: effectiveDate,
        valueQuantity: scoreQuantity(profileKey, value),
        focus: [{ reference: `urn:uuid:${conditionUuid}` }],
      }
    }

    // ADR-0090: Constant-Murley gains Observation.component[] for its four
    // sub-scores, present only when the corresponding form fields are
    // filled (component-derived entry mode) — absent for direct-total entry.
    const makeConstantScoreObservation = (): Observation => {
      const obs = makeScoreObservation(OBSERVATION_CODES.CONSTANT_SCORE, scores.constantScore)
      const components = CONSTANT_COMPONENT_DEFS
        .filter(({ key }) => scores[key])
        .map(({ key, code }) => ({
          code: { coding: [OBSERVATION_CODINGS[code]] },
          valueQuantity: { value: parseFloat(scores[key]), unit: 'points', system: 'http://unitsofmeasure.org', code: '{score}' },
        }))
      if (components.length > 0) obs.component = components
      return obs
    }

    const observations: Observation[] = []

    if (scores.constantScore) observations.push(makeConstantScoreObservation())
    if (scores.ssvScore) observations.push(makeScoreObservation(OBSERVATION_CODES.SSV_SCORE, scores.ssvScore))
    if (scores.saneScore) observations.push(makeScoreObservation(OBSERVATION_CODES.SANE_SCORE, scores.saneScore))

    if (observations.length === 0) {
      onSkip()
      return
    }

    onComplete(observations.map(resource => ({ uuid: crypto.randomUUID(), resource })))
  }

  const painAverageDeg = parseFilled(assessment.painAverage)
  const flexionDeg = parseFilled(assessment.forwardFlexion)
  const abductionDeg = parseFilled(assessment.abduction)

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Baseline Outcome Scores</h3>

        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          Leave fields empty to skip individual scores. Recorded here as a pre-operative baseline for
          later pre/post comparison — not outcome measures in their own right at this timepoint.
          Fields labeled <strong>(shared field)</strong> below are the same answer captured in Step 1 or
          Step 4 — editing one updates the other, so you can finish the Constant-Murley score entirely
          from this page without paging back.
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Composite Scores</h4>

        <div className="form-group mb-3">
          <label className="form-label">
            Constant-Murley Score (0–100) <span className="text-gray-400 font-normal">(calculated)</span>
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Higher = better function. Calculated automatically from the four sub-scores below.
          </p>
          <input
            type="number"
            inputMode="decimal"
            name="constantScore"
            value={scores.constantScore}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            min={0}
            max={100}
            step={1}
            className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
            placeholder="0–100"
          />
          {filledConstantComponents > 0 && filledConstantComponents < 4 && (
            <p className="text-xs text-amber-600 mt-1">
              {filledConstantComponents} of 4 sub-scores complete — the total stays blank until all four are
              filled. Still incomplete: {CONSTANT_COMPONENT_DEFS.filter((f) => formData[f.key] === '').map((f) => f.label).join(', ')}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 pl-4 border-l-2 border-gray-200">
          {/* Pain (0–15): average of a new categorical item + a rescale of the
              existing average-pain rating. Not a single-field derivation —
              see constantScore.ts for why (surgeon review). */}
          <div>
            <div className="form-group mb-2">
              <label className="form-label">
                Constant: Pain (0–{CONSTANT_COMPONENT_DEFS[0].max}) <span className="text-gray-400 font-normal">(calculated)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                name="constantScorePain"
                value={scores.constantScorePain}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                min={0}
                max={15}
                step={1}
                className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
                placeholder="0–15"
              />
              {partialFillHint(subscores.pain.filled, subscores.pain.total)}
            </div>
            <ScaleSelect
              label="Pain in normal activities"
              name="constantPainNormalActivities"
              value={formData.constantPainNormalActivities}
              options={PAIN_NORMAL_ACTIVITIES_OPTS}
              onChange={handleScoreChange}
            />
            <CrossStepNumberField
              label="Pain — On Average, this shoulder (0–10)"
              helpText="0 = no pain, 10 = worst pain imaginable. Same field as Step 4's Pain — On Average."
              value={assessment.painAverage}
              onChange={(v) => onAssessmentChange({ ...assessment, painAverage: v })}
              min={0}
              max={10}
              step={1}
              hint={painAverageDeg !== undefined ? `${painAverageDeg} / 10 → ${derivePainItem2Points(painAverageDeg)} pts` : undefined}
            />
          </div>

          {/* ADL (0–20): occupation + leisure + arm-use are new; sleep
              auto-derives from Step 1 (already designed to match this item). */}
          <div>
            <div className="form-group mb-2">
              <label className="form-label">
                Constant: Activities of Daily Living (0–{CONSTANT_COMPONENT_DEFS[1].max}) <span className="text-gray-400 font-normal">(calculated)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                name="constantScoreAdl"
                value={scores.constantScoreAdl}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                min={0}
                max={20}
                step={1}
                className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
                placeholder="0–20"
              />
              {partialFillHint(subscores.adl.filled, subscores.adl.total)}
            </div>
            <ScaleSelect
              label="Occupation / daily-living limitation"
              name="constantAdlOccupation"
              value={formData.constantAdlOccupation}
              options={OCCUPATION_LIMIT_OPTS}
              onChange={handleScoreChange}
            />
            <ScaleSelect
              label="Leisure / recreation limitation"
              name="constantAdlLeisure"
              value={formData.constantAdlLeisure}
              options={LEISURE_LIMIT_OPTS}
              onChange={handleScoreChange}
            />
            <CrossStepSelect
              label="Sleep Disturbance"
              value={patient.sleepDisturbance}
              options={sleepDisturbanceOptions}
              onChange={(v) => onPatientChange({ ...patient, sleepDisturbance: v })}
              pointsFor={mapSleepToAdlPoints}
            />
            <ScaleSelect
              label="Painless arm-use ceiling"
              name="constantAdlArmUse"
              value={formData.constantAdlArmUse}
              options={ARM_USE_OPTS}
              onChange={handleScoreChange}
            />
          </div>

          {/* ROM (0–40): flexion/abduction/internal rotation auto-derive from
              Step 4's Active ROM fields; external rotation is new (Constant's
              cumulative functional-position test differs from our at-side
              goniometer measurement). */}
          <div>
            <div className="form-group mb-2">
              <label className="form-label">
                Constant: Range of Motion (0–{CONSTANT_COMPONENT_DEFS[2].max}) <span className="text-gray-400 font-normal">(calculated)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                name="constantScoreRom"
                value={scores.constantScoreRom}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                min={0}
                max={40}
                step={1}
                className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
                placeholder="0–40"
              />
              {partialFillHint(subscores.rom.filled, subscores.rom.total)}
            </div>
            <CrossStepNumberField
              label="Forward Flexion, active"
              value={assessment.forwardFlexion}
              onChange={(v) => onAssessmentChange({ ...assessment, forwardFlexion: v })}
              min={flexionMin}
              max={flexionMax}
              unit="°"
              hint={flexionDeg !== undefined ? `${flexionDeg}° → ${bandRomDegrees(flexionDeg)} pts` : undefined}
            />
            <CrossStepNumberField
              label="Abduction, active"
              value={assessment.abduction}
              onChange={(v) => onAssessmentChange({ ...assessment, abduction: v })}
              min={abductionMin}
              max={abductionMax}
              unit="°"
              hint={abductionDeg !== undefined ? `${abductionDeg}° → ${bandRomDegrees(abductionDeg)} pts` : undefined}
            />
            <ScaleSelect
              label="External rotation (functional position)"
              name="constantRomExternalRotation"
              value={formData.constantRomExternalRotation}
              options={ER_POSITION_OPTS}
              onChange={handleScoreChange}
            />
            <CrossStepSelect
              label="Internal Rotation, active, hand behind back"
              value={assessment.internalRotation}
              options={internalRotationOptions}
              onChange={(v) => onAssessmentChange({ ...assessment, internalRotation: v })}
              pointsFor={mapInternalRotationLadder}
            />
          </div>

          {/* Strength/Power (0–25): a dedicated Constant power test, distinct
              from the supraspinatus-isolated dynamometry captured in Step 4
              (different test position/muscle target — surgeon review). */}
          <div>
            <div className="form-group mb-2">
              <label className="form-label">
                Constant: Strength (0–{CONSTANT_COMPONENT_DEFS[3].max}) <span className="text-gray-400 font-normal">(calculated)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                name="constantScoreStrength"
                value={scores.constantScoreStrength}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                min={0}
                max={25}
                step={1}
                className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
                placeholder="0–25"
              />
              {partialFillHint(subscores.strength.filled, subscores.strength.total)}
            </div>
            <div className="form-group">
              <label className="form-label">Constant power test (kg)</label>
              <p className="text-xs text-gray-500 mb-1">
                Resisted abduction at 90° in the scapular plane, neutral rotation — average of up to 5 pulls.
                Distinct from the supraspinatus-isolated dynamometry in Step 4 (different test position/muscle target).
              </p>
              <input
                type="number"
                inputMode="decimal"
                name="constantPowerTest"
                value={formData.constantPowerTest}
                onChange={handlePowerTestChange}
                min={0}
                max={50}
                step="any"
                className="form-input"
                placeholder="kg"
              />
            </div>
            {assessment.supraspinatusStrengthDynamometry && (
              <ReferenceNote>
                For reference only (different test, not used here): Supraspinatus Dynamometry (Step 4) ={' '}
                {assessment.supraspinatusStrengthDynamometry} kg.
              </ReferenceNote>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">SSV (0–100%)</label>
            <p className="text-xs text-gray-500 mb-1">Subjective Shoulder Value — patient self-rating.</p>
            <input type="number" inputMode="decimal" name="ssvScore" value={scores.ssvScore} onChange={handleScoreChange} min={0} max={100} className="form-input" placeholder="0–100" />
          </div>
          <div className="form-group">
            <label className="form-label">SANE Score (0–100%)</label>
            <p className="text-xs text-gray-500 mb-1">Single Assessment Numeric Evaluation.</p>
            <input type="number" inputMode="decimal" name="saneScore" value={scores.saneScore} onChange={handleScoreChange} min={0} max={100} className="form-input" placeholder="0–100" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onSkip} className="btn btn-secondary">Skip this step</button>
          <button type="submit" className="btn btn-primary">
            Next: Summary →
          </button>
        </div>
      </div>
    </form>
  )
}

export default StepOutcomeScores
