/**
 * QuestionnaireForm
 *
 * Renders a FHIR Questionnaire as an HTML form. Flow-agnostic — receives
 * a Questionnaire + flow tag + onSubmit callback. On submit it builds a
 * QuestionnaireResponse from form state and hands it to the parent (FlowPage)
 * which runs extraction + bundle assembly + submission.
 *
 * SDC features handled by this component:
 *   - Dynamic dropdowns via answerValueSet (loaded through useValueSet hook).
 *   - calculatedExpression: items carrying the SDC calculatedExpression
 *     extension have their value computed live from a FHIRPath expression,
 *     evaluated with the real `fhirpath` package (lib/calculatedExpression.ts)
 *     against a QuestionnaireResponse built from the current form state — the
 *     same way standard SDC engines (LForms) and HAPI $extract evaluate it.
 *     Read-only numeric targets (the Constant-Murley total) reflect into
 *     formState; a hidden Coding target (prior-treatment laterality →
 *     Procedure.bodySite) is derived per repeating-group instance into the
 *     submitted QR (see ADR-0171/ADR-0090/ADR-0100/ADR-0118).
 *   - initial.valueCoding: default values for choice items.
 *   - itemPopulationContext / initialExpression: FlowPage resolves these via
 *     lib/populationContext.ts and passes the result in as `initialOverrides`
 *     (linkId → display string), merged into formState here. This drives a
 *     read-only confirmation field only — it is not the source of truth for
 *     any cross-resource reference in the submitted bundle (that stays
 *     LaunchContext-driven in bundleAssembler.ts; see ADR-0100).
 */

import { useState, useMemo, useEffect } from 'react'
import { useValueSet } from '../hooks/useValueSet'
import type { TermOption } from '../hooks/useValueSet'
import type {
  QuestionnaireItem,
  Questionnaire,
  QuestionnaireResponse,
  TransactionResponseBundle,
  Condition,
} from '../types/fhir'
import { buildQuestionnaireResponse } from '../lib/extractor'
import { FhirError } from '../lib/fhirClient'
import type { FlowType } from './FlowPage'
import SnomedTypeahead from './SnomedTypeahead'
import { computeConstantSubscores, isSubscoreComplete } from '../lib/shared/constantScore'
import { dependencyLinkIdsOf, evaluateCalc } from '../lib/calculatedExpression'
import type { FhirResourceLike } from '../lib/populationContext'

// Client-side exclusion blocklist for the comorbidity typeahead (ADR-0084,
// ported verbatim from the unified frontend's identical constant) —
// shoulder-region disorders belong on RotatorCuffCondition /
// ShoulderDiagnosisCondition, not as a "comorbidity". Hardcoded to the one
// linkId that needs it (obs.comorbidities) rather than derived from the
// Questionnaire — FSH has no generic "exclusion VS" extension mechanism,
// same tradeoff already accepted for Coverage/RSG elsewhere in this port.
const COMORBIDITY_LINK_ID = 'obs.comorbidities'
const SHOULDER_REGION_DISORDERS_EXCLUSION_VS = [
  'http://snomed.info/sct?fhir_vs=isa/118944007',
  'http://snomed.info/sct?fhir_vs=isa/239960007',
  'http://snomed.info/sct?fhir_vs=isa/359532006',
]

const SDC_CALC_EXPR = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
const MAX_VALUE_EXT = 'http://hl7.org/fhir/StructureDefinition/maxValue'
const QUESTIONNAIRE_HIDDEN = 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden'

// A questionnaire-hidden item is not rendered. Its value (when any) is supplied
// by other means — e.g. the prior-treatment laterality is derived from the
// Diagnosis answer via calculatedExpression (see the calc effect below) rather
// than re-asked, and flows into the submitted QR through calcCodingState.
function isHiddenItem(item: QuestionnaireItem): boolean {
  return (item.extension ?? []).some(
    (e) => e.url === QUESTIONNAIRE_HIDDEN && (e as { valueBoolean?: boolean }).valueBoolean === true,
  )
}

// "Not applicable / not possible" (ADR-0147, parity port of the unified
// frontend's per-field N/A checkbox, ADR-0109) — offered only for the
// Follow-Up post-op exam items a surgeon might genuinely be unable to
// perform this soon after surgery (ROM active/passive, strength,
// provocation), same scoping unified's NOT_DONE_GROUPS uses. Hardcoded by
// linkId rather than derived from the Questionnaire — this is a UI-only
// policy list, not clinical data, same tradeoff already accepted for the
// Coverage/RSG/Comorbidities "loose leaf" exceptions in extractor.ts.
const NOT_DONE_ELIGIBLE_LINK_IDS = new Set([
  'obs.abduction', 'obs.forward-flexion', 'obs.external-rotation', 'obs.internal-rotation',
  'obs.external-rotation-90-abduction', 'obs.internal-rotation-90-abduction',
  'obs.passive-abduction', 'obs.passive-forward-flexion', 'obs.passive-external-rotation',
  'obs.passive-internal-rotation', 'obs.passive-external-rotation-90-abduction',
  'obs.passive-internal-rotation-90-abduction',
  'obs.supraspinatus-strength', 'obs.external-rotation-strength', 'obs.internal-rotation-strength',
  'obs.subscapularis-strength', 'obs.supraspinatus-strength-dynamometry',
  'obs.jobe-test', 'obs.lift-off-test', 'obs.belly-press-test',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectValueSetUrls(items: QuestionnaireItem[]): string[] {
  const urls: string[] = []
  for (const item of items) {
    // `open-choice` items (e.g. the comorbidity picker) are always rendered
    // by SnomedTypeahead, which fetches its own filtered results via
    // searchValueSet — never via this bounded preloader's valueSetOptions.
    // Their answerValueSet (e.g. isa/404684003, SNOMED Clinical finding, tens
    // of thousands of concepts) must never be bulk-expanded here: HAPI can't
    // resolve a SNOMED implicit ValueSet locally (only tx.fhir.org, via
    // searchValueSet's own routing, can), so including it produced a
    // guaranteed-failing, and even on success discarded, ValueSetLoader fetch.
    if (item.answerValueSet && item.type !== 'open-choice') urls.push(item.answerValueSet)
    if (item.item) urls.push(...collectValueSetUrls(item.item))
  }
  return [...new Set(urls)]
}

function collectAnswerOptions(items: QuestionnaireItem[]): Record<string, Array<{ code: string; display: string; system: string }>> {
  const result: Record<string, Array<{ code: string; display: string; system: string }>> = {}
  for (const item of items) {
    if (item.answerOption) {
      result[item.linkId] = item.answerOption
        .map((o) => {
          if (o.valueCoding?.code) {
            return { code: o.valueCoding.code, display: o.valueCoding.display ?? o.valueCoding.code, system: o.valueCoding.system ?? '' }
          }
          // Plain-string answerOption (e.g. Q11 Follow-Up Timepoint) — no
          // Coding involved, so the string itself doubles as the option's code.
          if (o.valueString !== undefined) {
            return { code: o.valueString, display: o.valueString, system: '' }
          }
          return undefined
        })
        .filter((o): o is { code: string; display: string; system: string } => o !== undefined)
    }
    if (item.item) Object.assign(result, collectAnswerOptions(item.item))
  }
  return result
}

function collectInitialDefaults(items: QuestionnaireItem[]): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const item of items) {
    const initial = item.initial?.[0]
    if (initial?.valueCoding?.code) defaults[item.linkId] = initial.valueCoding.code
    else if (initial?.valueString !== undefined) defaults[item.linkId] = initial.valueString
    else if (initial?.valueBoolean !== undefined) defaults[item.linkId] = String(initial.valueBoolean)
    else if (initial?.valueDecimal !== undefined) defaults[item.linkId] = String(initial.valueDecimal)
    else if (initial?.valueDate !== undefined) defaults[item.linkId] = initial.valueDate
    if (item.item) Object.assign(defaults, collectInitialDefaults(item.item))
  }
  return defaults
}

function calculatedExpressionOf(item: QuestionnaireItem): string | undefined {
  const ext = (item.extension ?? []).find((e) => e.url === SDC_CALC_EXPR)
  if (!ext) return undefined
  const expr = ext as unknown as { valueExpression?: { expression?: string } }
  return expr.valueExpression?.expression
}

/**
 * A calculatedExpression target: the item, its expression, and — when the
 * item lives inside a repeating top-level group — that group's linkId, so the
 * calc effect can derive the value per instance (suffixed state keys). The
 * actual evaluation is done by lib/calculatedExpression.ts with real fhirpath;
 * this only locates the targets (ADR-0090/ADR-0100/ADR-0171).
 */
interface CalcTarget {
  item: QuestionnaireItem
  expression: string
  /** linkId of the nearest repeating ancestor group, or undefined if none. */
  repeatingGroupLinkId?: string
}

function findCalcTargets(items: QuestionnaireItem[], repeatingAncestor?: string): CalcTarget[] {
  const out: CalcTarget[] = []
  for (const item of items) {
    const expression = calculatedExpressionOf(item)
    if (expression) out.push({ item, expression, repeatingGroupLinkId: repeatingAncestor })
    if (item.item) {
      const nextAncestor = item.repeats ? item.linkId : repeatingAncestor
      out.push(...findCalcTargets(item.item, nextAncestor))
    }
  }
  return out
}

/**
 * Whether the Nth instance of a repeating group already carries a real
 * (non-derived) answer — i.e. the user has actually started this repetition.
 * Mirrors buildGroupItems' own emit condition (a value in formState /
 * multiFormState / typeaheadState at the suffixed key) so a derived hidden
 * value (e.g. laterality) is never written into an otherwise-empty instance,
 * which would fabricate a bodySite-only Procedure. Hidden items are excluded
 * from the check (they carry only the derived value, not user intent).
 */
function instanceHasRealAnswer(
  group: QuestionnaireItem,
  suffix: string,
  formState: Record<string, string>,
  multiFormState: Record<string, string[]>,
  typeaheadState: Record<string, TermOption[]>,
): boolean {
  for (const child of group.item ?? []) {
    if (isHiddenItem(child)) continue
    const key = `${child.linkId}${suffix}`
    if (formState[key] !== undefined && formState[key] !== '') return true
    if ((multiFormState[key]?.length ?? 0) > 0) return true
    if ((typeaheadState[key]?.length ?? 0) > 0) return true
  }
  return false
}

function flattenItems(items: QuestionnaireItem[]): QuestionnaireItem[] {
  const out: QuestionnaireItem[] = []
  for (const item of items) {
    out.push(item)
    if (item.item) out.push(...flattenItems(item.item))
  }
  return out
}

// ── Single question renderer ──────────────────────────────────────────────────

interface QuestionProps {
  item: QuestionnaireItem
  /**
   * The key used to read/write this item's answer in formState/
   * multiFormState/typeaheadState — normally identical to `item.linkId`,
   * except inside a repeating group's Nth instance (ADR-0141), where it's
   * suffixed (`${item.linkId}#${n}`) so each repetition gets its own
   * independent answer. `item.linkId` itself stays the real Questionnaire
   * linkId throughout — used for DOM `id`/`name` uniqueness (still needs
   * `stateKey`, see below) and for answerOption/answerValueSet lookups
   * (which are repetition-independent, so those stay keyed on the real
   * linkId, not `stateKey`).
   */
  stateKey: string
  value: string
  multiValue: string[]
  onChange: (stateKey: string, value: string) => void
  onMultiChange: (stateKey: string, values: string[]) => void
  valueSetOptions: Record<string, TermOption[]>
  staticOptions: Record<string, Array<{ code: string; display: string; system: string }>>
  typeaheadValue: TermOption[]
  onTypeaheadChange: (stateKey: string, items: TermOption[]) => void
  isNotDone: boolean
  onNotDoneChange: (stateKey: string, notDone: boolean) => void
}

function QuestionField({ item, stateKey, value, multiValue, onChange, onMultiChange, valueSetOptions, staticOptions, typeaheadValue, onTypeaheadChange, isNotDone, onNotDoneChange }: QuestionProps) {
  const label = (
    <label htmlFor={stateKey} className="form-label">
      {item.text}
      {item.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )

  const isCalculated = !!calculatedExpressionOf(item)
  // ADR-0090: a calculatedExpression item is NOT forced read-only — the
  // Constant-Murley total supports two entry modes (direct total, or
  // auto-calculated from its four sub-scores) distinguished by whether the
  // sub-scores are filled; forcing read-only here would make direct entry
  // impossible. Only an explicit item.readOnly = true still blocks editing.
  const isReadOnly = item.readOnly === true

  const isNotDoneEligible = NOT_DONE_ELIGIBLE_LINK_IDS.has(item.linkId)
  const notDoneToggle = isNotDoneEligible && (
    <label
      className="flex items-center gap-2 text-xs text-gray-600 mb-1"
      title="Not applicable / not possible (e.g. contraindicated this soon after surgery)"
    >
      <input
        type="checkbox"
        checked={isNotDone}
        onChange={(e) => {
          onNotDoneChange(stateKey, e.target.checked)
          if (e.target.checked) onChange(stateKey, '')
        }}
      />
      N/A
    </label>
  )

  if (item.type === 'string') {
    return (
      <div className="form-group">
        {label}
        <input
          id={stateKey}
          type="text"
          name={stateKey}
          value={value}
          required={item.required}
          readOnly={isReadOnly}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className={`form-input ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`}
        />
      </div>
    )
  }

  if (item.type === 'text') {
    return (
      <div className="form-group">
        {label}
        <textarea
          id={stateKey}
          name={stateKey}
          value={value}
          required={item.required}
          readOnly={isReadOnly}
          onChange={(e) => onChange(stateKey, e.target.value)}
          rows={3}
          className="form-input"
        />
      </div>
    )
  }

  if (item.type === 'date') {
    return (
      <div className="form-group">
        {label}
        <input
          id={stateKey}
          type="date"
          name={stateKey}
          value={value}
          required={item.required}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className="form-input"
        />
      </div>
    )
  }

  if (item.type === 'dateTime') {
    return (
      <div className="form-group">
        {label}
        <input
          id={stateKey}
          type="datetime-local"
          name={stateKey}
          value={value}
          required={item.required}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className="form-input"
        />
      </div>
    )
  }

  if (item.type === 'boolean') {
    return (
      <div className="form-group">
        {label}
        <select
          id={stateKey}
          name={stateKey}
          value={value}
          required={item.required}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className="form-input"
        >
          <option value="">— select —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    )
  }

  if (item.type === 'decimal' || item.type === 'integer') {
    const maxValue = item.extension?.find((e) => e.url === MAX_VALUE_EXT)?.valueDecimal
    return (
      <div className="form-group">
        {label}
        {notDoneToggle}
        <input
          id={stateKey}
          type="number"
          name={stateKey}
          value={value}
          step={item.type === 'decimal' ? 'any' : '1'}
          min="0"
          max={maxValue}
          required={item.required}
          readOnly={isReadOnly}
          disabled={isNotDone}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className={`form-input ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`}
        />
        {isCalculated && (
          <p className="text-xs text-gray-500 mt-1">
            Auto-computed from the items above when they're filled — otherwise, enter the total directly.
          </p>
        )}
      </div>
    )
  }

  if (item.type === 'open-choice' && item.answerValueSet) {
    // Free-text typeahead search (ADR-0137) — the answerValueSet (e.g. IPS
    // Problems / SNOMED Clinical finding) is far too large to `$expand` and
    // render as a bounded dropdown/checkbox list the way plain repeating
    // `#choice` items (below) are.
    return (
      <div className="form-group col-span-2">
        <SnomedTypeahead
          valueSetUrl={item.answerValueSet}
          value={typeaheadValue}
          onChange={(next) => onTypeaheadChange(stateKey, next)}
          label={item.text}
          excludeValueSetUrl={item.linkId === COMORBIDITY_LINK_ID ? SHOULDER_REGION_DISORDERS_EXCLUSION_VS : undefined}
        />
      </div>
    )
  }

  if (item.type === 'choice') {
    const options: Array<{ code: string; display: string }> =
      item.answerValueSet
        ? (valueSetOptions[item.answerValueSet] ?? [])
        : (staticOptions[item.linkId] ?? [])

    if (item.repeats) {
      return (
        <div className="form-group col-span-2">
          {label}
          <p className="text-xs text-gray-500 mb-2">Select all that apply (optional)</p>
          <div className="flex flex-wrap gap-4">
            {options.map((o) => (
              <label key={o.code} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiValue.includes(o.code)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...multiValue, o.code]
                      : multiValue.filter((c) => c !== o.code)
                    onMultiChange(stateKey, next)
                  }}
                  className="rounded border-gray-300"
                />
                {o.display}
              </label>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="form-group">
        {label}
        {notDoneToggle}
        <select
          id={stateKey}
          name={stateKey}
          value={value}
          required={item.required}
          disabled={isNotDone}
          onChange={(e) => onChange(stateKey, e.target.value)}
          className="form-input"
        >
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.display}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return null
}

// ── Group section renderer ────────────────────────────────────────────────────

interface SectionProps {
  item: QuestionnaireItem
  formState: Record<string, string>
  multiFormState: Record<string, string[]>
  onChange: (stateKey: string, value: string) => void
  onMultiChange: (stateKey: string, values: string[]) => void
  valueSetOptions: Record<string, TermOption[]>
  staticOptions: Record<string, Array<{ code: string; display: string; system: string }>>
  typeaheadState: Record<string, TermOption[]>
  onTypeaheadChange: (stateKey: string, items: TermOption[]) => void
  notDoneState: Record<string, boolean>
  onNotDoneChange: (stateKey: string, notDone: boolean) => void
  /**
   * Present only for a repeating group's Nth rendered instance (ADR-0141) —
   * suffixes every child's state key (`${child.linkId}${instanceSuffix}`)
   * so each instance's answers are independent. `undefined` for every
   * non-repeating group, which is the overwhelming majority of this form —
   * those children keep using their plain linkId as the state key exactly
   * as before this suffix mechanism existed.
   */
  instanceSuffix?: string
}

function SectionCard({ item, formState, multiFormState, onChange, onMultiChange, valueSetOptions, staticOptions, typeaheadState, onTypeaheadChange, notDoneState, onNotDoneChange, instanceSuffix }: SectionProps) {
  return (
    <div className="card mb-6">
      <h2 className="card-header">{item.text}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        {(item.item ?? []).filter((child) => !isHiddenItem(child)).map((child) => {
          const stateKey = instanceSuffix ? `${child.linkId}${instanceSuffix}` : child.linkId
          return (
            <QuestionField
              key={stateKey}
              item={child}
              stateKey={stateKey}
              value={formState[stateKey] ?? ''}
              multiValue={multiFormState[stateKey] ?? []}
              onChange={onChange}
              onMultiChange={onMultiChange}
              valueSetOptions={valueSetOptions}
              staticOptions={staticOptions}
              typeaheadValue={typeaheadState[stateKey] ?? []}
              onTypeaheadChange={onTypeaheadChange}
              isNotDone={notDoneState[stateKey] ?? false}
              onNotDoneChange={onNotDoneChange}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── ValueSet loader ───────────────────────────────────────────────────────────

interface VSLoaderProps {
  url: string
  onLoaded: (url: string, options: TermOption[]) => void
}

function ValueSetLoader({ url, onLoaded }: VSLoaderProps) {
  const { options } = useValueSet(url)
  useMemo(() => {
    if (options.length > 0) onLoaded(url, options)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])
  return null
}

// ── Main form component ──────────────────────────────────────────────────────

interface Props {
  questionnaire: Questionnaire
  flow: FlowType
  onSubmit: (qr: QuestionnaireResponse) => Promise<TransactionResponseBundle>
  onSuccess: (response: TransactionResponseBundle) => void
  /** linkId → display string, resolved from itemPopulationContext + initialExpression (see FlowPage.tsx). */
  initialOverrides?: Record<string, string>
  /** ADR-0159: the patient's coexisting non-rotator-cuff diagnoses (resolved
   * by PatientLookup/FlowPage's LaunchContext) — merged into staticOptions
   * as the "procedure.diagnosis" item's runtime-computed option list. */
  otherDiagnoses?: Condition[]
  /** FHIRPath environment for calculatedExpression evaluation (e.g. %patient),
   * resolved from launchContext/itemPopulationContext by FlowPage. `%resource`
   * (the live QuestionnaireResponse) is bound internally; this supplies any
   * additional named contexts. Both current IG expressions are %resource-only,
   * so this is empty in practice today — it keeps one evaluation mechanism for
   * any future expression that references a launch-context resource. */
  calcEnv?: Record<string, FhirResourceLike>
}

const PROCEDURE_DIAGNOSIS_LINK_ID = 'procedure.diagnosis'

export function QuestionnaireForm({ questionnaire, flow, onSubmit, onSuccess, initialOverrides, otherDiagnoses, calcEnv }: Props) {
  const valueSetUrls = useMemo(() => collectValueSetUrls(questionnaire.item ?? []), [questionnaire])
  const staticOptions = useMemo(() => {
    const base = collectAnswerOptions(questionnaire.item ?? [])
    if (otherDiagnoses && otherDiagnoses.length > 0) {
      base[PROCEDURE_DIAGNOSIS_LINK_ID] = otherDiagnoses.map((c) => ({
        code: c.id ?? '',
        display: c.code?.coding?.[0]?.display ?? c.code?.coding?.[0]?.code ?? c.id ?? 'Condition',
        // Not a real terminology system — these codes are Condition.id
        // values, not codified concepts. A non-empty placeholder avoids
        // emitting Coding.system as an empty string, which some validators
        // reject as an invalid uri; extractor.ts only ever reads `.code`
        // back off this answer, so the system value itself is never used.
        system: 'urn:hpi:local-condition-ref',
      }))
    }
    return base
  }, [questionnaire, otherDiagnoses])
  const initialDefaults = useMemo(() => collectInitialDefaults(questionnaire.item ?? []), [questionnaire])
  const calcTargets = useMemo(() => findCalcTargets(questionnaire.item ?? []), [questionnaire])
  const flatItems = useMemo(() => flattenItems(questionnaire.item ?? []), [questionnaire])

  const [formState, setFormState] = useState<Record<string, string>>(initialDefaults)
  const [multiFormState, setMultiFormState] = useState<Record<string, string[]>>({})
  const [typeaheadState, setTypeaheadState] = useState<Record<string, TermOption[]>>({})
  // calculatedExpression-derived Codings for hidden items (e.g. prior-treatment
  // laterality → Procedure.bodySite), keyed by the same suffixed stateKey as
  // typeaheadState and merged into it at QR-build time so they serialize as
  // valueCoding. Kept in a separate map so a user typeahead answer and a
  // derived value never collide, and so it can be an effect output that does
  // not re-trigger the calc effect.
  const [calcCodingState, setCalcCodingState] = useState<Record<string, TermOption[]>>({})
  // Repeating top-level groups (ADR-0141) — currently exercised only by
  // Surgery's `procedure` group (index + concomitant procedures). Maps a
  // repeating group's linkId to how many instances are rendered; a group
  // not yet in this map renders its single default instance (count 1).
  const [repeatCount, setRepeatCount] = useState<Record<string, number>>({})
  const [valueSetOptions, setValueSetOptions] = useState<Record<string, TermOption[]>>({})
  // ADR-0147: "not applicable" checkbox state, keyed by stateKey (same
  // suffixing convention as formState).
  const [notDoneState, setNotDoneState] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // linkId → answer options, merging static answerOption lists with loaded
  // ValueSet expansions. Declared before the calc effect below (which reads it
  // to build the QR shim) so it is initialised when that effect's dependency
  // array is evaluated during render.
  const allAnswerOptions = useMemo(() => {
    const merged: Record<string, Array<{ code: string; display: string; system: string }>> = {
      ...staticOptions,
    }
    for (const item of (questionnaire.item ?? [])) {
      for (const child of (item.item ?? [])) {
        if (child.answerValueSet && valueSetOptions[child.answerValueSet]) {
          merged[child.linkId] = valueSetOptions[child.answerValueSet]
        }
      }
    }
    return merged
  }, [staticOptions, valueSetOptions, questionnaire.item])

  // Re-apply initial defaults if the Questionnaire changes (e.g., flow switch).
  useEffect(() => {
    setFormState((prev) => ({ ...initialDefaults, ...prev }))
  }, [initialDefaults])

  // itemPopulationContext-derived values arrive asynchronously (after
  // PatientLookup resolves, well after mount) — apply them as they land.
  useEffect(() => {
    if (!initialOverrides || Object.keys(initialOverrides).length === 0) return
    setFormState((prev) => ({ ...prev, ...initialOverrides }))
  }, [initialOverrides])

  // Live calculatedExpression evaluation (ADR-0090/ADR-0100/ADR-0118/ADR-0171).
  // On any answer change, build a QuestionnaireResponse from current form state
  // — the exact same serialization used at submit — and evaluate each calc
  // expression against it with the real `fhirpath` package (lib/
  // calculatedExpression.ts), the way standard SDC engines do. Two target
  // shapes occur in this IG:
  //   1. Non-repeating numeric target (Constant-Murley total): reflect the
  //      computed number into formState. On `incomplete` (not all four
  //      sub-scores present) leave the field untouched — this is what makes the
  //      two entry modes (direct total vs. component-derived) both work: a
  //      manually-typed direct total is never clobbered back to blank.
  //   2. Repeating hidden Coding target (prior-treatment laterality →
  //      Procedure.bodySite): derive the diagnosis laterality Coding per
  //      priorTreatment instance into calcCodingState, but ONLY for instances
  //      the user has actually started (instanceHasRealAnswer) so we never
  //      fabricate a bodySite-only Procedure. This replaces the former
  //      imperative bodySite default in bundleAssembler.ts — the declarative
  //      Questionnaire is now the single source of truth in every engine.
  useEffect(() => {
    if (calcTargets.length === 0) return
    const qrShim = buildQuestionnaireResponse(
      formState,
      multiFormState,
      questionnaire.url ?? '',
      allAnswerOptions,
      questionnaire.item ?? [],
      typeaheadState,
      repeatCount,
      notDoneState,
    )
    const nextForm = { ...formState }
    let formDirty = false
    const nextCoding = { ...calcCodingState }
    let codingDirty = false

    for (const target of calcTargets) {
      const deps = dependencyLinkIdsOf(target.expression, flatItems)
      const outcome = evaluateCalc(target.expression, qrShim, deps, calcEnv ?? {})

      if (!target.repeatingGroupLinkId) {
        // Non-repeating numeric target.
        if (outcome.kind === 'number') {
          const value = String(outcome.value)
          if (nextForm[target.item.linkId] !== value) {
            nextForm[target.item.linkId] = value
            formDirty = true
          }
        }
        // incomplete → leave untouched (preserves direct-total entry).
        continue
      }

      // Repeating hidden Coding target — one derived value per active instance.
      const group = flatItems.find((it) => it.linkId === target.repeatingGroupLinkId)
      const instances = Math.max(1, repeatCount[target.repeatingGroupLinkId] ?? 1)
      for (let i = 0; i < instances; i++) {
        const key = `${target.item.linkId}#${i}`
        const active = group
          ? instanceHasRealAnswer(group, `#${i}`, formState, multiFormState, typeaheadState)
          : false
        if (outcome.kind === 'coding' && active) {
          const coding: TermOption = {
            code: outcome.value.code ?? '',
            display: outcome.value.display ?? outcome.value.code ?? '',
            system: outcome.value.system ?? '',
          }
          const existing = nextCoding[key]?.[0]
          if (!existing || existing.code !== coding.code || existing.system !== coding.system) {
            nextCoding[key] = [coding]
            codingDirty = true
          }
        } else if (nextCoding[key]) {
          delete nextCoding[key]
          codingDirty = true
        }
      }
    }

    if (formDirty) setFormState(nextForm)
    if (codingDirty) setCalcCodingState(nextCoding)
    // calcCodingState is an OUTPUT of this effect, deliberately not a dependency
    // (including it would loop). All read state is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, multiFormState, typeaheadState, repeatCount, notDoneState, allAnswerOptions, calcTargets, flatItems, calcEnv, questionnaire.item, questionnaire.url])

  // Constant-Murley POOS-15 sub-item calculator (ADR-0158, porting ADR-0112
  // + ADR-0113 to SDC) — mirrors the unified frontend's own live-sync
  // effect. Reads whichever derivation/manual-input linkIds are present in
  // this Questionnaire (Registration and Follow-Up expose different
  // subsets — see the FSH items' own comments). Per ADR-0113, the four
  // obs.constant-score.{pain,adl,rom,strength} items are now read-only
  // (marked in FSH) and this is an UNCONDITIONAL mirror — each sub-score is
  // set to its freshly computed value, or cleared to empty if no longer
  // resolvable (isSubscoreComplete false), every render. The total
  // (obs.constant-score) stays driven by the pre-existing
  // calculatedExpression effect above, which already only fires once all
  // four of these sub-score fields have values (ADR-0118) — no separate
  // total logic needed here.
  useEffect(() => {
    const derived = computeConstantSubscores(
      {
        painAverage: formState['obs.pain-average'] ?? '',
        sleepDisturbance: formState['obs.sleep-disturbance'] ?? formState['constant-calc.adl-sleep'] ?? '',
        forwardFlexion: formState['obs.forward-flexion'] ?? '',
        abduction: formState['obs.abduction'] ?? '',
        internalRotation: formState['obs.internal-rotation'] ?? '',
      },
      {
        painNormalActivities: formState['constant-calc.pain-normal-activities'] ?? '',
        adlOccupation: formState['constant-calc.adl-occupation'] ?? '',
        adlLeisure: formState['constant-calc.adl-leisure'] ?? '',
        adlArmUse: formState['constant-calc.adl-arm-use'] ?? '',
        romExternalRotation: formState['constant-calc.rom-external-rotation'] ?? '',
        powerTest: formState['constant-calc.power-test'] ?? '',
      },
    )
    const updates: Record<string, string> = {
      'obs.constant-score.pain': isSubscoreComplete(derived.pain) ? String(derived.pain.value) : '',
      'obs.constant-score.adl': isSubscoreComplete(derived.adl) ? String(derived.adl.value) : '',
      'obs.constant-score.rom': isSubscoreComplete(derived.rom) ? String(derived.rom.value) : '',
      'obs.constant-score.strength': isSubscoreComplete(derived.strength) ? String(derived.strength.value) : '',
    }
    const dirty = Object.entries(updates).some(([k, v]) => (formState[k] ?? '') !== v)
    if (dirty) setFormState((prev) => ({ ...prev, ...updates }))
  }, [formState])

  const handleChange = (linkId: string, value: string) => {
    setFormState((prev) => ({ ...prev, [linkId]: value }))
  }

  const handleMultiChange = (linkId: string, values: string[]) => {
    setMultiFormState((prev) => ({ ...prev, [linkId]: values }))
  }

  const handleTypeaheadChange = (linkId: string, items: TermOption[]) => {
    setTypeaheadState((prev) => ({ ...prev, [linkId]: items }))
  }

  const handleNotDoneChange = (stateKey: string, notDone: boolean) => {
    setNotDoneState((prev) => ({ ...prev, [stateKey]: notDone }))
  }

  const handleVSLoaded = (url: string, options: TermOption[]) => {
    setValueSetOptions((prev) => ({ ...prev, [url]: options }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const qr = buildQuestionnaireResponse(
        formState,
        multiFormState,
        questionnaire.url!,
        allAnswerOptions,
        questionnaire.item ?? [],
        // Merge calculatedExpression-derived Codings (e.g. prior-treatment
        // laterality) alongside real typeahead answers so they serialize as
        // valueCoding. Keys are suffixed stateKeys, disjoint from user typeaheads.
        { ...typeaheadState, ...calcCodingState },
        repeatCount,
        notDoneState,
      )
      const response = await onSubmit(qr)
      onSuccess(response)
    } catch (err) {
      if (err instanceof FhirError && (err.status === 400 || err.status === 422)) {
        setError('The submission contains invalid data. Check that all values are within allowed ranges and try again.')
      } else if (err instanceof FhirError) {
        setError(`Server error ${err.status}: ${err.message}`)
      } else {
        setError(err instanceof Error ? err.message : 'Submission failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const sections = (questionnaire.item ?? []).filter((i) => i.type === 'group')
  const flowLabel = flow === 'registration' ? 'Registration'
    : flow === 'surgery' ? 'Surgery'
    : 'Follow-Up'

  return (
    <>
      {valueSetUrls.map((url) => (
        <ValueSetLoader key={url} url={url} onLoaded={handleVSLoaded} />
      ))}

      <form onSubmit={handleSubmit} noValidate>
        {sections.map((section) => {
          if (!section.repeats) {
            return (
              <SectionCard
                key={section.linkId}
                item={section}
                formState={formState}
                multiFormState={multiFormState}
                onChange={handleChange}
                onMultiChange={handleMultiChange}
                valueSetOptions={valueSetOptions}
                staticOptions={staticOptions}
                typeaheadState={typeaheadState}
                onTypeaheadChange={handleTypeaheadChange}
                notDoneState={notDoneState}
                onNotDoneChange={handleNotDoneChange}
              />
            )
          }

          const count = repeatCount[section.linkId] ?? 1
          return (
            <div key={section.linkId}>
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="relative">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => setRepeatCount((prev) => ({ ...prev, [section.linkId]: Math.max(1, (prev[section.linkId] ?? 1) - 1) }))}
                      className="absolute top-4 right-4 text-sm text-red-600 hover:text-red-800"
                      aria-label={`Remove ${section.text} #${i + 1}`}
                    >
                      Remove
                    </button>
                  )}
                  <SectionCard
                    item={section}
                    formState={formState}
                    multiFormState={multiFormState}
                    onChange={handleChange}
                    onMultiChange={handleMultiChange}
                    valueSetOptions={valueSetOptions}
                    staticOptions={staticOptions}
                    typeaheadState={typeaheadState}
                    onTypeaheadChange={handleTypeaheadChange}
                    notDoneState={notDoneState}
                    onNotDoneChange={handleNotDoneChange}
                    instanceSuffix={`#${i}`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRepeatCount((prev) => ({ ...prev, [section.linkId]: (prev[section.linkId] ?? 1) + 1 }))}
                className="mb-6 -mt-3 text-sm text-blue-700 hover:text-blue-900 font-medium"
              >
                + Add another {(section.text ?? 'item').toLowerCase()}
              </button>
            </div>
          )
        })}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="card">
          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-700">
              <span className="font-medium">{flowLabel}:</span> this structured questionnaire is
              automatically converted into discrete clinical records and submitted together as a
              single transaction.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : `Submit ${flowLabel}`}
          </button>
        </div>
      </form>
    </>
  )
}
