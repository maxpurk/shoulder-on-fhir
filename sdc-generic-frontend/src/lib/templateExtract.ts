// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Template-based extraction, HL7 SDC 4.0.0                                  │
// │  QuestionnaireResponse in, transaction Bundle out.                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Far smaller than the definition-based engine, because nothing has to be
// inferred. The Questionnaire contains a literal Bundle already in the shape the
// submission should take; this walks it, swaps annotated placeholders for
// answers, and drops whatever the answers do not fill.
//
// Extensions honoured:
//   templateExtractBundle   root only, points at a contained Bundle template
//   templateExtract         root or item, points at a contained resource template
//   templateExtractValue    on any element, a FHIRPath expression for its value
//   templateExtractContext  on any element, shifts the FHIRPath context
//   extractAllocateId       names a uuid, usable as %name in expressions
//
// No StructureDefinition is read. That is the whole point, and also the cost:
// every fixed value in the template was typed by hand and can drift from the
// profiles it is meant to satisfy.

import fhirpath from 'fhirpath'
// the R4 model is what lets FHIRPath resolve choice elements, so that
// answer.value finds answer.valueString / answer.valueCoding
import fhirR4Model from 'fhirpath/fhir-context/r4'
import { urnUuid } from './uuid'

const SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/'
const EXT_BUNDLE = SDC + 'sdc-questionnaire-templateExtractBundle'
const EXT_TEMPLATE = SDC + 'sdc-questionnaire-templateExtract'
const EXT_VALUE = SDC + 'sdc-questionnaire-templateExtractValue'
const EXT_CONTEXT = SDC + 'sdc-questionnaire-templateExtractContext'
const EXT_ALLOCATE = SDC + 'sdc-questionnaire-extractAllocateId'

type Json = Record<string, unknown>
interface Ext { url: string; extension?: Ext[]; [k: string]: unknown }
interface QItem { linkId: string; extension?: Ext[]; item?: QItem[] }
interface Questionnaire { resourceType: 'Questionnaire'; contained?: Json[]; extension?: Ext[]; item?: QItem[] }
interface QResponse { resourceType: 'QuestionnaireResponse'; [k: string]: unknown }

function valueOf(e: Ext | undefined): unknown {
  if (!e) return undefined
  for (const k of Object.keys(e)) if (k.startsWith('value')) return e[k]
  return undefined
}
function extsOf(node: { extension?: Ext[] } | undefined, url: string): Ext[] {
  return (node?.extension ?? []).filter((e) => e.url === url)
}
function subExt(e: Ext | undefined, url: string): Ext | undefined {
  return e?.extension?.find((x) => x.url === url)
}

export interface TemplateResult {
  bundle: Json | null
  /** Expressions that produced nothing, so their field was removed. */
  emptied: string[]
  /**
   * Expressions that threw, and expressions whose result cannot be the element
   * they were written on. No StructureDefinition is read here, so a template
   * that writes a bare string over an element it had written as an object is
   * copied out as the template asks and reported rather than quietly corrected.
   */
  failed: string[]
}

export function extractByTemplate(q: Questionnaire, qr: QResponse): TemplateResult {
  const emptied: string[] = []
  const failed: string[] = []

  const vars: Record<string, string> = {}
  for (const e of extsOf(q, EXT_ALLOCATE)) {
    const name = valueOf(e) as string | undefined
    if (name) vars[name] = urnUuid()
  }

  /**
   * A context is a FHIRPath path into the QuestionnaireResponse, not a detached
   * object. fhirpath resolves a choice element such as `answer.value` from the
   * type of what it is given, and a bare sub-object carries no type, so every
   * expression is evaluated against the whole response with the context path in
   * front of it.
   *
   * Only an expression that reads as a continuation of that path may be joined
   * to it, and a path step always begins with a name. Anything starting with a
   * variable, a literal or a bracket is already complete and stands on its own;
   * joining it produced expressions like `(ctx)[0].'Patient/' + %resource...`,
   * which parse as nothing.
   */
  const anchored = (expr: string) => !/^\s*[A-Za-z_]/.test(expr)

  function evaluate(expr: string, ctx: string, path: string): unknown[] {
    const full = !ctx || anchored(expr) ? expr : `${ctx}.${expr}`
    try {
      const out = fhirpath.evaluate(qr as object, full, { resource: qr, ...vars }, fhirR4Model)
      return Array.isArray(out) ? out : out === undefined ? [] : [out]
    } catch {
      failed.push(`${path}: ${full}`)
      return []
    }
  }

  /**
   * Walk a cloned template. For each primitive carrying a templateExtractValue
   * sibling (_field), replace the placeholder with the expression's result, or
   * delete the field when it yields nothing.
   */
  /** One templated node in, zero or more filled copies out. A context yielding
   *  several results clones the property once per result, which is how the
   *  mechanism expresses a loop. */
  function fillMany(node: unknown, ctx: string, path: string): unknown[] {
    if (Array.isArray(node)) {
      return node.flatMap((n, i) => fillMany(n, ctx, `${path}[${i}]`))
    }
    if (node === null || typeof node !== 'object') return [node]
    const obj = node as Json

    // an element-level context shift applies to this object and its children
    const ctxExt = extsOf(obj as { extension?: Ext[] }, EXT_CONTEXT)[0]
    if (ctxExt) {
      const raw = valueOf(ctxExt)
      const expr = typeof raw === 'string' ? raw : (raw as { expression?: string } | undefined)?.expression
      obj.extension = (obj.extension as Ext[]).filter((e) => e.url !== EXT_CONTEXT)
      if (!(obj.extension as Ext[]).length) delete obj.extension
      if (expr) {
        const shifted = anchored(expr) ? `(${expr})` : ctx ? `(${ctx}.${expr})` : `(${expr})`
        const hits = evaluate(expr, ctx, path)
        if (!hits.length) { emptied.push(`${path}: ${expr}`); return [] }
        return hits.flatMap((_h, n) =>
          fillOne(JSON.parse(JSON.stringify(obj)) as Json, `${shifted}[${n}]`, `${path}{${n}}`))
      }
    }
    return fillOne(obj, ctx, path)
  }

  function fill(node: unknown, ctx: string, path: string): unknown {
    const r = fillMany(node, ctx, path)
    if (Array.isArray(node)) return r.length ? r : undefined
    return r.length ? r[0] : undefined
  }

  function fillOne(obj: Json, localCtx: string, path: string): unknown[] {

    // an extension directly on a complex element
    const selfVal = extsOf(obj as { extension?: Ext[] }, EXT_VALUE)[0]
    if (selfVal) {
      const expr = valueOf(selfVal) as string | undefined
      obj.extension = (obj.extension as Ext[]).filter((e) => e.url !== EXT_VALUE)
      if (!(obj.extension as Ext[]).length) delete obj.extension
      if (expr) {
        const hits = evaluate(expr, localCtx, path)
        if (!hits.length) { emptied.push(`${path}: ${expr}`); return [] }
        // The template wrote this element as an object; a scalar in its place
        // changes what the element is. The value still travels, because the
        // template is the authority here, but it no longer does so in silence.
        if (Object.keys(obj).length === 0 && hits.some((h) => h === null || typeof h !== 'object')) {
          failed.push(`${path}: ${expr} yielded a value where the template wrote an object`)
        }
        return hits
      }
    }

    const out: Json = {}
    // Keys whose sidecar expression this pass already evaluated. The second loop
    // exists for a sidecar that has no primitive beside it; without this, a
    // primitive that WAS present but whose expression yielded nothing would be
    // evaluated a second time there and reported as unresolved twice.
    const attempted = new Set<string>()
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) continue // handled alongside its primitive
      const sidecarRaw = obj['_' + key]
      // an array of primitives carries an array of sidecars, aligned by position
      if (Array.isArray(sidecarRaw) && Array.isArray(obj[key])) {
        const prims = obj[key] as unknown[]
        const filledArr: unknown[] = []
        prims.forEach((prim, n) => {
          const sc = (sidecarRaw as Array<{ extension?: Ext[] } | null>)[n]
          const a = sc && extsOf(sc, EXT_VALUE)[0]
          if (!a) { filledArr.push(prim); return }
          const ex = valueOf(a) as string | undefined
          const hits = ex ? evaluate(ex, localCtx, `${path}.${key}[${n}]`) : []
          if (!hits.length) { emptied.push(`${path}.${key}[${n}]: ${ex ?? ''}`); return }
          hits.forEach((h) => filledArr.push(h))
        })
        if (filledArr.length) out[key] = filledArr
        attempted.add(key)
        continue
      }
      const sidecar = sidecarRaw as { extension?: Ext[] } | undefined
      const ann = sidecar && !Array.isArray(sidecar) && extsOf(sidecar, EXT_VALUE)[0]
      if (ann) {
        attempted.add(key)
        const expr = valueOf(ann) as string | undefined
        const hits = expr ? evaluate(expr, localCtx, `${path}.${key}`) : []
        if (!hits.length) { emptied.push(`${path}.${key}: ${expr ?? ''}`); continue }
        const v = hits[0]
        out[key] = typeof v === 'object' && v !== null && 'value' in (v as Json) && Object.keys(v as Json).length === 1
          ? (v as Json).value
          : v
        continue
      }
      const filled = fill(obj[key], localCtx, `${path}.${key}`)
      if (filled !== undefined) out[key] = filled
    }
    // a sidecar with no primitive of its own, e.g. an annotated absent field
    for (const key of Object.keys(obj)) {
      if (!key.startsWith('_')) continue
      const bare = key.slice(1)
      if (bare in out || attempted.has(bare)) continue
      // an array of sidecars stands for an array of primitives, so the value
      // it yields belongs in an array even though none was written out
      const sc = obj[key]
      const isArr = Array.isArray(sc)
      const holder = (isArr ? (sc as Array<{ extension?: Ext[] }>)[0] : sc) as { extension?: Ext[] }
      const ann = extsOf(holder, EXT_VALUE)[0]
      const expr = ann && (valueOf(ann) as string | undefined)
      if (!expr) continue
      const hits = evaluate(expr, localCtx, `${path}.${bare}`)
      if (!hits.length) { emptied.push(`${path}.${bare}: ${expr}`); continue }
      out[bare] = isArr ? hits : hits[0]
    }
    return Object.keys(out).length ? [out] : []
  }

  function contained(ref: string | undefined): Json | undefined {
    if (!ref || !ref.startsWith('#')) return undefined
    return (q.contained ?? []).find((c) => c.id === ref.slice(1))
  }

  const bundleExt = extsOf(q, EXT_BUNDLE)[0]
  if (bundleExt) {
    const ref = (valueOf(bundleExt) as { reference?: string } | undefined)?.reference
    const tmpl = contained(ref)
    if (!tmpl) return { bundle: null, emptied, failed: [...failed, `no contained template at ${ref}`] }
    const filled = fill(JSON.parse(JSON.stringify(tmpl)), '', 'Bundle') as Json | undefined
    // the template's id is the handle templateExtractBundle points at, an
    // artifact of it being a contained resource; it says nothing about the
    // submission and must not travel with it
    if (filled) delete filled.id
    return { bundle: filled ?? null, emptied, failed }
  }

  /**
   * templateExtract sits on the Questionnaire root or on any item. On an item,
   * one resource is produced per answer of that item, and the FHIRPath context
   * is the matching QuestionnaireResponse item rather than the response itself,
   * which is what lets a repeating group become several resources.
   */
  interface Site { ext: Ext; ctx: string; label: string }
  const sites: Site[] = extsOf(q, EXT_TEMPLATE).map((ext) => ({ ext, ctx: '', label: 'root' }))

  /** Paths of every response item with this linkId, so a repeating group becomes
   *  one resource per instance rather than one for the group. */
  const qrPathsFor = (linkId: string): string[] => {
    const found: string[] = []
    const walk = (items: unknown, prefix: string) => {
      ;((items as Array<Json> | undefined) ?? []).forEach((i, n) => {
        const here = `${prefix}item[${n}]`
        if (i.linkId === linkId) found.push(here)
        walk(i.item, `${here}.`)
      })
    }
    walk((qr as Json).item, '')
    return found
  }

  const collect = (items: QItem[] | undefined) => {
    for (const item of items ?? []) {
      for (const ext of extsOf(item as { extension?: Ext[] }, EXT_TEMPLATE)) {
        for (const ctx of qrPathsFor(item.linkId)) {
          sites.push({ ext, ctx, label: item.linkId })
        }
      }
      collect(item.item)
    }
  }
  collect(q.item)

  const entries: Json[] = []
  for (const { ext: e, ctx, label } of sites) {
    const ref = (valueOf(subExt(e, 'template')) as { reference?: string } | undefined)?.reference
    const tmpl = contained(ref)
    if (!tmpl) { failed.push(`no contained template at ${ref}`); continue }
    const res = fill(JSON.parse(JSON.stringify(tmpl)), ctx, `${label}:${ref ?? 'template'}`) as Json | undefined
    if (!res) continue
    // the id on the template is the handle the Questionnaire refers to it by, not
    // an identity the extracted resource has; only resourceId can give it one,
    // and only then is this an update rather than a create
    delete res.id
    const exprOf = (name: string) => valueOf(subExt(e, name)) as string | undefined
    const evalOne = (name: string) => {
      const x = exprOf(name)
      return x ? (evaluate(x, ctx, name)[0] as string | undefined) : undefined
    }
    const resourceId = evalOne('resourceId')
    if (resourceId) res.id = resourceId
    const fullUrl = evalOne('fullUrl')
    const request: Json = resourceId
      ? { method: 'PUT', url: `${res.resourceType}/${resourceId}` }
      : { method: 'POST', url: String(res.resourceType) }
    for (const [name, prop] of [['ifNoneMatch', 'ifNoneMatch'], ['ifModifiedSince', 'ifModifiedSince'],
                                ['ifMatch', 'ifMatch'], ['ifNoneExist', 'ifNoneExist']] as const) {
      const v = evalOne(name)
      if (v !== undefined) request[prop] = v
    }
    entries.push({
      fullUrl: fullUrl ?? urnUuid(),
      resource: res,
      request,
    })
  }
  if (!entries.length) return { bundle: null, emptied, failed }
  return { bundle: { resourceType: 'Bundle', type: 'transaction', entry: entries }, emptied, failed }
}

/** Which mechanism does this Questionnaire declare? */
export function mechanismOf(q: Questionnaire & { meta?: { profile?: string[] } }): 'template' | 'definition' | 'unknown' {
  const profiles = q.meta?.profile ?? []
  if (profiles.some((p) => p.endsWith('sdc-questionnaire-extr-template'))) return 'template'
  if (profiles.some((p) => p.endsWith('sdc-questionnaire-extr-defn'))) return 'definition'
  if (extsOf(q, EXT_BUNDLE).length || extsOf(q, EXT_TEMPLATE).length) return 'template'
  const onAnyItem = (items: QItem[] | undefined): boolean =>
    (items ?? []).some((i) => extsOf(i as { extension?: Ext[] }, EXT_TEMPLATE).length > 0 || onAnyItem(i.item))
  if (onAnyItem(q.item)) return 'template'
  return 'unknown'
}
