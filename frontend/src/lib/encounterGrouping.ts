import type { Condition, Encounter, Observation, Procedure } from '../types/fhir'
import { classifyEncounter, type EncounterKind } from './patientStage'

export interface EncounterBucket {
  encounter: Encounter
  kind: EncounterKind
  conditions: Condition[]
  procedures: Procedure[]
  observations: Observation[]
}

export interface GroupedPatientData {
  buckets: EncounterBucket[]
  orphans: {
    conditions: Condition[]
    procedures: Procedure[]
    observations: Observation[]
  }
}

function refId(ref?: { reference?: string }): string | undefined {
  if (!ref?.reference) return undefined
  const slash = ref.reference.lastIndexOf('/')
  return slash >= 0 ? ref.reference.slice(slash + 1) : ref.reference
}

export function groupByEncounter(args: {
  encounters: Encounter[]
  conditions: Condition[]
  procedures: Procedure[]
  observations: Observation[]
}): GroupedPatientData {
  const { encounters, conditions, procedures, observations } = args

  const sortedEncounters = [...encounters].sort((a, b) =>
    (a.period?.start ?? '').localeCompare(b.period?.start ?? ''),
  )

  const buckets: EncounterBucket[] = sortedEncounters.map((encounter) => ({
    encounter,
    kind: classifyEncounter(encounter),
    conditions: [],
    procedures: [],
    observations: [],
  }))

  const byId = new Map<string, EncounterBucket>()
  for (const b of buckets) {
    if (b.encounter.id) byId.set(b.encounter.id, b)
  }

  const orphans = {
    conditions: [] as Condition[],
    procedures: [] as Procedure[],
    observations: [] as Observation[],
  }

  // Procedure → encounter via Procedure.encounter
  for (const p of procedures) {
    const eid = refId(p.encounter)
    const bucket = eid ? byId.get(eid) : undefined
    if (bucket) bucket.procedures.push(p)
    else orphans.procedures.push(p)
  }

  // Observation → encounter via Observation.encounter
  for (const o of observations) {
    const eid = refId(o.encounter)
    const bucket = eid ? byId.get(eid) : undefined
    if (bucket) bucket.observations.push(o)
    else orphans.observations.push(o)
  }

  // Condition is reached via Encounter.reasonReference (ADR-0037) — the
  // registration Encounter points at its Condition, not the other way around.
  // Fallback: Condition.encounter if a builder set it.
  const linkedConditionIds = new Set<string>()
  for (const b of buckets) {
    if (b.kind !== 'registration') continue
    for (const ref of b.encounter.reasonReference ?? []) {
      const cid = refId(ref)
      if (!cid) continue
      const condition = conditions.find((c) => c.id === cid)
      if (condition) {
        b.conditions.push(condition)
        linkedConditionIds.add(cid)
      }
    }
  }
  for (const c of conditions) {
    if (c.id && linkedConditionIds.has(c.id)) continue
    const eid = refId(c.encounter)
    const bucket = eid ? byId.get(eid) : undefined
    if (bucket) bucket.conditions.push(c)
    else orphans.conditions.push(c)
  }

  return { buckets, orphans }
}
