import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import StepIndicator from '../wizard/StepIndicator'
import PatientLookup, { type LookupResult } from '../shared/PatientLookup'
import TimepointPicker from './TimepointPicker'
import Q9ExamForm, { type Q9FormState } from './Q9ExamForm'
import Q12PromForm, { type Q12FormState } from './Q12PromForm'
import ReviewSubmit from './ReviewSubmit'
import { buildFollowUpEncounter } from '../../lib/encounterBuilder'
import {
  buildCodedObservation,
  buildNotDoneObservation,
  buildQuantityObservation,
  buildQuantityObservationWithComponents,
  buildStringObservation,
} from '../../lib/observationBuilder'
import { assembleFollowUpEntries } from '../../lib/followUpBundleBuilder'
import { Q9_FIELDS, Q12_FIELDS, type ObservationGroup } from '../../config/followupObservationMetadata'
import { getProcedureEffectiveDate } from '../../lib/patientStage'
import { useValueSet, type TermOption } from '../../hooks/useValueSet'
import { PROFILE_URLS, VALUESET_URLS } from '../../types/fhir'
import type { BundleEntry, CodeableConcept, Encounter, ImagingStudy, Observation, Reference, TransactionResponseBundle } from '../../types/fhir'
import type { FieldValue } from './ObservationField'

type Step = 'lookup' | 'timepoint' | 'q9' | 'q12' | 'review' | 'done'

// Pill-style step indicator, aligned with RegistrationWizard / SurgeryWizard (StepIndicator.tsx).
const STEPS = [
  { number: 1, title: 'Find Patient' },
  { number: 2, title: 'Timepoint' },
  { number: 3, title: 'Post-op Exam' },
  { number: 4, title: 'Outcomes' },
  { number: 5, title: 'Review' },
]

const stepNumber: Record<Step, number> = {
  lookup: 1,
  timepoint: 2,
  q9: 3,
  q12: 4,
  review: 5,
  done: 5,
}

// Observation groups physically anchored to a shoulder — these get bodySite (laterality).
// Aggregate/survey scores (PROM totals, satisfaction, return-to-activity) have no physical
// target site and are deliberately excluded (bodySite would be a semantic misuse there).
const LATERALIZED_GROUPS: ObservationGroup[] = ['rom-active', 'rom-passive', 'strength', 'provocation', 'exam-finding']

// Pain is inherently site-specific even though it's grouped under 'prom-score'
// (a PROM-instrument grouping, not a laterality one) — special-cased here to
// still get bodySite. ADR-0087 split the single pain-severity field into 4
// context-specific axes; all 4 keep this same carve-out.
const LATERALIZED_KEYS = ['pain-average', 'pain-active-movement', 'pain-passive-movement', 'pain-rest']

function isLateralizedField(key: string, group?: ObservationGroup): boolean {
  return LATERALIZED_KEYS.includes(key) || (group !== undefined && LATERALIZED_GROUPS.includes(group))
}

// ADR-0156: the aggregate/survey PROMs excluded from bodySite above (Constant
// handled separately via buildConstantScoreObservation) get Observation.focus
// instead, disambiguating which RotatorCuffCondition the score is about in a
// bilateral case.
const FOCUS_KEYS = ['ssv-score', 'sane-score', 'patient-satisfaction', 'return-to-sport-work']

function buildObservationsFromState(
  state: Record<string, FieldValue>,
  fieldDefs: Record<string, { valueType: 'quantity' | 'codeable' | 'string'; unit?: string; unitDisplay?: string; group?: ObservationGroup; category: 'exam' | 'survey' }>,
  patientReference: string,
  encounterUuid: string,
  effectiveDateTime: string,
  bodySite: CodeableConcept | undefined,
  conditionReference: Reference,
): Observation[] {
  const result: Observation[] = []
  for (const [key, value] of Object.entries(state)) {
    if (!value) continue
    const def = fieldDefs[key]
    if (!def) continue
    const site = isLateralizedField(key, def.group) ? bodySite : undefined
    const focus = FOCUS_KEYS.includes(key) ? conditionReference : undefined
    if (value.kind === 'quantity' && def.valueType === 'quantity') {
      result.push(
        buildQuantityObservation({
          profileKey: key,
          patientReference,
          encounterUuid,
          effectiveDateTime,
          category: def.category,
          value: value.value,
          unit: def.unit ?? '{score}',
          unitDisplay: def.unitDisplay,
          bodySite: site,
          focus,
        }),
      )
    } else if (value.kind === 'coded' && def.valueType === 'codeable') {
      result.push(
        buildCodedObservation({
          profileKey: key,
          patientReference,
          encounterUuid,
          effectiveDateTime,
          category: def.category,
          valueCoding: value.coding,
          bodySite: site,
          focus,
        }),
      )
    } else if (value.kind === 'string' && def.valueType === 'string') {
      result.push(
        buildStringObservation({
          profileKey: key,
          patientReference,
          encounterUuid,
          effectiveDateTime,
          category: def.category,
          valueString: value.value,
          bodySite: site,
          focus,
        }),
      )
    } else if (value.kind === 'not-done') {
      result.push(
        buildNotDoneObservation({
          profileKey: key,
          patientReference,
          encounterUuid,
          effectiveDateTime,
          category: def.category,
          bodySite: site,
          focus,
        }),
      )
    }
  }
  return result
}

// ADR-0090: the Constant-Murley total + its four component keys are pulled
// out of the generic per-key loop above (which would otherwise emit 5
// separate Observations) and merged into a single ConstantScoreObservation
// with Observation.component[] — mirroring the SDC extractor's same
// same-profile-leaf-merging strategy.
const CONSTANT_SCORE_KEY = 'constant-score'
const CONSTANT_COMPONENT_KEYS = ['constant-score-pain', 'constant-score-adl', 'constant-score-rom', 'constant-score-strength']
const ALL_CONSTANT_KEYS = [CONSTANT_SCORE_KEY, ...CONSTANT_COMPONENT_KEYS]

function buildConstantScoreObservation(
  state: Q12FormState,
  patientReference: string,
  encounterUuid: string,
  effectiveDateTime: string,
  conditionReference: Reference,
): Observation | undefined {
  const total = state[CONSTANT_SCORE_KEY]
  if (!total || total.kind !== 'quantity') return undefined

  const def = Q12_FIELDS[CONSTANT_SCORE_KEY]
  const components = CONSTANT_COMPONENT_KEYS
    .map((key) => ({ key, value: state[key] }))
    .filter((c): c is { key: string; value: Extract<FieldValue, { kind: 'quantity' }> } => c.value?.kind === 'quantity')
    .map(({ key, value }) => ({
      code: key,
      value: value.value,
      unit: Q12_FIELDS[key]?.unit ?? '{score}',
      unitDisplay: Q12_FIELDS[key]?.unitDisplay,
    }))

  return buildQuantityObservationWithComponents({
    profileKey: CONSTANT_SCORE_KEY,
    patientReference,
    encounterUuid,
    effectiveDateTime,
    category: 'survey',
    value: total.value,
    unit: def.unit ?? '{score}',
    unitDisplay: def.unitDisplay,
    components,
    focus: conditionReference,
  })
}

function FollowUpWizard() {
  const [searchParams] = useSearchParams()
  const presetIdentifier =
    searchParams.get('identifier') ?? searchParams.get('patient') ?? ''
  const presetTimepointDaysRaw = searchParams.get('timepoint')
  const presetTimepointDays = presetTimepointDaysRaw
    ? Number(presetTimepointDaysRaw)
    : undefined

  const [step, setStep] = useState<Step>('lookup')
  useEffect(() => { window.scrollTo(0, 0) }, [step])
  const { options: modalityOptions } = useValueSet(VALUESET_URLS.IMAGING_MODALITY)
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [visitDate, setVisitDate] = useState<string | null>(null)
  const [q9State, setQ9State] = useState<Q9FormState>({})
  const [q12State, setQ12State] = useState<Q12FormState>({})
  // Research re-imaging (Q13 exception) — optional, only asked at the
  // research re-imaging timepoint. RotatorCuffFollowUpBundle's
  // entry[imagingStudy] slice is 0..1; empty string means "not done at
  // this visit," same convention as every other optional field here.
  const [imagingModality, setImagingModality] = useState('')
  const [submittedResponse, setSubmittedResponse] = useState<TransactionResponseBundle | null>(null)

  const encounterWithUuid = useMemo<{ encounter: Encounter; uuid: string } | null>(() => {
    if (!lookup || !visitDate) return null
    const encounter = buildFollowUpEncounter({
      patientReference: `Patient/${lookup.patient.id}`,
      conditionReference: `Condition/${lookup.condition.id}`,
      visitStart: visitDate,
    })
    return { encounter, uuid: crypto.randomUUID() }
  }, [lookup, visitDate])

  const encounter = encounterWithUuid?.encounter ?? null
  const encounterUuid = encounterWithUuid?.uuid ?? ''

  const entries: BundleEntry[] = useMemo(() => {
    if (!encounter || !lookup || !visitDate) return []
    const patientRef = `Patient/${lookup.patient.id}`
    const bodySite = lookup.condition.bodySite?.[0]
    // ADR-0090: Constant-Murley's 5 keys are excluded from the generic
    // per-key loop (which would otherwise emit 5 separate Observations) and
    // assembled into one ConstantScoreObservation with component[] instead.
    const q12StateWithoutConstant = Object.fromEntries(
      Object.entries(q12State).filter(([key]) => !ALL_CONSTANT_KEYS.includes(key)),
    )
    const conditionRef: Reference = { reference: `Condition/${lookup.condition.id}` }
    const constantScoreObs = buildConstantScoreObservation(q12State, patientRef, encounterUuid, visitDate, conditionRef)
    const observations = [
      ...buildObservationsFromState(q9State, Q9_FIELDS, patientRef, encounterUuid, visitDate, bodySite, conditionRef),
      ...buildObservationsFromState(q12StateWithoutConstant, Q12_FIELDS, patientRef, encounterUuid, visitDate, bodySite, conditionRef),
      ...(constantScoreObs ? [constantScoreObs] : []),
    ]
    // ADR-0172: `started` reuses the follow-up visit date the flow already
    // holds (same value stamped on this visit's Observations); the per-visit
    // `encounter` link is retained since a patient has several follow-ups.
    const imagingStudy: ImagingStudy | undefined = imagingModality
      ? {
          resourceType: 'ImagingStudy',
          meta: { profile: [PROFILE_URLS.IMAGING_STUDY] },
          status: 'available',
          subject: { reference: patientRef },
          started: visitDate,
          encounter: { reference: `urn:uuid:${encounterUuid}` },
          modality: [{
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: imagingModality,
            display: modalityOptions.find((o) => o.code === imagingModality)?.display,
          }],
        }
      : undefined
    return assembleFollowUpEntries({ encounter, encounterUuid, observations, imagingStudy })
  }, [encounter, encounterUuid, lookup, visitDate, q9State, q12State, imagingModality, modalityOptions])

  const observationCount = entries.filter((e) => e.resource.resourceType === 'Observation').length
  const canReview = encounter !== null && observationCount > 0

  function resetWizard() {
    setStep('lookup')
    setLookup(null)
    setVisitDate(null)
    setQ9State({})
    setQ12State({})
    setImagingModality('')
    setSubmittedResponse(null)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shoulder Registry — Follow-Up Visit</h1>
        <p className="text-sm text-gray-600 mt-1">
          Records the post-operative exam and patient-reported outcomes for an already-registered
          patient at this visit.
        </p>
        <StepIndicator steps={STEPS} currentStep={stepNumber[step]} />
      </header>

      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
        <strong>Clinician judgment required.</strong> Only fill fields that apply to this visit.
        The form does not enforce clinical plausibility — leaving an inapplicable field empty
        is the correct choice.
      </div>

      {step === 'lookup' && (
        <>
          <PatientLookup
            initialIdentifier={presetIdentifier || undefined}
            onSelect={(r: LookupResult) => {
              setLookup(r)
              setStep('timepoint')
            }}
          />
        </>
      )}

      {step === 'timepoint' && lookup && (
        <>
          <ContextBanner lookup={lookup} />
          <TimepointPicker
            indexProcedure={lookup.indexProcedure}
            priorEncounters={lookup.priorEncounters}
            autoPickDays={presetTimepointDays}
            onPick={(iso) => {
              setVisitDate(iso)
              setStep('q9')
            }}
          />
          <NavBar
            onBack={() => setStep('lookup')}
            backLabel="← Change patient"
            nextLabel=""
            onNext={undefined}
          />
        </>
      )}

      {step === 'q9' && lookup && visitDate && (
        <>
          <ContextBanner lookup={lookup} visitDate={visitDate} />
          <Q9ExamForm state={q9State} onChange={setQ9State} />
          <ReImagingField value={imagingModality} onChange={setImagingModality} options={modalityOptions} />
          <NavBar
            onBack={() => setStep('timepoint')}
            onNext={() => setStep('q12')}
            nextLabel="Continue to Outcome Scores →"
          />
        </>
      )}

      {step === 'q12' && lookup && visitDate && (
        <>
          <ContextBanner lookup={lookup} visitDate={visitDate} />
          <Q12PromForm state={q12State} onChange={setQ12State} q9State={q9State} onQ9Change={setQ9State} />
          <NavBar
            onBack={() => setStep('q9')}
            onNext={() => setStep('review')}
            nextLabel={
              canReview
                ? `Review (${observationCount} Observation${observationCount === 1 ? '' : 's'}) →`
                : 'Fill at least one observation to continue'
            }
            nextDisabled={!canReview}
          />
        </>
      )}

      {step === 'review' && encounter && (
        <>
          <ContextBanner lookup={lookup!} visitDate={visitDate!} />
          <ReviewSubmit
            encounter={encounter}
            entries={entries}
            onBack={() => setStep('q12')}
            onSubmitted={(resp) => {
              setSubmittedResponse(resp)
              setStep('done')
            }}
          />
        </>
      )}

      {step === 'done' && submittedResponse && (
        <div className="card">
          <h2 className="card-header">Submitted</h2>
          <p className="text-gray-700 mb-4">
            The follow-up visit has been committed to HAPI. You can now record another visit for the
            same or a different patient.
          </p>
          <button type="button" className="btn btn-primary" onClick={resetWizard}>
            Record another follow-up
          </button>
        </div>
      )}
    </div>
  )
}

// Research re-imaging (Q13 exception, RotatorCuffFollowUpBundle's
// entry[imagingStudy] 0..1 slice) — mirrors StepImaging.tsx's Registration
// modality picker (ADR-0130), which this visit-level slot has never had a
// UI affordance for until now.
function ReImagingField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (next: string) => void
  options: TermOption[]
}) {
  return (
    <div className="card mt-4">
      <h2 className="card-header">Re-imaging (optional)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Only applicable at the research re-imaging timepoint (Q13). Leave unset if no imaging was
        obtained at this visit.
      </p>
      <div className="form-group max-w-xs">
        <label className="form-label" htmlFor="reimaging-modality">Imaging Modality</label>
        <select
          id="reimaging-modality"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>{o.display}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function ContextBanner({
  lookup,
  visitDate,
}: {
  lookup: LookupResult
  visitDate?: string
}) {
  const name = lookup.patient.name?.[0]
  const fullName = [name?.given?.join(' '), name?.family].filter(Boolean).join(' ').trim()
  return (
    <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
      <div className="font-semibold text-blue-900">
        {fullName || `(unnamed) Patient/${lookup.patient.id}`}
      </div>
      <div className="text-blue-800 text-xs">
        Patient/{lookup.patient.id} · Condition/{lookup.condition.id}
        {lookup.indexProcedure && (
          <span>
            {' '}
            {/* ADR-0118: read via getProcedureEffectiveDate, not performedDateTime
                directly — the surgery wizard (ADR-0108) writes performedPeriod.start,
                so a direct performedDateTime read here always rendered blank. */}
            · index op {getProcedureEffectiveDate(lookup.indexProcedure)?.slice(0, 10)}
          </span>
        )}
        {visitDate && <span> · this visit: {visitDate.slice(0, 16).replace('T', ' ')}</span>}
      </div>
    </div>
  )
}

function NavBar({
  onBack,
  onNext,
  backLabel = '← Back',
  nextLabel = 'Next →',
  nextDisabled = false,
}: {
  onBack: () => void
  onNext?: () => void
  backLabel?: string
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="flex justify-between mt-4">
      <button type="button" className="btn btn-secondary" onClick={onBack}>
        {backLabel}
      </button>
      {onNext && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}

export default FollowUpWizard
