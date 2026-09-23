/**
 * SDC Definition-Driven Extractor
 *
 * Walks a Questionnaire + QuestionnaireResponse pair and produces an
 * ExtractedResources object using two SDC metadata signals:
 *
 *   1. Group items with an sdc-questionnaire-itemExtractionContext extension
 *      declare the target profile of an extracted resource. The group becomes
 *      a single resource (or, when `repeats=true`, one resource per repetition).
 *
 *   2. Leaf items with `item.definition = <profile canonical URL>#<element path>`
 *      declare which element of the surrounding resource the leaf answer fills.
 *
 * Groups without an itemExtractionContext (e.g. `clinicalAssessment`,
 * `outcomeScores`, `patientHistory`, `postOpExam`, `intraOpObservations`) are
 * per-leaf-extraction groups: each leaf's `item.definition` points at an
 * Observation profile, and the leaf produces one Observation resource on its
 * own.
 *
 * How an answer gets written onto a resource (ADR-0122): every element's
 * FHIR type + cardinality is resolved at runtime from the compiled
 * StructureDefinition HAPI serves (`profileMetadataResolver.ts`), and one
 * generic `assignByPath` writer builds the right FHIR shape from that type —
 * no hand-written switch per resource type per element path, and no table
 * mapping a profile id to its resource type (the resource type itself comes
 * from the resolved profile's own `StructureDefinition.type`). Two things
 * remain deliberately NOT derived from the StructureDefinition, and are
 * called out here rather than left implicit: (1) `SUBMISSION_DEFAULTS` below
 * — a handful of required-but-not-fixed fields (status codes, clinicalStatus,
 * a "today" recordedDate) that the form doesn't collect and no profile fixes
 * a value for; (2) the inherent SDC property that `item.definition` names
 * *which* StructureDefinition applies but not its fixed values inline, so
 * resolving those values still requires a live fetch, not a static read of
 * the Questionnaire alone.
 *
 * Cross-resource references (subject, encounter, reasonReference, evidence)
 * are NOT wired here — that is the job of the bundle assembler in
 * `bundleAssembler.ts`, which knows which bundle profile is being built.
 *
 * Reference: HL7 SDC IG v4.0.0, definition-based extraction via the
 * sdc-questionnaire-extr-defn profile.
 * See ADR-0039, ADR-0103, ADR-0122.
 */

import type {
  Patient,
  Condition,
  Procedure,
  Observation,
  ImagingStudy,
  Coverage,
  Quantity,
  CodeableConcept,
  Coding,
  Reference,
  QuestionnaireResponse,
  QuestionnaireItem,
  QRItem,
  QRAnswer,
  Meta,
  Extension,
} from '../types/fhir'
import { PROFILE_URLS } from '../types/fhir'
import type { ResolvedProfile, ResolvedElement, ExtractionTarget } from './profileMetadataResolver'

// ── Constants ─────────────────────────────────────────────────────────────────

const UCUM = 'http://unitsofmeasure.org'

const OBS_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/observation-category'
const EXAM_CATEGORY: CodeableConcept = { coding: [{ system: OBS_CATEGORY_SYSTEM, code: 'exam', display: 'Exam' }] }

// SDC extension URLs the extractor inspects.
const SDC_EXTRACT_CTX = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemExtractionContext'

// ── "Not applicable" marker (ADR-0147) ────────────────────────────────────────
// Parity port of the unified frontend's per-field N/A checkbox (ADR-0109):
// a post-op exam item (ROM/strength/provocation) the clinician marked
// contraindicated/not-possible this soon after surgery. Recorded on the
// QRItem itself (not `answer`, which has no "present but no value" shape)
// via the standard http://hl7.org/fhir/StructureDefinition/data-absent-reason
// extension (Extension.value[x] is `code` per FHIR core, verified against
// the locally cached hl7.fhir.uv.extensions.r4 package — not `Coding`).
// Extracted into the same Observation.dataAbsentReason shape the unified
// frontend's buildNotDoneObservation already produces, so both frontends
// emit an identical resource for this case.
const DATA_ABSENT_REASON_EXT_URL = 'http://hl7.org/fhir/StructureDefinition/data-absent-reason'
const DATA_ABSENT_REASON_SYSTEM = 'http://terminology.hl7.org/CodeSystem/data-absent-reason'

function isMarkedNotPerformed(qrItem: QRItem): boolean {
  return (qrItem.extension ?? []).some((e) => e.url === DATA_ABSENT_REASON_EXT_URL && e.valueCode === 'not-performed')
}

function buildNotDoneObservation(profileCanonical: string, resolvedProfile: ResolvedProfile): Observation {
  const obs = emptyResource('Observation', profileCanonical, resolvedProfile) as Observation
  obs.dataAbsentReason = { coding: [{ system: DATA_ABSENT_REASON_SYSTEM, code: 'not-performed', display: 'Not Performed' }] }
  obs.note = [{ text: 'Not performed — marked not applicable / not possible at this visit.' }]
  return obs
}

// ── Definition URL parsing ────────────────────────────────────────────────────

interface ParsedDefinition {
  /** The profile canonical URL (everything before #) */
  profileCanonical: string
  /** The FHIR element path on the resource (everything after #) — e.g. "Patient.name.family" */
  elementPath: string
  /** Resource type derived from the element path — e.g. "Patient" */
  resourceType: string
}

function parseDefinition(definition: string | undefined): ParsedDefinition | undefined {
  if (!definition) return undefined
  const hashIdx = definition.indexOf('#')
  if (hashIdx < 0) {
    // Group items sometimes carry a definition that's just the profile URL with no #path
    return { profileCanonical: definition, elementPath: '', resourceType: '' }
  }
  const profileCanonical = definition.slice(0, hashIdx)
  const elementPath = definition.slice(hashIdx + 1)
  const resourceType = elementPath.split('.')[0] ?? ''
  return { profileCanonical, elementPath, resourceType }
}

/**
 * `parseDefinition`'s `elementPath` is the ElementDefinition id after "#"
 * (e.g. "Patient.name.family", "Observation.component:Pain.value[x]").
 * Everywhere else — the resolver's per-element map keys, `assignByPath`'s own
 * path parsing — works on the id local to the resource (the same string with
 * the leading "<ResourceType>." stripped, e.g. "name.family", "value[x]").
 * This is the one place that boundary is crossed.
 */
function localElementPath(parsed: ParsedDefinition): string {
  // Bare group-marker definitions (e.g. "...#Patient") carry elementPath ===
  // resourceType with no further segment — nothing local to strip down to.
  if (parsed.elementPath === parsed.resourceType) return ''
  const prefix = `${parsed.resourceType}.`
  return parsed.elementPath.startsWith(prefix) ? parsed.elementPath.slice(prefix.length) : parsed.elementPath
}

// ── Group itemExtractionContext lookup ────────────────────────────────────────

function extractionContextOf(item: QuestionnaireItem): string | undefined {
  const ext = (item.extension ?? []).find((e) => e.url === SDC_EXTRACT_CTX)
  if (!ext) return undefined
  // Expression's expression field is treated as the target profile URL.
  const expr = ext as unknown as { valueExpression?: { expression?: string } }
  return expr.valueExpression?.expression
}

// ── Answer extraction ─────────────────────────────────────────────────────────

interface AnswerValue {
  string?: string
  date?: string
  dateTime?: string
  decimal?: number
  integer?: number
  boolean?: boolean
  coding?: Coding
}

function readAnswer(a: QRAnswer): AnswerValue {
  return {
    string: a.valueString,
    date: a.valueDate ?? a.valueDateTime,
    dateTime: a.valueDateTime,
    decimal: a.valueDecimal,
    integer: a.valueInteger,
    boolean: a.valueBoolean,
    coding: a.valueCoding,
  }
}

// HTML <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" — not a valid
// FHIR dateTime, which requires :SS and a timezone offset. Normalize to the
// browser's local offset so HAPI accepts it.
function toFhirDateTime(local: string): string {
  if (!local || !local.includes('T')) return local
  const d = new Date(local)
  if (isNaN(d.getTime())) return local
  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(offsetMin) / 60))
  const om = pad(Math.abs(offsetMin) % 60)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
}

// ── Type-driven answer -> FHIR value construction (ADR-0122) ─────────────────
// Given the FHIR type ADR-0122's resolver read off the compiled
// StructureDefinition, build the concrete value an answer produces. This is
// the one place that understands "what does a Quantity/CodeableConcept/
// dateTime/etc. answer look like" — it does not know or care which resource
// or element path it's being written to.

function buildValue(fhirType: string, ans: AnswerValue, ucumCode: string | undefined): unknown {
  switch (fhirType) {
    case 'string':
    case 'markdown':
    case 'id':
    case 'uri':
    case 'url':
      return ans.string
    case 'code':
      // Deliberately no ans.string fallback: a FHIR "code" element is always
      // bound to a value set, so the only legitimate source is a coded
      // answer (ans.coding) — never a raw typed string.
      return ans.coding?.code
    case 'date':
      return ans.date
    case 'dateTime':
    case 'instant':
      return ans.dateTime ?? ans.date
    case 'boolean':
      return ans.boolean
    case 'decimal':
    case 'integer':
    case 'positiveInt':
    case 'unsignedInt':
      return ans.decimal ?? ans.integer
    case 'CodeableConcept':
      return ans.coding ? { coding: [ans.coding] } : undefined
    case 'Coding':
      return ans.coding
    case 'Quantity': {
      if (ans.decimal === undefined) return undefined
      const q: Quantity = { value: ans.decimal }
      if (ucumCode) {
        q.system = UCUM
        q.code = ucumCode
      }
      return q
    }
    case 'Annotation':
      return ans.string ? { text: ans.string } : undefined
    default:
      return undefined
  }
}

const COMPONENT_PATH_RE = /^component:([A-Za-z]+)\.value\[x\]$/
const EXTENSION_SLICE_RE = /^extension:(.+)$/

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/**
 * A choice element's id ends in "[x]" ("value[x]", "onset[x]"); the property
 * actually written is the base name plus the capitalized type code
 * ("valueQuantity", "onsetDateTime") — the naming rule FHIR itself defines
 * (http://hl7.org/fhir/formats.html#choice). `item.definition` has to carry
 * the "[x]" form because a fragment may only name an ElementDefinition id,
 * so the concrete name is reconstructed here from the resolved type.
 */
function concreteChoiceName(segment: string, fhirType: string): string {
  return segment.endsWith('[x]') ? `${segment.slice(0, -3)}${capitalize(fhirType)}` : segment
}

/**
 * Write one answer onto a resource at the given element path, using the
 * type/cardinality ADR-0122's resolver already worked out — no per-path or
 * per-resource-type switch. Three shapes, distinguished by the path syntax
 * itself (all three are literal SDC/FHIRPath conventions, not this IG's
 * invention):
 *   - `extension:slice` — single-value extension; the value[x] key is
 *     reconstructed from the resolved type, since an element id never spells
 *     a concrete choice name out.
 *   - `component:Slice.value[x]` — Observation.component slice; same
 *     reconstruction, applied to the slice's own value.
 *   - a plain dotted path (1 or 2 segments in every profile today) — walks
 *     into (creating if absent) any container object/array, using the
 *     resolver-supplied cardinality to decide array vs. singular at each
 *     level actually present in the path.
 */
function assignByPath(resource: object, elementPath: string, ans: AnswerValue, resolved: ResolvedElement): void {
  const target = resource as Record<string, unknown>

  const sliceMatch = elementPath.match(EXTENSION_SLICE_RE)
  if (sliceMatch) {
    if (!resolved.extensionUrl) return
    const value = buildValue(resolved.fhirType, ans, resolved.ucumCode)
    if (value === undefined) return
    const valueKey = `value${capitalize(resolved.fhirType)}`
    const existing = (target.extension as Array<{ url: string }> | undefined) ?? []
    target.extension = [
      ...existing.filter((e) => e.url !== resolved.extensionUrl),
      { url: resolved.extensionUrl, [valueKey]: value },
    ]
    return
  }

  const componentMatch = elementPath.match(COMPONENT_PATH_RE)
  if (componentMatch) {
    if (!resolved.fixedCoding) return
    const value = buildValue(resolved.fhirType, ans, resolved.ucumCode)
    if (value === undefined) return
    const valueKey = `value${capitalize(resolved.fhirType)}`
    const fixedCode = resolved.fixedCoding
    const existing = (target.component as Array<{ code?: { coding?: Array<{ code?: string }> } }> | undefined) ?? []
    target.component = [
      ...existing.filter((c) => c.code?.coding?.[0]?.code !== fixedCode.code),
      { code: { coding: [fixedCode] }, [valueKey]: value },
    ]
    return
  }

  const value = buildValue(resolved.fhirType, ans, resolved.ucumCode)
  if (value === undefined) return

  const segments = elementPath.split('.')
  segments[segments.length - 1] = concreteChoiceName(segments[segments.length - 1], resolved.fhirType)
  if (segments.length === 1) {
    if (resolved.isArray) {
      // Append, not overwrite — a repeating leaf (item.repeats = true) calls
      // this once per answer; each call must add to the array, not clobber
      // the previous answer. Non-repeating leaves call this exactly once, so
      // the append is a no-op-equivalent single-element array either way.
      const existing = (target[segments[0]] as unknown[] | undefined) ?? []
      target[segments[0]] = [...existing, value]
    } else {
      target[segments[0]] = value
    }
    return
  }
  // 2-segment plain path (e.g. "name.family", "period.start") — every path
  // in the current IG bottoms out here; see the resolver's own comment on
  // why deeper paths aren't handled yet.
  const [containerName, leafName] = segments
  if (!target[containerName]) target[containerName] = resolved.containerIsArray ? [{}] : {}
  const container = (
    resolved.containerIsArray ? (target[containerName] as Record<string, unknown>[])[0] : target[containerName]
  ) as Record<string, unknown>
  if (resolved.isArray) {
    const existing = (container[leafName] as unknown[] | undefined) ?? []
    container[leafName] = [...existing, value]
  } else {
    container[leafName] = value
  }
}

// ── Resource instantiation ────────────────────────────────────────────────────
// Submission defaults (see module doc comment #1): required fields that no
// profile fixes a value for and no form field collects. Not SD-derived —
// deliberately kept small and named here rather than hidden inside the
// generic writer above.

// ADR-0125/ADR-0126: status = final/completed/finished,
// Condition.category = encounter-diagnosis, Condition.verificationStatus =
// confirmed, and (Registration/Follow-Up only) Encounter.class = ambulatory
// are now ALSO fixed directly in FSH — the last one at the bundle level
// (RotatorCuffRegistrationBundle/RotatorCuffFollowUpBundle's own
// entry[encounter].resource.class), since ShoulderEncounter itself is shared
// with Surgery, where class genuinely varies and must stay open (ADR-0124).
// An independent SDC engine reading only the published IG now knows all of
// these values too, closing that part of the interoperability gap. Note:
// this function never actually runs for Registration's Encounter — that
// flow's Questionnaire has no Encounter group at all, so its status/class
// live in `bundleAssembler.ts`'s own separate literal instead (see the
// comment there); everything below is real for Observation/Procedure/
// Condition always, and for Encounter on Surgery/Follow-Up specifically.
// They stay duplicated here rather than resolved generically from the SD: the
// resolver's fixed-value reading (`resolveObservationFixedValues`) is
// currently hardcoded to exactly Observation.code/category, not a general
// "read any fixed primitive off any resource type" mechanism — extending it
// to close this duplication for real is a legitimate follow-up, not done
// here. If either copy changes, change both, or this table silently drifts
// out of sync with the profile the same way the old PROFILE_METADATA table
// did (ADR-0103). `Condition.clinicalStatus`/`recordedDate` and Surgery's
// `Encounter.class` (a real per-case answer, not a default — ADR-0124) are
// the only fields left genuinely unpromoted: dynamic (recordedDate) or
// context-dependent in a way no single fixed value could ever express
// (clinicalStatus changes over the patient's timeline; Surgery's class
// varies by case).
function submissionDefaults(resourceType: string): Record<string, unknown> {
  switch (resourceType) {
    case 'Observation':
      return { status: 'final', effectiveDateTime: new Date().toISOString() }
    // performedDateTime defaults to today for the priorTreatment group only
    // in practice (ADR-0105/ADR-0133): that group's Questionnaire item no
    // longer asks for an exact date (judged clinically unhelpful, replaced
    // by bucketed session/injection counts), but RotatorCuffProcedure.
    // performed[x] stays FHIR-required 1..1. Harmless for Surgery's
    // procedure.date, which IS a required leaf item there and always
    // overwrites this seed via assignByPath before the resource is returned.
    case 'Procedure':
      return { status: 'completed', performedDateTime: new Date().toISOString().split('T')[0] }
    case 'Condition':
      return {
        category: [
          {
            coding: [
              { system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis', display: 'Encounter Diagnosis' },
            ],
          },
        ],
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        recordedDate: new Date().toISOString().split('T')[0],
      }
    case 'Encounter':
      return { status: 'finished', class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' } }
    case 'ImagingStudy':
      // ADR-0130: minimal registered-resource realisation of Q6 — no form
      // field asks "is this study available", so default to the common case.
      // ADR-0172: `started` reuses the same "today" stamp Observations get for
      // effectiveDateTime — no questionnaire item collects a study date.
      return { status: 'available', started: new Date().toISOString() }
    default:
      return {}
  }
}

// Encounter is not in the existing types/fhir.ts module; declare a minimal
// shape inline so the assembler can produce one without importing more types.
export interface Encounter {
  resourceType: 'Encounter'
  meta?: Meta
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled'
  class: Coding
  type?: CodeableConcept[]
  subject?: Reference
  period?: { start?: string; end?: string }
  reasonReference?: Reference[]
  /** Ranked diagnoses addressed by this visit — rank 1 is the principal (Hauptdiagnose), L3.F.5. Populated only when more than one diagnosis is submitted. */
  diagnosis?: Array<{ condition: Reference; rank?: number; use?: CodeableConcept }>
}

type AnyResource = Patient | Condition | Procedure | Observation | Encounter | ImagingStudy

/**
 * Instantiate an empty resource of the given type: resourceType + meta.profile
 * + submission defaults, plus (Observation only) the profile-fixed code/
 * category ADR-0103 already resolves. One generic factory replaces what used
 * to be five separate `emptyPatient`/`emptyCondition`/… functions.
 */
function emptyResource(resourceType: string, profileCanonical: string, resolvedProfile: ResolvedProfile): AnyResource {
  const resource: Record<string, unknown> = {
    resourceType,
    meta: { profile: [profileCanonical] },
    ...submissionDefaults(resourceType),
  }
  if (resourceType === 'Observation') {
    resource.category = resolvedProfile.category ? [{ coding: [resolvedProfile.category] }] : [EXAM_CATEGORY]
    resource.code = resolvedProfile.code ? { coding: [resolvedProfile.code] } : { coding: [] }
  }
  return resource as unknown as AnyResource
}

function hasObservationValue(o: Observation): boolean {
  return !!(
    o.valueQuantity ||
    o.valueCodeableConcept ||
    o.valueString ||
    o.valueBoolean !== undefined ||
    (o.component && o.component.length > 0)
  )
}

// ── Coverage (Q1.l workers'-compensation flag, ADR-0061/ADR-0131) ─────────────
// The `coverage.workersCompensation` Questionnaire item is a "loose leaf" —
// no item.definition, because its answer doesn't populate a single resource
// element; it gates whether a whole separate Coverage resource is built at
// all. `ShoulderCoverage.type` has no fixed value in the profile (only an
// extensible binding), so WCBPOL can't be resolved generically the way
// Observation code/category are (ADR-0103/ADR-0122) — it's hardcoded here,
// same reason the unified frontend hardcodes it in StepPatient.tsx.
//
// No existing helper walks the QR *answer* tree by linkId (buildItemMap
// above walks the *Questionnaire* item tree instead), so this is new.

const V3_ACT_CODE = 'http://terminology.hl7.org/CodeSystem/v3-ActCode'

function findAnswerByLinkId(items: QRItem[], linkId: string): QRAnswer | undefined {
  for (const item of items) {
    if (item.linkId === linkId) return item.answer?.[0]
    if (item.item) {
      const found = findAnswerByLinkId(item.item, linkId)
      if (found) return found
    }
  }
  return undefined
}

/** Same walk as findAnswerByLinkId, but returns every answer of a repeating loose leaf (e.g. comorbidities). */
function findAllAnswersByLinkId(items: QRItem[], linkId: string): QRAnswer[] {
  for (const item of items) {
    if (item.linkId === linkId) return item.answer ?? []
    if (item.item) {
      const found = findAllAnswersByLinkId(item.item, linkId)
      if (found.length > 0) return found
    }
  }
  return []
}

function buildWorkersCompCoverage(): Coverage {
  return {
    resourceType: 'Coverage',
    meta: { profile: [PROFILE_URLS.COVERAGE] },
    status: 'active',
    type: {
      coding: [{ system: V3_ACT_CODE, code: 'WCBPOL', display: "worker's compensation" }],
      text: 'Berufsgenossenschaft (BG)',
    },
  }
}

// ── Sex Assigned at Birth (HL7 Gender Harmony RSG, ADR-0053/L3.A.6) ────────────
// Another loose leaf (see patient.sexAssignedAtBirth's own FSH comment for
// why): `type` is fixed to LOINC 76689-9 by the profile, but the generic
// per-element resolver can't populate two sibling sub-extensions from one
// answer, so this nested shape is built by hand, same as Coverage above.
// The answer's own valueCoding already carries system/code/display (baked
// into the FSH answerOption), so no separate display lookup table is needed
// here — unlike the unified frontend's ADMIN_GENDER_DISPLAYS, whose plain
// HTML <select> has no embedded display text to read back.

const LOINC_SYSTEM = 'http://loinc.org'
const RSG_EXT_URL = 'http://hl7.org/fhir/StructureDefinition/individual-recordedSexOrGender'

function buildSexAssignedAtBirthExtension(coding: Coding): Extension {
  return {
    url: RSG_EXT_URL,
    extension: [
      { url: 'value', valueCodeableConcept: { coding: [coding] } },
      {
        url: 'type',
        valueCodeableConcept: {
          coding: [{ system: LOINC_SYSTEM, code: '76689-9', display: 'Sex assigned at birth' }],
        },
      },
    ],
  }
}

// ── Comorbidities (expert consensus Q1.c, ADR-0055/ADR-0084) ──────────────────────────────
// Two loose leaves, same "generic resolver can't fix Condition.category"
// reason as Coverage/RSG above — ShoulderComorbidityCondition needs
// category=problem-list-item, which the blanket submissionDefaults('Condition')
// (written for RotatorCuffCondition, category=encounter-diagnosis) doesn't
// give it. `obs.comorbidities` (repeating, typeahead) takes priority: if it
// has any answers, one Condition per selected code is built and
// `comorbidity.absentReason` is ignored, matching the unified frontend's
// tri-state semantics (a "specific" answer supersedes the none-known/no-info
// flag). Matches the unified frontend, per ADR-0144.

const CONDITION_CLINICAL_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-clinical'
const CONDITION_VER_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-ver-status'
const CONDITION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-category'
const IPS_ABSENT_UNKNOWN_SYSTEM = 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips'

function emptyComorbidityCondition(): Condition {
  return {
    resourceType: 'Condition',
    meta: { profile: [PROFILE_URLS.COMORBIDITY_CONDITION] },
    clinicalStatus: { coding: [{ system: CONDITION_CLINICAL_SYSTEM, code: 'active', display: 'Active' }] },
    verificationStatus: { coding: [{ system: CONDITION_VER_STATUS_SYSTEM, code: 'confirmed', display: 'Confirmed' }] },
    category: [{ coding: [{ system: CONDITION_CATEGORY_SYSTEM, code: 'problem-list-item', display: 'Problem List Item' }] }],
    code: { coding: [] },
    subject: { reference: '' },
    recordedDate: new Date().toISOString().split('T')[0],
  }
}

function buildComorbidityConditions(qr: QuestionnaireResponse): Condition[] {
  const comorbidityAnswers = findAllAnswersByLinkId(qr.item ?? [], 'obs.comorbidities')
  const codedAnswers = comorbidityAnswers.filter((a): a is QRAnswer & { valueCoding: Coding } => Boolean(a.valueCoding))
  if (codedAnswers.length > 0) {
    return codedAnswers.map((a) => ({
      ...emptyComorbidityCondition(),
      code: { coding: [a.valueCoding], text: a.valueCoding.display },
    }))
  }
  const absentAnswer = findAnswerByLinkId(qr.item ?? [], 'comorbidity.absentReason')
  if (absentAnswer?.valueCoding) {
    return [{
      ...emptyComorbidityCondition(),
      code: { coding: [{ system: IPS_ABSENT_UNKNOWN_SYSTEM, code: absentAnswer.valueCoding.code, display: absentAnswer.valueCoding.display }] },
    }]
  }
  return []
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
// Walk a Questionnaire+QR pair. For each group with itemExtractionContext,
// instantiate a target resource and fill its fields from the group's leaves.
// For per-leaf-extraction groups (no extraction context), each leaf produces
// its own Observation.

export interface ExtractedResources {
  patient?: Patient
  condition?: Condition
  encounter?: Encounter
  procedures: Procedure[]
  observations: Observation[]
  // ADR-0130: Q6 imaging modality (ShoulderImagingStudy) — Registration.
  // Also used at the Follow-Up flow's optional Q13 research re-imaging
  // timepoint, same resource shape, wired to the visit's Encounter instead.
  // ADR-0172: one ImagingStudy per selected modality (parity with the unified
  // frontend's StepImaging.tsx), each carrying a single-element modality[].
  imagingStudies: ImagingStudy[]
  // ADR-0061/ADR-0131: Q1.l workers'-compensation flag (ShoulderCoverage) —
  // Registration only, emitted only when the loose-leaf answer is "Yes".
  coverage?: Coverage
  // ADR-0055/ADR-0137: Q1.c comorbidities (ShoulderComorbidityCondition) —
  // Registration only, 0..* — one per specific comorbidity, or a single
  // absent-value Condition, or none.
  comorbidities: Condition[]
  // ADR-0145: coexisting non-rotator-cuff shoulder diagnoses
  // (ShoulderDiagnosisCondition) — Registration only, 0..*, repeatable group
  // (parity port of the unified frontend's "+ Add another diagnosis").
  otherDiagnoses: Condition[]
  // Surgeon/performer (not Hurley-named, L3.H.1) — Surgery only, one per
  // surgical event (encounter.performer loose leaf), applied to every
  // Procedure's performer.actor.display in bundleAssembler.ts. See the
  // "Performer" section below for why this can't use item.definition.
  performerName?: string
  // ADR-0141: per-procedure technique loose leaves (Approach/Reconstruction
  // Extent/Fixation Technique — separate Observations, not Procedure
  // fields, so the generic per-element resolver can't place them via
  // item.definition the way procedure.outcome above works). Index-aligned
  // with `procedures[]` — technique[i] belongs to procedures[i] — so
  // bundleAssembler.ts can wire each Observation's `partOf` to the matching
  // Procedure's own freshly-assigned UUID once one exists.
  technique: ProcedureTechnique[]
  // ADR-0159: which diagnosis each procedure addresses, index-aligned with
  // `procedures[]` (same alignment convention as `technique`). Undefined
  // (or the index Condition's own persisted ID) means "index diagnosis" —
  // bundleAssembler.ts falls back to conditionRef when unset. Loose leaf,
  // same reasoning as the technique fields: the candidate list is dynamic
  // per-patient (the patient's own otherDiagnosis Conditions), so there is
  // no static answerValueSet item.definition could bind to.
  diagnosisConditionId: (string | undefined)[]
}

export interface ProcedureTechnique {
  approach?: Observation
  reconstructionExtent?: Observation
  fixationTechnique?: Observation
}

/** Non-recursive sibling of findAnswerByLinkId — searches only this one item list (e.g. one procedure repetition's own direct children), not the whole QR tree. */
function findDirectAnswer(items: QRItem[], linkId: string): QRAnswer | undefined {
  return items.find((item) => item.linkId === linkId)?.answer?.[0]
}

// ── Technique Observations (Approach / Reconstruction Extent / Fixation
// Technique, ADR-0141) ─────────────────────────────────────────────────────
// Built entirely hardcoded rather than through the generic per-element
// resolver, same reasoning as Coverage/RSG above: these loose leaves have
// no item.definition (nothing for collectExtractionTargets to prefetch),
// so no resolved profile metadata is available for them at extraction
// time. code/category are fixed values read directly off each profile's
// own FSH (`ShoulderObservationCodes#<slug>`, category=procedure) — stable,
// small, and already duplicated this same way for Coverage's WCBPOL and
// RSG's LOINC 76689-9 type code.
const SHOULDER_OBS_SYSTEM = 'https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/shoulder-observation'
const PROCEDURE_OBS_CATEGORY: CodeableConcept = {
  coding: [{ system: OBS_CATEGORY_SYSTEM, code: 'procedure', display: 'Procedure' }],
}

function buildTechniqueObservation(
  coding: Coding | undefined,
  profileCanonical: string,
  obsCode: string,
  obsDisplay: string,
): Observation | undefined {
  if (!coding) return undefined
  return {
    resourceType: 'Observation',
    meta: { profile: [profileCanonical] },
    status: 'final',
    category: [PROCEDURE_OBS_CATEGORY],
    code: { coding: [{ system: SHOULDER_OBS_SYSTEM, code: obsCode, display: obsDisplay }] },
    subject: { reference: '' },
    effectiveDateTime: new Date().toISOString().split('T')[0],
    valueCodeableConcept: { coding: [coding] },
  }
}

interface WalkContext {
  /** Map linkId → questionnaire item (for elementPath / definition lookup) */
  itemMap: Map<string, QuestionnaireItem>
  /** Runtime-resolved extraction plan (ADR-0103/ADR-0122), prefetched by FlowPage.tsx, keyed by profile id (last URL segment). */
  resolved: Map<string, ResolvedProfile>
}

function buildItemMap(items: QuestionnaireItem[], acc = new Map<string, QuestionnaireItem>()): Map<string, QuestionnaireItem> {
  for (const it of items) {
    acc.set(it.linkId, it)
    if (it.item) buildItemMap(it.item, acc)
  }
  return acc
}

function profileId(canonical: string): string {
  return canonical.split('/').pop() ?? canonical
}

/**
 * Process a single "extraction group" — a Questionnaire group with
 * itemExtractionContext that maps to exactly one resource (one per QR-item
 * repetition if the group repeats). Returns the freshly-built resource, or
 * undefined if the target profile's metadata failed to resolve (surfaced by
 * FlowPage.tsx's submit-blocking banner, not silently dropped here).
 */
function buildResourceForExtractionGroup(
  groupQRItem: QRItem,
  profileCanonical: string,
  ctx: WalkContext,
): AnyResource | undefined {
  const resolvedProfile = ctx.resolved.get(profileId(profileCanonical))
  if (!resolvedProfile) {
    console.warn(`[extractor] no resolved profile for "${profileCanonical}" — resource dropped`)
    return undefined
  }
  const resource = emptyResource(resolvedProfile.resourceType, profileCanonical, resolvedProfile)

  for (const leafQR of groupQRItem.item ?? []) {
    const leafQItem = ctx.itemMap.get(leafQR.linkId)
    if (!leafQItem) continue
    const parsed = parseDefinition(leafQItem.definition)
    if (!parsed || !parsed.elementPath) continue
    const answers = leafQR.answer ?? []
    if (answers.length === 0) continue
    const localPath = localElementPath(parsed)
    const resolvedElement = resolvedProfile.elements.get(localPath)
    if (!resolvedElement) continue
    // ADR-0155: a repeating leaf (item.repeats = true, e.g. imaging.modality)
    // carries multiple answers under one linkId — every one must be written,
    // not just the first, or a multi-select silently loses everything past
    // the first checked box. assignByPath's array branch appends, so calling
    // it once per answer accumulates correctly; non-repeating leaves always
    // have exactly one answer here, so this loop is a no-op-equivalent
    // single call for them.
    for (const answer of answers) {
      const ans = readAnswer(answer)
      assignByPath(resource, localPath, ans, resolvedElement)
    }
  }

  return resource
}

/**
 * Process a per-leaf-extraction group: every leaf's item.definition points at
 * a separate Observation profile. Produces one Observation per leaf with an
 * answered value — EXCEPT when multiple non-repeating leaves in the same
 * group share the same target profileCanonical (ADR-0090: the four
 * Constant-Murley sub-score leaves + the total leaf all target
 * constant-score-observation), in which case they are merged into a single
 * shared Observation — the standard component panel is fixed per-profile;
 * distinct leaves populate `component[]` slices or the top `value[x]` on the
 * same resource rather than producing separate resources.
 */
function buildObservationsForPerLeafGroup(groupQRItem: QRItem, ctx: WalkContext): Observation[] {
  const obs: Observation[] = []
  const sharedByProfile = new Map<string, Observation>()

  for (const leafQR of groupQRItem.item ?? []) {
    const leafQItem = ctx.itemMap.get(leafQR.linkId)
    if (!leafQItem) continue
    const parsed = parseDefinition(leafQItem.definition)
    if (!parsed || !parsed.elementPath || parsed.resourceType !== 'Observation') continue
    const answers = leafQR.answer ?? []

    const resolvedProfile = ctx.resolved.get(profileId(parsed.profileCanonical))
    if (!resolvedProfile || !resolvedProfile.code) {
      if (answers.length > 0 || isMarkedNotPerformed(leafQR)) {
        console.warn(`[extractor] no resolved metadata for profile "${parsed.profileCanonical}" (leaf "${leafQR.linkId}") — Observation dropped`)
      }
      continue
    }

    if (answers.length === 0) {
      // ADR-0147: explicitly marked "not applicable" with no answer — emit
      // dataAbsentReason instead of silently dropping (the ordinary blank-
      // field behavior for every other unanswered leaf in this loop).
      if (isMarkedNotPerformed(leafQR)) obs.push(buildNotDoneObservation(parsed.profileCanonical, resolvedProfile))
      continue
    }

    const localPath = localElementPath(parsed)
    const resolvedElement = resolvedProfile.elements.get(localPath)
    if (!resolvedElement) continue

    if (leafQItem.repeats) {
      // Repeating items (e.g. tendons-involved) produce one Observation per
      // answer so each gets its own resource, individually linkable from
      // Condition.evidence.detail (ADR-0064) — never merged.
      for (const answer of answers) {
        const ans = readAnswer(answer)
        const obsResource = emptyResource('Observation', parsed.profileCanonical, resolvedProfile) as Observation
        assignByPath(obsResource, localPath, ans, resolvedElement)
        if (hasObservationValue(obsResource)) obs.push(obsResource)
      }
      continue
    }

    // Non-repeating: get-or-create the shared Observation for this profile
    // (lazily — most profiles have exactly one leaf targeting them, so this
    // is a no-op merge in the common case; Constant-Murley's five leaves all
    // resolve to the same shared resource).
    let obsResource = sharedByProfile.get(parsed.profileCanonical)
    if (!obsResource) {
      obsResource = emptyResource('Observation', parsed.profileCanonical, resolvedProfile) as Observation
      sharedByProfile.set(parsed.profileCanonical, obsResource)
    }
    const ans = readAnswer(answers[0])
    assignByPath(obsResource, localPath, ans, resolvedElement)
  }

  // Emit shared Observations that actually got a value set (skip
  // empty-answer cases — same rule the repeating path applied).
  for (const obsResource of sharedByProfile.values()) {
    if (hasObservationValue(obsResource)) obs.push(obsResource)
  }
  return obs
}

/**
 * Main extraction entry point. Walks every top-level group in the QR. For
 * each group: if its Q-item carries itemExtractionContext, treat as a single
 * (or repeating) resource group; else treat as a per-leaf-extraction group.
 */
export function extractResources(
  qr: QuestionnaireResponse,
  questionnaireItems: QuestionnaireItem[],
  resolved: Map<string, ResolvedProfile>,
): ExtractedResources {
  const itemMap = buildItemMap(questionnaireItems)
  const out: ExtractedResources = { procedures: [], observations: [], comorbidities: [], technique: [], otherDiagnoses: [], diagnosisConditionId: [], imagingStudies: [] }
  const ctx: WalkContext = { itemMap, resolved }

  for (const groupQR of qr.item ?? []) {
    const groupQItem = itemMap.get(groupQR.linkId)
    if (!groupQItem) continue
    const extractionContext = extractionContextOf(groupQItem)

    if (extractionContext) {
      // Resource-anchored group. If repeats=true, each QR group repetition
      // produces a separate resource; otherwise one resource for the group.
      // (In the current QR structure each top-level entry is one repetition;
      // repeating groups appear as multiple QR.item entries with the same
      // linkId.)
      const resource = buildResourceForExtractionGroup(groupQR, extractionContext, ctx)
      if (!resource) continue
      if (resource.resourceType === 'Patient') out.patient = resource
      else if (resource.resourceType === 'Condition' && groupQItem.linkId === 'otherDiagnosis') {
        // ADR-0145: distinguished from the main `condition` group by linkId,
        // since both target resourceType Condition — code-only answers (no
        // required fields, unlike the main diagnosis) mean a repetition with
        // nothing selected must not produce an empty Condition.
        if (resource.code?.coding?.length) out.otherDiagnoses.push(resource)
      } else if (resource.resourceType === 'Condition') out.condition = resource
      else if (resource.resourceType === 'Procedure') {
        out.procedures.push(resource)
        // ADR-0159: index-aligned with the Procedure just pushed — see
        // ExtractedResources.diagnosisConditionId's own doc comment.
        // Answered as valueCoding, not valueString: procedure.diagnosis has
        // no static FSH answerOption (its options are injected at runtime
        // by QuestionnaireForm.tsx from the patient's own otherDiagnoses),
        // so buildGroupItems' isStringOption check never matches and it
        // always builds a Coding — .code is the picked Condition.id.
        out.diagnosisConditionId.push(findDirectAnswer(groupQR.item ?? [], 'procedure.diagnosis')?.valueCoding?.code)
        // ADR-0141: index-aligned with the Procedure just pushed — see
        // ProcedureTechnique's own doc comment for why these 3 answers
        // can't flow through the generic per-element resolver above.
        out.technique.push({
          approach: buildTechniqueObservation(
            findDirectAnswer(groupQR.item ?? [], 'procedure.approach')?.valueCoding,
            'https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/procedure-approach-observation',
            'procedure-approach', 'Procedure Approach',
          ),
          reconstructionExtent: buildTechniqueObservation(
            findDirectAnswer(groupQR.item ?? [], 'procedure.reconstructionExtent')?.valueCoding,
            'https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/reconstruction-extent-observation',
            'reconstruction-extent', 'Reconstruction Extent',
          ),
          fixationTechnique: buildTechniqueObservation(
            findDirectAnswer(groupQR.item ?? [], 'procedure.fixationTechnique')?.valueCoding,
            'https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/fixation-technique-observation',
            'fixation-technique', 'Fixation Technique',
          ),
        })
      } else if (resource.resourceType === 'Encounter') out.encounter = resource
      else if (resource.resourceType === 'Observation') out.observations.push(resource)
      else if (resource.resourceType === 'ImagingStudy') {
        // ADR-0172: the repeating modality leaf accumulates every selected
        // code into one resource's modality[] (via assignByPath's array
        // append); split that into one ImagingStudy per modality so the SDC
        // frontend emits the same lean one-study-per-modality shape as the
        // unified frontend, each with a single-element modality[].
        const study = resource as ImagingStudy
        for (const coding of study.modality ?? []) {
          out.imagingStudies.push({ ...study, modality: [coding] })
        }
      }
    } else {
      // Per-leaf-extraction group: each leaf → its own Observation.
      out.observations.push(...buildObservationsForPerLeafGroup(groupQR, ctx))
    }
  }

  // Loose leaf, not reachable by the group loop above (no item.definition,
  // so buildObservationsForPerLeafGroup already skips it) — see the Coverage
  // section above for why it needs its own lookup.
  const wcAnswer = findAnswerByLinkId(qr.item ?? [], 'coverage.workersCompensation')
  if (wcAnswer?.valueString === 'Yes') out.coverage = buildWorkersCompCoverage()

  // Surgeon/performer loose leaf (Surgery only) — one per surgical event,
  // applied to every Procedure in bundleAssembler.ts (same event-level
  // pattern as the incision/closure Period, not per-procedure).
  const performerAnswer = findAnswerByLinkId(qr.item ?? [], 'encounter.performer')
  if (performerAnswer?.valueString) out.performerName = performerAnswer.valueString

  // Sex Assigned at Birth loose leaf — same lookup pattern, but modifies the
  // already-built Patient in place rather than producing a separate resource.
  const sexAtBirthAnswer = findAnswerByLinkId(qr.item ?? [], 'patient.sexAssignedAtBirth')
  if (sexAtBirthAnswer?.valueCoding && out.patient) {
    out.patient = {
      ...out.patient,
      extension: [...(out.patient.extension ?? []), buildSexAssignedAtBirthExtension(sexAtBirthAnswer.valueCoding)],
    }
  }

  // Phone loose leaf — cpt-2 ("a system is required if a value is
  // provided") means Patient.telecom needs system fixed alongside value;
  // same in-place-modification pattern as Sex Assigned at Birth above.
  const phoneAnswer = findAnswerByLinkId(qr.item ?? [], 'patient.phone')
  if (phoneAnswer?.valueString && out.patient) {
    out.patient = {
      ...out.patient,
      telecom: [...(out.patient.telecom ?? []), { system: 'phone', value: phoneAnswer.valueString, use: 'home' }],
    }
  }

  out.comorbidities = buildComorbidityConditions(qr)

  return out
}

// ── QR construction (form state → QuestionnaireResponse) ──────────────────────
// Builds a QR from raw form state. Preserves item order per Questionnaire item
// order (FHIR validators reject re-ordered items). Repeating choice answers
// come from multiFormState; everything else from formState.

/**
 * Build the QR items for one instance of a group's children. `stateSuffix`
 * is `''` for a non-repeating group (state keys == plain linkIds, as
 * always) or `#N` for the Nth instance of a repeating group (ADR-0141) —
 * every read from `formState`/`multiFormState`/`typeaheadState` uses the
 * suffixed key, but every `QRItem.linkId` emitted stays the plain
 * Questionnaire-defined linkId, since the QR itself has no concept of the
 * suffix (repetition is expressed structurally, by this group of leaves
 * being wrapped in its own top-level QRItem, one per instance).
 */
function buildGroupItems(
  group: QuestionnaireItem,
  stateSuffix: string,
  formState: Record<string, string>,
  multiFormState: Record<string, string[]>,
  answerOptions: Record<string, Array<{ code: string; display: string; system: string }>>,
  typeaheadState: Record<string, Coding[]>,
  notDoneState: Record<string, boolean> = {},
): QRItem[] {
  const groupItems: QRItem[] = []

  for (const child of group.item ?? []) {
    const { linkId } = child
    const stateKey = `${linkId}${stateSuffix}`

    // ADR-0147: "not applicable" checked and no value entered — emit the
    // item with a data-absent-reason extension instead of an answer, rather
    // than silently omitting it like an ordinary blank field.
    const rawValueForNotDone = formState[stateKey]
    if (notDoneState[stateKey] && (rawValueForNotDone === undefined || rawValueForNotDone === '')) {
      groupItems.push({ linkId, extension: [{ url: DATA_ABSENT_REASON_EXT_URL, valueCode: 'not-performed' }] })
      continue
    }

    // Single-value answer
    const rawValue = formState[stateKey]
    if (rawValue !== undefined && rawValue !== '') {
      const options = answerOptions[linkId]
      if (child.type === 'boolean') {
        groupItems.push({ linkId, answer: [{ valueBoolean: rawValue === 'true' }] })
      } else if (child.type === 'string') {
        groupItems.push({ linkId, answer: [{ valueString: rawValue }] })
      } else if (options) {
        // Plain-string answerOption (e.g. Q11 Follow-Up Timepoint) carries
        // no Coding at all — echo the string back rather than fabricating one.
        const isStringOption = child.answerOption?.every((o) => o.valueCoding === undefined && o.valueString !== undefined)
        if (isStringOption) {
          groupItems.push({ linkId, answer: [{ valueString: rawValue }] })
        } else {
          const opt = options.find((o) => o.code === rawValue)
          groupItems.push({
            linkId,
            answer: [{ valueCoding: { system: opt?.system, code: rawValue, display: opt?.display } }],
          })
        }
      } else if (child.type === 'dateTime') {
        groupItems.push({ linkId, answer: [{ valueDateTime: toFhirDateTime(rawValue) }] })
      } else if (child.type === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
        groupItems.push({ linkId, answer: [{ valueDate: rawValue }] })
      } else {
        const num = Number(rawValue)
        if (!isNaN(num) && rawValue.trim() !== '') {
          groupItems.push({ linkId, answer: [{ valueDecimal: num }] })
        } else {
          groupItems.push({ linkId, answer: [{ valueString: rawValue }] })
        }
      }
    }

    // Multi-value answer (repeating choice items)
    const codes = multiFormState[stateKey]
    if (codes && codes.length > 0) {
      const opts = answerOptions[linkId] ?? []
      groupItems.push({
        linkId,
        answer: codes.map((code) => {
          const opt = opts.find((o) => o.code === code)
          return { valueCoding: { system: opt?.system, code, display: opt?.display } }
        }),
      })
    }

    // Typeahead answer (repeating open-choice items, ADR-0137) — each
    // selected result already carries its own full Coding from the
    // search response, so no answerOptions lookup is needed here.
    const typeaheadItems = typeaheadState[stateKey]
    if (typeaheadItems && typeaheadItems.length > 0) {
      groupItems.push({
        linkId,
        answer: typeaheadItems.map((coding) => ({ valueCoding: coding })),
      })
    }
  }

  return groupItems
}

export function buildQuestionnaireResponse(
  formState: Record<string, string>,
  multiFormState: Record<string, string[]>,
  questionnaireUrl: string,
  answerOptions: Record<string, Array<{ code: string; display: string; system: string }>>,
  questionnaireItems: QuestionnaireItem[],
  typeaheadState: Record<string, Coding[]> = {},
  repeatCount: Record<string, number> = {},
  notDoneState: Record<string, boolean> = {},
): QuestionnaireResponse {
  const topLevelItems: QRItem[] = []

  for (const group of questionnaireItems) {
    // Repeating groups (ADR-0141, currently only Surgery's `procedure`)
    // produce one top-level QRItem per instance, all sharing the group's
    // linkId — the SDC-standard way to represent a repeated group answer.
    const instances = group.repeats ? Math.max(1, repeatCount[group.linkId] ?? 1) : 1
    for (let i = 0; i < instances; i++) {
      const stateSuffix = group.repeats ? `#${i}` : ''
      const groupItems = buildGroupItems(group, stateSuffix, formState, multiFormState, answerOptions, typeaheadState, notDoneState)
      if (groupItems.length > 0) {
        topLevelItems.push({ linkId: group.linkId, item: groupItems })
      }
    }
  }

  return {
    resourceType: 'QuestionnaireResponse',
    meta: { profile: [PROFILE_URLS.QUESTIONNAIRE_RESPONSE] },
    questionnaire: questionnaireUrl,
    status: 'completed',
    authored: new Date().toISOString(),
    item: topLevelItems,
  }
}

// ── Extraction-target prefetch (ADR-0103/ADR-0122) ────────────────────────────
// Walks the full item tree collecting every distinct {profile, elementPath}
// pair a Questionnaire's item.definition references — the exact set
// FlowPage.tsx needs to prefetch via resolveExtractionPlan() before the form
// can be submitted. Can never fall out of sync with what extraction actually
// needs, since it's derived from the same parseDefinition() extraction
// itself uses. Generalizes the old Observation-only
// collectObservationProfileCanonicals to every resource type, now that
// resourceType itself comes from the resolved profile rather than a
// profile-id table.

export function collectExtractionTargets(items: QuestionnaireItem[]): ExtractionTarget[] {
  const targets: ExtractionTarget[] = []
  const seen = new Set<string>()

  function walk(qItems: QuestionnaireItem[]): void {
    for (const item of qItems) {
      const parsed = parseDefinition(item.definition)
      if (parsed?.elementPath) {
        const localPath = localElementPath(parsed)
        if (localPath) {
          // Bare group-marker definitions (e.g. "...#Patient", elementPath
          // === resourceType, no further segment) only declare the group's
          // resource type — already captured via ResolvedProfile.resourceType,
          // not a per-element target.
          const key = `${parsed.profileCanonical}#${localPath}`
          if (!seen.has(key)) {
            seen.add(key)
            targets.push({ profileCanonical: parsed.profileCanonical, elementPath: localPath })
          }
        }
      }
      if (item.item) walk(item.item)
    }
  }
  walk(items)

  return targets
}

// ── Helpers exported for the bundle assembler ─────────────────────────────────

export function buildItemTextMap(items: QuestionnaireItem[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.text) map.set(item.linkId, item.text)
    if (item.item) {
      for (const [k, v] of buildItemTextMap(item.item)) map.set(k, v)
    }
  }
  return map
}
