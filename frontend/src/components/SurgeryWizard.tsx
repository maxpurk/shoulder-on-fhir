import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StepIndicator from './wizard/StepIndicator'
import PatientLookup, { type LookupResult } from './shared/PatientLookup'
import SurgicalEventStep, {
  type SurgicalEventFormState,
  type ProcedureFormState,
  type SurgicalProcedureFormItem,
} from './surgery/SurgicalEventStep'
import IntraOpObservationsStep, { type IntraOpFormState } from './surgery/IntraOpObservationsStep'
import SurgeryReview from './surgery/SurgeryReview'
import { fhirClient, FhirError, BUNDLE_PROFILES } from '../lib/fhirClient'
import { preflightValidate } from '../lib/preflightValidate'
import { assembleSurgeryEntries } from '../lib/surgeryBundleBuilder'
import { OBSERVATION_METADATA } from '../config/observationMetadata'
import { useValueSet, type TermOption } from '../hooks/useValueSet'
import { computeTimepoints } from '../lib/patientStage'
import {
  ENCOUNTER_CLASS_AMBULATORY,
  ENCOUNTER_CLASS_INPATIENT,
  IG_CANONICAL,
  OBSERVATION_CODES,
  OBSERVATION_PROFILE_URLS,
  PROCEDURE_CATEGORY,
  PROFILE_URLS,
  SHOULDER_LATERALITY,
  SURGERY_ENCOUNTER_TYPE,
  VALUESET_URLS,
} from '../types/fhir'
import type { WizardEntry } from '../types/fhir'
import type {
  CarePlan,
  Encounter,
  Observation,
  OperationOutcome,
  Procedure,
  TransactionResponseBundle,
} from '../types/fhir'

/**
 * Surgery Wizard — T1 submission per ADR-0034.
 *
 * Captures the surgical event for an already-registered patient. Patient
 * and Condition come from the prior RotatorCuffRegistrationBundle and are
 * referenced via persisted IDs. Output is one RotatorCuffSurgeryBundle
 * (Encounter + Procedures + optional intra-op Observations).
 *
 * Per ADR-0110 (refined by ADR-0121), the surgeon enters one "day of
 * surgery" plus one incision/suture-closure time for the whole surgical
 * event (no separate Encounter admission window, and no per-procedure
 * incision/suture) — the merged Surgical Event step below folds what used
 * to be a standalone Encounter step into the Procedures step. Every
 * Procedure recorded (index + any concomitant) shares that one incision
 * and closure, since a concomitant procedure is performed through the same
 * skin incision as the index procedure, not a separate one. Encounter.period
 * is composed directly from the same pair.
 */

type Step = 'lookup' | 'surgical-event' | 'intraop' | 'review' | 'done'

const STEPS = [
  { number: 1, title: 'Find Patient' },
  { number: 2, title: 'Surgical Event' },
  { number: 3, title: 'Intra-op Findings', optional: true },
  { number: 4, title: 'Review' },
]

const stepNumber: Record<Step, number> = {
  lookup: 1,
  'surgical-event': 2,
  intraop: 3,
  review: 4,
  done: 4,
}

// 'YYYY-MM-DD' + 'HH:mm' (local wall-clock) -> offset-aware FHIR dateTime,
// e.g. 2024-04-15T09:00:00+02:00 (ADR-0110). A FHIR dateTime with minute
// precision SHALL carry a timezone offset; the raw datetime-local string
// this replaced carried none.
function composeDateTime(date: string, time: string): string {
  const d = new Date(`${date}T${time}`)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  return `${date}T${time}:00${sign}${hh}:${mm}`
}

function blankProcedure(): SurgicalProcedureFormItem {
  return {
    procedureCode: '',
    outcome: '',
    notes: '',
    procedureApproach: '',
    reconstructionExtent: '',
    fixationTechnique: '',
    diagnosisConditionId: '',
  }
}

function blankIntraOpForm(): IntraOpFormState {
  return { tearSize: '', tearSizeClassification: '' }
}

function buildProcedureResource(
  item: SurgicalProcedureFormItem,
  surgeryDate: string,
  incisionTime: string,
  sutureTime: string,
  patientReference: string,
  conditionReference: string | undefined,
  encounterUuid: string,
  lateralityCode: string,
  lateralityDisplay: string,
  primary: { code: string; display?: string },
  performerName: string,
  // ADR-0186: set for a concomitant procedure only, pointing at the index
  // procedure of the same surgical event. Left undefined for the index
  // procedure itself, whose absence of partOf is what identifies it.
  partOf?: { reference: string }[],
): Procedure {
  const proc: Procedure = {
    resourceType: 'Procedure',
    meta: { profile: [PROFILE_URLS.PROCEDURE] },
    // No longer prompted (surgeon feedback, ADR-0108) — every procedure
    // recorded through this retrospective wizard is completed by
    // construction. Procedure.status stays 1..1 MS (FHIR-required).
    status: 'completed',
    category: { coding: [PROCEDURE_CATEGORY.SURGICAL] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: primary.code, display: primary.display }] },
    subject: { reference: patientReference },
    // Incision/suture-closure time (ADR-0108), composed against the single
    // wizard-level day-of-surgery date (ADR-0110). One incision/closure
    // pair per surgical event, shared by every procedure recorded in it
    // (ADR-0121) — a concomitant procedure is performed through the same
    // skin incision as the index procedure, not a separate one.
    performedPeriod: {
      ...(surgeryDate && incisionTime && { start: composeDateTime(surgeryDate, incisionTime) }),
      ...(surgeryDate && sutureTime && { end: composeDateTime(surgeryDate, sutureTime) }),
    },
    bodySite: [{
      coding: [{ system: SHOULDER_LATERALITY.SYSTEM, code: lateralityCode, display: lateralityDisplay }],
    }],
    ...(partOf && partOf.length > 0 && { partOf }),
  }
  // Encounter cross-ref (resolved within the transaction)
  ;(proc as Procedure & { encounter?: { reference: string } }).encounter = {
    reference: `urn:uuid:${encounterUuid}`,
  }
  // ADR-0159: a concomitant procedure may address a different, coexisting
  // diagnosis than the index rotator cuff tear (RotatorCuffProcedure.
  // reasonReference was widened to allow this by ADR-0127); falls back to
  // the index Condition when no diagnosis was explicitly picked, unchanged
  // from before this ADR.
  const effectiveConditionReference = item.diagnosisConditionId
    ? `Condition/${item.diagnosisConditionId}`
    : conditionReference
  if (effectiveConditionReference) {
    proc.reasonReference = [{ reference: effectiveConditionReference }]
  }
  if (item.outcome) {
    proc.outcome = {
      coding: [{
        system: 'http://snomed.info/sct',
        code: item.outcome === 'successful' ? '385669000' : '385671000',
        display: item.outcome === 'successful' ? 'Successful' : 'Unsuccessful',
      }],
    }
  }
  if (item.notes) {
    proc.note = [{ text: item.notes }]
  }
  // Surgeon/performer (not Hurley-named — verified against the full Hurley
  // et al. 2024 text, L3.H.1). No Practitioner directory exists in this IG;
  // free-text name via Reference.display only, shared across every
  // procedure in the event (same one-per-event pattern as incision/closure,
  // ADR-0121).
  if (performerName) {
    proc.performer = [{ actor: { display: performerName } }]
  }
  return proc
}

// Postcoordinated procedure-technique Observations (ADR-0108) — approach /
// reconstruction extent / fixation technique, each linked back to the
// specific procedure it describes via partOf (a Surgery encounter can carry
// an index procedure plus 0..* concomitant procedures).
function buildTechniqueObservations(
  item: SurgicalProcedureFormItem,
  procedureUuid: string,
  patientReference: string,
  encounterUuid: string,
  approachOptions: Array<{ code: string; system?: string; display: string }>,
  extentOptions: Array<{ code: string; system?: string; display: string }>,
  fixationOptions: Array<{ code: string; system?: string; display: string }>,
): Observation[] {
  const effectiveDate = new Date().toISOString().split('T')[0]
  const partOf = [{ reference: `urn:uuid:${procedureUuid}` }]
  const category = [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'procedure', display: 'Procedure' }] }]

  const makeTechniqueObservation = (
    key: 'procedure-approach' | 'reconstruction-extent' | 'fixation-technique',
    display: string,
    value: string,
    options: Array<{ code: string; system?: string; display: string }>,
  ): Observation => {
    const option = options.find((o) => o.code === value)
    return {
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[key] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category,
      code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: key, display }] },
      subject: { reference: patientReference },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      effectiveDateTime: effectiveDate,
      valueCodeableConcept: {
        coding: [{ system: option?.system ?? 'http://snomed.info/sct', code: value, display: option?.display }],
      },
      partOf,
    }
  }

  const observations: Observation[] = []
  if (item.procedureApproach) {
    observations.push(makeTechniqueObservation('procedure-approach', 'Procedure Approach', item.procedureApproach, approachOptions))
  }
  if (item.reconstructionExtent) {
    observations.push(makeTechniqueObservation('reconstruction-extent', 'Reconstruction Extent', item.reconstructionExtent, extentOptions))
  }
  if (item.fixationTechnique) {
    observations.push(makeTechniqueObservation('fixation-technique', 'Fixation Technique', item.fixationTechnique, fixationOptions))
  }
  return observations
}

// Intra-operative tear-size Observations (ADR-0104) — the surgical-context
// (category=exam) siblings of Registration's imaging-context tear-size
// fields. Pure function (no React) so it's the single FHIR-construction
// site for this wizard's optional intra-op findings, exactly like
// buildProcedureResource above, and independently testable.
function buildIntraOpObservations(
  form: IntraOpFormState,
  patientReference: string,
  encounterUuid: string,
  lateralityCode: string,
  lateralityDisplay: string,
  cofieldOptions: TermOption[],
): Observation[] {
  const bodySite = {
    coding: [{ system: SHOULDER_LATERALITY.SYSTEM, code: lateralityCode, display: lateralityDisplay }],
  }
  const effectiveDate = new Date().toISOString().split('T')[0]
  const observations: Observation[] = []

  const tearSizeNum = parseFloat(form.tearSize)
  if (!isNaN(tearSizeNum) && form.tearSize.trim() !== '') {
    const tearMeta = OBSERVATION_METADATA['intraop-tear-size']
    observations.push({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.INTRAOP_TEAR_SIZE] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_SIZE, display: 'Tear Size' }] },
      subject: { reference: patientReference },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      effectiveDateTime: effectiveDate,
      valueQuantity: { value: tearSizeNum, unit: tearMeta.unitDisplay, system: 'http://unitsofmeasure.org', code: tearMeta.unit },
      bodySite,
    })
  }

  if (form.tearSizeClassification) {
    observations.push({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.INTRAOP_TEAR_SIZE_CLASSIFICATION] ?? PROFILE_URLS.OBSERVATION] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
      code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_SIZE_CLASSIFICATION, display: 'Tear Size Classification (Cofield)' }] },
      subject: { reference: patientReference },
      encounter: { reference: `urn:uuid:${encounterUuid}` },
      effectiveDateTime: effectiveDate,
      valueCodeableConcept: {
        coding: [{
          system: OBSERVATION_METADATA['intraop-tear-size-classification'].codeSystem,
          code: form.tearSizeClassification,
          display: cofieldOptions.find((o) => o.code === form.tearSizeClassification)?.display,
        }],
      },
      bodySite,
    })
  }

  return observations
}

// Q11 research follow-up schedule (ADR-0129) — generated automatically from
// the index procedure's date, no separate data-entry step. Reuses the exact
// same Q11_TIMEPOINTS offsets that lib/patientStage.ts already applies to
// compute the Follow-Up flow's planned-vs-actual schedule, via
// computeTimepoints, so the persisted CarePlan and the live-computed
// schedule can never drift apart. Returns undefined (no CarePlan emitted)
// when the index procedure has no dated performedPeriod.start yet.
function buildResearchCarePlan(indexProcedureDate: string | undefined, patientReference: string): CarePlan | undefined {
  if (!indexProcedureDate) return undefined
  const timepoints = computeTimepoints({ indexProcedureDate, followUpEncounters: [] })
  if (timepoints.length === 0) return undefined
  const last = timepoints[timepoints.length - 1]
  return {
    resourceType: 'CarePlan',
    meta: { profile: [PROFILE_URLS.CARE_PLAN] },
    status: 'active',
    intent: 'plan',
    subject: { reference: patientReference },
    period: { start: indexProcedureDate, end: last.scheduledIso },
    activity: timepoints.map((tp) => ({
      detail: {
        status: 'scheduled',
        scheduledTiming: { event: [tp.scheduledIso] },
        description: `Q11 research follow-up — ${tp.label} post-surgery`,
        code: {
          coding: [{
            system: `${IG_CANONICAL}/CodeSystem/q11-timepoint`,
            code: tp.code,
          }],
        },
      },
    })),
  }
}

function SurgeryWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetIdentifier =
    searchParams.get('identifier') ?? searchParams.get('patient') ?? ''

  const [step, setStep] = useState<Step>('lookup')
  useEffect(() => { window.scrollTo(0, 0) }, [step])
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const encounterUuid = useMemo(() => crypto.randomUUID(), [])
  const { options: procedureOptions } = useValueSet(VALUESET_URLS.ROTATOR_CUFF_PROCEDURE_TYPE)
  const { options: approachOptions } = useValueSet(VALUESET_URLS.PROCEDURE_APPROACH)
  const { options: extentOptions } = useValueSet(VALUESET_URLS.RECONSTRUCTION_EXTENT)
  const { options: fixationOptions } = useValueSet(VALUESET_URLS.FIXATION_TECHNIQUE)
  const { options: cofieldOptions } = useValueSet(VALUESET_URLS.COFIELD_TEAR_SIZE_CLASSIFICATION)

  const [eventForm, setEventForm] = useState<SurgicalEventFormState>({
    surgeryDate: '',
    setting: 'IMP',
    incisionTime: '',
    sutureTime: '',
    performerName: '',
  })
  const [procedureForm, setProcedureForm] = useState<ProcedureFormState>({
    index: blankProcedure(),
    concomitant: [],
  })
  const [intraOpForm, setIntraOpForm] = useState<IntraOpFormState>(blankIntraOpForm())

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationIssues, setValidationIssues] = useState<OperationOutcome['issue']>([])
  const [validatorUnavailable, setValidatorUnavailable] = useState<string | null>(null)
  const [response, setResponse] = useState<TransactionResponseBundle | null>(null)

  // Resolve laterality from the patient's existing Condition.bodySite. No
  // fallback to a specific side: an unrecognized/missing bodySite code
  // resolves to undefined rather than silently mislabeling the shoulder as
  // Right, blocking Procedure construction and submission below instead.
  const conditionLateralityCode = lookup?.condition?.bodySite?.[0]?.coding?.[0]?.code
  const lateralityCode =
    conditionLateralityCode === SHOULDER_LATERALITY.LEFT
      ? SHOULDER_LATERALITY.LEFT
      : conditionLateralityCode === SHOULDER_LATERALITY.RIGHT
      ? SHOULDER_LATERALITY.RIGHT
      : undefined
  const lateralityDisplay =
    lateralityCode === SHOULDER_LATERALITY.LEFT
      ? SHOULDER_LATERALITY.LEFT_DISPLAY
      : lateralityCode === SHOULDER_LATERALITY.RIGHT
      ? SHOULDER_LATERALITY.RIGHT_DISPLAY
      : undefined
  const lateralityUi: 'left' | 'right' | '' =
    lateralityCode === SHOULDER_LATERALITY.LEFT ? 'left' : lateralityCode === SHOULDER_LATERALITY.RIGHT ? 'right' : ''

  const entries = useMemo(() => {
    if (!lookup || !lateralityCode || !lateralityDisplay) return []
    const patientReference = `Patient/${lookup.patient.id}`
    const conditionReference = lookup.condition?.id ? `Condition/${lookup.condition.id}` : undefined

    // Encounter.period is composed directly from the one incision/closure
    // pair captured at the surgical-event level (ADR-0110, refined by
    // ADR-0121) rather than captured as its own separate admission window
    // — one fewer redundant date-time pair for the surgeon to enter.
    const concomitantItems = procedureForm.concomitant.filter((c) => c.procedureCode)

    const encounter: Encounter = {
      resourceType: 'Encounter',
      meta: { profile: [PROFILE_URLS.ENCOUNTER] },
      status: 'finished',
      class: eventForm.setting === 'IMP' ? ENCOUNTER_CLASS_INPATIENT : ENCOUNTER_CLASS_AMBULATORY,
      type: [{
        coding: [{ system: SURGERY_ENCOUNTER_TYPE.SYSTEM, code: SURGERY_ENCOUNTER_TYPE.CODE, display: SURGERY_ENCOUNTER_TYPE.DISPLAY }],
      }],
      subject: { reference: patientReference },
      period: {
        ...(eventForm.surgeryDate && eventForm.incisionTime && { start: composeDateTime(eventForm.surgeryDate, eventForm.incisionTime) }),
        ...(eventForm.surgeryDate && eventForm.sutureTime && { end: composeDateTime(eventForm.surgeryDate, eventForm.sutureTime) }),
      },
      ...(conditionReference && { reasonReference: [{ reference: conditionReference }] }),
    }

    // Each procedure gets its own uuid up front (rather than relying on
    // assembleSurgeryEntries to generate one) so the technique Observations
    // below can reference the right procedure via partOf (ADR-0108).
    const indexProcUuid = crypto.randomUUID()
    const indexProc = buildProcedureResource(
      procedureForm.index,
      eventForm.surgeryDate,
      eventForm.incisionTime,
      eventForm.sutureTime,
      patientReference,
      conditionReference,
      encounterUuid,
      lateralityCode,
      lateralityDisplay,
      {
        code: procedureForm.index.procedureCode,
        display: procedureOptions.find((o) => o.code === procedureForm.index.procedureCode)?.display,
      },
      eventForm.performerName,
    )

    // ADR-0186: a concomitant procedure points at the index procedure via
    // partOf. Bundle entry order marks the index only until the transaction is
    // persisted, after which a reader sees several procedures sharing one
    // encounter, performer and period with nothing distinguishing them; the
    // index procedure is the one that carries no partOf.
    const indexProcRef = [{ reference: `urn:uuid:${indexProcUuid}` }]
    const concomitantProcs = concomitantItems.map((c) => ({
      uuid: crypto.randomUUID(),
      resource: buildProcedureResource(
        c,
        eventForm.surgeryDate,
        eventForm.incisionTime,
        eventForm.sutureTime,
        patientReference,
        conditionReference,
        encounterUuid,
        lateralityCode,
        lateralityDisplay,
        {
          code: c.procedureCode,
          display: procedureOptions.find((o) => o.code === c.procedureCode)?.display,
        },
        eventForm.performerName,
        indexProcRef,
      ),
    }))

    const procedureEntries: WizardEntry[] = [
      { uuid: indexProcUuid, resource: indexProc },
      ...concomitantProcs,
    ]

    const techniqueObservations = [
      buildTechniqueObservations(procedureForm.index, indexProcUuid, patientReference, encounterUuid, approachOptions, extentOptions, fixationOptions),
      ...concomitantItems.map((item, i) =>
        buildTechniqueObservations(item, concomitantProcs[i].uuid, patientReference, encounterUuid, approachOptions, extentOptions, fixationOptions),
      ),
    ].flat()

    const observations = [
      ...buildIntraOpObservations(
        intraOpForm,
        patientReference,
        encounterUuid,
        lateralityCode,
        lateralityDisplay,
        cofieldOptions,
      ),
      ...techniqueObservations,
    ]

    // Anchored to the index procedure's own date (not just eventForm.surgeryDate
    // directly) so the schedule only gets generated once the same date is
    // actually present on the resource being submitted.
    const carePlan = buildResearchCarePlan(indexProc.performedPeriod?.start, patientReference)

    return assembleSurgeryEntries({
      encounter,
      encounterUuid,
      procedures: procedureEntries,
      observations,
      carePlan,
    })
  }, [lookup, eventForm, procedureForm, intraOpForm, encounterUuid, lateralityCode, lateralityDisplay, procedureOptions, approachOptions, extentOptions, fixationOptions, cofieldOptions])

  const handleSubmit = async () => {
    if (!lookup) return
    if (!lateralityCode || !lateralityDisplay) {
      setSubmitError(
        "Cannot determine shoulder laterality: the patient's Condition has no recognized left/right bodySite code. Fix the Condition record before submitting surgery data.",
      )
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    setValidationIssues([])
    setValidatorUnavailable(null)
    try {
      const preflight = await preflightValidate(entries, BUNDLE_PROFILES.SURGERY)
      if (preflight.kind === 'blocked') {
        setValidationIssues(preflight.issues)
        setSubmitting(false)
        return
      }
      if (preflight.kind === 'warnings') setValidationIssues(preflight.issues)
      if (preflight.kind === 'unavailable') setValidatorUnavailable(preflight.message ?? '')
      const resp = await fhirClient.submitBundle(entries, BUNDLE_PROFILES.SURGERY)
      setResponse(resp)
      setStep('done')
    } catch (err) {
      setSubmitError(
        err instanceof FhirError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Submission failed',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Record Surgical Event</h2>
          <p className="text-gray-500 text-sm">
            Surgical event record. References an already-registered patient and diagnosis.
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => {
            if (step === 'lookup' || window.confirm('Discard this surgery record? Everything entered so far will be lost.')) {
              navigate('/')
            }
          }}
        >
          ✕ Cancel
        </button>
      </div>

      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
        <strong>Clinician judgment required.</strong> Only fill fields that apply to this case.
        The form does not enforce clinical plausibility — leaving an inapplicable field empty
        is the correct choice.
      </div>

      <StepIndicator steps={STEPS} currentStep={stepNumber[step]} />

      {step === 'lookup' && (
        <PatientLookup
          initialIdentifier={presetIdentifier || undefined}
          onSelect={(r: LookupResult) => {
            setLookup(r)
            setStep('surgical-event')
          }}
        />
      )}

      {step === 'surgical-event' && lookup && (
        <SurgicalEventStep
          event={eventForm}
          onEventChange={setEventForm}
          value={procedureForm}
          onChange={setProcedureForm}
          laterality={lateralityUi}
          otherDiagnoses={lookup.otherDiagnoses}
          onComplete={() => setStep('intraop')}
          onBack={() => setStep('lookup')}
        />
      )}

      {step === 'intraop' && lookup && (
        <IntraOpObservationsStep
          laterality={lateralityUi}
          value={intraOpForm}
          onChange={setIntraOpForm}
          onComplete={() => setStep('review')}
          onBack={() => setStep('surgical-event')}
        />
      )}

      {step === 'review' && lookup && (
        <SurgeryReview
          patient={lookup.patient}
          condition={lookup.condition}
          entries={entries}
          submitting={submitting}
          error={submitError}
          validationIssues={validationIssues}
          validatorUnavailable={validatorUnavailable}
          onSubmit={handleSubmit}
          onBack={() => setStep('intraop')}
        />
      )}

      {step === 'done' && lookup && (
        <div className="card">
          <h3 className="card-header text-green-700">Surgery submission accepted</h3>
          <p className="text-sm text-gray-600 mb-3">
            The transaction was committed by HAPI. {response?.entry?.length ?? 0} resources written.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/patient/${lookup.patient.id}`)}>
              View patient
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/follow-up')}>
              Record a follow-up visit
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              Home
            </button>
          </div>
        </div>
      )}

      {presetIdentifier && step === 'lookup' && (
        <p className="mt-4 text-xs text-gray-500">
          Searching for patient with identifier <code>{presetIdentifier}</code> — paste it into the
          identifier field above.
        </p>
      )}
    </div>
  )
}

export default SurgeryWizard
