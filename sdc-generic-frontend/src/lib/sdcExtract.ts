// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Definition-based extraction, HL7 SDC 4.0.0                                │
// │  QuestionnaireResponse in, transaction Bundle out.                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// This file knows about SDC and about FHIR. It knows nothing about any
// particular implementation guide: no profile canonical, no linkId, no element
// path appears here. Everything specific arrives in the Questionnaire.
//
// Extensions honoured:
//   definitionExtract       marks where a resource starts, names its profile,
//                           and supplies Bundle.entry metadata
//   definitionExtractValue  a fixed value or an expression for one element
//   extractAllocateId       names a uuid, scoped to its item and descendants

import fhirpath from 'fhirpath'
// the R4 model is what lets FHIRPath resolve choice elements, so that
// answer.value finds answer.valueString / answer.valueCoding
import fhirR4Model from 'fhirpath/fhir-context/r4'
import {
  resolveElement, resolveSegments, fixedValuesOf, loadStructureDefinition, extensionValueType,
  concreteType,
} from './profileTypes'
import { urnUuid } from './uuid'

const SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/'
const EXT_EXTRACT = SDC + 'sdc-questionnaire-definitionExtract'
const EXT_VALUE = SDC + 'sdc-questionnaire-definitionExtractValue'
const EXT_ALLOCATE = SDC + 'sdc-questionnaire-extractAllocateId'

type Json = Record<string, unknown>
type Fetcher = (url: string) => Promise<unknown>

interface Ext { url: string; extension?: Ext[]; [k: string]: unknown }
interface QItem { linkId: string; type: string; definition?: string; repeats?: boolean; item?: QItem[]; extension?: Ext[] }
interface Questionnaire { resourceType: 'Questionnaire'; url?: string; item?: QItem[]; extension?: Ext[] }
interface QRAnswer { [k: string]: unknown; item?: QRItem[] }
interface QRItem { linkId: string; answer?: QRAnswer[]; item?: QRItem[] }
interface QResponse { resourceType: 'QuestionnaireResponse'; item?: QRItem[]; subject?: { reference?: string }; [k: string]: unknown }

interface Draft {
  canonical: string
  resourceType: string
  resource: Json
  fullUrl: string
  /** slice name -> index within its array, so repeated slices stay distinct */
  sliceIndex: Map<string, number>
}

interface Scope {
  vars: Record<string, string>
  drafts: Map<string, Draft>
}

function subExt(e: Ext | undefined, url: string): Ext | undefined {
  return e?.extension?.find((x) => x.url === url)
}
function valueOf(e: Ext | undefined): unknown {
  if (!e) return undefined
  for (const k of Object.keys(e)) if (k.startsWith('value')) return e[k]
  return undefined
}
function extsOf(node: { extension?: Ext[] } | undefined, url: string): Ext[] {
  return (node?.extension ?? []).filter((e) => e.url === url)
}

function evalPath(expr: string, qr: QResponse, vars: Record<string, string>): unknown {
  try {
    const env: Record<string, unknown> = { resource: qr, ...vars }
    const out = fhirpath.evaluate(qr, expr, env, fhirR4Model)
    return Array.isArray(out) ? out[0] : out
  } catch {
    return undefined
  }
}

/** Split "<canonical>[|version]#<elementId>" into its two halves. */
function splitDefinition(def: string | undefined): { canonical: string; elementId: string } | undefined {
  if (!def || !def.includes('#')) return undefined
  const [left, elementId] = def.split('#')
  // The fragment is already an element id, slices included (extension:dueTo,
  // component:Pain). It is taken verbatim: a choice element's id keeps its
  // bracketed suffix, so rewriting brackets to colons here would turn the
  // legitimate value[x] into value:x and resolve nothing.
  return { canonical: left.split('|')[0], elementId }
}

/** Read the single answer value out of a QuestionnaireResponse answer. */
function answerValue(a: QRAnswer | undefined): unknown {
  if (!a) return undefined
  for (const k of Object.keys(a)) if (k.startsWith('value')) return a[k]
  return undefined
}

/** Build the FHIR shape an element of `type` expects from a raw answer. */
function shapeValue(type: string, raw: unknown): unknown {
  if (raw === undefined || raw === null) return undefined
  const isCoding = (v: unknown): v is Json => typeof v === 'object' && v !== null && 'code' in (v as Json)
  switch (type) {
    case 'Quantity':
    case 'Age':
    case 'Duration':
      if (typeof raw === 'object' && raw !== null && 'value' in (raw as Json)) return raw
      return { value: Number(raw) }
    case 'CodeableConcept':
      if (isCoding(raw)) return { coding: [raw] }
      if (typeof raw === 'string') return { text: raw }
      return raw
    case 'Coding':
      return isCoding(raw) ? raw : undefined
    case 'Reference':
      return typeof raw === 'string' ? { reference: raw } : raw
    case 'boolean':
      return typeof raw === 'boolean' ? raw : String(raw) === 'true'
    case 'integer':
    case 'positiveInt':
    case 'unsignedInt':
      return Math.trunc(Number(raw))
    case 'decimal':
      return Number(raw)
    case 'string':
    case 'code':
    case 'uri':
    case 'canonical':
    case 'id':
    case 'markdown':
      return isCoding(raw) ? String((raw as Json).code) : String(raw)
    case 'date':
      return String(raw).slice(0, 10)
    case 'dateTime':
    case 'instant':
      return String(raw)
    default:
      return raw
  }
}

/**
 * Merge the parts a profile pins beneath a choice element into the value built
 * from the answer. An empty sub-path means the whole value is pinned.
 */
function withFixedParts(value: Json, parts: Array<{ sub: string; value: unknown }>): Json {
  const out: Json = { ...value }
  for (const { sub, value: v } of parts) {
    if (!sub) { Object.assign(out, Object(v) as Json); continue }
    const segs = sub.split('.')
    let cur: Json = out
    for (let i = 0; i < segs.length - 1; i++) {
      const nxt = cur[segs[i]]
      cur = (nxt as Json) ?? (cur[segs[i]] = {} as Json)
    }
    if (cur[segs[segs.length - 1]] === undefined) cur[segs[segs.length - 1]] = v
  }
  return out
}

/**
 * An extension is written as its own url plus one typed value, so a value bound
 * for an extension slice cannot simply be placed where the slice sits. Written
 * that way it produced an extension with neither a url nor a value.
 */
async function asExtension(
  el: { profile?: string }, raw: unknown, fetchJson: Fetcher,
): Promise<Json | undefined> {
  if (!el.profile) return undefined
  const valueType = (await extensionValueType(el.profile, fetchJson)) ?? 'string'
  const shaped = shapeValue(valueType, raw)
  if (shaped === undefined) return undefined
  const key = 'value' + valueType[0].toUpperCase() + valueType.slice(1)
  return { url: el.profile, [key]: shaped }
}

type Seg = { name: string; slice?: string; isArray: boolean; url?: string }

/**
 * Write `value` into `target`, honouring the cardinality of every segment on
 * the way, not only the leaf. A repeating intermediate becomes an array and the
 * walk continues inside its first (or sliced) entry.
 *
 * A slice name does not make an element an array. Slicing a repeating element
 * picks one of its entries, but a choice element is sliced by type while still
 * holding a single value, and writing that one as an array of one produced a
 * `valueQuantity: [{...}]` no server would accept.
 */
function assign(target: Json, segs: Seg[], value: unknown, slices: Map<string, number>): void {
  if (value === undefined || value === null || segs.length === 0) return
  let cur: Json = target
  for (let i = 0; i < segs.length; i++) {
    const { name, slice, isArray } = segs[i]
    const last = i === segs.length - 1
    const key = segs.slice(0, i + 1).map((x) => x.name + (x.slice ? ':' + x.slice : '')).join('.')

    if (last) {
      if (isArray) {
        let arr = cur[name]
        if (!Array.isArray(arr)) arr = cur[name] = arr === undefined ? [] : [arr]
        const a = arr as Json[]
        if (slice) {
          let idx = slices.get(key)
          if (idx === undefined) { idx = a.length; slices.set(key, idx) }
          a[idx] = { ...(a[idx] ?? {}), ...(Object(value) as Json) }
        } else {
          a.push(value as Json)
        }
      } else {
        cur[name] = value
      }
      return
    }

    if (isArray) {
      let arr = cur[name]
      if (!Array.isArray(arr)) arr = cur[name] = arr === undefined ? [] : [arr]
      const a = arr as Json[]
      let idx = slices.get(key)
      if (idx === undefined) { idx = slice ? a.length : 0; slices.set(key, idx) }
      if (!a[idx]) a[idx] = {}
      cur = a[idx]
      if (segs[i].url && cur.url === undefined) cur.url = segs[i].url
    } else {
      const nxt = cur[name]
      cur = (nxt as Json) ?? (cur[name] = {} as Json)
    }
  }
}

export interface ExtractResult {
  bundle: Json
  /** Every element the engine could not resolve, for honest reporting. */
  unresolved: string[]
}

export async function extract(
  q: Questionnaire,
  qr: QResponse,
  fetchJson: Fetcher,
): Promise<ExtractResult> {
  const entries: Array<{ draft: Draft }> = []
  const unresolved: string[] = []
  /**
   * Fixed values sitting under a choice element, held until the answer reveals
   * which concrete type is in play. Kept as path/value pairs: the path says
   * where under the chosen value the fixed part belongs, so a fixed unit and a
   * fixed system land as `system` and `code` rather than being merged blindly.
   */
  const choiceFixed = new Map<string, Array<{ sub: string; value: unknown }>>()

  /**
   * The first draft started for each profile. A value may be declared at the
   * questionnaire root while the context that creates the resource sits on an
   * item, in which case nothing is in scope when the root is processed.
   *
   * The specification's traversal scans down from an extraction context, so a
   * form that follows it never needs this, and none of this guide's forms does
   * any more. It is kept because a form written elsewhere may still declare a
   * value above its context, and dropping such a value silently is worse than
   * resolving it. `extract.test.mjs` exercises the path on a form built for it,
   * since no published form reaches it.
   */
  const firstDraft = new Map<string, Draft>()

  /** Pinned values waiting for the optional element they belong to to exist. */
  const deferredFixed: Array<{ canonical: string; path: string; value: unknown }> = []

  async function startDraft(ext: Ext, scope: Scope): Promise<Draft | undefined> {
    const canonical = valueOf(subExt(ext, 'definition')) as string | undefined
    if (!canonical) return undefined
    const sd = await loadStructureDefinition(canonical, fetchJson)
    const resourceType = sd?.type
    if (!resourceType) { unresolved.push(`profile not resolvable: ${canonical}`); return undefined }
    const resource: Json = { resourceType, meta: { profile: [canonical] } }
    // anything the profile pins, applied before any answer is written
    const slices = new Map<string, number>()
    const rt = resourceType
    for (const { path, value, optional } of await fixedValuesOf(canonical, fetchJson)) {
      // A value pinned under a slice the profile does not require waits until
      // something else has brought that slice into existence. Applied eagerly it
      // creates a half-built optional element, which is worse than an absent one.
      if (optional) { deferredFixed.push({ canonical, path, value }); continue }
      // fixed values sitting under a choice element cannot be placed until the
      // concrete type is known, so hold them for the answer to merge
      if (path.startsWith('value[x]')) {
        const sub = path.slice('value[x]'.length).replace(/^\./, '')
        const held = choiceFixed.get(canonical) ?? []
        held.push({ sub, value })
        choiceFixed.set(canonical, held)
        continue
      }
      const segs = await resolveSegments(canonical, `${rt}.${path}`, fetchJson, value)
      if (segs) assign(resource, segs, value, slices)
    }
    const fullUrlExpr = valueOf(subExt(ext, 'fullUrl')) as string | undefined
    const fullUrl = (fullUrlExpr ? (evalPath(fullUrlExpr, qr, scope.vars) as string) : undefined) ?? urnUuid()
    const draft: Draft = { canonical, resourceType, resource, fullUrl, sliceIndex: slices }
    scope.drafts.set(canonical, draft)
    if (!firstDraft.has(canonical)) firstDraft.set(canonical, draft)
    entries.push({ draft })
    return draft
  }

  const deferred: Array<{ ext: Ext; scope: Scope }> = []

  /**
   * How a value with no extraction context in scope is treated.
   *
   *   item   an item's own value: there is no resource to write it into, and
   *          the first one built for that profile belongs to a different item
   *   defer  declared at the root, where the context may be created later on
   *   retry  a deferred one, now that every context that will exist does
   *
   * Only a form that declares a value above its extraction context reaches
   * `defer` and `retry`, which the specification's traversal does not require an
   * engine to resolve. See the note on `firstDraft`.
   */
  type ValueMode = 'item' | 'defer' | 'retry'

  async function applyValues(
    node: { extension?: Ext[] }, scope: Scope, mode: ValueMode = 'item',
  ): Promise<void> {
    for (const ext of extsOf(node, EXT_VALUE)) {
      const def = splitDefinition(valueOf(subExt(ext, 'definition')) as string | undefined)
      if (!def) continue
      const draft = scope.drafts.get(def.canonical)
        ?? (mode === 'retry' ? firstDraft.get(def.canonical) : undefined)
      if (!draft) {
        // The resource may not exist yet; retried once the whole form is walked.
        if (mode === 'defer') deferred.push({ ext, scope })
        // On the retry every context that will exist does. A value declared at
        // the root for a profile this form extracts elsewhere simply had no
        // answer this time, which is the ordinary shape of a partly answered
        // form. A value declared for a profile the form never extracts is an
        // authoring mistake, and so is one sitting on an item with no context.
        else if (mode !== 'retry' || !declaredProfiles.has(def.canonical)) {
          unresolved.push(`no extraction context for ${def.canonical}#${def.elementId}`)
        }
        continue
      }
      const fixed = subExt(ext, 'fixed-value')
      const expr = subExt(ext, 'expression')
      let raw: unknown
      if (fixed) raw = valueOf(fixed)
      else if (expr) {
        const e = valueOf(expr) as { expression?: string } | undefined
        raw = e?.expression ? evalPath(e.expression, qr, scope.vars) : undefined
      }
      if (raw === undefined) continue
      const el = await resolveElement(def.canonical, def.elementId, fetchJson)
      if (!el) { unresolved.push(`${def.canonical}#${def.elementId}`); continue }
      const segs = await resolveSegments(def.canonical, def.elementId, fetchJson, raw)
      const shaped = el.type === 'Extension'
        ? await asExtension(el, raw, fetchJson)
        : shapeValue(concreteType(el, raw), raw)
      if (segs) assign(draft.resource, segs, shaped, draft.sliceIndex)
    }
  }

  function allocate(node: { extension?: Ext[] }, scope: Scope): void {
    for (const ext of extsOf(node, EXT_ALLOCATE)) {
      const name = valueOf(ext) as string | undefined
      if (name) scope.vars[name] = urnUuid()
    }
  }

  async function walkItem(qi: QItem, qrItems: QRItem[], parent: Scope): Promise<void> {
    const mine = qrItems.filter((x) => x.linkId === qi.linkId)
    if (mine.length === 0) {
      // a root-level extraction still fires with no answers; an item-level one does not
      return
    }
    for (const qrItem of mine) {
      const scope: Scope = { vars: { ...parent.vars }, drafts: new Map(parent.drafts) }
      allocate(qi, scope)
      for (const ext of extsOf(qi, EXT_EXTRACT)) await startDraft(ext, scope)
      await applyValues(qi, scope)

      // this item's own answer, if it names an element
      const def = splitDefinition(qi.definition)
      if (def) {
        const draft = scope.drafts.get(def.canonical)
        const raw = answerValue(qrItem.answer?.[0])
        if (draft && raw !== undefined) {
          const el = await resolveElement(def.canonical, def.elementId, fetchJson)
          if (!el) { unresolved.push(`${def.canonical}#${def.elementId}`); continue }
          const extra = def.elementId.includes('value[x]') ? choiceFixed.get(def.canonical) : undefined
          for (const a of qrItem.answer ?? []) {
            const answered = answerValue(a)
            // Resolved per answer, because a choice element is named after the
            // type of the value going into it and two answers may differ.
            const segs = await resolveSegments(def.canonical, def.elementId, fetchJson, answered)
            let v = el.type === 'Extension'
              ? await asExtension(el, answered, fetchJson)
              : shapeValue(concreteType(el, answered), answered)
            if (extra?.length && v && typeof v === 'object') v = withFixedParts(v as Json, extra)
            if (segs) assign(draft.resource, segs, v, draft.sliceIndex)
          }
        } else if (!draft && raw !== undefined) {
          unresolved.push(`no extraction context in scope for ${def.canonical}#${def.elementId}`)
        }
      }

      const childQr = [...(qrItem.item ?? []), ...(qrItem.answer?.flatMap((a) => a.item ?? []) ?? [])]
      for (const child of qi.item ?? []) await walkItem(child, childQr, scope)
    }
  }

  /**
   * Every profile this form declares an extraction context for, anywhere. A
   * value declared at the root for one of these is simply not applicable when
   * the answers of this response created no such resource, which is the normal
   * shape of a partly answered form. A value declared for a profile the form
   * never extracts is an authoring mistake, and is reported.
   */
  const declaredProfiles = new Set<string>()
  const collectDeclared = (node: { extension?: Ext[]; item?: QItem[] }): void => {
    for (const ext of extsOf(node, EXT_EXTRACT)) {
      const c = valueOf(subExt(ext, 'definition')) as string | undefined
      if (c) declaredProfiles.add(c)
    }
    for (const child of node.item ?? []) collectDeclared(child)
  }
  collectDeclared(q)

  const rootScope: Scope = { vars: {}, drafts: new Map() }
  allocate(q, rootScope)
  for (const ext of extsOf(q, EXT_EXTRACT)) await startDraft(ext, rootScope)
  await applyValues(q, rootScope, 'defer')
  for (const qi of q.item ?? []) await walkItem(qi, qr.item ?? [], rootScope)
  // Anything declared before its resource existed, now that they all do.
  for (const { ext, scope } of deferred.splice(0)) await applyValues({ extension: [ext] }, scope, 'retry')

  // Pinned values under optional slices, applied only where the slice is now
  // present because an answer put something there.
  for (const { canonical, path, value } of deferredFixed) {
    const draft = firstDraft.get(canonical)
    if (!draft) continue
    const segs = await resolveSegments(canonical, `${draft.resourceType}.${path}`, fetchJson, value)
    if (!segs) continue
    // does the element this belongs to already exist?
    let cur: unknown = draft.resource
    let present = true
    for (const seg of segs.slice(0, -1)) {
      const next = (cur as Json)?.[seg.name]
      const step = Array.isArray(next) ? next[0] : next
      if (step === undefined) { present = false; break }
      cur = step
    }
    if (present) assign(draft.resource, segs, value, draft.sliceIndex)
  }

  const bundle: Json = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: entries.map(({ draft }) => ({
      fullUrl: draft.fullUrl,
      resource: draft.resource,
      request: {
        method: (draft.resource as { id?: string }).id ? 'PUT' : 'POST',
        url: (draft.resource as { id?: string }).id
          ? `${draft.resourceType}/${(draft.resource as { id?: string }).id}`
          : draft.resourceType,
      },
    })),
  }
  return { bundle, unresolved }
}
