import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StepIndicator from './wizard/StepIndicator'
import StepPatient from './wizard/StepPatient'
import StepCondition from './wizard/StepCondition'
import StepImaging from './wizard/StepImaging'
import StepClinicalAssessment from './wizard/StepClinicalAssessment'
import StepOutcomeScores from './wizard/StepOutcomeScores'
import StepSummary from './wizard/StepSummary'
import {
  createInitialPatientForm,
  createInitialConditionForm,
  INITIAL_IMAGING_FORM,
  INITIAL_CLINICAL_ASSESSMENT_FORM,
  INITIAL_OUTCOME_SCORES_FORM,
  type PatientFormData,
  type ConditionFormData,
  type ImagingFormData,
  type ClinicalAssessmentFormData,
  type OutcomeScoresFormData,
} from './wizard/stepFormData'
import type { DiagnosisRank } from './wizard/StepCondition'
import { fhirClient, FhirError, BUNDLE_PROFILES } from '../lib/fhirClient'
import { preflightValidate } from '../lib/preflightValidate'
import { buildRegistrationEncounter } from '../lib/encounterBuilder'
import { assembleRegistrationEntries } from '../lib/registrationBundleBuilder'
import { SHOULDER_LATERALITY } from '../types/fhir'
import type {
  Condition,
  Observation,
  Patient,
  Procedure,
  WizardEntry,
  OperationOutcome,
} from '../types/fhir'

const STAGE_PROFILE_KEYS = [
  'patte-observation',
  'goutallier-observation',
  'tear-size-classification-observation',
]

// Visit-level evidence only — glued onto the PRINCIPAL Condition by this
// global filter. Tendons-involved and tear-location evidence are wired
// directly onto their owning Condition inside StepCondition itself (each
// diagnosis can have its own), so they're deliberately absent from this
// list. Provocation tests are visit-level (not per-diagnosis) so they belong
// here. Sleep disturbance (ADR-0081) is captured once in StepPatient, before
// any diagnosis card exists, so — like the provocation tests — it can only
// sensibly attach to the principal Condition.
const EVIDENCE_PROFILE_KEYS = [
  'jobe-test-observation',
  'lift-off-test-observation',
  'belly-press-test-observation',
  'bear-hug-test-observation',
  'hornblower-test-observation',
  'sleep-disturbance-observation',
]

function isStageObservation(resource: WizardEntry['resource']): resource is Observation {
  if (resource.resourceType !== 'Observation') return false
  const profiles = resource.meta?.profile ?? []
  return profiles.some((p) => STAGE_PROFILE_KEYS.some((key) => p.endsWith(`/${key}`)))
}

function isEvidenceObservation(resource: WizardEntry['resource']): resource is Observation {
  if (resource.resourceType !== 'Observation') return false
  const profiles = resource.meta?.profile ?? []
  return profiles.some((p) => EVIDENCE_PROFILE_KEYS.some((key) => p.endsWith(`/${key}`)))
}

/**
 * Registration Wizard — pre-operative (T0) submission per ADR-0034.
 *
 * The surgical procedure is NOT captured here — it lives in SurgeryWizard
 * (T1 submission) which references the Patient + Condition created by this
 * flow via persisted IDs. Prior non-surgical treatments (Q1.f PT and
 * injection) are captured in StepPatient and emitted as RotatorCuffProcedure
 * resources with the PT / Medication categories required by
 * PriorTreatmentCategoryVS.
 */

const STEPS = [
  { number: 1, title: 'Patient' },
  { number: 2, title: 'Diagnosis' },
  { number: 3, title: 'Imaging', optional: true },
  { number: 4, title: 'Assessment', optional: true },
  { number: 5, title: 'Baseline Scores', optional: true },
  { number: 6, title: 'Review' },
]

function RegistrationWizard() {
  const navigate = useNavigate()

  // Stable UUIDs for cross-references within the transaction.
  const patientUuid = useMemo(() => crypto.randomUUID(), [])
  const encounterUuid = useMemo(() => crypto.randomUUID(), [])
  const conditionUuid = useMemo(() => crypto.randomUUID(), [])

  const [currentStep, setCurrentStep] = useState(1)
  useEffect(() => { window.scrollTo(0, 0) }, [currentStep])
  const [laterality, setLaterality] = useState('')
  // {uuid, rank} for every diagnosis submitted in step 2, principal-first.
  // Feeds ShoulderEncounter.diagnosis[] — populated on the Encounter only
  // when there's more than one (see buildAllEntries).
  const [diagnosisRanks, setDiagnosisRanks] = useState<DiagnosisRank[]>([])
  const [resourcesByStep, setResourcesByStep] = useState<Record<number, WizardEntry[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationIssues, setValidationIssues] = useState<OperationOutcome['issue']>([])
  const [validatorUnavailable, setValidatorUnavailable] = useState<string | null>(null)

  // Wizard-owned form state per step: lifted up so back-navigation preserves
  // both committed and in-edit values (Bug 1).
  const [patientForm, setPatientForm] = useState<PatientFormData>(createInitialPatientForm)
  const [conditionForm, setConditionForm] = useState<ConditionFormData>(createInitialConditionForm)
  const [imagingForm, setImagingForm] = useState<ImagingFormData>(INITIAL_IMAGING_FORM)
  const [assessmentForm, setAssessmentForm] = useState<ClinicalAssessmentFormData>(INITIAL_CLINICAL_ASSESSMENT_FORM)
  const [outcomeScoresForm, setOutcomeScoresForm] = useState<OutcomeScoresFormData>(INITIAL_OUTCOME_SCORES_FORM)

  const advance = () => setCurrentStep((s) => s + 1)
  const goBack = () => setCurrentStep((s) => s - 1)

  const storeAndAdvance = (step: number, entries: WizardEntry[]) => {
    setResourcesByStep((prev) => ({ ...prev, [step]: entries }))
    advance()
  }

  const skipStep = (step: number) => {
    setResourcesByStep((prev) => ({ ...prev, [step]: [] }))
    advance()
  }

  // Reassemble the bundle entries with the registration Encounter inserted as
  // the cross-resource anchor (ADR-0037). Order: Patient → Encounter →
  // Condition → step-1 history (Obs + prior Procedures) → step-3/4/5 Obs.
  // Imaging-classification observation UUIDs are folded into
  // Condition.evidence.detail before submit.
  const buildAllEntries = (): WizardEntry[] => {
    const step1 = resourcesByStep[1] ?? []
    const step2 = resourcesByStep[2] ?? []
    const step3to5 = [3, 4, 5].flatMap((s) => resourcesByStep[s] ?? [])

    const patientEntry = step1.find((e) => e.resource.resourceType === 'Patient')
    // Step 2 may now carry MULTIPLE Condition entries (a principal
    // RotatorCuffCondition plus 0..* additional RC or non-RC diagnoses) —
    // the principal is identified by uuid, not by "first Condition found".
    const conditionEntry = step2.find((e) => e.uuid === conditionUuid)
    if (!patientEntry || !conditionEntry) return [...step1, ...step2, ...step3to5]

    const step1History = step1.filter((e) => e !== patientEntry)
    // Everything else step 2 produced — secondary Condition entries and
    // their own TendonsInvolvedObservation / TearLocationObservation
    // (already wired into their own Condition's evidence.detail by
    // StepCondition), plus the principal's own tendon/tear-location
    // Observations, which only need to pass through unchanged here.
    const step2Extras = step2.filter((e) => e !== conditionEntry)
    // RotatorCuffProcedure requires bodySite (1..1 bound to ShoulderLateralityVS).
    // Prior-treatment Procedures are built in StepPatient before laterality is
    // chosen in StepCondition, so the bodySite is stitched in here once it's known.
    const lateralityBodySite = laterality
      ? {
          coding: [
            {
              system: SHOULDER_LATERALITY.SYSTEM,
              code: laterality === 'left' ? SHOULDER_LATERALITY.LEFT : SHOULDER_LATERALITY.RIGHT,
              display:
                laterality === 'left'
                  ? SHOULDER_LATERALITY.LEFT_DISPLAY
                  : SHOULDER_LATERALITY.RIGHT_DISPLAY,
            },
          ],
        }
      : null
    const withBodySite = (entry: WizardEntry): WizardEntry => {
      if (entry.resource.resourceType !== 'Procedure' || !lateralityBodySite) return entry
      const proc = entry.resource as Procedure
      if (proc.bodySite && proc.bodySite.length > 0) return entry
      return { ...entry, resource: { ...proc, bodySite: [lateralityBodySite] } }
    }
    const trailing = [...step1History, ...step2Extras, ...step3to5].map(withBodySite)

    const stageRefs = trailing
      .filter((e) => isStageObservation(e.resource))
      .map((e) => ({ reference: `urn:uuid:${e.uuid}` }))

    // Provocation-test evidence, glued onto the principal Condition (they're
    // not per-diagnosis). Merged with — not overwriting — whatever evidence
    // StepCondition already set directly on the principal (its own tendon /
    // tear-location Observations).
    const provocationEvidenceRefs = trailing
      .filter((e) => isEvidenceObservation(e.resource))
      .map((e) => ({ reference: `urn:uuid:${e.uuid}` }))
    const existingEvidenceRefs = (conditionEntry.resource as Condition).evidence?.[0]?.detail ?? []
    const combinedEvidenceRefs = [...existingEvidenceRefs, ...provocationEvidenceRefs]

    const conditionWithEvidence: Condition = {
      ...(conditionEntry.resource as Condition),
      ...(stageRefs.length > 0 && { stage: [{ assessment: stageRefs }] }),
      ...(combinedEvidenceRefs.length > 0 && { evidence: [{ detail: combinedEvidenceRefs }] }),
    }

    // Encounter.diagnosis[] only makes sense (and is only populated) when
    // there's more than one diagnosis — with exactly one, rank is
    // unambiguous and reasonReference alone already identifies it.
    const encounter = buildRegistrationEncounter({
      patientReference: `urn:uuid:${patientUuid}`,
      conditionReference: `urn:uuid:${conditionUuid}`,
      visitStart: new Date().toISOString(),
      ...(diagnosisRanks.length > 1 && {
        diagnoses: diagnosisRanks.map(({ uuid, rank }) => ({
          reference: `urn:uuid:${uuid}`,
          rank,
          use:
            rank === 1
              ? { system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role', code: 'CC', display: 'Chief complaint' }
              : { system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role', code: 'CM', display: 'comorbidity diagnosis' },
        })),
      }),
    })

    return assembleRegistrationEntries({
      patient: patientEntry.resource as Patient,
      patientUuid,
      encounter,
      encounterUuid,
      condition: conditionWithEvidence,
      conditionUuid,
      priorAndObservationEntries: trailing,
    })
  }

  const summaryEntries = buildAllEntries()

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    setValidationIssues([])
    setValidatorUnavailable(null)
    try {
      const allEntries = buildAllEntries()
      // Strict pre-flight via Validator sidecar (ADR-0051). Block on error/fatal;
      // allow on warnings; fail-open banner if sidecar unreachable.
      const preflight = await preflightValidate(allEntries, BUNDLE_PROFILES.REGISTRATION)
      if (preflight.kind === 'blocked') {
        setValidationIssues(preflight.issues)
        setSubmitting(false)
        return
      }
      if (preflight.kind === 'warnings') setValidationIssues(preflight.issues)
      if (preflight.kind === 'unavailable') setValidatorUnavailable(preflight.message ?? '')
      const response = await fhirClient.submitBundle(allEntries, BUNDLE_PROFILES.REGISTRATION)
      const patientLocation = response.entry
        ?.find((e) => e.response?.location?.startsWith('Patient/'))
        ?.response?.location
      const patientId = patientLocation?.split('/')[1]
      if (!patientId) {
        throw new Error('Server did not return a Patient location in the transaction response')
      }
      // After Registration succeeds, send the user to the patient detail page
      // (existing route). From there they can launch the Surgery flow with
      // the new identifier pre-filled.
      navigate(`/patient/${patientId}?next=surgery`)
    } catch (err) {
      setSubmitError(
        err instanceof FhirError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Submission failed',
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Register New Patient (Pre-Op)</h2>
          <p className="text-gray-500 text-sm">
            Pre-operative record. Surgery is captured separately in the Surgery flow.
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => {
            if (currentStep === 1 || window.confirm('Discard this registration? Everything entered so far will be lost.')) {
              navigate('/')
            }
          }}
        >
          ✕ Cancel
        </button>
      </div>

      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
        <strong>Clinician judgment required.</strong> Only fill fields that apply to this patient.
        For example, do not record a tear size, Patte stage, or Goutallier grade if no tear is
        present. The form does not enforce clinical plausibility — leaving an inapplicable field
        empty is the correct choice.
      </div>

      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {currentStep === 1 && (
        <StepPatient
          patientUuid={patientUuid}
          conditionUuid={conditionUuid}
          encounterUuid={encounterUuid}
          value={patientForm}
          onChange={setPatientForm}
          onComplete={(entries) => storeAndAdvance(1, entries)}
        />
      )}

      {currentStep === 2 && (
        <StepCondition
          patientUuid={patientUuid}
          conditionUuid={conditionUuid}
          encounterUuid={encounterUuid}
          value={conditionForm}
          onChange={setConditionForm}
          onComplete={(entries, lat, ranks) => {
            setLaterality(lat)
            setDiagnosisRanks(ranks)
            storeAndAdvance(2, entries)
          }}
          onBack={goBack}
        />
      )}

      {currentStep === 3 && (
        <StepImaging
          patientUuid={patientUuid}
          encounterUuid={encounterUuid}
          laterality={laterality}
          value={imagingForm}
          onChange={setImagingForm}
          onComplete={(entries) => storeAndAdvance(3, entries)}
          onSkip={() => skipStep(3)}
          onBack={goBack}
        />
      )}

      {currentStep === 4 && (
        <StepClinicalAssessment
          patientUuid={patientUuid}
          encounterUuid={encounterUuid}
          laterality={laterality}
          value={assessmentForm}
          onChange={setAssessmentForm}
          onComplete={(entries) => storeAndAdvance(4, entries)}
          onSkip={() => skipStep(4)}
          onBack={goBack}
        />
      )}

      {currentStep === 5 && (
        <StepOutcomeScores
          patientUuid={patientUuid}
          encounterUuid={encounterUuid}
          conditionUuid={conditionUuid}
          value={outcomeScoresForm}
          onChange={setOutcomeScoresForm}
          assessment={assessmentForm}
          patient={patientForm}
          onAssessmentChange={setAssessmentForm}
          onPatientChange={setPatientForm}
          onComplete={(entries) => storeAndAdvance(5, entries)}
          onSkip={() => skipStep(5)}
          onBack={goBack}
        />
      )}

      {currentStep === 6 && (
        <StepSummary
          allEntries={summaryEntries}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={submitError}
          validationIssues={validationIssues}
          validatorUnavailable={validatorUnavailable}
          onBack={goBack}
        />
      )}
    </div>
  )
}

export default RegistrationWizard
