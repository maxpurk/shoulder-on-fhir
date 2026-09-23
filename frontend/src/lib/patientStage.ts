import type { Encounter, Procedure } from '../types/fhir'
import {
  REGISTRATION_ENCOUNTER_TYPE,
  SURGERY_ENCOUNTER_TYPE,
  FOLLOW_UP_ENCOUNTER_TYPE,
} from '../types/fhir'

// ADR-0157: single source of truth is shared/q11Timepoints.ts (synced here
// via tools/sync-shared-code.sh) — was a hand-duplicated copy independently
// maintained in sync with sdc-frontend/src/lib/bundleAssembler.ts.
import { Q11_TIMEPOINTS } from './shared/q11Timepoints'
export { Q11_TIMEPOINTS }

export const TOLERANCE_DAYS = 30

export type EncounterKind = 'registration' | 'surgery' | 'follow-up' | 'other'

export type WorkflowStage =
  | 'registered'
  | 'surgery-done'
  | 'in-followup'
  | 'complete'
  | 'unknown'

export type TimepointStatus = 'done' | 'pending' | 'upcoming' | 'overdue'

export interface Timepoint {
  label: string
  days: number
  code: string
  scheduledIso: string
  status: TimepointStatus
  encounterId?: string
  actualIso?: string
}

export interface PatientWorkflow {
  stage: WorkflowStage
  registrationEncounterId?: string
  surgeryEncounterId?: string
  indexProcedureDate?: string
  timepoints: Timepoint[]
  nextDue?: {
    label: string
    days: number
    scheduledIso: string
    daysUntil: number
    status: TimepointStatus
  }
}

export function classifyEncounter(encounter: Encounter): EncounterKind {
  const code = encounter.type?.[0]?.coding?.[0]?.code
  if (code === REGISTRATION_ENCOUNTER_TYPE.CODE) return 'registration'
  if (code === SURGERY_ENCOUNTER_TYPE.CODE) return 'surgery'
  if (code === FOLLOW_UP_ENCOUNTER_TYPE.CODE) return 'follow-up'
  return 'other'
}

// SNOMED 387713003 = "Surgical procedure". Prior-treatment Procedures in the
// Registration bundle (PT 91251008, medication administration 18629005) carry
// the same performed[x] shape but are NOT the index surgery; filtering
// them out here keeps `surgery-done` from triggering off a T0 PT/injection.
const SURGICAL_CATEGORY_CODE = '387713003'

export function isSurgicalProcedure(p: Procedure): boolean {
  return p.category?.coding?.some((c) => c.code === SURGICAL_CATEGORY_CODE) ?? false
}

// Q11 timepoint anchor read: prefers performedPeriod.start (incision time,
// ADR-0108 — the surgery wizard now captures incision/suture times instead
// of a single performedDateTime), falls back to performedDateTime for
// older seeded/submitted data still using that shape.
export function getProcedureEffectiveDate(p: Procedure): string | undefined {
  return p.performedPeriod?.start ?? p.performedDateTime
}

export function findIndexProcedure(procedures: Procedure[]): Procedure | undefined {
  return procedures
    .filter((p) => isSurgicalProcedure(p) && Boolean(getProcedureEffectiveDate(p)))
    .sort((a, b) =>
      (getProcedureEffectiveDate(a) ?? '').localeCompare(getProcedureEffectiveDate(b) ?? ''),
    )[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
  )
}

function signedDaysFromNow(iso: string, now: Date): number {
  return Math.round(
    (new Date(iso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )
}

export function computeTimepoints(args: {
  indexProcedureDate?: string
  followUpEncounters: Encounter[]
  now?: Date
}): Timepoint[] {
  const { indexProcedureDate, followUpEncounters, now = new Date() } = args
  if (!indexProcedureDate) return []

  return Q11_TIMEPOINTS.map(({ label, days, code }) => {
    const scheduledIso = addDays(indexProcedureDate, days)

    const matchingEncounter = followUpEncounters.find(
      (enc) =>
        enc.period?.start &&
        daysBetween(enc.period.start, scheduledIso) <= TOLERANCE_DAYS,
    )

    if (matchingEncounter) {
      return {
        label,
        days,
        code,
        scheduledIso,
        status: 'done' as TimepointStatus,
        encounterId: matchingEncounter.id,
        actualIso: matchingEncounter.period?.start,
      }
    }

    const signedDays = signedDaysFromNow(scheduledIso, now)
    let status: TimepointStatus
    if (Math.abs(signedDays) <= TOLERANCE_DAYS) {
      status = 'pending'
    } else if (signedDays > TOLERANCE_DAYS) {
      status = 'upcoming'
    } else {
      status = 'overdue'
    }

    return { label, days, code, scheduledIso, status }
  })
}

export function computePatientWorkflow(args: {
  encounters: Encounter[]
  procedures: Procedure[]
  now?: Date
}): PatientWorkflow {
  const { encounters, procedures, now = new Date() } = args

  const buckets: Record<EncounterKind, Encounter[]> = {
    registration: [],
    surgery: [],
    'follow-up': [],
    other: [],
  }
  for (const enc of encounters) {
    buckets[classifyEncounter(enc)].push(enc)
  }

  const indexProcedure = findIndexProcedure(procedures)
  const indexProcedureDate = indexProcedure ? getProcedureEffectiveDate(indexProcedure) : undefined

  const timepoints = computeTimepoints({
    indexProcedureDate,
    followUpEncounters: buckets['follow-up'],
    now,
  })

  const hasRegistration = buckets.registration.length > 0
  const hasSurgeryEncounter = buckets.surgery.length > 0
  const hasSurgery = hasSurgeryEncounter || Boolean(indexProcedureDate)
  const hasFollowUp = buckets['follow-up'].length > 0
  const allDone = timepoints.length > 0 && timepoints.every((t) => t.status === 'done')

  let stage: WorkflowStage
  if (!hasRegistration && !hasSurgery && !hasFollowUp) {
    stage = 'unknown'
  } else if (allDone) {
    stage = 'complete'
  } else if (hasFollowUp) {
    stage = 'in-followup'
  } else if (hasSurgery) {
    stage = 'surgery-done'
  } else {
    stage = 'registered'
  }

  // nextDue: first non-done timepoint by scheduled date — overdue and pending
  // float to the top of that list naturally (their scheduled date is earlier).
  const nextDueTp = timepoints
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.scheduledIso.localeCompare(b.scheduledIso))[0]

  const nextDue = nextDueTp
    ? {
        label: nextDueTp.label,
        days: nextDueTp.days,
        scheduledIso: nextDueTp.scheduledIso,
        daysUntil: signedDaysFromNow(nextDueTp.scheduledIso, now),
        status: nextDueTp.status,
      }
    : undefined

  return {
    stage,
    registrationEncounterId: buckets.registration[0]?.id,
    surgeryEncounterId: buckets.surgery[0]?.id,
    indexProcedureDate,
    timepoints,
    nextDue,
  }
}
