import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type {
  Patient,
  Condition,
  Procedure,
  Observation,
  Encounter,
  Bundle,
} from '../types/fhir'
import {
  computePatientWorkflow,
  getProcedureEffectiveDate,
  type PatientWorkflow,
  type Timepoint,
  type WorkflowStage,
} from '../lib/patientStage'
import {
  groupByEncounter,
  type EncounterBucket,
  type GroupedPatientData,
} from '../lib/encounterGrouping'
import { PROFILE_URLS, IPS_ABSENT_UNKNOWN } from '../types/fhir'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

function isComorbidity(c: Condition): boolean {
  return c.meta?.profile?.includes(PROFILE_URLS.COMORBIDITY_CONDITION) ?? false
}

function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [grouped, setGrouped] = useState<GroupedPatientData | null>(null)
  const [workflow, setWorkflow] = useState<PatientWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (patientId) loadPatientData(patientId)
  }, [patientId])

  async function loadPatientData(id: string) {
    setLoading(true)
    setError(null)
    try {
      const [
        patientData,
        encountersBundle,
        conditionsBundle,
        proceduresBundle,
        observationsBundle,
      ] = await Promise.all([
        fhirClient.read<Patient>('Patient', id),
        fhirClient.search<Encounter>('Encounter', {
          subject: `Patient/${id}`,
          _sort: 'date',
          _count: '50',
        }) as Promise<Bundle<Encounter>>,
        fhirClient.search<Condition>('Condition', {
          subject: `Patient/${id}`,
        }) as Promise<Bundle<Condition>>,
        fhirClient.search<Procedure>('Procedure', {
          subject: `Patient/${id}`,
          _sort: 'date',
          _count: '50',
        }) as Promise<Bundle<Procedure>>,
        fhirClient.search<Observation>('Observation', {
          subject: `Patient/${id}`,
          _count: '500',
        }) as Promise<Bundle<Observation>>,
      ])

      const encounters = encountersBundle.entry?.map((e) => e.resource) ?? []
      const conditions = conditionsBundle.entry?.map((e) => e.resource) ?? []
      const procedures = proceduresBundle.entry?.map((e) => e.resource) ?? []
      const observations = observationsBundle.entry?.map((e) => e.resource) ?? []

      setPatient(patientData)
      setGrouped(groupByEncounter({ encounters, conditions, procedures, observations }))
      setWorkflow(computePatientWorkflow({ encounters, procedures }))
    } catch (err) {
      setError(
        err instanceof FhirError
          ? `Failed to load patient data: ${err.message}`
          : 'An unexpected error occurred',
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (error || !patient || !grouped || !workflow) {
    return (
      <div className="max-w-4xl mx-auto">
        <ErrorBanner message={error || 'Patient not found'} />
        <Link to="/patients" className="text-hpi-orange hover:underline mt-4 inline-block">
          &larr; Back to patients
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <Link to="/patients" className="text-slate-600 hover:text-slate-900 text-sm">
            &larr; Back to patients
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 mt-1 truncate">{getPatientName(patient)}</h2>
          <p className="text-xs text-slate-500 mt-0.5 break-all">
            Patient/{patient.id}
            {patient.identifier?.[0]?.value && (
              <span className="ml-2">
                · identifier <code>{patient.identifier[0].value}</code>
              </span>
            )}
          </p>
        </div>
        <Link to={`/patient/${patientId}/edit`} className="btn btn-secondary shrink-0">
          Edit Patient
        </Link>
      </div>

      <WorkflowHeader patient={patient} workflow={workflow} />

      {(() => {
        const comorbidities = grouped.orphans.conditions.filter(isComorbidity)
        const otherConditions = grouped.orphans.conditions.filter((c) => !isComorbidity(c))
        const trueOrphans = {
          conditions: otherConditions,
          procedures: grouped.orphans.procedures,
          observations: grouped.orphans.observations,
        }
        // Comorbidities have no Encounter reference by design (IPS Problems
        // pattern — patient-level chronic problems, not encounter findings).
        // The registration bundle is what *carried* them, so we surface them
        // inside the registration encounter card. If no registration card
        // exists, fall back to a standalone top-level section so the data
        // doesn't disappear.
        const hasRegistration = grouped.buckets.some((b) => b.kind === 'registration')
        return (
          <>
            {comorbidities.length > 0 && !hasRegistration && (
              <ComorbiditySection
                comorbidities={comorbidities}
                patientId={patientId!}
              />
            )}

            <Timeline
              patient={patient}
              grouped={grouped}
              workflow={workflow}
              patientId={patientId!}
              comorbidities={hasRegistration ? comorbidities : []}
            />

            {(trueOrphans.conditions.length > 0 ||
              trueOrphans.procedures.length > 0 ||
              trueOrphans.observations.length > 0) && (
              <UnlinkedSection
                orphans={trueOrphans}
                patientId={patientId!}
              />
            )}
          </>
        )
      })()}
    </div>
  )
}

// ============================================================================
// Workflow header — chip + dot row + CTA + demographics
// ============================================================================

function WorkflowHeader({
  patient,
  workflow,
}: {
  patient: Patient
  workflow: PatientWorkflow
}) {
  return (
    <div className="card mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <StageChip stage={workflow.stage} />
        <Q11Dots timepoints={workflow.timepoints} />
        {workflow.nextDue && <NextDueBadge workflow={workflow} />}
        <div className="flex-1" />
        <NextActionCta patient={patient} workflow={workflow} />
      </div>

      <h3 className="card-header">Patient Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Demographic label="Birth Date" value={formatDate(patient.birthDate)} />
        <Demographic label="Gender" value={patient.gender || '-'} capitalize />
        <Demographic
          label="Patient ID"
          value={patient.identifier?.[0]?.value || patient.id || '-'}
          small
        />
      </div>
    </div>
  )
}

function Demographic({
  label,
  value,
  capitalize,
  small,
}: {
  label: string
  value: string
  capitalize?: boolean
  small?: boolean
}) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`font-medium ${capitalize ? 'capitalize' : ''} ${small ? 'text-sm' : ''}`}>
        {value}
      </p>
    </div>
  )
}

const STAGE_LABEL: Record<WorkflowStage, string> = {
  registered: 'Registered',
  'surgery-done': 'Surgery done',
  'in-followup': 'In follow-up',
  complete: 'Complete',
  unknown: 'Unknown',
}

const STAGE_CHIP_CLASS: Record<WorkflowStage, string> = {
  registered: 'bg-blue-100 text-blue-800 border-blue-200',
  'surgery-done': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'in-followup': 'bg-amber-100 text-amber-800 border-amber-200',
  complete: 'bg-green-100 text-green-800 border-green-200',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200',
}

function StageChip({ stage }: { stage: WorkflowStage }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${STAGE_CHIP_CLASS[stage]}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  )
}

function Q11Dots({ timepoints }: { timepoints: Timepoint[] }) {
  if (timepoints.length === 0) {
    return <span className="text-xs text-slate-400 italic">(no surgery yet)</span>
  }
  return (
    <div className="flex items-end gap-1 text-xs text-slate-500">
      {timepoints.map((tp) => (
        <div key={tp.label} className="flex flex-col items-center" title={dotTooltip(tp)}>
          <DotGlyph status={tp.status} />
          <span className="mt-0.5">{tp.label}</span>
        </div>
      ))}
    </div>
  )
}

function DotGlyph({ status }: { status: Timepoint['status'] }) {
  if (status === 'done') return <span className="text-hpi-orange text-lg leading-none">●</span>
  if (status === 'pending')
    return <span className="text-hpi-orange text-lg leading-none">○</span>
  if (status === 'overdue') return <span className="text-red-600 text-lg leading-none">⚠</span>
  return <span className="text-slate-300 text-lg leading-none">◌</span>
}

function dotTooltip(tp: Timepoint): string {
  const date = new Date(tp.scheduledIso).toISOString().slice(0, 10)
  if (tp.status === 'done') return `Done · actual ${tp.actualIso?.slice(0, 10) ?? '—'}`
  if (tp.status === 'pending') return `Pending · scheduled ${date}`
  if (tp.status === 'overdue') return `Overdue · scheduled ${date}`
  return `Upcoming · scheduled ${date}`
}

function NextDueBadge({ workflow }: { workflow: PatientWorkflow }) {
  const nd = workflow.nextDue!
  const text =
    nd.status === 'overdue'
      ? `Overdue ${Math.abs(nd.daysUntil)} d`
      : nd.daysUntil < 0
        ? `${Math.abs(nd.daysUntil)} d overdue`
        : nd.daysUntil === 0
          ? 'Due today'
          : `Due in ${nd.daysUntil} d`
  const cls =
    nd.status === 'overdue'
      ? 'bg-red-50 text-red-700 border-red-200'
      : nd.status === 'pending'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>
      Next: {nd.label} · {text}
    </span>
  )
}

function NextActionCta({
  patient,
  workflow,
}: {
  patient: Patient
  workflow: PatientWorkflow
}) {
  const cta = nextActionFor(patient, workflow)
  if (!cta) return null
  return (
    <Link to={cta.to} className="btn btn-primary">
      {cta.label} →
    </Link>
  )
}

function nextActionFor(
  patient: Patient,
  workflow: PatientWorkflow,
): { label: string; to: string } | null {
  const idValue = patient.identifier?.[0]?.value
  const q = idValue ? `identifier=${encodeURIComponent(idValue)}` : `patient=${patient.id}`

  if (workflow.stage === 'registered') {
    return { label: 'Record surgery', to: `/surgery?${q}` }
  }

  const due = workflow.nextDue
  if (
    (workflow.stage === 'surgery-done' || workflow.stage === 'in-followup') &&
    due &&
    (due.status === 'pending' || due.status === 'overdue')
  ) {
    return {
      label: `Record ${due.label} follow-up`,
      to: `/follow-up?${q}&timepoint=${due.days}`,
    }
  }

  if (workflow.stage === 'surgery-done' || workflow.stage === 'in-followup') {
    return { label: 'Record follow-up', to: `/follow-up?${q}` }
  }

  return null
}

// ============================================================================
// Timeline — encounter cards interleaved with ghost cards
// ============================================================================

function Timeline({
  patient,
  grouped,
  workflow,
  patientId,
  comorbidities,
}: {
  patient: Patient
  grouped: GroupedPatientData
  workflow: PatientWorkflow
  patientId: string
  comorbidities: Condition[]
}) {
  // Build a unified, date-sorted list of timeline items: real encounter cards
  // and ghost cards for non-done Q11 timepoints.
  type Item =
    | { kind: 'bucket'; date: string; bucket: EncounterBucket }
    | { kind: 'ghost'; date: string; timepoint: Timepoint }

  const items: Item[] = []
  for (const b of grouped.buckets) {
    items.push({
      kind: 'bucket',
      date: b.encounter.period?.start ?? '',
      bucket: b,
    })
  }
  for (const tp of workflow.timepoints) {
    if (tp.status === 'done') continue
    items.push({ kind: 'ghost', date: tp.scheduledIso, timepoint: tp })
  }
  items.sort((a, b) => a.date.localeCompare(b.date))

  if (items.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-500">
        No workflow encounters yet. Use the <Link to="/register" className="text-hpi-orange hover:underline">Register</Link> flow to start.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item, idx) =>
        item.kind === 'bucket' ? (
          <EncounterCard
            key={`b-${item.bucket.encounter.id ?? idx}`}
            bucket={item.bucket}
            patientId={patientId}
            comorbidities={item.bucket.kind === 'registration' ? comorbidities : []}
          />
        ) : (
          <FollowUpGhostCard
            key={`g-${item.timepoint.label}`}
            patient={patient}
            timepoint={item.timepoint}
          />
        ),
      )}
    </div>
  )
}

// ----- card title helpers ------------------------------------------------

const KIND_TITLE: Record<EncounterBucket['kind'], (date: string) => string> = {
  registration: (d) => `T0 · Registration · ${d}`,
  surgery: (d) => `T1 · Surgery · ${d}`,
  'follow-up': (d) => `Follow-up · ${d}`,
  other: (d) => `Encounter · ${d}`,
}

const KIND_ACCENT: Record<EncounterBucket['kind'], string> = {
  registration: 'border-l-4 border-blue-400',
  surgery: 'border-l-4 border-indigo-400',
  'follow-up': 'border-l-4 border-amber-400',
  other: 'border-l-4 border-slate-300',
}

function EncounterCard({
  bucket,
  patientId,
  comorbidities,
}: {
  bucket: EncounterBucket
  patientId: string
  comorbidities: Condition[]
}) {
  const dateIso = bucket.encounter.period?.start
  const dateLabel = dateIso ? new Date(dateIso).toISOString().slice(0, 10) : '—'
  // Follow-ups are rendered with a generic title here. The Q11 timepoint label
  // is computed by the caller (Timeline): the bucket alone doesn't know which
  // Q11 window matches, because that mapping lives in workflow.timepoints.
  const title = KIND_TITLE[bucket.kind](dateLabel)

  // Categorize procedures into surgical vs. prior-treatment for the surgery /
  // registration cards. SNOMED 387713003 = surgical procedure category.
  const surgicalProcedures = bucket.procedures.filter(
    (p) => p.category?.coding?.[0]?.code === '387713003',
  )
  const priorProcedures = bucket.procedures.filter(
    (p) => p.category?.coding?.[0]?.code !== '387713003',
  )

  return (
    <div className={`card ${KIND_ACCENT[bucket.kind]}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500 break-all sm:break-normal">
          Encounter/{bucket.encounter.id} · status {bucket.encounter.status}
        </span>
      </div>

      {bucket.conditions.length > 0 && (
        <ConditionTable
          conditions={bucket.conditions}
          patientId={patientId}
        />
      )}

      {bucket.kind === 'registration' && (
        comorbidities.length > 0 ? (
          <ComorbidityTable
            comorbidities={comorbidities}
            patientId={patientId}
          />
        ) : (
          <EmptySubsection label="Comorbidities" message="No comorbidities recorded." />
        )
      )}

      {bucket.kind === 'surgery' && surgicalProcedures.length > 0 && (
        <ProcedureTable
          title="Surgical procedure"
          procedures={surgicalProcedures}
          patientId={patientId}
        />
      )}

      {bucket.kind === 'registration' && (
        priorProcedures.length > 0 ? (
          <ProcedureTable
            title="Prior treatment"
            procedures={priorProcedures}
            patientId={patientId}
          />
        ) : (
          <EmptySubsection label="Prior treatment" message="No prior treatment recorded." />
        )
      )}

      {bucket.kind !== 'surgery' &&
        bucket.kind !== 'registration' &&
        bucket.procedures.length > 0 && (
          <ProcedureTable
            title="Procedures"
            procedures={bucket.procedures}
            patientId={patientId}
          />
        )}

      {bucket.observations.length > 0 ? (
        <ObservationTable
          title={bucket.kind === 'surgery' ? 'Intra-op observations' : 'Observations'}
          observations={bucket.observations}
          patientId={patientId}
        />
      ) : (
        <EmptySubsection
          label={bucket.kind === 'surgery' ? 'Intra-op observations' : 'Observations'}
          message="No observations recorded for this visit."
        />
      )}

      {bucket.conditions.length === 0 &&
        bucket.procedures.length === 0 &&
        bucket.observations.length === 0 &&
        comorbidities.length === 0 && (
          <p className="text-sm text-slate-500 italic">No linked resources.</p>
        )}
    </div>
  )
}

function FollowUpGhostCard({
  patient,
  timepoint,
}: {
  patient: Patient
  timepoint: Timepoint
}) {
  const scheduled = new Date(timepoint.scheduledIso).toISOString().slice(0, 10)
  const idValue = patient.identifier?.[0]?.value
  const q = idValue ? `identifier=${encodeURIComponent(idValue)}` : `patient=${patient.id}`
  const recordHref = `/follow-up?${q}&timepoint=${timepoint.days}`

  let glyph: string
  let badgeClass: string
  let subline: string
  let cta: { label: string; to: string } | null = null

  const today = new Date()
  const daysUntil = Math.round(
    (new Date(timepoint.scheduledIso).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (timepoint.status === 'pending') {
    glyph = '⏳'
    badgeClass = 'border-l-4 border-amber-400'
    subline =
      daysUntil === 0
        ? 'Due today'
        : daysUntil > 0
          ? `Due in ${daysUntil} d`
          : `${Math.abs(daysUntil)} d overdue (still in tolerance window)`
    cta = { label: `Record ${timepoint.label} follow-up`, to: recordHref }
  } else if (timepoint.status === 'overdue') {
    glyph = '⚠'
    badgeClass = 'border-l-4 border-red-400'
    subline = `${Math.abs(daysUntil)} d overdue`
    cta = { label: `Record ${timepoint.label} follow-up`, to: recordHref }
  } else {
    glyph = '◌'
    badgeClass = 'border-l-4 border-slate-200'
    subline = `Scheduled ${scheduled}`
  }

  return (
    <div className={`card ${badgeClass} bg-slate-50/60`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-700">
            <span className="mr-2">{glyph}</span>
            Follow-up {timepoint.label}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{subline}</p>
        </div>
        {cta && (
          <Link to={cta.to} className="btn btn-primary text-sm">
            {cta.label} →
          </Link>
        )}
      </div>
    </div>
  )
}

function EmptySubsection({ label, message }: { label: string; message: string }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{label}</h4>
      <p className="text-sm text-slate-400 italic">{message}</p>
    </div>
  )
}

// ============================================================================
// Inline tables
// ============================================================================

function ConditionTable({
  conditions,
  patientId,
}: {
  conditions: Condition[]
  patientId: string
}) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">
        Condition{conditions.length === 1 ? '' : 's'}
      </h4>
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Diagnosis</Th>
            <Th>Body Site</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {conditions.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link
                  to={`/patient/${patientId}/condition/${c.id}`}
                  className="text-hpi-orange hover:underline font-medium"
                >
                  {c.code?.coding?.[0]?.display || c.code?.text || 'Unknown condition'}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-600">
                {c.bodySite?.[0]?.text || c.bodySite?.[0]?.coding?.[0]?.display || '-'}
              </td>
              <td className="px-4 py-2">
                <span className={statusPill(c.clinicalStatus?.coding?.[0]?.code)}>
                  {c.clinicalStatus?.coding?.[0]?.code || '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

function ProcedureTable({
  title,
  procedures,
  patientId,
}: {
  title: string
  procedures: Procedure[]
  patientId: string
}) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Procedure</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {procedures.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link
                  to={`/patient/${patientId}/procedure/${p.id}`}
                  className="text-hpi-orange hover:underline font-medium"
                >
                  {p.code?.coding?.[0]?.display || p.code?.text || p.code?.coding?.[0]?.code || 'Procedure'}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-600">
                {p.category?.coding?.[0]?.display || p.category?.coding?.[0]?.code || '-'}
              </td>
              <td className="px-4 py-2">
                <span className={statusPill(p.status)}>{p.status}</span>
              </td>
              <td className="px-4 py-2 text-slate-600">{formatDate(getProcedureEffectiveDate(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

function ObservationTable({
  title,
  observations,
  patientId,
}: {
  title: string
  observations: Observation[]
  patientId: string
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">
        {title} <span className="text-slate-400 font-normal">({observations.length})</span>
      </h4>
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Observation</Th>
            <Th>Value</Th>
            <Th>Body Site</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {observations.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link
                  to={`/patient/${patientId}/observation/${o.id}`}
                  className="text-hpi-orange hover:underline font-medium"
                >
                  {o.code?.coding?.[0]?.display || o.code?.text || 'Observation'}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-700">{getObservationValue(o)}</td>
              <td className="px-4 py-2 text-slate-600">
                {o.bodySite?.text || o.bodySite?.coding?.[0]?.display || '-'}
              </td>
              <td className="px-4 py-2 text-slate-600">{formatDate(o.effectiveDateTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}

// ============================================================================
// Comorbidities — patient-level problem list, surfaced inside the T0 card
// (the registration bundle is what carried them) but rendered as a distinct
// sub-table so it's clear they're problem-list items, not encounter findings.
// ============================================================================

function ComorbidityTable({
  comorbidities,
  patientId,
}: {
  comorbidities: Condition[]
  patientId: string
}) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-1">Comorbidities</h4>
      <p className="text-xs text-slate-500 mb-2">
        Problem list. Patient-level pre-existing problems elicited at registration.
      </p>
      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Problem</Th>
            <Th>SNOMED code</Th>
            <Th>Status</Th>
            <Th>Recorded</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {comorbidities.map((c) => {
            const isAbsent = c.code?.coding?.[0]?.system === IPS_ABSENT_UNKNOWN.SYSTEM
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    to={`/patient/${patientId}/condition/${c.id}`}
                    className="text-hpi-orange hover:underline font-medium"
                  >
                    {c.code?.coding?.[0]?.display || c.code?.text || 'Unknown'}
                  </Link>
                  {isAbsent && <span className="ml-2 text-xs text-slate-500 italic">(absent/unknown)</span>}
                </td>
                <td className="px-4 py-2 text-slate-600">{c.code?.coding?.[0]?.code || '-'}</td>
                <td className="px-4 py-2">
                  <span className={statusPill(c.clinicalStatus?.coding?.[0]?.code)}>
                    {c.clinicalStatus?.coding?.[0]?.code || '-'}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{formatDate(c.recordedDate)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </div>
  )
}

// Fallback top-level panel used only when no registration encounter exists.
function ComorbiditySection({
  comorbidities,
  patientId,
}: {
  comorbidities: Condition[]
  patientId: string
}) {
  return (
    <div className="card mb-4 border-l-4 border-blue-200">
      <ComorbidityTable
        comorbidities={comorbidities}
        patientId={patientId}
      />
    </div>
  )
}

// ============================================================================
// Unlinked / orphan section
// ============================================================================

function UnlinkedSection({
  orphans,
  patientId,
}: {
  orphans: GroupedPatientData['orphans']
  patientId: string
}) {
  const [open, setOpen] = useState(false)
  const total =
    orphans.conditions.length + orphans.procedures.length + orphans.observations.length

  return (
    <div className="card mt-4 border-dashed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold text-slate-700">
          Other ({total}) — not linked to a workflow Encounter
        </h3>
        <span className="text-slate-400 text-sm">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {orphans.conditions.length > 0 && (
            <ConditionTable
              conditions={orphans.conditions}
              patientId={patientId}
            />
          )}
          {orphans.procedures.length > 0 && (
            <ProcedureTable
              title="Procedures"
              procedures={orphans.procedures}
              patientId={patientId}
            />
          )}
          {orphans.observations.length > 0 && (
            <ObservationTable
              title="Observations"
              observations={orphans.observations}
              patientId={patientId}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Small utilities
// ============================================================================

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left'
  return (
    <th
      className={`px-4 py-2 ${alignClass} text-xs font-medium text-slate-500 uppercase tracking-wider`}
    >
      {children}
    </th>
  )
}

function statusPill(status?: string): string {
  const base = 'px-2 py-0.5 rounded-full text-xs'
  if (!status) return `${base} bg-slate-100 text-slate-600`
  if (status === 'completed' || status === 'finished' || status === 'final')
    return `${base} bg-green-100 text-green-800`
  if (status === 'active' || status === 'in-progress' || status === 'recurrence')
    return `${base} bg-yellow-100 text-yellow-800`
  if (status === 'cancelled' || status === 'entered-in-error')
    return `${base} bg-red-100 text-red-800`
  return `${base} bg-blue-100 text-blue-800`
}

function getPatientName(p: Patient): string {
  const name = p.name?.[0]
  if (!name) return 'Unknown'
  const given = name.given?.join(' ') || ''
  const family = name.family || ''
  return `${given} ${family}`.trim() || 'Unknown'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('de-DE')
}

function getObservationValue(o: Observation): string {
  if (o.valueCodeableConcept) {
    return (
      o.valueCodeableConcept.coding?.[0]?.display ||
      o.valueCodeableConcept.text ||
      '-'
    )
  }
  if (o.valueQuantity) {
    return `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}`.trim()
  }
  if (o.valueInteger !== undefined) return o.valueInteger.toString()
  if (o.valueString) return o.valueString
  if (o.valueBoolean !== undefined) return o.valueBoolean ? 'true' : 'false'
  return '-'
}

export default PatientDetail
