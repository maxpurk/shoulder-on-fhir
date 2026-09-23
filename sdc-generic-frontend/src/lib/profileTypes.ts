// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Element type resolution                                                   │
// │  Given "<profile canonical>#<element id>", answer: what FHIR type does     │
// │  that element hold, does it repeat, and does the profile fix a value?      │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Everything here is resolved from StructureDefinitions the server already
// serves. Nothing about any particular registry is known in advance.
//
// An element id may reach further than the profile's own snapshot. SDC allows
// "Patient.name.given" against a profile whose snapshot stops at "Patient.name",
// so when an exact match fails we take the longest prefix that does match, read
// its datatype, and continue the walk inside that datatype's definition.

import { endpoint } from './config'

const CORE = 'http://hl7.org/fhir/StructureDefinition/'

export interface ResolvedElement {
  /** FHIR type code, e.g. "Quantity", "CodeableConcept", "string", "dateTime". */
  type: string
  /** Element repeats (max > 1). */
  isArray: boolean
  /** Fixed or pattern value the profile pins, if any. */
  fixed?: unknown
  /** Path relative to the resource root, e.g. "name.given". */
  path: string
  /** For an extension element, the extension definition it is constrained to. */
  profile?: string
  /**
   * Every type a choice element permits, when the request left the type open.
   * Absent when the element is not a choice, or when the request pinned the type
   * itself, in which case that pin is what counts and not the value written.
   */
  choices?: string[]
}

/**
 * Which of the types a choice element permits this value is.
 *
 * FHIR names a choice element's property after the type it carries, so an
 * element named only as the choice ("Observation.effective", "Observation.
 * value[x]") cannot be written until the value is in hand. A value type the
 * element does not permit is never chosen; the element's own first type stands.
 */
export function chooseType(types: string[], raw: unknown): string {
  if (types.length <= 1 || raw === undefined || raw === null) return types[0]
  const has = (t: string) => types.find((x) => x.toLowerCase() === t.toLowerCase())
  if (typeof raw === 'boolean') return has('boolean') ?? types[0]
  if (typeof raw === 'number') {
    return (Number.isInteger(raw) ? has('integer') : undefined) ?? has('decimal') ?? has('Quantity') ?? types[0]
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if ('start' in o || 'end' in o) return has('Period') ?? types[0]
    if ('reference' in o) return has('Reference') ?? types[0]
    if ('coding' in o || 'text' in o) return has('CodeableConcept') ?? types[0]
    if ('value' in o) return has('Quantity') ?? types[0]
    if ('code' in o) return has('Coding') ?? has('CodeableConcept') ?? types[0]
    return types[0]
  }
  const v = String(raw)
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return has('dateTime') ?? has('instant') ?? types[0]
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) return has('date') ?? has('dateTime') ?? types[0]
  if (/^\d{2}:\d{2}/.test(v)) return has('time') ?? types[0]
  return has('string') ?? has('code') ?? types[0]
}

/** The type an element actually takes for this value: its own, or the chosen one. */
export function concreteType(el: ResolvedElement, raw: unknown): string {
  return el.choices?.length ? chooseType(el.choices, raw) : el.type
}

interface ElementDefinition {
  id?: string
  path?: string
  min?: number
  max?: string
  types?: unknown
  /** Cardinality of the element in the resource this one profiles. */
  base?: { path?: string; min?: number; max?: string }
  type?: Array<{ code?: string; profile?: string[] }>
  [k: string]: unknown
}

interface StructureDefinition {
  resourceType: 'StructureDefinition'
  type?: string
  baseDefinition?: string
  snapshot?: { element?: ElementDefinition[] }
  differential?: { element?: ElementDefinition[] }
}

type Fetcher = (url: string) => Promise<unknown>

// Keyed by canonical *and* by the server asked, because the same canonical
// resolves to a different definition on a different server.
const sdCache = new Map<string, Promise<StructureDefinition | undefined>>()

export function clearProfileCache(): void {
  sdCache.clear()
}

export async function loadStructureDefinition(
  canonical: string,
  fetchJson: Fetcher,
): Promise<StructureDefinition | undefined> {
  const key = canonical.split('|')[0]
  const cacheKey = `${endpoint('fhir')} ${key}`
  if (!sdCache.has(cacheKey)) {
    sdCache.set(
      cacheKey,
      (async () => {
        const bundle = (await fetchJson(
          `${endpoint('fhir')}/StructureDefinition?url=${encodeURIComponent(key)}`,
        )) as { entry?: Array<{ resource?: StructureDefinition }> } | undefined
        return bundle?.entry?.[0]?.resource
      })().catch(() => undefined),
    )
  }
  return sdCache.get(cacheKey)
}

function elementsOf(sd: StructureDefinition): ElementDefinition[] {
  return sd.snapshot?.element ?? sd.differential?.element ?? []
}

/**
 * Whether this element is a JSON array.
 *
 * Not the same question as whether the profile allows more than one. A profile
 * may narrow a repeating element to a single value, and the JSON is still an
 * array of one: array-ness belongs to the resource being profiled, which is what
 * ElementDefinition.base records. Reading the profile's own max instead wrote a
 * lone body site as an object, and the validator rejected it.
 */
function repeats(e: ElementDefinition): boolean {
  const max = e.base?.max ?? e.max
  return max === '*' || Number(max) > 1
}

function fixedOf(e: ElementDefinition): unknown {
  for (const k of Object.keys(e)) {
    if (k.startsWith('fixed') || k.startsWith('pattern')) return e[k]
  }
  return undefined
}

/** Normalise bracket slice notation: "extension[foo]" -> "extension:foo". */
function normalise(path: string): string {
  return path.replace(/\[([^\]]+)\]/g, ':$1')
}

/** Strip slice names: "category:VSCat.coding" -> "category.coding". */
function unslice(path: string): string {
  return normalise(path)
    .split('.')
    .map((seg) => seg.split(':')[0])
    .join('.')
}

/**
 * Resolve an element id against a profile, following baseDefinition and
 * stepping into complex datatypes when the id reaches past the snapshot.
 */
export async function resolveElement(
  canonical: string,
  elementId: string,
  fetchJson: Fetcher,
): Promise<ResolvedElement | undefined> {
  const sd = await loadStructureDefinition(canonical, fetchJson)
  if (!sd) return undefined
  const root = sd.type ?? elementId.split('.')[0]
  // element ids are rooted at the resource type; drop it for a relative path
  const rel = elementId.startsWith(root + '.') ? elementId.slice(root.length + 1) : elementId
  return walk(sd, root, rel, fetchJson)
}

async function walk(
  sd: StructureDefinition,
  root: string,
  rel: string,
  fetchJson: Fetcher,
  depth = 0,
): Promise<ResolvedElement | undefined> {
  const els = elementsOf(sd)
  const want = rel ? `${root}.${rel}` : root

  // the slice itself, before anything that ignores slice names. Unslicing turns
  // "extension:recordedSexOrGender" into "extension", which matches the generic
  // element every resource has and loses the definition the slice is bound to.
  for (const e of els) {
    if ((e.id ?? e.path ?? '') === want) {
      const type = e.type?.[0]?.code
      if (type) {
        return { type, isArray: repeats(e), fixed: fixedOf(e), path: unslice(rel),
                 profile: e.type?.[0]?.profile?.[0] }
      }
    }
  }

  // exact hit, ignoring slice names
  const pinned = (want.split('.').pop() ?? '').includes(':')
  for (const e of els) {
    const id = e.id ?? e.path ?? ''
    if (unslice(id) === unslice(want)) {
      const types = (e.type ?? []).map((t) => t.code).filter((c): c is string => !!c)
      if (!types.length) break
      // A request naming "value[x]" left the type open; one naming
      // "value[x]:valueQuantity" already chose, and that choice is not the
      // value's to second-guess.
      const choices = types.length > 1 && !pinned ? types : undefined
      return { type: types[0], choices, isArray: repeats(e), fixed: fixedOf(e), path: unslice(rel),
               profile: e.type?.[0]?.profile?.[0] }
    }
  }

  // a concrete choice element, e.g. "valueQuantity" where the snapshot only
  // declares "value[x]". The chosen type is the suffix.
  const tail = unslice(want).split('.').pop() ?? ''
  const wantParent = unslice(want).split('.').slice(0, -1).join('.')
  const choice = tail.match(/^(.*?)([A-Z][A-Za-z]+)$/)
  if (choice) {
    const [, stem, suffix] = choice
    for (const e of els) {
      const rawId = e.id ?? e.path ?? ''
      // The parent path has to match as well. A tail-only match lands on any
      // element ending in the same choice name, and a complex extension carries
      // a generic open value[x] alongside the one its own sub-extension
      // declares, so the first snapshot entry to end in "value[x]" is not
      // necessarily the one asked for.
      if (unslice(rawId).split('.').slice(0, -1).join('.') !== wantParent) continue
      // Compared against the raw id, because unslice() rewrites "effective[x]"
      // to "effective" and no id would ever equal stem + "[x]" after it.
      const rawTail = rawId.split('.').pop() ?? ''
      if (rawTail.split(':')[0] !== stem + '[x]') continue
      const types = (e.type ?? []).map((t) => t.code)
      const hit = types.find((t) => t?.toLowerCase() === suffix.toLowerCase())
      if (hit) return { type: hit, isArray: repeats(e), fixed: fixedOf(e), path: unslice(rel) }
    }
  }

  // A choice element named without its suffix: "Observation.effective" where the
  // snapshot declares "Observation.effective[x]". FHIR names the element with the
  // suffix, but an element id may name the choice itself and leave the concrete
  // type to whatever is written into it.
  for (const e of els) {
    if (unslice(e.id ?? e.path ?? '') !== unslice(want) + '[x]') continue
    const types = (e.type ?? []).map((t) => t.code).filter((c): c is string => !!c)
    if (!types.length) continue
    return { type: types[0], choices: types, isArray: repeats(e), fixed: fixedOf(e),
             path: unslice(rel), profile: e.type?.[0]?.profile?.[0] }
  }

  // longest matching prefix, then continue inside that element's datatype.
  // The prefix is resolved the same way this function resolves anything, so a
  // prefix naming a concrete choice element resolves too: "performedPeriod.start"
  // has to find "performed[x]" before it can step into Period.
  const segs = rel.split('.')
  for (let n = segs.length - 1; n >= 1; n--) {
    const prefixRel = segs.slice(0, n).join('.')
    const outer = await walk(sd, root, prefixRel, fetchJson, depth + 1)
    if (!outer?.type) continue
    // An extension constrained to a definition is resolved inside that
    // definition, not inside the bare Extension datatype. The bare one permits
    // every value type there is, and taking the first of them wrote a coding
    // into a property meant for binary data.
    const inner = (outer.profile && (await loadStructureDefinition(outer.profile, fetchJson)))
      || (await loadStructureDefinition(CORE + outer.type, fetchJson))
    if (!inner) continue
    const deeper = await walk(inner, inner.type ?? outer.type, segs.slice(n).join('.'), fetchJson, depth + 1)
    if (deeper) {
      // The leaf's own repeatability, not its parent's. A reference inside a
      // repeating element is still a single value, and treating it as a list
      // wrote the one reference as an array of one.
      return { ...deeper, path: unslice(rel) }
    }
  }
  // Nothing here. A profile may be published with only a differential, in which
  // case it lists just the elements it constrains and everything inherited is
  // defined further up. Resolving those is what a validator does, and without it
  // an element the profile does not mention is silently never written.
  if (sd.baseDefinition && depth < 8) {
    const base = await loadStructureDefinition(sd.baseDefinition, fetchJson)
    if (base && base !== sd) return walk(base, base.type ?? root, rel, fetchJson, depth + 1)
  }
  return undefined
}

/**
 * Every fixed or pattern value the profile pins, as relative paths. These are
 * applied to a freshly created resource before any answer is written, which is
 * how required-but-unasked things like a fixed code or category get filled.
 */
export async function fixedValuesOf(
  canonical: string,
  fetchJson: Fetcher,
): Promise<Array<{ path: string; value: unknown; isArray: boolean; optional: boolean }>> {
  const sd = await loadStructureDefinition(canonical, fetchJson)
  if (!sd) return []
  const root = sd.type ?? ''
  // Which slices the profile does not require. A value pinned underneath one of
  // them must not bring that slice into existence on its own: the sex a patient
  // was recorded as is optional, and pinning what kind of value it is produced
  // an extension saying it was a recorded sex and not saying which, which is
  // less conformant than not being there.
  const optionalPrefixes: string[] = []
  const root0 = sd.type ?? ''
  for (const e of elementsOf(sd)) {
    const id = e.id ?? ''
    if (!id.startsWith(root0 + '.') || (e.min ?? 0) >= 1) continue
    const rel = id.slice(root0.length + 1)
    if (rel.includes(':')) optionalPrefixes.push(rel)
  }

  const out: Array<{ path: string; value: unknown; isArray: boolean; optional: boolean }> = []
  for (const e of elementsOf(sd)) {
    const v = fixedOf(e)
    if (v === undefined) continue
    // The fixed url of an extension slice identifies that extension; it is not
    // content. Writing it on its own produces an extension carrying a url and no
    // value, which every extension is forbidden from being. It belongs there
    // only once something actually fills that extension.
    const segs = (e.id ?? e.path ?? '').split('.')
    if (segs[segs.length - 1] === 'url' && segs.some((x) => x.startsWith('extension'))) continue
    // The raw id, not the unsliced one: unslice() would turn "value[x].system"
    // into "value.system" and "category:VSCat" into "category", losing both the
    // choice marker and the slice the fixed value belongs to.
    const id = e.id ?? e.path ?? ''
    if (!id.startsWith(root + '.')) continue
    const rel = id.slice(root.length + 1)
    const optional = optionalPrefixes.some((pre) => rel === pre || rel.startsWith(pre + '.'))
    out.push({ path: rel, value: v, isArray: repeats(e), optional })
  }
  return out
}

/**
 * The concrete value type an extension definition holds, so a value written into
 * an extension slice can be written the way an extension has to be written: its
 * own url, and the single typed value element it defines.
 */
export async function extensionValueType(
  canonical: string,
  fetchJson: Fetcher,
): Promise<string | undefined> {
  const sd = await loadStructureDefinition(canonical, fetchJson)
  if (!sd) return undefined
  for (const e of elementsOf(sd)) {
    const id = e.id ?? e.path ?? ''
    if (id === 'Extension.value[x]' || id.endsWith('.value[x]')) {
      const t = e.type?.[0]?.code
      if (t) return t
    }
  }
  return undefined
}

export function resourceTypeOf(sd: StructureDefinition | undefined): string | undefined {
  return sd?.type
}


/**
 * Cardinality of every segment along an element path, not just the leaf.
 * "Encounter.reasonReference.reference" has a repeating first segment and a
 * single second one, and a writer that only knows the leaf produces an object
 * where the resource wants an array.
 */
export async function resolveSegments(
  canonical: string,
  elementId: string,
  fetchJson: Fetcher,
  /** The value about to be written, needed only to name a choice element. */
  valueHint?: unknown,
): Promise<Array<{ name: string; slice?: string; isArray: boolean; url?: string }> | undefined> {
  const sd = await loadStructureDefinition(canonical, fetchJson)
  if (!sd) return undefined
  const root = sd.type ?? elementId.split('.')[0]
  const rel = elementId.startsWith(root + '.') ? elementId.slice(root.length + 1) : elementId
  const segs = rel.split('.')
  const out: Array<{ name: string; slice?: string; isArray: boolean; url?: string }> = []
  for (let i = 0; i < segs.length; i++) {
    const [rawName, slice] = segs[i].split(':')
    const prefix = segs.slice(0, i + 1).join('.')
    const el = await resolveElement(canonical, `${root}.${prefix}`, fetchJson)
    // A choice element's id keeps its bracketed suffix (value[x], onset[x]), but
    // the property written is the stem plus the capitalized type code. FHIR names
    // concrete choice elements by that rule, so the resolved type is what turns
    // value[x] into valueQuantity; writing the id verbatim would create a literal
    // "value[x]" property. An element id may also name the choice with no suffix
    // at all, in which case the same rule applies to the bare name.
    const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
    const isLast = i === segs.length - 1
    let name = rawName
    if (rawName.endsWith('[x]')) {
      const stem = rawName.slice(0, -3)
      // A type slice is named after the concrete property it pins, so the slice
      // name is the answer and the value has no say in it.
      name = slice && slice.startsWith(stem)
        ? slice
        : el ? stem + cap(concreteType(el, isLast ? valueHint : undefined)) : rawName
    } else if (el?.choices?.length) {
      name = rawName + cap(concreteType(el, isLast ? valueHint : undefined))
    }
    // an extension is always a repeating element, whatever the snapshot says
    const isArray = name === 'extension' || name === 'modifierExtension' ? true : !!el?.isArray
    // An extension says which extension it is by its url. A slice bound to its
    // own definition takes the url from that definition; one defined inline,
    // as the sub-extensions of a complex extension are, pins the url on its own
    // url element instead. Without either the element is an extension of
    // nothing, which no resource may carry.
    let url: string | undefined
    if (name === 'extension' || name === 'modifierExtension') {
      url = el?.profile
      if (!url && slice) {
        const pinned = await resolveElement(canonical, `${root}.${prefix}.url`, fetchJson)
        if (typeof pinned?.fixed === 'string') url = pinned.fixed
      }
    }
    out.push({ name, slice, isArray, url })
  }
  return out
}
