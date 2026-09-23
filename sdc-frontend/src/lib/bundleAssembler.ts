/**
 * SDC Bundle Assembler
 *
 * Takes the ExtractedResources from extractor.ts and assembles a
 * profile-conformant WizardEntry[] for one of the three bundles defined by
 * ADR-0034:
 *
 *   - RotatorCuffRegistrationBundle  (T0 — pre-op)
 *   - RotatorCuffSurgeryBundle       (T1 — surgical event)
 *   - RotatorCuffFollowUpBundle      (Tn — per-visit follow-up)
 *
 * The assembler is the only place where cross-resource references
 * (`subject`, `encounter`, `reasonReference`, `Condition.evidence.detail`)
 * are wired. The extractor produces inert resources; the assembler wires
 * them together using the Encounter-as-anchor pattern from ADR-0037.
 *
 * Surgery and Follow-Up bundles reference the patient and condition by
 * persisted server-side ID (no inline Patient or Condition entries) —
 * those resources were created by the prior Registration submission.
 */

import type {
  Patient,
  Condition,
  Procedure,
  Observation,
  CarePlan,
  CodeableConcept,
  Reference,
  QuestionnaireResponse,
  WizardEntry,
  AnyFhirResource,
} from '../types/fhir'
import { BUNDLE_PROFILE_URLS, PROFILE_URLS } from '../types/fhir'
import { withIpsClaim } from './shared/ipsProfiles'
import type { Encounter, ExtractedResources } from './extractor'
// ADR-0157: single source of truth is shared/q11Timepoints.ts (synced here
// via tools/sync-shared-code.sh) — was a hand-duplicated copy independently
// maintained in sync with frontend/src/lib/patientStage.ts.
import { Q11_TIMEPOINTS } from './shared/q11Timepoints'

// The Encounter resource shape is defined inside extractor.ts (it doesn't
// exist in types/fhir.ts yet). For bundle entries we cast through AnyFhirResource
// since the encounter is a valid FHIR resource and the wizard wrapper is type-
// erased to AnyFhirResource at the entry level.
type EncounterEntry = WizardEntry & { resource: AnyFhirResource }

// ── Cross-resource reference helpers ──────────────────────────────────────────

function uuidRef(uuid: string): Reference {
  return { reference: `urn:uuid:${uuid}` }
}

function persistedRef(resourceType: string, id: string): Reference {
  return { reference: `${resourceType}/${id}` }
}

// ── Instance-level IPS multi-profile claims (meta.profile[]) ──────────────────
// Stamp the IPS profile claim on every eligible resource in the assembled
// bundle — Patient, comorbidity Condition, surgical Procedure, smoking
// Observation — so the SDC frontend reproduces the IG examples' IPS
// conformance. withIpsClaim is a non-mutating no-op for every other resource
// (the index diagnosis Condition and prior non-surgical Procedures included).
function stampIpsClaims(entries: WizardEntry[]): WizardEntry[] {
  return entries.map((e) => ({ ...e, resource: withIpsClaim(e.resource) }))
}

// ── Launch context (from the Surgery / Follow-Up PatientLookup step) ──────────

export interface LaunchContext {
  /** Persisted Patient.id resolved by PatientLookup */
  patientId: string
  /** Persisted Condition.id (the patient's RotatorCuffCondition), optional for some flows */
  conditionId?: string
  /** The condition's laterality (bodySite[0]) — stamped onto physically-anchored Observations */
  conditionBodySite?: CodeableConcept
  /** ADR-0159: coexisting non-rotator-cuff diagnoses (ShoulderDiagnosisCondition,
   * ADR-0077's otherDiagnosis slice) already recorded at Registration — lets the
   * Surgery flow offer a per-concomitant-procedure diagnosis picker, parity port
   * of the unified frontend's identical LookupResult.otherDiagnoses. */
  otherDiagnoses?: Condition[]
}

// ── Identifier helpers ────────────────────────────────────────────────────────
// The Registration assembler synthesises an HPI-namespaced patient identifier
// per ADR-0025 (canonical patient identifier system).

function ensurePatientIdentifier(patient: Patient, uuid: string): Patient {
  if (patient.identifier && patient.identifier.length > 0) return patient
  return {
    ...patient,
    identifier: [{
      system: 'https://maxpurk.github.io/shoulder-on-fhir/identifier/patient',
      value: `SDC-${uuid.slice(0, 8).toUpperCase()}`,
      use: 'official',
    }],
  }
}

// ── Encounter-as-anchor wiring (ADR-0037) ─────────────────────────────────────
// Every Observation and Procedure in a bundle gets `encounter` populated so
// downstream consumers can query "all findings for this visit" without
// date+bodySite heuristics. The Condition (Registration only) also receives
// `encounter`. `Encounter.reasonReference` (1..1 per ADR-0028 broadened by
// ADR-0037) points at the Condition.
//
// For Surgery and Follow-Up, the Patient and Condition references are
// persisted-ID references (resolved before form launch). For Registration,
// they are urn:uuid references that resolve within the same transaction
// bundle.

function attachSubjectRef<T extends { subject?: Reference }>(resource: T, ref: Reference): T {
  return { ...resource, subject: ref }
}

// ── Observation.bodySite wiring (ADR-0074) ────────────────────────────────────
// bodySite is the site where the observation was physically made — appropriate
// for exam findings (ROM, strength, provocation, inspection, pain) and imaging
// classifications (Patte, Goutallier, tear size, tendons involved), both of
// which are anchored to the affected shoulder. Aggregate/survey scores
// (Constant-Murley, SSV, SANE, satisfaction, return-to-activity) and social
// history (smoking, occupation, hand dominance, ...) have no physical target
// site and are deliberately excluded — laterality for those is conveyed by the
// Condition/Encounter context, not a physical site element.
const LATERALIZED_CATEGORY_CODES = new Set(['exam', 'imaging'])

function isLateralizedObservation(o: Observation): boolean {
  return (o.category ?? []).some((c) => c.coding?.some((coding) => LATERALIZED_CATEGORY_CODES.has(coding.code ?? '')))
}

function attachBodySite(o: Observation, bodySite: CodeableConcept | undefined): Observation {
  return bodySite && isLateralizedObservation(o) ? { ...o, bodySite } : o
}

// ── Observation.focus wiring (ADR-0156) ───────────────────────────────────────
// The five aggregate/survey PROMs excluded from bodySite above have no
// physical site to disambiguate a bilateral case with — focus (distinct
// from subject) is FHIR's own element for "which of the patient's
// (possibly multiple) conditions is this about," precedented by mCODE's
// identical use for its own composite scores. Identified by Observation.code
// rather than category (category=survey also covers social-history facts
// like smoking/employment status that are about the patient generally, not
// any one condition, and must not get focus).
const FOCUS_OBSERVATION_CODES = new Set([
  '273383002', // ConstantScoreObservation (SNOMED)
  'ssv-score', // SsvScoreObservation (local)
  'sane-score', // SaneScoreObservation (local)
  '77218-6', // PatientSatisfactionObservation (LOINC)
  'return-to-sport-work', // ReturnToActivityObservation (local)
])

function isFocusEligibleObservation(o: Observation): boolean {
  return (o.code?.coding ?? []).some((c) => FOCUS_OBSERVATION_CODES.has(c.code ?? ''))
}

function attachFocus(o: Observation, conditionRef: Reference): Observation {
  return isFocusEligibleObservation(o) ? { ...o, focus: [conditionRef] } : o
}

// ── Condition linkage: stage.assessment + evidence.detail (ADR-0073) ──────────
// Imaging-classification Observations (category=imaging) split into two buckets
// per ADR-0073's three-bucket policy, mirroring the unified frontend's
// isStageObservation()/isEvidenceObservation() split (closes SDC parity gap —
// limitation 0011):
//   Bucket 2 — Condition.stage.assessment: formal grading (Patte, Goutallier,
//     Cofield tear-size classification), identified by profile.
//   Bucket 3 — Condition.evidence.detail: diagnostic evidence (tendons-involved,
//     tear-location, tear-thickness).
// ADR-0073 rejects putting staging observations in evidence.detail as
// "incorrect semantics — staging happens after diagnosis, not as evidence for it."

interface ConditionWithStageEvidence extends Condition {
  stage?: Array<{ assessment?: Reference[] }>
  evidence?: Array<{ detail?: Reference[] }>
}

// Bucket 2 — formal grading (Condition.stage.assessment). Same keys as the
// unified frontend's STAGE_PROFILE_KEYS.
const STAGE_PROFILE_KEYS = [
  'patte-observation',
  'goutallier-observation',
  'tear-size-classification-observation',
]

// Bucket 3 — imaging-derived diagnostic evidence (Condition.evidence.detail).
// Raw TearSizeObservation (cm) is deliberately absent: ADR-0073 files it under
// neither bucket (a measurement, not grading or evidence), reachable via the
// encounter chain — matching the hand-authored seed bundles.
const EVIDENCE_IMAGING_PROFILE_KEYS = [
  'tendons-involved-observation',
  'tear-location-observation',
  'tear-thickness-observation',
]

function isImagingObservation(o: Observation): boolean {
  return (o.category ?? []).some(
    (c) => c.coding?.some((coding) => coding.code === 'imaging')
  )
}

function isStageObservation(o: Observation): boolean {
  const profiles = o.meta?.profile ?? []
  return profiles.some((p) => STAGE_PROFILE_KEYS.some((key) => p.endsWith(`/${key}`)))
}

function isEvidenceImagingObservation(o: Observation): boolean {
  const profiles = o.meta?.profile ?? []
  return profiles.some((p) => EVIDENCE_IMAGING_PROFILE_KEYS.some((key) => p.endsWith(`/${key}`)))
}

function attachConditionStageAndEvidence(
  condition: Condition,
  stageUuids: string[],
  evidenceUuids: string[],
): Condition {
  const c = condition as ConditionWithStageEvidence
  return {
    ...c,
    ...(stageUuids.length > 0 && {
      stage: [...(c.stage ?? []), { assessment: stageUuids.map(uuidRef) }],
    }),
    ...(evidenceUuids.length > 0 && {
      evidence: [...(c.evidence ?? []), { detail: evidenceUuids.map(uuidRef) }],
    }),
  } as Condition
}

// ── Encounter defaults per bundle type ────────────────────────────────────────
// If the extractor produced an Encounter without all the fields we need
// for an assembler-driven default, fill them in here.

function applyEncounterDefaults(
  encounter: Encounter,
  subjectRef: Reference,
  reasonRef: Reference | undefined,
): Encounter {
  return {
    ...encounter,
    subject: subjectRef,
    ...(reasonRef ? { reasonReference: [reasonRef] } : {}),
  }
}

// ── Bundle assembly: Registration (T0) ────────────────────────────────────────

export interface AssembleResult {
  entries: WizardEntry[]
  bundleProfile: string
}

interface AssembleOptions {
  /** The freshly-built QuestionnaireResponse to include in the bundle */
  questionnaireResponse?: QuestionnaireResponse
  /** Persisted patient + condition refs from launch context (Surgery / Follow-Up only) */
  launchContext?: LaunchContext
}

export function assembleRegistrationBundle(
  extracted: ExtractedResources,
  options: AssembleOptions = {},
): AssembleResult {
  const { questionnaireResponse } = options

  // UUIDs for in-bundle references
  const patientUuid = crypto.randomUUID()
  const encounterUuid = crypto.randomUUID()
  const conditionUuid = crypto.randomUUID()
  const qrUuid = crypto.randomUUID()

  const patientRef = uuidRef(patientUuid)
  const encounterRef = uuidRef(encounterUuid)
  const conditionRef = uuidRef(conditionUuid)

  // Patient — synthesise identifier per ADR-0025
  let patient = extracted.patient ?? ({ resourceType: 'Patient', meta: { profile: [PROFILE_URLS.PATIENT] }, identifier: [], name: [] } as Patient)
  patient = ensurePatientIdentifier(patient, patientUuid)

  // Condition — wire subject + encounter; evidence.detail attached after observations
  let condition = extracted.condition ?? ({ resourceType: 'Condition', meta: { profile: [PROFILE_URLS.CONDITION] }, subject: { reference: '' } } as Condition)
  condition = attachSubjectRef(condition, patientRef)
  ;(condition as Condition & { encounter?: Reference }).encounter = encounterRef
  const bodySite = condition.bodySite?.[0]

  // Encounter — anchor. The Registration Questionnaire has no Encounter group
  // at all (unlike Surgery/Follow-Up), so extracted.encounter is always
  // undefined here in practice, not just a rare defensive fallback: this
  // literal object IS the real, always-used source for Registration's
  // Encounter, not `extractor.ts`'s `submissionDefaults()` (which never runs
  // for this resource on this flow). status/class match the same
  // ADR-0125/ADR-0126 fixed IG values, duplicated here rather than there —
  // same known, low-risk duplication, just worth naming which file actually
  // owns it for this specific flow.
  let encounter: Encounter = extracted.encounter ?? {
    resourceType: 'Encounter',
    meta: { profile: [PROFILE_URLS.ENCOUNTER] },
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '185349003', display: 'Encounter for check up' }] }],
    // Was missing entirely (2026-08-04 parity port) — the unified frontend's
    // RegistrationWizard.tsx sets this to submission time (`new Date()`);
    // Registration is a single-visit encounter with no operative window to
    // derive it from the way Surgery's period is (ADR-0121), so it's
    // captured directly here too.
    period: { start: new Date().toISOString() },
  }
  encounter = applyEncounterDefaults(encounter, patientRef, conditionRef)

  // Prior treatment Procedures — wire subject + encounter + reasonReference → Condition.
  // bodySite (RotatorCuffProcedure.bodySite 1..1) is derived from the diagnosis's
  // own laterality rather than re-asked on the form: a prior PT/injection is on the
  // same shoulder as the diagnosis being registered. The SDC Questionnaire declares
  // this via a hidden calculatedExpression, which the form now evaluates with real
  // fhirpath (ADR-0174) — so `proc.bodySite` already carries the derived laterality
  // by the time it reaches here (single source of truth in every engine). This
  // frontend no longer defaults it imperatively; it only wires the cross-references.
  const priorProcedureEntries: WizardEntry[] = []
  for (const proc of extracted.procedures) {
    const p: Procedure = {
      ...proc,
      subject: patientRef,
      reasonReference: [conditionRef],
    }
    ;(p as Procedure & { encounter?: Reference }).encounter = encounterRef
    priorProcedureEntries.push({ uuid: crypto.randomUUID(), resource: p })
  }

  // Observations — wire subject + encounter + bodySite (physically-anchored only)
  const observationEntries: WizardEntry[] = []
  const stageObservationUuids: string[] = []
  const evidenceObservationUuids: string[] = []
  for (const obs of extracted.observations) {
    let o: Observation = { ...obs, subject: patientRef }
    ;(o as Observation & { encounter?: Reference }).encounter = encounterRef
    o = attachBodySite(o, bodySite)
    o = attachFocus(o, conditionRef)
    const obsUuid = crypto.randomUUID()
    observationEntries.push({ uuid: obsUuid, resource: o })
    // Split imaging-classification observations into stage (formal grading) vs
    // evidence (diagnostic evidence) per ADR-0073 — see attachConditionStageAndEvidence.
    // Raw tear-size (cm) matches neither list and lands in neither bucket.
    if (isImagingObservation(o)) {
      if (isStageObservation(o)) stageObservationUuids.push(obsUuid)
      else if (isEvidenceImagingObservation(o)) evidenceObservationUuids.push(obsUuid)
    }
  }

  // Wire Condition.stage.assessment (grading) + Condition.evidence.detail
  // (diagnostic evidence) with the imaging-derived classifications (ADR-0073)
  condition = attachConditionStageAndEvidence(
    condition,
    stageObservationUuids,
    evidenceObservationUuids,
  )

  // ImagingStudy (Q6, ADR-0130) — subject wired the same way as Condition/
  // Encounter above. ADR-0187: the encounter cross-reference is now wired here
  // too, matching the follow-up flow below; omitting it left the pre-operative
  // study tied to no visit at all once the bundle was persisted.
  // ADR-0172: one bundle entry per study (one per selected modality).
  const imagingStudyEntry: WizardEntry[] = extracted.imagingStudies.map((study) => ({
    uuid: crypto.randomUUID(),
    resource: { ...attachSubjectRef(study, patientRef), encounter: encounterRef },
  }))

  // Coverage (Q1.l workers'-compensation flag, ADR-0061/ADR-0131) — the
  // extractor only builds the inert resource (fixed status/type); subscriber/
  // beneficiary/payor wiring happens here, matching every other cross-
  // resource reference in this function. payor is display-only (no
  // Organization resource in this IG), mirroring the unified frontend's
  // StepPatient.tsx.
  const coverageEntry: WizardEntry[] = extracted.coverage
    ? [{
        uuid: crypto.randomUUID(),
        resource: {
          ...extracted.coverage,
          subscriber: patientRef,
          beneficiary: patientRef,
          payor: [{ display: 'Berufsgenossenschaft (BG)' }],
        },
      }]
    : []

  // Comorbidities (Q1.c, ADR-0055/ADR-0137) — subject only, no encounter:
  // a comorbidity is a patient-level problem-list item, not anchored to the
  // registration visit, matching the unified frontend's StepPatient.tsx.
  const comorbidityEntries: WizardEntry[] = extracted.comorbidities.map((c) => ({
    uuid: crypto.randomUUID(),
    resource: attachSubjectRef(c, patientRef),
  }))

  // Additional non-rotator-cuff diagnoses (Q1's coexisting-pathology slice,
  // ADR-0145) — subject + encounter wired the same as the main Condition;
  // bodySite copied from the main Condition rather than re-asked, since
  // ShoulderDiagnosisCondition's own profile requires it to match (one
  // registration entry = one patient + one shoulder side).
  const otherDiagnosisEntries: WizardEntry[] = extracted.otherDiagnoses.map((c) => {
    const withSubject = attachSubjectRef(c, patientRef) as Condition & { encounter?: Reference }
    withSubject.encounter = encounterRef
    return { uuid: crypto.randomUUID(), resource: bodySite ? { ...withSubject, bodySite: [bodySite] } : withSubject }
  })

  // Encounter.diagnosis[] ranking (Hauptdiagnose, L3.F.5, parity port
  // 2026-08-04) — only populated when more than one diagnosis is submitted;
  // with exactly one, rank is unambiguous and reasonReference alone already
  // identifies it. Mirrors the unified frontend's RegistrationWizard.tsx
  // exactly, including the CC/CM diagnosis-role split.
  if (otherDiagnosisEntries.length > 0) {
    const DIAGNOSIS_ROLE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/diagnosis-role'
    encounter = {
      ...encounter,
      diagnosis: [
        {
          condition: conditionRef,
          rank: 1,
          use: { coding: [{ system: DIAGNOSIS_ROLE_SYSTEM, code: 'CC', display: 'Chief complaint' }] },
        },
        ...otherDiagnosisEntries.map((entry, i) => ({
          condition: uuidRef(entry.uuid),
          rank: i + 2,
          use: { coding: [{ system: DIAGNOSIS_ROLE_SYSTEM, code: 'CM', display: 'comorbidity diagnosis' }] },
        })),
      ],
    }
  }

  // QuestionnaireResponse — set subject to the in-bundle Patient
  const qrEntry: WizardEntry[] = questionnaireResponse
    ? [{
        uuid: qrUuid,
        resource: { ...questionnaireResponse, subject: patientRef } as QuestionnaireResponse,
      }]
    : []

  return {
    bundleProfile: BUNDLE_PROFILE_URLS.REGISTRATION,
    entries: stampIpsClaims([
      { uuid: patientUuid, resource: patient },
      { uuid: encounterUuid, resource: encounter as unknown as AnyFhirResource } as EncounterEntry,
      { uuid: conditionUuid, resource: condition },
      ...priorProcedureEntries,
      ...observationEntries,
      ...imagingStudyEntry,
      ...coverageEntry,
      ...comorbidityEntries,
      ...otherDiagnosisEntries,
      ...qrEntry,
    ]),
  }
}

// ── Q11 research follow-up schedule (ADR-0129) ────────────────────────────────
// Generated automatically from the index procedure's date; no Questionnaire
// item corresponds to it (the schedule is derived, not clinician-entered),
// so this lives in assembler-level bundle synthesis, not extractor.ts's
// per-question extraction. Q11_TIMEPOINTS imported at top of file.

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function buildResearchCarePlan(indexProcedureDate: string | undefined, patientRef: Reference): CarePlan | undefined {
  if (!indexProcedureDate) return undefined
  const scheduled = Q11_TIMEPOINTS.map(({ label, days, code }) => ({ label, code, scheduledIso: addDays(indexProcedureDate, days) }))
  const last = scheduled[scheduled.length - 1]
  return {
    resourceType: 'CarePlan',
    meta: { profile: [PROFILE_URLS.CARE_PLAN] },
    status: 'active',
    intent: 'plan',
    subject: patientRef,
    period: { start: indexProcedureDate, end: last.scheduledIso },
    activity: scheduled.map(({ label, code, scheduledIso }) => ({
      detail: {
        status: 'scheduled',
        scheduledTiming: { event: [scheduledIso] },
        description: `Q11 research follow-up — ${label} post-surgery`,
        code: {
          coding: [{ system: 'https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/q11-timepoint', code }],
        },
      },
    })),
  }
}

// ── Bundle assembly: Surgery (T1) ─────────────────────────────────────────────

export function assembleSurgeryBundle(
  extracted: ExtractedResources,
  options: AssembleOptions,
): AssembleResult {
  const { questionnaireResponse, launchContext } = options
  if (!launchContext) {
    throw new Error('Surgery bundle requires launchContext (patientId + conditionId from PatientLookup)')
  }
  const { patientId, conditionId, conditionBodySite } = launchContext
  if (!conditionId) {
    throw new Error('Surgery bundle requires launchContext.conditionId (the patient\'s RotatorCuffCondition)')
  }

  const encounterUuid = crypto.randomUUID()
  const qrUuid = crypto.randomUUID()
  const patientRef = persistedRef('Patient', patientId)
  const conditionRef = persistedRef('Condition', conditionId)
  const encounterRef = uuidRef(encounterUuid)

  // Encounter — surgical admission
  let encounter: Encounter = extracted.encounter ?? {
    resourceType: 'Encounter',
    meta: { profile: [PROFILE_URLS.ENCOUNTER] },
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '308335008', display: 'Patient encounter procedure' }] }],
  }
  encounter = applyEncounterDefaults(encounter, patientRef, conditionRef)

  // Surgical Procedures — stamp category=Surgical (387713003) since SurgeryBundle
  // requires it (ADR-0033); the Questionnaire didn't ask the user (surgical
  // bundle only has one category by construction).
  //
  // Each procedure's own UUID is captured up front (ADR-0141) so the
  // technique Observations below can reference the right procedure via
  // `partOf`, matching the unified frontend's identical index-alignment
  // approach (SurgeryWizard.tsx's `indexProcUuid`/`concomitantProcs[i].uuid`).
  const procedureEntries: WizardEntry[] = []
  // Every procedure's uuid is minted before the loop body runs so a concomitant
  // procedure can point at the index procedure's uuid via partOf (ADR-0186) —
  // entry order marks the index only until the transaction is persisted, after
  // which a reader sees several procedures sharing one encounter, performer and
  // period with nothing distinguishing them. Index procedure carries no partOf.
  const procedureUuids: string[] = extracted.procedures.map(() => crypto.randomUUID())
  const indexProcUuid = procedureUuids[0]
  extracted.procedures.forEach((proc, i) => {
    // performedDateTime dropped 2026-08-04: the removed per-procedure
    // procedure.date item is no longer extracted; every procedure in the
    // event instead shares the one incision/closure Period already
    // composed onto `encounter.period` above (ADR-0121 parity port —
    // mirrors the unified frontend's SurgeryWizard.tsx exactly).
    const { performedDateTime: _unused, ...procWithoutDate } = proc
    // ADR-0159: a concomitant procedure may address a different, coexisting
    // diagnosis than the index rotator cuff tear — falls back to the index
    // Condition (conditionRef) when no diagnosis was explicitly picked,
    // unchanged from before this ADR. Mirrors SurgeryWizard.tsx's
    // effectiveConditionReference.
    const diagnosisId = extracted.diagnosisConditionId[i]
    const procReasonRef = diagnosisId ? persistedRef('Condition', diagnosisId) : conditionRef
    const p: Procedure = {
      ...procWithoutDate,
      subject: patientRef,
      reasonReference: [procReasonRef],
      category: proc.category ?? {
        coding: [{ system: 'http://snomed.info/sct', code: '387713003', display: 'Surgical procedure' }],
      },
      ...(encounter.period?.start || encounter.period?.end ? { performedPeriod: encounter.period } : {}),
      // Surgeon/performer (not Hurley-named, L3.H.1) — same event-level
      // sharing as performedPeriod above; free-text via Reference.display
      // only, no Practitioner directory in this IG.
      ...(extracted.performerName ? { performer: [{ actor: { display: extracted.performerName } }] } : {}),
      ...(i > 0 && indexProcUuid ? { partOf: [uuidRef(indexProcUuid)] } : {}),
    }
    ;(p as Procedure & { encounter?: Reference }).encounter = encounterRef
    procedureEntries.push({ uuid: procedureUuids[i], resource: p })
  })

  // Technique Observations (Approach / Reconstruction Extent / Fixation
  // Technique, ADR-0141) — index-aligned with extracted.procedures via
  // extracted.technique; subject/encounter/partOf wired here, same as every
  // other cross-resource reference in this function.
  const techniqueEntries: WizardEntry[] = []
  extracted.technique.forEach((t, i) => {
    const procedureUuid = procedureUuids[i]
    if (!procedureUuid) return
    const partOf = [{ reference: `urn:uuid:${procedureUuid}` }]
    for (const obs of [t.approach, t.reconstructionExtent, t.fixationTechnique]) {
      if (!obs) continue
      const o: Observation = { ...obs, subject: patientRef, partOf }
      ;(o as Observation & { encounter?: Reference }).encounter = encounterRef
      techniqueEntries.push({ uuid: crypto.randomUUID(), resource: o })
    }
  })

  // Intra-op Observations
  const observationEntries: WizardEntry[] = []
  for (const obs of extracted.observations) {
    let o: Observation = { ...obs, subject: patientRef }
    ;(o as Observation & { encounter?: Reference }).encounter = encounterRef
    o = attachBodySite(o, conditionBodySite)
    observationEntries.push({ uuid: crypto.randomUUID(), resource: o })
  }

  const qrEntry: WizardEntry[] = questionnaireResponse
    ? [{
        uuid: qrUuid,
        resource: { ...questionnaireResponse, subject: patientRef } as QuestionnaireResponse,
      }]
    : []

  // Index procedure date, for the Q11 schedule anchor: reads the shared
  // incision time off Encounter.period.start (ADR-0121 parity port,
  // 2026-08-04) — every Procedure in the event now shares this same date,
  // so there is no more per-procedure performedDateTime to read here.
  const indexProcedureDate = encounter.period?.start
  const carePlan = buildResearchCarePlan(indexProcedureDate, patientRef)
  const carePlanEntry: WizardEntry[] = carePlan ? [{ uuid: crypto.randomUUID(), resource: carePlan }] : []

  return {
    bundleProfile: BUNDLE_PROFILE_URLS.SURGERY,
    entries: stampIpsClaims([
      { uuid: encounterUuid, resource: encounter as unknown as AnyFhirResource } as EncounterEntry,
      ...procedureEntries,
      ...techniqueEntries,
      ...observationEntries,
      ...qrEntry,
      ...carePlanEntry,
    ]),
  }
}

// ── Bundle assembly: Follow-Up (Tn) ───────────────────────────────────────────

export function assembleFollowUpBundle(
  extracted: ExtractedResources,
  options: AssembleOptions,
): AssembleResult {
  const { questionnaireResponse, launchContext } = options
  if (!launchContext) {
    throw new Error('Follow-Up bundle requires launchContext (patientId + conditionId from PatientLookup)')
  }
  const { patientId, conditionId, conditionBodySite } = launchContext
  if (!conditionId) {
    throw new Error('Follow-Up bundle requires launchContext.conditionId (the patient\'s RotatorCuffCondition)')
  }

  const encounterUuid = crypto.randomUUID()
  const qrUuid = crypto.randomUUID()
  const patientRef = persistedRef('Patient', patientId)
  const conditionRef = persistedRef('Condition', conditionId)
  const encounterRef = uuidRef(encounterUuid)

  // Encounter — follow-up visit
  let encounter: Encounter = extracted.encounter ?? {
    resourceType: 'Encounter',
    meta: { profile: [PROFILE_URLS.ENCOUNTER] },
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '390906007', display: 'Follow-up encounter' }] }],
  }
  encounter = applyEncounterDefaults(encounter, patientRef, conditionRef)

  // Follow-up Observations
  const observationEntries: WizardEntry[] = []
  for (const obs of extracted.observations) {
    let o: Observation = { ...obs, subject: patientRef }
    ;(o as Observation & { encounter?: Reference }).encounter = encounterRef
    o = attachBodySite(o, conditionBodySite)
    o = attachFocus(o, conditionRef)
    observationEntries.push({ uuid: crypto.randomUUID(), resource: o })
  }

  const qrEntry: WizardEntry[] = questionnaireResponse
    ? [{
        uuid: qrUuid,
        resource: { ...questionnaireResponse, subject: patientRef } as QuestionnaireResponse,
      }]
    : []

  // Re-imaging (Q13 exception) — optional, only present at the research
  // re-imaging timepoint. RotatorCuffFollowUpBundle's entry[imagingStudy]
  // slice is 0..1; wired to the specific visit it belongs to via encounter,
  // since there can be several follow-up visits per patient (the registration
  // flow above now does the same, ADR-0187).
  // ADR-0172: one bundle entry per study (one per selected modality), each
  // keeping the per-visit `encounter` link.
  const imagingStudyEntry: WizardEntry[] = extracted.imagingStudies.map((study) => ({
    uuid: crypto.randomUUID(),
    resource: { ...attachSubjectRef(study, patientRef), encounter: encounterRef },
  }))

  return {
    bundleProfile: BUNDLE_PROFILE_URLS.FOLLOW_UP,
    entries: stampIpsClaims([
      { uuid: encounterUuid, resource: encounter as unknown as AnyFhirResource } as EncounterEntry,
      ...observationEntries,
      ...qrEntry,
      ...imagingStudyEntry,
    ]),
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Pick an assembler based on the active Questionnaire's URL → bundle-profile
 * mapping. Throws if the Questionnaire URL is not one of the three known
 * bundle-targeting Questionnaires.
 */
export function assembleBundle(
  extracted: ExtractedResources,
  questionnaireUrl: string,
  options: AssembleOptions = {},
): AssembleResult {
  if (questionnaireUrl.endsWith('/shoulder-registration')) {
    return assembleRegistrationBundle(extracted, options)
  }
  if (questionnaireUrl.endsWith('/shoulder-surgery')) {
    return assembleSurgeryBundle(extracted, options)
  }
  if (questionnaireUrl.endsWith('/shoulder-follow-up')) {
    return assembleFollowUpBundle(extracted, options)
  }
  throw new Error(`Unknown Questionnaire URL — no bundle assembler registered: ${questionnaireUrl}`)
}
