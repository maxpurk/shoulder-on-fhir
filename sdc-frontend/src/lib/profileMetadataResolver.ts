/**
 * Runtime resolution of SDC extraction targets from HAPI's compiled
 * StructureDefinitions/CodeSystems.
 *
 * ADR-0103 closed the first half of this gap: fixed Observation.code /
 * category / ucumCode used to live in a hand-typed `PROFILE_METADATA` table
 * in extractor.ts; that table was deleted and replaced with a runtime read
 * of the compiled StructureDefinition/CodeSystem HAPI already serves, so it
 * structurally cannot drift from the FSH source of truth.
 *
 * ADR-0122 generalizes the same idea to *every* element `item.definition`
 * can reference, not just Observation.code/category: given a profile
 * canonical + element path, this module resolves the FHIR type FHIR itself
 * declares for that element (walking the profile's baseDefinition chain and,
 * where the path crosses into a complex datatype like HumanName or Period,
 * that datatype's own StructureDefinition) — the basis for `extractor.ts`'s
 * generic `assignByPath`, which replaced a hand-written switch statement per
 * resource type per element path.
 *
 * Resolution is prefetched once per Questionnaire load (see FlowPage.tsx),
 * not performed mid-submission — extractResources() stays synchronous,
 * consuming the ExtractionPlan this module produces.
 */

import fhirClient from './fhirClient'
import {
  readFixedCodeableConcept,
  readComponentFixedCode,
  readUcumCode,
  readBaseDefinition,
  readElementType,
  findExtensionSlice,
  datatypeCanonical,
  isPrimitiveType,
  displayFromCodeSystem,
  type StructureDefinition,
  type CodeSystem,
  type FixedCode,
  type ResolvedElementType,
  type ElementType,
} from './profileMetadataParse'

const SNOMED = 'http://snomed.info/sct'
const MAX_BASE_WALK = 5

/** One `item.definition` target: a profile canonical plus the element path after "#". */
export interface ExtractionTarget {
  profileCanonical: string
  /** An ElementDefinition id local to the resource, e.g. "value[x]", "name.family", "component:Pain.value[x]", "extension:dueTo". Empty string for group-marker definitions with no "#path" (resourceType-only). */
  elementPath: string
}

export interface ResolvedElement {
  /** FHIR type code this element accepts, e.g. "Quantity", "CodeableConcept", "string", "dateTime", "code", "Annotation". */
  fhirType: string
  /** Whether the terminal element itself is repeating (FHIR max != "1"/"0") — read from the SD, not guessed from the path string. */
  isArray?: boolean
  /** For a 2-segment path (e.g. "name.family"): whether the container property ("Patient.name") is itself repeating. Undefined for single-segment paths, which have no container. */
  containerIsArray?: boolean
  /** UCUM code fixed by the profile on this element's value[x].code — only present for Quantity-typed elements. */
  ucumCode?: string
  /** A fixed CodeableConcept coding the element itself carries (e.g. a component slice's own `.code`) — distinct from the answer's own value. */
  fixedCoding?: FixedCode
  /** Resolved extension profile canonical — only present for `extension:slice` segments. */
  extensionUrl?: string
}

export interface ResolvedProfile {
  resourceType: string
  /** Observation.code — a resource-level fixed value, not an answer target, kept separate from `elements`. */
  code?: FixedCode
  /** Observation.category. */
  category?: FixedCode
  elements: Map<string, ResolvedElement>
}

// ── Module-level caches, keyed by canonical URL ──────────────────────────────

const sdCache = new Map<string, StructureDefinition | undefined>()
const csCache = new Map<string, CodeSystem | undefined>()

function lastSegment(canonical: string): string {
  return canonical.split('/').pop() ?? canonical
}

async function fetchStructureDefinition(url: string): Promise<StructureDefinition | undefined> {
  if (sdCache.has(url)) return sdCache.get(url)
  const bundle = await fhirClient.search<StructureDefinition>('StructureDefinition', { url })
  const sd = bundle.entry?.[0]?.resource
  sdCache.set(url, sd)
  return sd
}

async function fetchCodeSystem(url: string): Promise<CodeSystem | undefined> {
  if (csCache.has(url)) return csCache.get(url)
  const bundle = await fhirClient.search<CodeSystem>('CodeSystem', { url })
  const cs = bundle.entry?.[0]?.resource
  csCache.set(url, cs)
  return cs
}

/**
 * Resolve a coding's display: already inlined (most LOINC/local-CS profiles) ->
 * done; local/standard CodeSystem with no inlined display -> direct resource
 * read (ADR-0063: prefer over $lookup, HAPI's Lucene index is wiped every
 * restart); SNOMED with no inlined display -> live $lookup, transparently
 * proxied by HAPI to tx.fhir.org (ADR-0050).
 */
async function resolveDisplay(coding: FixedCode): Promise<FixedCode> {
  if (coding.display) return coding
  if (coding.system === SNOMED) {
    const display = await fhirClient.lookupCodeSystemDisplay(coding.system, coding.code)
    return { ...coding, display }
  }
  const cs = await fetchCodeSystem(coding.system)
  const display = cs ? displayFromCodeSystem(cs, coding.code) : undefined
  return { ...coding, display }
}

/**
 * Walk a profile's baseDefinition chain (bounded, cycle-guarded), applying
 * `reader` at each ancestor until it returns a hit. Generalizes the
 * base-walk ADR-0103 introduced for fixed Observation.code/category to any
 * per-element lookup — most elements are declared (typed, or fixed) on
 * whichever single ancestor SD actually constrains them, not redeclared at
 * every level of the profile hierarchy.
 */
async function walkBaseChain<T>(
  leafSd: StructureDefinition,
  reader: (sd: StructureDefinition) => T | undefined,
): Promise<T | undefined> {
  let current: StructureDefinition | undefined = leafSd
  const seen = new Set<string>()
  for (let depth = 0; current && depth <= MAX_BASE_WALK; depth++) {
    const found = reader(current)
    if (found) return found
    const base = readBaseDefinition(current)
    if (!base || seen.has(base)) return undefined
    seen.add(base)
    current = await fetchStructureDefinition(base)
  }
  return undefined
}

/**
 * Walk a profile's baseDefinition chain resolving a single element id's
 * type, STOPPING as soon as any level explicitly declares (and narrows) the
 * target choice element — even if that level's own type list doesn't
 * include what was asked. Continuing past an explicit narrowing to check a
 * laxer ancestor would silently resurrect a type the actual target profile
 * disallows (e.g. a profile narrowing `value[x]` to Quantity-only must not
 * have a stale `item.definition` pointing at `valueString` "accidentally"
 * resolve via unconstrained base FHIR `Observation.value[x]`, which allows
 * many types). See `ElementTypeLookup`'s own doc comment in
 * `profileMetadataParse.ts` for the three-way distinction this depends on.
 *
 * `type` and `max` are resolved independently once a `found` level fixes
 * the type: a profile edit that narrows only `type` (e.g. FSH `* address
 * only Address-eu`, which SUSHI emits with no `max` in that same
 * differential element, since the edit never touched cardinality) must
 * still recover the real `max` from whichever ancestor last stated it —
 * per FHIR profiling rules a derived profile can only equal-or-narrow an
 * inherited cardinality, never widen it, so backfilling `max` from a laxer
 * ancestor is always spec-correct, unlike backfilling `type` (bug found
 * live, ADR-0138: `Patient.address` resolved as non-repeating because
 * `patient-eu`'s differential narrows the type to `Address-eu` without
 * repeating base FHIR `Patient.address`'s `max: "*"`, producing an invalid
 * `address` JSON object instead of an array on every SDC submission with
 * an address).
 */
async function resolveTypeWithNarrowing(sd: StructureDefinition, elementId: string): Promise<ResolvedElementType | undefined> {
  let current: StructureDefinition | undefined = sd
  const seen = new Set<string>()
  let foundType: ElementType | undefined
  for (let depth = 0; current && depth <= MAX_BASE_WALK; depth++) {
    const result = readElementType(current, elementId)
    if (result.kind === 'found') {
      if (!foundType) foundType = result.type
      if (result.max !== undefined) return { type: foundType, max: result.max }
    } else if (result.kind === 'declared') {
      break
    }
    const base = readBaseDefinition(current)
    if (!base || seen.has(base)) break
    seen.add(base)
    current = await fetchStructureDefinition(base)
  }
  return foundType ? { type: foundType, max: undefined } : undefined
}

/**
 * Resolve an element's FHIR type against a profile, generically:
 *   1. `resolveTypeWithNarrowing` — direct lookup on the profile's own
 *      differential (covers same-SD BackboneElement nesting, e.g.
 *      Observation.component:X.value[x], and FHIR's choice-element ([x])
 *      naming: `value[x]`/`onset[x]` resolve by exact id, and a concrete
 *      suffix like valueQuantity still resolves against them), then the profile's
 *      baseDefinition chain for the same element id (most elements are
 *      declared only once, on whichever ancestor SD actually constrains or
 *      inherits them; a leaf profile's differential often re-lists an
 *      element for cardinality alone, with no type) — bounded by narrowing,
 *      not just by depth;
 *   2. else split off the deepest resolvable ancestor segment and, if it
 *      names a non-primitive datatype (e.g. HumanName, Period, Annotation),
 *      fetch THAT datatype's own StructureDefinition and recurse for the
 *      remaining path — the FHIR-spec distinction between BackboneElement
 *      children (inline in the same SD) and complex-datatype children
 *      (their own separate SD) is exactly what this step bridges.
 * No per-resource-type or per-element-path table anywhere in this walk.
 */
async function resolveElementType(sd: StructureDefinition, elementId: string): Promise<ResolvedElementType | undefined> {
  const viaChain = await resolveTypeWithNarrowing(sd, elementId)
  if (viaChain) return viaChain

  const segments = elementId.split('.')
  for (let i = segments.length - 1; i >= 2; i--) {
    const prefixId = segments.slice(0, i).join('.')
    const prefixResolved = await resolveTypeWithNarrowing(sd, prefixId)
    if (!prefixResolved?.type.code || isPrimitiveType(prefixResolved.type.code)) continue
    const nestedSd = await fetchStructureDefinition(datatypeCanonical(prefixResolved.type.code))
    if (!nestedSd) continue
    const remainder = segments.slice(i).join('.')
    const resolved = await resolveElementType(nestedSd, `${prefixResolved.type.code}.${remainder}`)
    if (resolved) return resolved
  }
  return undefined
}

function isRepeating(max: string | undefined): boolean {
  return max !== undefined && max !== '0' && max !== '1'
}

/** Resolve one `item.definition` element path (the part after "#") against a profile. */
async function resolveElement(
  sd: StructureDefinition,
  resourceType: string,
  elementPath: string,
): Promise<ResolvedElement | undefined> {
  const sliceMatch = elementPath.match(/^extension:(.+)$/)
  if (sliceMatch) {
    // `extension:dueTo` is the ElementDefinition id verbatim — see
    // findExtensionSlice's own doc comment. The slice itself is always 0..1
    // in this IG's usage; assignByPath handles the resource-level
    // `extension[]` array directly, so no isArray here.
    const found = findExtensionSlice(sd, resourceType, sliceMatch[1])
    if (!found) return undefined
    const valueType = await resolveElementType(sd, `${found.elementId}.value[x]`)
    if (!valueType?.type.code) return undefined
    return { fhirType: valueType.type.code, extensionUrl: found.url }
  }

  const componentMatch = elementPath.match(/^component:([A-Za-z]+)\.value\[x\]$/)
  const elementId = `${resourceType}.${elementPath}`
  const resolvedType = await resolveElementType(sd, elementId)
  if (!resolvedType?.type.code) return undefined

  const result: ResolvedElement = { fhirType: resolvedType.type.code, isArray: isRepeating(resolvedType.max) }
  if (resolvedType.type.code === 'Quantity') {
    const ucumId = componentMatch ? `Observation.component:${componentMatch[1]}.value[x]` : `${resourceType}.value[x]`
    result.ucumCode = readUcumCode(sd, ucumId) ?? (await walkBaseChain(sd, (s) => readUcumCode(s, ucumId)))
  }
  if (componentMatch) {
    // The component's own JS property name ("valueQuantity") is
    // reconstructed by assignByPath from fhirType, exactly as the extension
    // branch above does — the path carries the `value[x]` element id, which
    // does not spell the concrete choice name out.
    const sliceName = componentMatch[1]
    const raw =
      readComponentFixedCode(sd, sliceName) ?? (await walkBaseChain(sd, (s) => readComponentFixedCode(s, sliceName)))
    if (raw) result.fixedCoding = await resolveDisplay(raw)
  } else {
    // Container cardinality, only meaningful for a 2-segment plain dotted
    // path (e.g. "name.family" -> is Patient.name itself repeating?). No
    // current profile path goes deeper than 2 segments; a 3+-segment path
    // would need this generalized to a per-intermediate-segment array,
    // which the SD-driven max lookup below would support unchanged — this
    // is a scope boundary, not a hidden assumption.
    const segs = elementPath.split('.')
    if (segs.length === 2) {
      const containerId = `${resourceType}.${segs[0]}`
      const containerResolved = await resolveTypeWithNarrowing(sd, containerId)
      result.containerIsArray = isRepeating(containerResolved?.max)
    }
  }
  return result
}

/** Resolve one profile's Observation.code / Observation.category (ADR-0103 behavior, unchanged; refactored onto the shared walkBaseChain helper). */
async function resolveObservationFixedValues(
  sd: StructureDefinition,
): Promise<{ code?: FixedCode; category?: FixedCode }> {
  const rawCode = await walkBaseChain(sd, (s) => readFixedCodeableConcept(s, 'Observation.code'))
  const code = rawCode ? await resolveDisplay(rawCode) : undefined
  const rawCategory = await walkBaseChain(sd, (s) => readFixedCodeableConcept(s, 'Observation.category'))
  const category = rawCategory ? await resolveDisplay(rawCategory) : undefined
  return { code, category }
}

async function resolveProfile(profileCanonical: string, elementPaths: string[]): Promise<ResolvedProfile | undefined> {
  const sd = await fetchStructureDefinition(profileCanonical)
  if (!sd?.type) return undefined

  const resourceType = sd.type
  const elements = new Map<string, ResolvedElement>()
  for (const path of elementPaths) {
    if (!path) continue // group-marker definitions with no "#path" only name the resourceType, already captured above
    const resolved = await resolveElement(sd, resourceType, path)
    if (resolved) elements.set(path, resolved)
    else console.warn(`[profileMetadataResolver] could not resolve element "${resourceType}#${path}" on profile "${profileCanonical}"`)
  }

  const resolved: ResolvedProfile = { resourceType, elements }
  if (resourceType === 'Observation') {
    const { code, category } = await resolveObservationFixedValues(sd)
    resolved.code = code
    resolved.category = category
  }
  return resolved
}

/**
 * Resolve a full extraction plan: every {profileCanonical, elementPath} pair
 * a Questionnaire's item.definition references, grouped by profile. A
 * profile that fails to resolve at all (StructureDefinition not found) is
 * simply absent from the returned Map, and an individual element that fails
 * to resolve is logged and omitted from that profile's `elements` map —
 * callers (FlowPage.tsx) compare against the requested target set to detect
 * gaps and surface them visibly (submit-blocking banner) rather than
 * silently proceeding. A thrown error (network failure reaching HAPI)
 * propagates instead of being swallowed here.
 */
export async function resolveExtractionPlan(targets: ExtractionTarget[]): Promise<Map<string, ResolvedProfile>> {
  const byProfile = new Map<string, string[]>()
  for (const t of targets) {
    const list = byProfile.get(t.profileCanonical) ?? []
    list.push(t.elementPath)
    byProfile.set(t.profileCanonical, list)
  }

  const results = await Promise.all(
    Array.from(byProfile.entries()).map(
      async ([canonical, paths]) => [lastSegment(canonical), await resolveProfile(canonical, paths)] as const,
    ),
  )

  const map = new Map<string, ResolvedProfile>()
  for (const [id, resolved] of results) {
    if (resolved) map.set(id, resolved)
  }
  return map
}
