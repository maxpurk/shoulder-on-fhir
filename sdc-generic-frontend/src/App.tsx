// Generic SDC form filler.
//
// It is given Questionnaires by the server, renders them from their own
// declarations, extracts a transaction Bundle with the SDC engine, validates
// that Bundle against a profile chosen at runtime, and only then submits it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { extract } from './lib/sdcExtract'
import { extractByTemplate, mechanismOf } from './lib/templateExtract'
import { searchValueSet } from './lib/fhirClient'
import fhirpath from 'fhirpath'
import fhirR4Model from 'fhirpath/fhir-context/r4'
import {
  getJson, getQuestionnaire, listQuestionnaires, listBundleProfiles,
  expand, validateBundle, issueText, submitBundle, fhirQuery, findLaunchCandidates,
  type ValidationIssue,
} from './lib/fhirClient'
import { launchContextsOf, populate, type LaunchContext } from './lib/populate'
import {
  collectEnableExpressions, enabled, groupIsPresent, instancePrefix, scopeView,
} from './lib/formLogic'
import { buildResponse, type Unit } from './lib/response'
import { endpoint, configuredOverride, setOverride, defaultOf, type Endpoint } from './lib/config'
import { clearProfileCache } from './lib/profileTypes'

interface Ext { url: string; [k: string]: unknown }
interface AnswerOption { valueCoding?: { system?: string; code?: string; display?: string }; valueString?: string;
  valueInteger?: number; valueDate?: string }
interface EnableWhen { question: string; operator: string; [k: string]: unknown }
interface QItem { linkId: string; text?: string; type: string; required?: boolean; readOnly?: boolean; repeats?: boolean
  answerValueSet?: string; answerOption?: AnswerOption[]; item?: QItem[]; definition?: string; extension?: Ext[]
  enableWhen?: EnableWhen[]; enableBehavior?: string }
interface Q { resourceType: 'Questionnaire'; id?: string; url?: string; title?: string; item?: QItem[]; extension?: Ext[]
  meta?: { profile?: string[] }; contained?: Array<Record<string, unknown>> }

type Values = Record<string, unknown>
type Codes = Record<string, Array<{ system?: string; code: string; display?: string }>>


// A form may ask for something this filler has no control for. Drawing a text box
// for it would collect a value of the wrong type in silence, so it says so instead.
const UNSUPPORTED = new Set(['attachment'])

// A datetime-local control yields 'YYYY-MM-DDTHH:MM'. FHIR requires seconds and
// a timezone offset as soon as a dateTime carries a time, so the browser value is
// completed here rather than in any template: it is a property of the control,
// not of the form being filled.

const CALC_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
const HIDDEN_EXT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden'
const MIN_EXT = 'http://hl7.org/fhir/StructureDefinition/minValue'
const MAX_EXT = 'http://hl7.org/fhir/StructureDefinition/maxValue'
// A quantity item declares its units rather than carrying them in the answer, so
// the control offers what the form permits and the answer says which was chosen.
const UNIT_EXT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit'
const UNIT_OPTION_EXT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption'

// Above this many concepts a dropdown stops being usable, and an expansion that
// comes back at the server's own cap is truncated without saying so, which would
// silently narrow what the form can express. Such a binding is searched instead.
const LIST_LIMIT = 50

function extOf(item: QItem, url: string): Ext | undefined {
  return (item.extension ?? []).find((x) => x.url === url)
}

/** A hidden item is still answered and still extracted; it is only not drawn. */
function isHidden(item: QItem): boolean {
  return (extOf(item, HIDDEN_EXT) as { valueBoolean?: boolean } | undefined)?.valueBoolean === true
}

/** minValue/maxValue are core FHIR and carry the range the guide permits. */
function boundOf(item: QItem, url: string): number | undefined {
  const e = extOf(item, url) as { valueDecimal?: number; valueInteger?: number } | undefined
  return e?.valueDecimal ?? e?.valueInteger
}


/** Every unit the item permits: the one it fixes, or the ones it offers. */
function unitsOf(item: QItem): Unit[] {
  const one = (extOf(item, UNIT_EXT) as { valueCoding?: Unit } | undefined)?.valueCoding
  if (one) return [one]
  return (item.extension ?? [])
    .filter((e) => e.url === UNIT_OPTION_EXT)
    .map((e) => (e as { valueCoding?: Unit }).valueCoding)
    .filter((u): u is Unit => !!u)
}

/** linkId -> FHIRPath, for every item the Questionnaire says is computed. */
function collectCalculated(items: QItem[] | undefined, acc: Record<string, string> = {}): Record<string, string> {
  for (const i of items ?? []) {
    const e = (i.extension ?? []).find((x) => x.url === CALC_EXT) as
      { valueExpression?: { expression?: string } } | undefined
    const expr = e?.valueExpression?.expression
    if (expr) acc[i.linkId] = expr
    collectCalculated(i.item, acc)
  }
  return acc
}

function collectValueSets(items: QItem[] | undefined, acc: string[] = []): string[] {
  for (const i of items ?? []) {
    if (i.answerValueSet) acc.push(i.answerValueSet)
    collectValueSets(i.item, acc)
  }
  return acc
}




/** A binding the server could not enumerate is searched rather than listed. */
function Typeahead({ label, vsUrl, value, onChange }: {
  label: string; vsUrl: string; value: unknown; onChange: (v: unknown) => void
}) {
  const picked = value as { code?: string; display?: string } | undefined
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<Array<{ system?: string; code: string; display?: string }>>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 3) { setOpts([]); return }
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      searchValueSet(vsUrl, q.trim())
        .then((r) => { if (alive) setOpts(r) })
        .catch(() => { if (alive) setOpts([]) })
        .finally(() => { if (alive) setBusy(false) })
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [q, vsUrl])
  return (
    <div className="field">
      <label>{label}<span className="pill">search</span></label>
      {picked?.code ? (
        <div className="row">
          <span className="pill">{picked.display ?? picked.code}</span>
          <button className="ghost" type="button" onClick={() => { onChange(undefined); setQ('') }}>clear</button>
        </div>
      ) : (
        <>
          <input type="text" placeholder="type at least 3 letters…" value={q} onChange={(e) => setQ(e.target.value)} />
          {busy && <span className="sub">searching…</span>}
          {opts.length > 0 && (
            <select size={Math.min(6, opts.length + 1)} onChange={(e) => e.target.value && onChange(JSON.parse(e.target.value))}>
              <option value="">—</option>
              {opts.map((c) => (
                <option key={c.code} value={JSON.stringify({ system: c.system, code: c.code, display: c.display })}>
                  {c.display ?? c.code}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  )
}

/**
 * One resource the Questionnaire asked to be handed at launch. The type comes
 * from the form's own declaration, so this panel is the same for any guide.
 */
function LaunchSlot({ ctx, chosen, onPick }: {
  ctx: LaunchContext; chosen?: { id: string; label: string }; onPick: (v: { id: string; label: string } | undefined) => void
}) {
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<Array<{ id: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (text.trim().length < 2) { setOpts([]); return }
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      findLaunchCandidates(ctx.type, text)
        .then((r) => { if (alive) setOpts(r) })
        .catch(() => { if (alive) setOpts([]) })
        .finally(() => { if (alive) setBusy(false) })
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [text, ctx.type])
  return (
    <div className="field">
      <label>%{ctx.name}<span className="pill">{ctx.type}</span></label>
      {chosen ? (
        <div className="row">
          <span className="pill">{chosen.label}</span>
          <button className="ghost" type="button" onClick={() => { onPick(undefined); setText('') }}>clear</button>
        </div>
      ) : (
        <>
          <input type="text" placeholder={ctx.description ?? `find a ${ctx.type}…`}
            value={text} onChange={(e) => setText(e.target.value)} />
          {busy && <span className="sub">searching…</span>}
          {opts.length > 0 && (
            <select size={Math.min(6, opts.length + 1)} onChange={(e) => e.target.value && onPick(JSON.parse(e.target.value))}>
              <option value="">—</option>
              {opts.map((o) => <option key={o.id} value={JSON.stringify(o)}>{o.label}</option>)}
            </select>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Where to ask. Nothing above this line knows any server address, so pointing
 * the app at a different FHIR endpoint is the whole of what it takes to run it
 * against another implementation guide.
 */
function ServerPanel({ onChange }: { onChange: () => void }) {
  const ROWS: Array<{ key: Endpoint; label: string; hint: string }> = [
    { key: 'fhir', label: 'FHIR server', hint: 'serves Questionnaire, StructureDefinition, ValueSet' },
    { key: 'tx', label: 'Terminology', hint: 'expands what the FHIR server cannot' },
    { key: 'validate', label: 'Validator', hint: 'pre-submission conformance check' },
  ]
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(ROWS.map((r) => [r.key, configuredOverride(r.key)])),
  )
  function apply() {
    for (const r of ROWS) setOverride(r.key, draft[r.key] ?? '')
    // A canonical resolves to a different definition on a different server.
    clearProfileCache()
    onChange()
    setOpen(false)
  }
  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Server</h2>
        <span className="pill" data-testid="active-base">{endpoint('fhir')}</span>
        <button className="ghost" type="button" onClick={() => setOpen(!open)}>
          {open ? 'close' : 'change'}
        </button>
      </div>
      {open && (
        <>
          <p className="sub">
            Absolute (https://hapi.fhir.org/baseR4) or relative to this page. Empty means the
            built-in default. A <code>?fhir=</code> query parameter overrides both, so a server can
            be shared as a link.
          </p>
          <div className="grid">
            {ROWS.map((r) => (
              <div className="field" key={r.key}>
                <label>{r.label}<span className="pill">{r.hint}</span></label>
                <input type="text" data-testid={`base-${r.key}`} placeholder={defaultOf(r.key)}
                  value={draft[r.key] ?? ''}
                  onChange={(e) => setDraft((p) => ({ ...p, [r.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" data-testid="apply-base" onClick={apply}>Connect</button>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ item, value, codes, onChange }: {
  item: QItem; value: unknown; codes: Codes; onChange: (v: unknown) => void
}) {
  const label = (item.text ?? item.linkId) + (item.required ? ' *' : '')
  // A display item is text the form wants shown, not a question. Drawing an
  // input for it invented a field the author never asked anyone to fill in.
  if (item.type === 'display') {
    return <p className="sub" data-testid={`display-${item.linkId}`}>{item.text}</p>
  }
  if (UNSUPPORTED.has(item.type)) {
    return (
      <div className="field">
        <label>{label}<span className="pill warn">{item.type} not supported</span></label>
        <input type="text" value="" readOnly disabled />
      </div>
    )
  }
  if (item.type === 'boolean') {
    return (
      <div className="field">
        <label>{label}</label>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}>
          <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
        </select>
      </div>
    )
  }
  const inline = (item.answerOption ?? [])
    .map((o) => o.valueCoding ?? (o.valueString !== undefined ? { code: String(o.valueString) } : undefined))
    .filter((c): c is { system?: string; code: string; display?: string } => !!c?.code)
  if (item.answerValueSet || inline.length) {
    const opts = inline.length ? inline : (codes[item.answerValueSet ?? ''] ?? [])
    if (item.answerValueSet && !inline.length && !item.readOnly && (!opts.length || opts.length > LIST_LIMIT)) {
      return <Typeahead label={label} vsUrl={item.answerValueSet} value={value} onChange={onChange} />
    }
    return (
      <div className="field">
        <label>{label}<span className="pill">{item.readOnly ? 'calculated' : `${opts.length} codes`}</span></label>
        <select disabled={!!item.readOnly} value={value ? JSON.stringify(value) : ''} onChange={(e) => onChange(e.target.value ? JSON.parse(e.target.value) : undefined)}>
          <option value="">—</option>
          {opts.map((c) => (
            <option key={c.code} value={JSON.stringify({ system: c.system, code: c.code, display: c.display })}>
              {c.display ?? c.code}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const type = item.type === 'decimal' || item.type === 'integer' || item.type === 'quantity' ? 'number'
    : item.type === 'date' ? 'date' : item.type === 'dateTime' ? 'datetime-local'
    : item.type === 'time' ? 'time' : 'text'
  const computed = !!item.readOnly
  // The permitted range is declared on the item, so the control can refuse a
  // value the profile would reject without knowing what is being measured.
  const min = boundOf(item, MIN_EXT)
  const max = boundOf(item, MAX_EXT)

  if (item.type === 'quantity') {
    const units = unitsOf(item)
    const held = (value ?? {}) as { value?: unknown; unit?: Unit }
    const chosen = held.unit ?? units[0]
    const set = (next: { value?: unknown; unit?: Unit }) =>
      onChange(next.value === '' || next.value === undefined ? undefined : next)
    return (
      <div className="field">
        <label>
          {label}
          {(min !== undefined || max !== undefined) && <span className="pill">{min ?? ''}–{max ?? ''}</span>}
        </label>
        <div className="row">
          <input type="number" value={(held.value as string) ?? ''} min={min} max={max} readOnly={computed}
            onChange={(e) => set({ value: e.target.value, unit: chosen })} />
          {units.length > 1 ? (
            <select value={chosen?.code ?? ''}
              onChange={(e) => set({ value: held.value, unit: units.find((u) => u.code === e.target.value) })}>
              {units.map((u) => <option key={u.code} value={u.code}>{u.display ?? u.code}</option>)}
            </select>
          ) : chosen?.code ? <span className="pill">{chosen.display ?? chosen.code}</span> : null}
        </div>
      </div>
    )
  }

  // A text item is prose; a one-line box for it loses the shape of the answer.
  if (item.type === 'text') {
    return (
      <div className="field">
        <label>{label}{computed && <span className="pill">calculated</span>}</label>
        <textarea rows={3} value={(value as string) ?? ''} readOnly={computed}
          onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }

  return (
    <div className="field">
      <label>
        {label}
        {computed && <span className="pill">calculated</span>}
        {!computed && type === 'number' && (min !== undefined || max !== undefined) &&
          <span className="pill">{min ?? ''}–{max ?? ''}</span>}
      </label>
      <input type={type} value={(value as string) ?? ''} readOnly={computed}
        placeholder={item.type === 'reference' ? 'Type/id, e.g. Patient/123' : undefined}
        min={type === 'number' ? min : undefined} max={type === 'number' ? max : undefined}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

interface GroupProps {
  item: QItem; values: Values; codes: Codes; set: (id: string, v: unknown) => void
  /** Keys of answers inside a repeating occurrence carry this. */
  prefix?: string
  /** How many occurrences of each repeating group are open, by prefixed linkId. */
  counts: Record<string, number>
  setCount: (key: string, n: number) => void
  /** Whether each item carrying an enableWhenExpression is currently enabled. */
  gates: Record<string, boolean>
  /** Set once the occurrences of a repeating group are being drawn. */
  drawingInstance?: boolean
}

function Group({ item, values, codes, set, prefix = '', counts, setCount, gates, drawingInstance }: GroupProps) {
  const scoped = scopeView(values, prefix)
  if (!enabled(item, scoped, gates)) return null
  if (item.type !== 'group') {
    if (isHidden(item)) return null
    const key = prefix + item.linkId
    return <Field item={item} value={values[key] ?? scoped[item.linkId]} codes={codes} onChange={(v) => set(key, v)} />
  }

  // A group the form says may occur more than once is drawn once per occurrence,
  // each with its own answers. Without this a second prior treatment overwrites
  // the first, and the form silently records one of them.
  if (item.repeats && !drawingInstance) {
    const key = prefix + item.linkId
    const n = Math.max(1, counts[key] ?? 1)
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <Group key={`${key}~${i}`} item={item} values={values} codes={codes} set={set}
                 prefix={instancePrefix(prefix, item.linkId, i)} counts={counts} setCount={setCount}
                 gates={gates} drawingInstance />
        ))}
        <div className="repeat-controls">
          <button type="button" onClick={() => setCount(key, n + 1)}>
            Add another {(item.text ?? item.linkId).toLowerCase()}
          </button>
          {n > 1 && (
            <button type="button" onClick={() => setCount(key, n - 1)}>
              Remove the last one
            </button>
          )}
        </div>
      </>
    )
  }

  const leaves = (item.item ?? []).filter((c) => c.type !== 'group' && !isHidden(c) && enabled(c, scoped, gates))
  const groups = (item.item ?? []).filter((c) => c.type === 'group')
  if (!leaves.length && !groups.length) return null
  const occurrence = prefix ? Number(prefix.slice(0, -1).split('~').pop()) : undefined
  return (
    <div className="card">
      <h2>{item.text ?? item.linkId}{occurrence !== undefined && occurrence > 0 ? ` (${occurrence + 1})` : ''}</h2>
      {leaves.length > 0 && (
        <div className="grid">
          {leaves.map((c) => {
            const key = prefix + c.linkId
            return <Field key={key} item={c} value={values[key] ?? scoped[c.linkId]} codes={codes}
                          onChange={(v) => set(key, v)} />
          })}
        </div>
      )}
      {groups.map((g) => <Group key={prefix + g.linkId} item={g} values={values} codes={codes} set={set}
                                prefix={prefix} counts={counts} setCount={setCount} gates={gates} />)}
    </div>
  )
}

export default function App() {
  const [forms, setForms] = useState<Array<{ id: string; url: string; title: string }>>([])
  const [profiles, setProfiles] = useState<Array<{ url: string; title: string }>>([])
  const [q, setQ] = useState<Q | null>(null)
  const [values, setValues] = useState<Values>({})
  // How many occurrences of each repeating group are open, by prefixed linkId.
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [codes, setCodes] = useState<Codes>({})
  const [subject, setSubject] = useState('')
  const [profile, setProfile] = useState('')
  const [bundle, setBundle] = useState<unknown>(null)
  const [unresolved, setUnresolved] = useState<string[]>([])
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [busy, setBusy] = useState('')
  const [log, setLog] = useState('')
  const [mechanism, setMechanism] = useState('')
  const [launchCtxs, setLaunchCtxs] = useState<LaunchContext[]>([])
  const [launched, setLaunched] = useState<Record<string, { id: string; label: string }>>({})
  const [popLog, setPopLog] = useState<string[]>([])

  const reload = useCallback(() => {
    setQ(null); setForms([]); setProfiles([]); setBundle(null); setIssues(null); setValues({}); setCounts({}); setLog('')
    listQuestionnaires().then(setForms).catch((e) => setLog(String(e)))
    listBundleProfiles().then(setProfiles).catch(() => undefined)
  }, [])

  useEffect(() => { reload() }, [reload])

  async function load(id: string) {
    setBusy('loading form'); setBundle(null); setIssues(null); setValues({}); setCounts({}); setLog('')
    try {
      const doc = (await getQuestionnaire(id)) as Q
      setQ(doc)
      const ctxs = launchContextsOf(doc as never)
      setLaunchCtxs(ctxs)
      setLaunched({})
      setPopLog([])
      const urls = [...new Set(collectValueSets(doc.item))]
      const got: Codes = {}
      await Promise.all(urls.map(async (u) => { try { got[u] = await expand(u) } catch { got[u] = [] } }))
      setCodes(got)
    } catch (e) { setLog(String(e)) } finally { setBusy('') }
  }

  // A form handed a patient at launch is a form about that patient, so the
  // response says so. Expressions read it from there, and a response with no
  // subject leaves every resource built from it without one.
  const subjectRef = useMemo(() => {
    if (subject) return subject
    const patientCtx = launchCtxs.find((c) => c.type === 'Patient')
    const chosen = patientCtx && launched[patientCtx.name]
    return chosen ? `Patient/${chosen.id}` : ''
  }, [subject, launchCtxs, launched])

  // Recomputed whenever an answer changes: the Questionnaire declares these,
  // so a filler that honours them needs no knowledge of what is being summed.
  const computed = useMemo(() => {
    if (!q) return {}
    const exprs = collectCalculated(q.item)
    if (!Object.keys(exprs).length) return {}
    const qr = buildResponse(q, values, subject, undefined, counts)
    const out: Values = {}
    for (const [lid, expr] of Object.entries(exprs)) {
      try {
        const r = fhirpath.evaluate(qr as object, expr, { resource: qr }, fhirR4Model)
        // An expression may yield a Coding as readily as a number: the laterality
        // of a procedure derived from the laterality of a diagnosis is a Coding,
        // and a filter on primitives would drop it and with it a required element.
        if (Array.isArray(r) && r.length && r[0] !== null && r[0] !== undefined) out[lid] = r[0]
      } catch { /* a half-filled form is not an error */ }
    }
    return out
  }, [q, values, subject])

  // Which items the form is currently asking at all.
  //
  // Evaluated against the response so far, because the answer that governs may
  // sit anywhere in the form — for a question about a treatment recorded in a
  // repeating group, in any occurrence of it. The result is one boolean per
  // item, which is what the renderer, the required check and the response all
  // read, so a hidden question is hidden, not owed, and not submitted.
  const gates = useMemo(() => {
    if (!q) return {}
    const exprs = collectEnableExpressions(q.item)
    if (!Object.keys(exprs).length) return {}
    const qr = buildResponse(q, { ...values, ...computed }, subject, undefined, counts)
    const out: Record<string, boolean> = {}
    for (const [lid, expr] of Object.entries(exprs)) {
      try {
        const r = fhirpath.evaluate(qr as object, expr, { resource: qr }, fhirR4Model)
        // SDC: an empty result is false, and anything non-boolean is an authoring
        // error the renderer is not required to guess its way through.
        out[lid] = Array.isArray(r) && r.length === 1 && r[0] === true
      } catch { out[lid] = false }
    }
    return out
  }, [q, values, computed, subject, counts])

  /** An item the form is not asking, wherever it sits. */
  const itemEnabled = useCallback(
    (i: { linkId: string; enableWhen?: EnableWhen[]; enableBehavior?: string }, prefix: string) =>
      enabled(i, scopeView({ ...values, ...computed }, prefix), gates),
    [values, computed, gates],
  )

  // Population is independent of extraction: it seeds answers from resources the
  // form asked for, whichever mechanism will later turn those answers into
  // records. Re-runnable, because a different launch resource means a different
  // pre-fill.
  async function runPopulate() {
    if (!q) return
    setBusy('populating')
    try {
      const env: Record<string, unknown> = {}
      for (const c of launchCtxs) {
        const chosen = launched[c.name]
        if (!chosen) continue
        env[c.name] = await fhirQuery(`${c.type}/${chosen.id}`)
      }
      const res = await populate(q as never, env, fhirQuery)
      setValues((prev) => ({ ...res.values, ...prev }))
      setPopLog([
        `${Object.keys(res.values).length} answer(s) pre-filled`,
        ...res.queries.map((u) => `query: ${u}`),
        ...res.failed.map((f) => `failed: ${f}`),
      ])
    } catch (e) { setLog(String(e)) } finally { setBusy('') }
  }

  async function runExtract() {
    if (!q) return
    const how = mechanismOf(q as never)
    setBusy(`extracting (${how})`); setIssues(null)
    try {
      const qr = buildResponse(q, { ...values, ...computed }, subjectRef,
        new Set(Object.keys(computed)), counts, itemEnabled)
      if (how === 'template') {
        // the Questionnaire carries a literal template; nothing is inferred
        const res = extractByTemplate(q as never, qr as never)
        setBundle(res.bundle)
        setUnresolved([...res.failed, ...res.emptied.map((e) => 'no value: ' + e)])
        // the extracted Bundle says which profile it claims, so preselect it
        const claimed = (res.bundle as { meta?: { profile?: string[] } } | null)?.meta?.profile?.[0]
        if (claimed && profiles.some((p) => p.url === claimed)) setProfile(claimed)
      } else {
        const res = await extract(q as never, qr as never, getJson)
        setBundle(res.bundle); setUnresolved(res.unresolved)
      }
      setMechanism(how)
    } catch (e) { setLog(String(e)) } finally { setBusy('') }
  }

  async function runValidate() {
    if (!bundle || !profile) return
    setBusy('validating')
    try { setIssues(await validateBundle(bundle, profile)) }
    catch (e) { setLog(String(e)) } finally { setBusy('') }
  }

  async function runSubmit() {
    if (!bundle) return
    setBusy('submitting')
    try { const r = await submitBundle(bundle); setLog('Submitted. ' + JSON.stringify(r).slice(0, 300)) }
    catch (e) { setLog('Submit failed: ' + String(e)) } finally { setBusy('') }
  }

  // A question the form marks required, and does not hide, has to be answered
  // before there is anything worth extracting.
  //
  // Only where its group is present. A required item can be present only inside
  // its parent, and an optional group that no answer brought into the response is
  // not there for it to sit in. Asking for it anyway blocks a submission over a
  // section the form never obliged anyone to fill: a registration recording no
  // prior treatment was held on the category and type of a treatment that does
  // not exist. A value the Questionnaire computes does not make a group present
  // either, which is the same rule buildResponse applies.
  const unanswered = useMemo(() => {
    if (!q) return []
    const all = { ...values, ...computed }
    const out: string[] = []
    const walk = (items: QItem[] | undefined, prefix = '') => {
      for (const i of items ?? []) {
        const scoped = scopeView(all, prefix)
        if (!enabled(i, scoped, gates)) continue
        if (i.type === 'group') {
          // Each occurrence of a repeating group answers for itself. An
          // occurrence nobody touched is not present, so it is owed nothing,
          // which is what lets a second one be opened and left blank.
          if (i.repeats) {
            const n = Math.max(1, counts[prefix + i.linkId] ?? 1)
            for (let k = 0; k < n; k++) {
              const inner = instancePrefix(prefix, i.linkId, k)
              if (!groupIsPresent(i, scopeView(values, inner))) continue
              walk(i.item, inner)
            }
            continue
          }
          if (!groupIsPresent(i, scopeView(values, prefix))) continue
          walk(i.item, prefix)
          continue
        }
        const v = all[prefix + i.linkId] ?? scoped[i.linkId]
        if (i.required && i.type !== 'display'
            && (v === undefined || v === '' || v === null)) {
          out.push(i.text ?? i.linkId)
        }
        walk(i.item, prefix)
      }
    }
    walk(q.item)
    return out
  }, [q, values, computed, counts, gates])

  const errors = useMemo(() => (issues ?? []).filter((i) => i.severity === 'error' || i.severity === 'fatal'), [issues])
  const entryCount = (bundle as { entry?: unknown[] } | null)?.entry?.length ?? 0

  return (
    <div className="wrap">
      <h1>Generic SDC Form Filler</h1>
      <p className="sub">
        Receives Questionnaires from the server, extracts a transaction Bundle using only their own
        declarations, validates it against a profile chosen below, then submits. Holds no knowledge
        of any implementation guide.
      </p>

      <ServerPanel onChange={reload} />

      <div className="card">
        <h2>Form</h2>
        <div className="row">
          <select data-testid="form-picker" value={q?.id ?? ''} onChange={(e) => e.target.value && load(e.target.value)} style={{ maxWidth: 380 }}>
            <option value="">Choose a Questionnaire…</option>
            {forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
          <input data-testid="subject" placeholder="Subject reference, e.g. Patient/123 (optional)"
            value={subject} onChange={(e) => setSubject(e.target.value)} style={{ maxWidth: 320 }} />
        </div>
      </div>

      {q && launchCtxs.length > 0 && (
        <div className="card">
          <h2>Launch context</h2>
          <p className="sub">
            This form declares the resources it wants to be handed before it is filled in. Identify
            them and the form pre-fills whatever it declares it can derive from them.
          </p>
          <div className="grid">
            {launchCtxs.map((c) => (
              <LaunchSlot key={c.name} ctx={c} chosen={launched[c.name]}
                onPick={(v) => setLaunched((p) => {
                  const next = { ...p }
                  if (v) next[c.name] = v; else delete next[c.name]
                  return next
                })} />
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button data-testid="populate" onClick={runPopulate}
              disabled={!!busy || !launchCtxs.every((c) => launched[c.name])}>
              Populate form
            </button>
            {busy === 'populating' && <span className="pill">populating…</span>}
          </div>
          {popLog.length > 0 && <pre data-testid="populate-log">{popLog.join('\n')}</pre>}
        </div>
      )}

      {q && (q.item ?? []).filter((i) => !isHidden(i) && enabled(i, { ...values, ...computed }, gates)).map((i) => (
        <Group key={i.linkId} item={i} values={{ ...values, ...computed }} codes={codes}
               counts={counts} setCount={(k, n) => setCounts((p) => ({ ...p, [k]: n }))}
               gates={gates}
               set={(id, v) => setValues((p) => ({ ...p, [id]: v }))} />
      ))}

      {q && (
        <div className="card">
          <h2>Extract, validate, submit</h2>
          <div className="row">
            <button data-testid="extract" onClick={runExtract} disabled={!!busy || unanswered.length > 0}>Extract Bundle</button>
            <select data-testid="profile-picker" value={profile} onChange={(e) => setProfile(e.target.value)} style={{ maxWidth: 340 }}>
              <option value="">Validate against…</option>
              {profiles.map((p) => <option key={p.url} value={p.url}>{p.title}</option>)}
            </select>
            <button data-testid="validate" className="ghost" onClick={runValidate} disabled={!bundle || !profile || !!busy}>Validate</button>
            <button data-testid="submit" onClick={runSubmit} disabled={!bundle || !!busy || (issues !== null && errors.length > 0)}>Submit to server</button>
            {busy && <span className="pill">{busy}…</span>}
          </div>

          {unanswered.length > 0 && (
            <p data-testid="unanswered" className="sub" style={{ marginTop: 12 }}>
              <span className="warn">{unanswered.length} required question(s) unanswered:</span>{' '}
              {unanswered.slice(0, 6).join('; ')}{unanswered.length > 6 ? ' …' : ''}
            </p>
          )}

          {/* A form that declares a launch context expects to be pre-filled from the
              resource handed to it. Skipping that step is legal, and it is also the
              easiest way to produce a bundle that fails validation on an element no
              question asks for: the values the population step seeds are the ones the
              extraction declarations read. Say so here rather than let the validator
              report a missing reference whose cause is three steps upstream. */}
          {launchCtxs.length > 0 && popLog.length === 0 && (
            <p data-testid="not-populated" className="sub" style={{ marginTop: 12 }}>
              <span className="warn">This form has not been pre-filled.</span>{' '}
              It declares {launchCtxs.length === 1 ? 'a launch context' : `${launchCtxs.length} launch contexts`}, so
              some of what it extracts comes from the resource handed to it and not from a
              question. Choose one above and select Populate form, or expect validation to
              report elements that nothing here asked you for.
            </p>
          )}

          {bundle !== null && (
            <p data-testid="entry-count" className="sub" style={{ marginTop: 12 }}>
              Bundle built with {entryCount} entries{mechanism ? ` via ${mechanism}-based extraction` : ''}.
              {unresolved.length > 0 && <span className="warn"> {unresolved.length} element(s) unresolved.</span>}
            </p>
          )}

          {issues !== null && (
            <div data-testid="validation" style={{ marginTop: 8 }}>
              <strong className={errors.length === 0 ? 'ok' : 'bad'}>
                {errors.length === 0 ? 'Valid against the selected profile' : `${errors.length} error(s)`}
              </strong>
              {(issues ?? []).slice(0, 40).map((i, n) => (
                <div key={n} className="issue">
                  <span className={i.severity === 'error' || i.severity === 'fatal' ? 'bad' : 'warn'}>{i.severity}</span>
                  {' '}{issueText(i)} <span className="sub">{i.expression?.join(', ')}</span>
                </div>
              ))}
            </div>
          )}

          {unresolved.length > 0 && <pre>{unresolved.join('\n')}</pre>}
          {log && <pre>{log}</pre>}
          {bundle !== null && <pre data-testid="bundle-json">{JSON.stringify(bundle, null, 1)}</pre>}
        </div>
      )}
    </div>
  )
}
