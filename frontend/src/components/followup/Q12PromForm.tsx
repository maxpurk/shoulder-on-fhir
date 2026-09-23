import { useEffect } from 'react'
import { GROUP_LABELS, Q12_FIELDS, type ObservationGroup } from '../../config/followupObservationMetadata'
import ObservationField, { type FieldValue } from './ObservationField'
import type { Q9FormState } from './Q9ExamForm'
import { VALUESET_URLS, OBSERVATION_PROFILE_URLS } from '../../types/fhir'
import { useValueSet, type TermOption } from '../../hooks/useValueSet'
import { useQuantityBounds } from '../../hooks/useQuantityBounds'
import {
  computeConstantSubscores,
  derivePainItem2Points,
  bandRomDegrees,
  mapInternalRotationLadder,
  parseFilled,
  isSubscoreComplete,
  PAIN_NORMAL_ACTIVITIES_OPTS,
  OCCUPATION_LIMIT_OPTS,
  LEISURE_LIMIT_OPTS,
  ARM_USE_OPTS,
  ER_POSITION_OPTS,
  SLEEP_DISTURBANCE_OPTS,
  type ScaleOption,
} from '../../lib/shared/constantScore'

export type Q12FormState = Record<string, FieldValue>

interface Props {
  state: Q12FormState
  onChange: (next: Q12FormState) => void
  /** Already-entered Step 3 (Post-op Exam) values — feeds the POOS-15
   * sub-item calculator below for the Range-of-Motion sub-items (Flexion,
   * Abduction, Internal Rotation auto-derive from here; External Rotation
   * does not — see constantScore.ts). */
  q9State: Q9FormState
  /** Lets the ROM sub-score block edit the Step 3 fields it depends on in
   * place, so a sub-score stuck at "not yet entered" can be finished here
   * instead of paging back to Step 3 — same shared state either way. */
  onQ9Change: (next: Q9FormState) => void
}

const GROUP_ORDER: ObservationGroup[] = ['prom-score', 'prom-coded']

function fieldNumber(v: FieldValue): number | undefined {
  return v?.kind === 'quantity' ? v.value : undefined
}

function fieldCode(v: FieldValue): string | undefined {
  return v?.kind === 'coded' ? v.coding.code : undefined
}

function fieldString(v: FieldValue): string | undefined {
  return v?.kind === 'string' ? v.value : undefined
}

function numToStr(n: number | undefined): string {
  return n === undefined ? '' : String(n)
}

// ADR-0090: the four Constant-Murley component keys, rendered as a bespoke
// block (not the generic per-field loop) so filling them can live-auto-calc
// the total — mirrors StepOutcomeScores.tsx's Registration-side behavior and
// the SDC Questionnaire's calculatedExpression.
const CONSTANT_COMPONENT_DEFS = [
  { key: 'constant-score-pain', label: 'Pain', max: 15 },
  { key: 'constant-score-adl', label: 'Activities of Daily Living', max: 20 },
  { key: 'constant-score-rom', label: 'Range of Motion', max: 40 },
  { key: 'constant-score-strength', label: 'Strength', max: 25 },
] as const

// POOS-15 sub-item calculator inputs (see ../../lib/constantScore.ts) — UI-only
// keys, never registered in Q12_FIELDS, so the generic per-field loop and
// buildObservationsFromState (FollowUpWizard.tsx) both skip them automatically.
// Follow-Up captures none of sleep/occupation/leisure/arm-use and has no
// dedicated Constant power test, so — unlike Registration, which auto-derives
// sleep from Step 1 — B1/B2/B3/B4, C3, and D are all manual here.
const CALC_KEYS = {
  painNormalActivities: 'constant-pain-normal-activities',
  adlOccupation: 'constant-adl-occupation',
  adlLeisure: 'constant-adl-leisure',
  adlSleep: 'constant-adl-sleep',
  adlArmUse: 'constant-adl-arm-use',
  romExternalRotation: 'constant-rom-external-rotation',
  powerTest: 'constant-power-test',
} as const

function partialFillHint(filled: number, total: number) {
  if (filled === 0 || filled === total) return null
  return (
    <p className="text-xs text-amber-600 mt-1">
      {filled} of {total} items entered — this sub-score stays blank until all {total} are filled.
    </p>
  )
}

interface ScaleSelectProps {
  label: string
  fieldKey: string
  value: string
  options: ScaleOption[]
  onChange: (code: string) => void
}

function ScaleSelect({ label, fieldKey, value, options, onChange }: ScaleSelectProps) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={`field-${fieldKey}`}>{label}</label>
      <select
        id={`field-${fieldKey}`}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
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

function fieldValueNumber(v: FieldValue): number | undefined {
  return v?.kind === 'quantity' ? v.value : undefined
}

function fieldValueCode(v: FieldValue): string | undefined {
  return v?.kind === 'coded' ? v.coding.code : undefined
}

// Editable stand-ins for what used to be read-only "go check Step 3" text —
// same q9State field, so editing here updates Step 3 (Q9ExamForm) too.
interface CrossStepQ9NumberProps {
  label: string
  fieldKey: string
  q9State: Q9FormState
  onQ9Change: (next: Q9FormState) => void
  min?: number
  max?: number
  unit?: string
  hint?: string
}

function CrossStepQ9NumberField({ label, fieldKey, q9State, onQ9Change, min, max, unit, hint }: CrossStepQ9NumberProps) {
  const current = fieldValueNumber(q9State[fieldKey])
  const placeholder = min !== undefined && max !== undefined ? `${min}–${max}` : ''
  return (
    <div className="form-group mb-2">
      <label className="form-label">{label} <span className="text-gray-400 font-normal">(shared field)</span></label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={current ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            const next = { ...q9State }
            if (raw === '') {
              delete next[fieldKey]
            } else {
              const n = Number(raw)
              if (Number.isNaN(n)) return
              next[fieldKey] = { kind: 'quantity', value: n }
            }
            onQ9Change(next)
          }}
          min={min}
          max={max}
          className="form-input"
          placeholder={placeholder}
        />
        {unit && <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{hint ?? 'Enter a value to include this in the sub-score.'}</p>
    </div>
  )
}

interface CrossStepQ9SelectProps {
  label: string
  fieldKey: string
  q9State: Q9FormState
  onQ9Change: (next: Q9FormState) => void
  options: TermOption[]
  pointsFor: (code: string) => number | undefined
}

function CrossStepQ9Select({ label, fieldKey, q9State, onQ9Change, options, pointsFor }: CrossStepQ9SelectProps) {
  const current = fieldValueCode(q9State[fieldKey]) ?? ''
  return (
    <div className="form-group mb-2">
      <label className="form-label">{label} <span className="text-gray-400 font-normal">(shared field)</span></label>
      <select
        value={current}
        onChange={(e) => {
          const code = e.target.value
          const next = { ...q9State }
          if (code === '') {
            delete next[fieldKey]
          } else {
            const picked = options.find((o) => o.code === code)
            if (!picked) return
            next[fieldKey] = { kind: 'coded', coding: { system: picked.system, code: picked.code, display: picked.display } }
          }
          onQ9Change(next)
        }}
        className="form-input"
      >
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

function ConstantMurleyFields({ state, onChange, q9State, onQ9Change }: Props) {
  const totalMeta = Q12_FIELDS['constant-score']
  const { options: internalRotationOptions } = useValueSet(VALUESET_URLS.INTERNAL_ROTATION_VERTEBRAL_LEVEL)
  const { min: flexionMin, max: flexionMax } = useQuantityBounds(OBSERVATION_PROFILE_URLS['forward-flexion'])
  const { min: abductionMin, max: abductionMax } = useQuantityBounds(OBSERVATION_PROFILE_URLS['abduction'])

  function setField(key: string, value: FieldValue) {
    const next = { ...state }
    if (value === undefined) delete next[key]
    else next[key] = value
    onChange(next)
  }

  const setCalcSelect = (key: string) => (code: string) => setField(key, code === '' ? undefined : { kind: 'string', value: code })

  const painAverage = numToStr(fieldNumber(state['pain-average']))
  const flexionDeg = fieldNumber(q9State['forward-flexion'])
  const abductionDeg = fieldNumber(q9State['abduction'])
  const internalRotationCode = fieldCode(q9State['internal-rotation']) ?? ''

  const subscores = computeConstantSubscores(
    {
      painAverage,
      sleepDisturbance: fieldString(state[CALC_KEYS.adlSleep]) ?? '',
      forwardFlexion: numToStr(flexionDeg),
      abduction: numToStr(abductionDeg),
      internalRotation: internalRotationCode,
    },
    {
      painNormalActivities: fieldString(state[CALC_KEYS.painNormalActivities]) ?? '',
      adlOccupation: fieldString(state[CALC_KEYS.adlOccupation]) ?? '',
      adlLeisure: fieldString(state[CALC_KEYS.adlLeisure]) ?? '',
      adlArmUse: fieldString(state[CALC_KEYS.adlArmUse]) ?? '',
      romExternalRotation: fieldString(state[CALC_KEYS.romExternalRotation]) ?? '',
      powerTest: numToStr(fieldNumber(state[CALC_KEYS.powerTest])),
    },
  )

  // ADR-0113/ADR-0118: the four Constant-Murley sub-scores and the total are
  // calculated, read-only outputs — never hand-typed. This effect
  // unconditionally mirrors the POOS-15 calculator's sub-item derivations
  // into form state — including changes made OUTSIDE this component (e.g.
  // `pain-average` and Step 3's ROM fields are edited via the generic
  // ObservationField loop / Q9ExamForm respectively, not via a handler
  // here). A sub-score is only written once ALL of its own contributing
  // sub-items are filled (isSubscoreComplete) — a partial sum/average is not
  // a valid POOS-15 sub-score, so it is cleared rather than shown half-
  // computed. The total is likewise only computed once ALL FOUR sub-scores
  // are complete — never as a sum of whichever sub-scores happen to be
  // present. Because every derive function in constantScore.ts clamps its
  // output (e.g. derivePowerPoints caps Strength at 25), the total can never
  // exceed 100 — closing the out-of-range corruption a manually-typed
  // sub-score previously allowed.
  useEffect(() => {
    const next: Q12FormState = { ...state }
    let changed = false
    const setSub = (key: string, val: number | undefined) => {
      if (val === undefined) {
        if (key in next) {
          delete next[key]
          changed = true
        }
      } else if (fieldNumber(next[key]) !== val) {
        next[key] = { kind: 'quantity', value: val }
        changed = true
      }
    }
    setSub('constant-score-pain', isSubscoreComplete(subscores.pain) ? subscores.pain.value : undefined)
    setSub('constant-score-adl', isSubscoreComplete(subscores.adl) ? subscores.adl.value : undefined)
    setSub('constant-score-rom', isSubscoreComplete(subscores.rom) ? subscores.rom.value : undefined)
    setSub('constant-score-strength', isSubscoreComplete(subscores.strength) ? subscores.strength.value : undefined)

    const allComplete = [subscores.pain, subscores.adl, subscores.rom, subscores.strength].every(isSubscoreComplete)
    if (allComplete) {
      const total =
        (subscores.pain.value ?? 0) +
        (subscores.adl.value ?? 0) +
        (subscores.rom.value ?? 0) +
        (subscores.strength.value ?? 0)
      if (fieldNumber(next['constant-score']) !== total) {
        next['constant-score'] = { kind: 'quantity', value: total }
        changed = true
      }
    } else if ('constant-score' in next) {
      delete next['constant-score']
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

  const filledCount = CONSTANT_COMPONENT_DEFS.filter(({ key }) => fieldNumber(state[key]) !== undefined).length

  return (
    <div className="mb-4 md:col-span-2">
      <div className="form-group mb-2">
        <label className="form-label" htmlFor="field-constant-score">
          {totalMeta.label} ({totalMeta.min}–{totalMeta.max}) <span className="text-gray-400 font-normal">(calculated)</span>
        </label>
        {totalMeta.helpText && <p className="text-xs text-gray-500 mb-1">{totalMeta.helpText}</p>}
        <input
          id="field-constant-score"
          type="number"
          inputMode="decimal"
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
          min={totalMeta.min}
          max={totalMeta.max}
          step={1}
          value={fieldNumber(state['constant-score']) ?? ''}
        />
        {filledCount > 0 && filledCount < 4 && (
          <p className="text-xs text-amber-600 mt-1">
            {filledCount} of 4 sub-scores complete — the total stays blank until all four are filled. Still
            incomplete: {CONSTANT_COMPONENT_DEFS.filter(({ key }) => fieldNumber(state[key]) === undefined).map((c) => c.label).join(', ')}.
            {' '}If a contributing field (e.g. an active ROM item) was marked N/A, this score cannot be captured for this visit.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 pl-4 border-l-2 border-gray-200">
        {/* Pain (0–15): average of a new categorical item + a rescale of the
            existing pain-average rating (item 2 proxy only — see constantScore.ts). */}
        <div>
          <div className="form-group mb-2">
            <label className="form-label" htmlFor="field-constant-score-pain">
              Constant: Pain (0–15) <span className="text-gray-400 font-normal">(calculated)</span>
            </label>
            <input
              id="field-constant-score-pain"
              type="number"
              inputMode="decimal"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
              min={0}
              max={15}
              step={1}
              value={fieldNumber(state['constant-score-pain']) ?? ''}
            />
            {partialFillHint(subscores.pain.filled, subscores.pain.total)}
          </div>
          <ScaleSelect
            label="Pain in normal activities"
            fieldKey={CALC_KEYS.painNormalActivities}
            value={fieldString(state[CALC_KEYS.painNormalActivities]) ?? ''}
            options={PAIN_NORMAL_ACTIVITIES_OPTS}
            onChange={setCalcSelect(CALC_KEYS.painNormalActivities)}
          />
          <ReferenceNote>
            Pain — On Average (this visit):{' '}
            {parseFilled(painAverage) !== undefined
              ? `${painAverage} / 10 → ${derivePainItem2Points(Number(painAverage))} pts`
              : 'not yet entered'}
          </ReferenceNote>
        </div>

        {/* ADL (0–20): all four items are manual — Follow-Up captures no
            sleep/occupation/leisure/arm-use axis to auto-derive from. */}
        <div>
          <div className="form-group mb-2">
            <label className="form-label" htmlFor="field-constant-score-adl">
              Constant: Activities of Daily Living (0–20) <span className="text-gray-400 font-normal">(calculated)</span>
            </label>
            <input
              id="field-constant-score-adl"
              type="number"
              inputMode="decimal"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
              min={0}
              max={20}
              step={1}
              value={fieldNumber(state['constant-score-adl']) ?? ''}
            />
            {partialFillHint(subscores.adl.filled, subscores.adl.total)}
          </div>
          <ScaleSelect
            label="Occupation / daily-living limitation"
            fieldKey={CALC_KEYS.adlOccupation}
            value={fieldString(state[CALC_KEYS.adlOccupation]) ?? ''}
            options={OCCUPATION_LIMIT_OPTS}
            onChange={setCalcSelect(CALC_KEYS.adlOccupation)}
          />
          <ScaleSelect
            label="Leisure / recreation limitation"
            fieldKey={CALC_KEYS.adlLeisure}
            value={fieldString(state[CALC_KEYS.adlLeisure]) ?? ''}
            options={LEISURE_LIMIT_OPTS}
            onChange={setCalcSelect(CALC_KEYS.adlLeisure)}
          />
          <ScaleSelect
            label="Sleep disturbance"
            fieldKey={CALC_KEYS.adlSleep}
            value={fieldString(state[CALC_KEYS.adlSleep]) ?? ''}
            options={SLEEP_DISTURBANCE_OPTS}
            onChange={setCalcSelect(CALC_KEYS.adlSleep)}
          />
          <ScaleSelect
            label="Painless arm-use ceiling"
            fieldKey={CALC_KEYS.adlArmUse}
            value={fieldString(state[CALC_KEYS.adlArmUse]) ?? ''}
            options={ARM_USE_OPTS}
            onChange={setCalcSelect(CALC_KEYS.adlArmUse)}
          />
        </div>

        {/* ROM (0–40): flexion/abduction/internal rotation auto-derive from
            Step 3's Active ROM fields; external rotation is new/manual. */}
        <div>
          <div className="form-group mb-2">
            <label className="form-label" htmlFor="field-constant-score-rom">
              Constant: Range of Motion (0–40) <span className="text-gray-400 font-normal">(calculated)</span>
            </label>
            <input
              id="field-constant-score-rom"
              type="number"
              inputMode="decimal"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
              min={0}
              max={40}
              step={1}
              value={fieldNumber(state['constant-score-rom']) ?? ''}
            />
            {partialFillHint(subscores.rom.filled, subscores.rom.total)}
          </div>
          <CrossStepQ9NumberField
            label="Forward Flexion, active"
            fieldKey="forward-flexion"
            q9State={q9State}
            onQ9Change={onQ9Change}
            min={flexionMin}
            max={flexionMax}
            unit="°"
            hint={flexionDeg !== undefined ? `${flexionDeg}° → ${bandRomDegrees(flexionDeg)} pts` : undefined}
          />
          <CrossStepQ9NumberField
            label="Abduction, active"
            fieldKey="abduction"
            q9State={q9State}
            onQ9Change={onQ9Change}
            min={abductionMin}
            max={abductionMax}
            unit="°"
            hint={abductionDeg !== undefined ? `${abductionDeg}° → ${bandRomDegrees(abductionDeg)} pts` : undefined}
          />
          <ScaleSelect
            label="External rotation (functional position)"
            fieldKey={CALC_KEYS.romExternalRotation}
            value={fieldString(state[CALC_KEYS.romExternalRotation]) ?? ''}
            options={ER_POSITION_OPTS}
            onChange={setCalcSelect(CALC_KEYS.romExternalRotation)}
          />
          <CrossStepQ9Select
            label="Internal Rotation, active, hand behind back"
            fieldKey="internal-rotation"
            q9State={q9State}
            onQ9Change={onQ9Change}
            options={internalRotationOptions}
            pointsFor={mapInternalRotationLadder}
          />
        </div>

        {/* Strength/Power (0–25): a dedicated Constant power test, distinct
            from the supraspinatus-isolated dynamometry captured in Step 3
            (different test position/muscle target — surgeon review). */}
        <div>
          <div className="form-group mb-2">
            <label className="form-label" htmlFor="field-constant-score-strength">
              Constant: Strength (0–25) <span className="text-gray-400 font-normal">(calculated)</span>
            </label>
            <input
              id="field-constant-score-strength"
              type="number"
              inputMode="decimal"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              className="form-input bg-gray-100 text-gray-600 cursor-not-allowed"
              min={0}
              max={25}
              step={1}
              value={fieldNumber(state['constant-score-strength']) ?? ''}
            />
            {partialFillHint(subscores.strength.filled, subscores.strength.total)}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`field-${CALC_KEYS.powerTest}`}>Constant power test (kg)</label>
            <p className="text-xs text-gray-500 mb-1">
              Resisted abduction at 90° in the scapular plane, neutral rotation — average of up to 5 pulls.
              Distinct from the supraspinatus-isolated dynamometry in Step 3 (different test position/muscle target).
            </p>
            <input
              id={`field-${CALC_KEYS.powerTest}`}
              type="number"
              inputMode="decimal"
              className="form-input"
              min={0}
              max={50}
              step="any"
              value={fieldNumber(state[CALC_KEYS.powerTest]) ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setField(CALC_KEYS.powerTest, undefined)
                  return
                }
                const n = Number(raw)
                if (Number.isNaN(n)) return
                setField(CALC_KEYS.powerTest, { kind: 'quantity', value: Math.min(50, Math.max(0, n)) })
              }}
              placeholder="kg"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Q12PromForm({ state, onChange, q9State, onQ9Change }: Props) {
  function setField(key: string, value: FieldValue) {
    const next = { ...state }
    if (value === undefined) delete next[key]
    else next[key] = value
    onChange(next)
  }

  const CONSTANT_KEYS = new Set(['constant-score', ...CONSTANT_COMPONENT_DEFS.map((c) => c.key)])

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    fields: Object.entries(Q12_FIELDS).filter(([key, m]) => m.group === g && !CONSTANT_KEYS.has(key)),
  })).filter((b) => b.fields.length > 0)

  return (
    <div className="card">
      <h2 className="card-header">Step 4 — Outcome Scores</h2>
      <p className="text-sm text-gray-600 mb-4">
        Constant-Murley and SSV / SANE are the preferred outcome scores. Pain is captured as
        4 context-specific axes (average / active movement / passive movement / rest), matching
        the pre-op baseline pain fields. Fields labeled <strong>(shared field)</strong> below are the
        same ROM answers captured in Step 3 — editing one updates the other, so you can finish the
        Constant-Murley score entirely from this page without paging back.
      </p>
      <fieldset className="mb-6">
        <legend className="text-sm font-semibold text-gray-700 mb-2">{GROUP_LABELS['prom-score']}</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <ConstantMurleyFields state={state} onChange={onChange} q9State={q9State} onQ9Change={onQ9Change} />
          {grouped
            .find((b) => b.group === 'prom-score')
            ?.fields.map(([key, meta]) => (
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
      {grouped
        .filter((b) => b.group !== 'prom-score')
        .map((block) => (
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

export default Q12PromForm
