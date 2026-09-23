/**
 * Pure parsing of compiled StructureDefinition/CodeSystem JSON (no I/O).
 *
 * Two jobs:
 *  1. Read the fixed Observation.code / Observation.category / value[x] unit
 *     that a derived Observation profile's compiled `differential` already
 *     carries (SUSHI emits `patternCodeableConcept`/`patternUri`/`patternCode`
 *     for FSH `* element = system#code "display"` assignments) — see ADR-0103.
 *  2. Read each element's declared FHIR `type` — the basis for fully generic,
 *     type-driven answer assignment (`extractor.ts`'s `assignByPath`) instead
 *     of a hand-written switch per element path — see ADR-0122.
 *
 * HAPI serves `differential` only for IG profiles, but a full `snapshot` for
 * the FHIR-core base resource and datatype StructureDefinitions (loaded by
 * `seed/load-base-profiles.sh`) — every function here reads
 * `differential.element` first and falls back to `snapshot.element`, which
 * covers both cases uniformly.
 */

export interface ElementType {
  code?: string
  profile?: string[]
}

export interface ElementDefinition {
  id?: string
  path?: string
  sliceName?: string
  type?: ElementType[]
  /** FHIR cardinality upper bound ("1", "0", "*", or a specific number) — determines array vs. singular assignment generically (ADR-0122), no per-path table. */
  max?: string
  patternCodeableConcept?: { coding?: Array<{ system?: string; code?: string; display?: string }> }
  patternUri?: string
  patternCode?: string
}

export interface StructureDefinition {
  resourceType: 'StructureDefinition'
  id?: string
  url?: string
  type?: string
  baseDefinition?: string
  differential?: { element?: ElementDefinition[] }
  snapshot?: { element?: ElementDefinition[] }
}

export interface CodeSystemConcept {
  code?: string
  display?: string
}

export interface CodeSystem {
  resourceType: 'CodeSystem'
  url?: string
  concept?: CodeSystemConcept[]
}

/** The raw fixed coding read off a CodeableConcept-typed element (display may be absent). */
export interface FixedCode {
  system: string
  code: string
  display?: string
}

function elements(sd: StructureDefinition): ElementDefinition[] {
  return sd.differential?.element ?? sd.snapshot?.element ?? []
}

function findById(sd: StructureDefinition, id: string): ElementDefinition | undefined {
  return elements(sd).find((el) => el.id === id || el.path === id)
}

/** Read a fixed CodeableConcept's first coding off an unsliced element (e.g. "Observation.code", "Observation.category"). */
export function readFixedCodeableConcept(sd: StructureDefinition, elementId: string): FixedCode | undefined {
  const el = findById(sd, elementId)
  const coding = el?.patternCodeableConcept?.coding?.[0]
  if (!coding?.system || !coding?.code) return undefined
  return { system: coding.system, code: coding.code, display: coding.display }
}

/** Read a component slice's fixed code (e.g. sliceName "Pain" -> id "Observation.component:Pain.code"). */
export function readComponentFixedCode(sd: StructureDefinition, sliceName: string): FixedCode | undefined {
  return readFixedCodeableConcept(sd, `Observation.component:${sliceName}.code`)
}

/** Read the UCUM code fixed on a value[x] element's `.code` sub-element (e.g. "Observation.value[x]" or "Observation.component:Pain.value[x]"). */
export function readUcumCode(sd: StructureDefinition, valueElementId: string): string | undefined {
  const el = findById(sd, `${valueElementId}.code`)
  return el?.patternCode
}

export function readBaseDefinition(sd: StructureDefinition): string | undefined {
  return sd.baseDefinition
}

/** Find a concept's display in a CodeSystem's own enumerated concept[] array by code. */
export function displayFromCodeSystem(cs: CodeSystem, code: string): string | undefined {
  return cs.concept?.find((c) => c.code === code)?.display
}

/** Discover every named component[] slice a profile declares (e.g. ["Pain", "ADL", "ROM", "Strength"]). */
export function readComponentSliceNames(sd: StructureDefinition): string[] {
  return elements(sd)
    .filter((el) => el.path === 'Observation.component' && el.sliceName)
    .map((el) => el.sliceName!)
}

// ── Element type resolution (ADR-0122) ──────────────────────────────────────
// Enables generic, type-driven answer assignment: given an element path (as
// used in Questionnaire item.definition, e.g. "Observation.value[x]" or
// "Condition.onset[x]"), resolve the FHIR type FHIR itself declares for
// it — no per-resource-type or per-element table.

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/** An element's resolved type together with its own cardinality upper bound. */
export interface ResolvedElementType {
  type: ElementType
  max?: string
}

/**
 * Three-way result of a single-SD element-type lookup:
 *   - `found`   — resolved to a concrete type (+ cardinality).
 *   - `declared` — the target choice element ([x]) IS declared on this SD
 *     with an explicit, non-empty type list, but that list does not include
 *     the requested suffix. This is authoritative: a derived profile that
 *     narrows `value[x]` from many types down to one (e.g. Quantity-only)
 *     is *rejecting* the other types, not silently deferring to whatever a
 *     laxer ancestor might still allow. Callers must stop here, not walk
 *     further up the baseDefinition chain.
 *   - `absent`  — nothing declared on this SD for this path at all (no
 *     matching element, or a matching element with no explicit type) —
 *     safe to keep walking up.
 */
export type ElementTypeLookup =
  | { kind: 'found'; type: ElementType; max?: string }
  | { kind: 'declared' }
  | { kind: 'absent' }

/**
 * Resolve an element's FHIR type (+ cardinality) against a single SD,
 * handling FHIR's choice-element ([x]) naming convention generically: a
 * concrete answer path segment like "onsetDateTime" is resolved against the
 * declared choice element "Condition.onset[x]" by matching the segment's
 * suffix (after stripping the shared base name, e.g. "onset") against each
 * candidate type code, capitalized ("dateTime" -> "DateTime", "Quantity" ->
 * "Quantity") — the exact rule FHIR itself uses to name concrete choice
 * elements (http://hl7.org/fhir/formats.html#choice). No hardcoded per-path
 * table. See `ElementTypeLookup` for why this returns three states, not two
 * — callers (the base-walk in `profileMetadataResolver.ts`) must not treat
 * `declared` the same as `absent`.
 */
export function readElementType(sd: StructureDefinition, elementId: string): ElementTypeLookup {
  const exact = findById(sd, elementId)
  if (exact?.type?.[0]?.code) return { kind: 'found', type: exact.type[0], max: exact.max }

  const dot = elementId.lastIndexOf('.')
  if (dot < 0) return { kind: 'absent' }
  const parentPath = elementId.slice(0, dot)
  const leaf = elementId.slice(dot + 1)

  const choicePrefix = `${parentPath}.`
  for (const el of elements(sd)) {
    const id = el.id ?? el.path
    if (!id || !id.endsWith('[x]') || !id.startsWith(choicePrefix)) continue
    const baseName = id.slice(choicePrefix.length, -3) // strip prefix and trailing "[x]"
    if (!leaf.startsWith(baseName)) continue
    const suffix = leaf.slice(baseName.length)
    if (!suffix) continue
    if (!el.type || el.type.length === 0) return { kind: 'absent' } // no explicit type here; nothing to narrow against
    const match = el.type.find((t) => t.code && capitalize(t.code) === suffix)
    if (match) return { kind: 'found', type: match, max: el.max }
    return { kind: 'declared' } // explicit type list present, doesn't include this suffix — authoritative
  }
  return { kind: 'absent' }
}

const FHIR_CORE_BASE = 'http://hl7.org/fhir/StructureDefinition/'

/** Canonical URL of a FHIR-core datatype/resource StructureDefinition, given its type code (e.g. "HumanName", "Quantity", "Encounter"). */
export function datatypeCanonical(typeCode: string): string {
  return `${FHIR_CORE_BASE}${typeCode}`
}

const PRIMITIVE_TYPES = new Set([
  'base64Binary', 'boolean', 'canonical', 'code', 'date', 'dateTime', 'decimal', 'id', 'instant',
  'integer', 'integer64', 'markdown', 'oid', 'positiveInt', 'string', 'time', 'unsignedInt', 'uri', 'url', 'uuid', 'xhtml',
])

/** Whether a FHIR type code names a primitive (terminates a type walk) rather than a complex datatype (which has its own nested elements to resolve). */
export function isPrimitiveType(typeCode: string): boolean {
  return PRIMITIVE_TYPES.has(typeCode)
}

/**
 * Resolve an `extension:X` slice segment against a profile's compiled
 * elements. `X` is the slice name, so the whole segment is the
 * ElementDefinition id verbatim (e.g. `Condition.extension:dueTo`). That is
 * what `Questionnaire.item.definition` requires of a fragment, and it is why
 * the published guide's generated cross-link for this item resolves.
 */
export function findExtensionSlice(
  sd: StructureDefinition,
  resourceType: string,
  sliceName: string,
): { url: string; elementId: string } | undefined {
  const targetId = `${resourceType}.extension:${sliceName}`
  for (const el of elements(sd)) {
    if ((el.id ?? el.path) !== targetId) continue
    const profile = el.type?.[0]?.profile?.[0]
    if (!profile) continue
    return { url: profile, elementId: targetId }
  }
  return undefined
}
