// Extraction regression tests. No server: StructureDefinitions come from the
// packages on disk, so this runs anywhere the IG has been built.
//
// Every expectation below failed before the fixes it guards, so a silent return
// of any of them is a real regression rather than a tightened assertion.

import fs from 'node:fs'
import assert from 'node:assert/strict'
import fhirpath from 'fhirpath'
import fhirR4Model from 'fhirpath/fhir-context/r4/index.js'
import { offlineFetch, differentialOnlyFetch } from './offlineFixtures.mjs'
import { extract } from '../dist-test/sdcExtract.mjs'
import { extractByTemplate, mechanismOf } from '../dist-test/templateExtract.mjs'
import { launchContextsOf, populate, resolveQuery } from '../dist-test/populate.mjs'
import {
  collectEnableExpressions, enabled, groupIsPresent, answeredWithin, instancePrefix,
} from '../dist-test/formLogic.mjs'
import { buildResponse } from '../dist-test/response.mjs'

const RES = '../ig/fsh-generated/resources'
if (!fs.existsSync('../ig/output')) {
  console.error('ig/output is missing: build the IG first, its StructureDefinitions carry the snapshots.')
  process.exit(1)
}
const load = (n) => JSON.parse(fs.readFileSync(`${RES}/Questionnaire-${n}.json`, 'utf8'))

let answered = 0
const answerFor = (it) => {
  answered++
  switch (it.type) {
    case 'boolean': return { valueBoolean: true }
    case 'decimal': return { valueDecimal: 12.5 }
    case 'integer': return { valueInteger: 3 }
    case 'date': return { valueDate: '2026-03-04' }
    case 'dateTime': return { valueDateTime: '2026-03-04T09:30:00+01:00' }
    case 'choice': case 'open-choice': {
      const o = it.answerOption?.[0]
      if (o?.valueCoding) return { valueCoding: o.valueCoding }
      if (o?.valueString !== undefined) return { valueString: String(o.valueString) }
      return { valueCoding: { system: 'http://snomed.info/sct', code: '7771000', display: 'Test concept' } }
    }
    default: return { valueString: 'test-' + answered }
  }
}
const walk = (items) => (items ?? []).map((it) => it.type === 'group'
  ? { linkId: it.linkId, item: walk(it.item) }
  : { linkId: it.linkId, answer: [answerFor(it)], ...(it.item ? { item: walk(it.item) } : {}) })
const respond = (q) => ({
  resourceType: 'QuestionnaireResponse', questionnaire: q.url, status: 'completed',
  subject: { reference: 'Patient/pat-long-001' }, authored: '2026-03-04T09:30:00+01:00', item: walk(q.item),
})

/** Answers every question except the named ones, which are left blank. */
const respondExcept = (q, skip) => {
  const keep = (items) => (items ?? []).flatMap((it) => {
    if (skip.includes(it.linkId)) return []
    return [it.type === 'group'
      ? { linkId: it.linkId, item: keep(it.item) }
      : { linkId: it.linkId, answer: [answerFor(it)], ...(it.item ? { item: keep(it.item) } : {}) }]
  })
  return {
    resourceType: 'QuestionnaireResponse', questionnaire: q.url, status: 'completed',
    subject: { reference: 'Patient/pat-long-001' }, authored: '2026-03-04T09:30:00+01:00', item: keep(q.item),
  }
}

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('definition-based extraction resolves every element it is asked for', async () => {
  for (const name of ['shoulder-registration', 'shoulder-surgery', 'shoulder-follow-up']) {
    const q = load(name)
    const { bundle, unresolved } = await extract(q, respond(q), offlineFetch)
    assert.deepEqual(unresolved, [], `${name} left elements unresolved`)
    assert.ok((bundle.entry ?? []).length > 0, `${name} produced no entries`)
    assert.equal(bundle.type, 'transaction')
    for (const e of bundle.entry) {
      assert.ok(e.fullUrl, 'entry without fullUrl')
      assert.ok(e.request?.method && e.request?.url, 'entry without request')
      assert.ok(e.resource?.meta?.profile?.length, 'entry without a claimed profile')
    }
  }
})

test('an encounter carries the values no question asks for', async () => {
  for (const name of ['shoulder-surgery', 'shoulder-follow-up']) {
    const q = load(name)
    const { bundle } = await extract(q, respond(q), offlineFetch)
    const enc = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Encounter')
    assert.ok(enc, `${name} produced no Encounter`)
    assert.ok(enc.status, `${name}: Encounter.status missing`)
    assert.ok(enc.class?.code, `${name}: Encounter.class missing`)
    assert.ok(enc.subject?.reference, `${name}: Encounter.subject missing`)
  }
})

test('a value declared above its extraction context still reaches the resource', async () => {
  // No form in this guide does this any more: the specification's traversal scans
  // down from the extraction context, so every value now sits on the item that
  // carries it or beneath it. The engine keeps resolving the other arrangement,
  // because a form written elsewhere may still use it, and this is the only thing
  // that exercises that tolerance. Built by hoisting a declaration the surgery
  // form makes on its encounter group up to the questionnaire root.
  const q = structuredClone(load('shoulder-surgery'))
  const group = q.item.find((i) => i.linkId === 'encounter')
  const hoisted = group.extension.filter((e) => e.url.endsWith('definitionExtractValue'))
  assert.ok(hoisted.length >= 3, 'expected the encounter group to declare several values')
  group.extension = group.extension.filter((e) => !hoisted.includes(e))
  q.extension = [...(q.extension ?? []), ...hoisted]

  const { bundle } = await extract(q, respond(q), offlineFetch)
  const enc = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Encounter')
  assert.ok(enc, 'hoisted form produced no Encounter')
  assert.ok(enc.status, 'hoisted form: Encounter.status missing')
  assert.ok(enc.class?.code, 'hoisted form: Encounter.class missing')
  assert.ok(enc.subject?.reference, 'hoisted form: Encounter.subject missing')
})

test('a fixed unit under a choice element travels with the answer', async () => {
  const q = load('shoulder-registration')
  const { bundle } = await extract(q, respond(q), offlineFetch)
  const quantities = bundle.entry.map((e) => e.resource)
    .filter((r) => r.resourceType === 'Observation' && r.valueQuantity)
  assert.ok(quantities.length > 10, 'expected many quantity observations')
  for (const o of quantities) {
    assert.ok(o.valueQuantity.system, `${o.meta.profile[0]}: valueQuantity.system missing`)
    assert.ok(o.valueQuantity.code, `${o.meta.profile[0]}: valueQuantity.code missing`)
  }
})

test('every observation carries the effective time its profile names', async () => {
  const q = load('shoulder-registration')
  const { bundle } = await extract(q, respond(q), offlineFetch)
  const obs = bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Observation')
  for (const o of obs) assert.ok(o.effectiveDateTime, `${o.meta.profile[0]}: effectiveDateTime missing`)
})

test('a resource is timed even when the visit date is left blank', () => {
  // Every temporal anchor in the registration template reads one optional
  // question. Skipping it used to strip the time off every resource that
  // declares one, and leave the prior-treatment Procedure without the
  // performed[x] its profile makes mandatory, so the submission was rejected.
  const q = load('shoulder-registration-full-template')
  const TIME = ['effectiveDateTime', 'recordedDate', 'performedDateTime', 'started']
  // what the template promises to time, read off the template itself, so an
  // entry that gains or loses an anchor later is covered without editing this
  // Two entries can claim one profile and time it differently: the prior
  // physiotherapy uses a period, the injection a single date. So the anchors are
  // unioned per profile and a resource has to carry one of them, not all.
  const promised = new Map()
  for (const e of q.contained[0].entry ?? []) {
    const r = e.resource ?? {}
    const declared = TIME.filter((t) => `_${t}` in r)
    if (r.performedPeriod || r.period) declared.push('period')
    if (!declared.length) continue
    const profile = r.meta.profile[0]
    promised.set(profile, new Set([...(promised.get(profile) ?? []), ...declared]))
  }
  assert.ok(promised.size > 30, 'expected most template entries to declare a time')

  const blank = ['encounter.date', 'encounter.endDate',
                 'proc.priorTreatment1.start', 'proc.priorTreatment1.end', 'proc.priorTreatment2.date']
  const { bundle } = extractByTemplate(q, respondExcept(q, blank))
  const resources = bundle.entry.map((e) => e.resource)
  assert.ok(resources.length > 5, 'expected a populated bundle')
  for (const r of resources) {
    const anchors = [...(promised.get(r.meta?.profile?.[0]) ?? [])]
    if (anchors.length) {
      const timed = anchors.some((element) => element === 'period'
        ? Boolean(r.performedPeriod?.start || r.period?.start)
        : Boolean(r[element]))
      assert.ok(timed, `${r.meta.profile[0]}: carries none of ${anchors.join(', ')}`)
    }
    if (r.resourceType === 'Procedure') {
      assert.ok(r.performedDateTime || r.performedPeriod?.start, `${r.meta.profile[0]}: performed[x] missing`)
    }
  }
})

test('nothing the form never asked for reaches the patient', () => {
  // The template is a worked example with the answers swapped out. Any element
  // it carries that no question fills is copied verbatim into every submission,
  // which is how one example patient's phone number and street address were
  // being attributed to everybody who filled the form in.
  const q = load('shoulder-registration-full-template')
  const { bundle } = extractByTemplate(q, respond(q))
  const patient = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient')
  assert.ok(patient, 'no Patient extracted')
  for (const element of ['telecom', 'address']) {
    assert.ok(!patient[element], `Patient.${element} was copied from the example`)
  }
})

test('template extraction runs outside a browser', async () => {
  const q = load('shoulder-registration-full-template')
  assert.equal(mechanismOf(q), 'template')
  const qr = { resourceType: 'QuestionnaireResponse', questionnaire: q.url, status: 'in-progress', item: [] }
  const r = extractByTemplate(q, qr)
  assert.deepEqual(r.failed, [], 'template expressions failed')
  assert.ok(r.bundle.entry.length > 0)
})


test('extraction works against a profile published without a snapshot', async () => {
  // A snapshot is derivable, not required, so a server may serve only the
  // elements a profile constrains. Everything else has to be resolved by
  // following the profile's base, or it is silently never written.
  const { clearProfileCache } = await import('../dist-test/profileTypes.mjs')
  clearProfileCache()
  const q = load('shoulder-registration')
  const { unresolved, bundle } = await extract(q, respond(q), differentialOnlyFetch)
  clearProfileCache()
  assert.deepEqual(unresolved, [], 'elements went unresolved without a snapshot')
  const enc = bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Encounter')
  assert.ok(enc?.status, 'Encounter.status, inherited from the base, was not written')
})

// ---- template extraction, answered ----------------------------------------

const TEMPLATES = ['shoulder-registration-full-template',
                   'shoulder-surgery-full-template',
                   'shoulder-followup-full-template']

test('template extraction yields the whole submission when the form is answered', () => {
  for (const name of TEMPLATES) {
    const q = load(name)
    assert.equal(mechanismOf(q), 'template', `${name} is not a template form`)
    const r = extractByTemplate(q, respond(q))
    assert.deepEqual(r.failed, [], `${name}: expressions failed`)
    const declared = (q.contained?.[0]?.entry ?? []).length
    assert.equal(r.bundle.entry.length, declared,
      `${name}: answered form yielded ${r.bundle.entry.length} of ${declared} entries`)
    assert.ok(r.bundle.meta?.profile?.length, `${name}: bundle claims no profile`)
    for (const e of r.bundle.entry) {
      assert.ok(e.fullUrl && e.request?.method, `${name}: entry without fullUrl or request`)
    }
  }
})

test('the affected side comes from the answer, not from the example', () => {
  // Every body site in the example names one side. A submission for the other
  // side must not silently assert the example's.
  const LEFT = { system: 'http://snomed.info/sct', code: '91775009', display: 'Structure of left shoulder region' }
  for (const name of TEMPLATES) {
    const q = load(name)
    const qr = respond(q)
    const lat = qr.item.flatMap((g) => g.item ?? []).find((i) => i.linkId === 'cond.laterality')
    if (!lat) { assert.fail(`${name}: no laterality question`) }
    lat.answer = [{ valueCoding: LEFT }]
    const r = extractByTemplate(q, qr)
    const sites = []
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (n && typeof n === 'object') {
        for (const [k, v] of Object.entries(n)) {
          if (k === 'bodySite') {
            for (const cc of [v].flat()) for (const c of cc.coding ?? []) sites.push(c.code)
          } else walk(v)
        }
      }
    }
    walk(r.bundle.entry.map((e) => e.resource))
    assert.ok(sites.length > 0, `${name}: no body site emitted`)
    for (const c of sites) assert.equal(c, LEFT.code, `${name}: a body site kept the example's side`)
  }
})

test('an operation that was not performed is not asserted', async () => {
  // The index procedure always happens; anything alongside it may not. Both
  // once read the same question, so one answer emitted two operations.
  const q = load('shoulder-surgery-full-template')
  const qr = respond(q)
  for (const g of qr.item) {
    g.item = (g.item ?? []).filter((i) => !i.linkId.startsWith('proc.type.'))
  }
  const r = extractByTemplate(q, qr)
  const procs = r.bundle.entry.map((e) => e.resource).filter((x) => x.resourceType === 'Procedure')
  assert.equal(procs.length, 1,
    `leaving the concomitant procedure unanswered still emitted ${procs.length} operations`)
})

test('a question the form conditions on another answer is only asked when it applies', () => {
  const item = (w, behavior) => ({ linkId: 'x', enableWhen: w, enableBehavior: behavior })
  const eq = [{ question: 'a', operator: '=', answerBoolean: true }]
  assert.equal(enabled(item(eq), { a: true }), true)
  assert.equal(enabled(item(eq), { a: false }), false)
  assert.equal(enabled(item(eq), {}), false)
  assert.equal(enabled({ linkId: 'x' }, {}), true, 'an unconditional question is always asked')

  const coded = [{ question: 'a', operator: '=', answerCoding: { code: 'L' } }]
  assert.equal(enabled(item(coded), { a: { code: 'L', display: 'Left' } }), true,
    'a coded answer compares on its code')
  assert.equal(enabled(item(coded), { a: { code: 'R' } }), false)

  const gt = [{ question: 'n', operator: '>', answerInteger: 3 }]
  assert.equal(enabled(item(gt), { n: 4 }), true)
  assert.equal(enabled(item(gt), { n: 3 }), false)

  const exists = [{ question: 'a', operator: 'exists', answerBoolean: true }]
  assert.equal(enabled(item(exists), { a: 'something' }), true)
  assert.equal(enabled(item(exists), { a: '' }), false)

  const two = [{ question: 'a', operator: '=', answerBoolean: true },
               { question: 'b', operator: '=', answerBoolean: true }]
  assert.equal(enabled(item(two, 'any'), { a: true, b: false }), true, 'any')
  assert.equal(enabled(item(two), { a: true, b: false }), false, 'all is the default')
})

test('a partly answered form leaves no empty objects behind', () => {
  // An expression yielding nothing removes its element, but a parent left with
  // no children at all is an empty object, and several base resources have
  // invariants that forbid exactly that.
  const emptyObjects = (node, path, out) => {
    if (Array.isArray(node)) { node.forEach((v, i) => emptyObjects(v, `${path}[${i}]`, out)); return out }
    if (node === null || typeof node !== 'object') return out
    const keys = Object.keys(node)
    if (!keys.length) out.push(path)
    for (const k of keys) emptyObjects(node[k], `${path}.${k}`, out)
    return out
  }
  for (const name of TEMPLATES) {
    const q = load(name)
    for (const keep of [0, 0.5, 1]) {
      const qr = respond(q)
      // drop a share of the answers, deterministically
      let n = 0
      for (const g of qr.item) {
        g.item = (g.item ?? []).filter(() => (n++ % 4) < keep * 4)
      }
      const r = extractByTemplate(q, qr)
      const empties = emptyObjects(r.bundle.entry.map((e) => e.resource), name, [])
      assert.deepEqual(empties, [],
        `${name} at ${keep * 100}% answered produced empty objects`)
      for (const e of r.bundle.entry) {
        assert.ok(e.fullUrl && e.request?.method && e.resource?.resourceType,
          `${name}: malformed entry at ${keep * 100}% answered`)
      }
    }
  }
})

test('a definition-based form partly answered stays well formed', async () => {
  for (const name of ['shoulder-registration', 'shoulder-surgery', 'shoulder-follow-up']) {
    const q = load(name)
    const qr = respond(q)
    let n = 0
    for (const g of qr.item) g.item = (g.item ?? []).filter(() => n++ % 3 !== 0)
    const { bundle, unresolved } = await extract(q, qr, offlineFetch)
    assert.deepEqual(unresolved, [], `${name}: unresolved on a partial answer`)
    for (const e of bundle.entry) {
      assert.ok(e.fullUrl && e.request?.method, `${name}: malformed entry`)
      assert.ok(Object.keys(e.resource).length > 1, `${name}: an all but empty resource`)
    }
  }
})

test('a form requires the answers its profiles make mandatory', async () => {
  // Read from each profile's differential these came out empty, because an
  // element a parent profile makes mandatory appears only in the snapshot. The
  // surgery form then did not require the operation, and extracting without it
  // produced a Procedure with no code and no date.
  const required = (q) => {
    const out = []
    const walk = (items) => (items ?? []).forEach((i) => { if (i.required) out.push(i.linkId); walk(i.item) })
    walk(q.item)
    return out
  }
  const surgery = required(load('shoulder-surgery-full-template'))
  for (const lid of ['proc.type', 'encounter.date', 'context.patientId', 'cond.laterality']) {
    assert.ok(surgery.includes(lid), `surgery form does not require ${lid}`)
  }
  const registration = required(load('shoulder-registration-full-template'))
  for (const lid of ['patient.identifier', 'patient.birthDate', 'cond.diagnosis']) {
    assert.ok(registration.includes(lid), `registration form does not require ${lid}`)
  }
})

test('nothing is written that would make an extension invalid', async () => {
  // An extension slice pins its own url as a discriminator. Written on its own
  // that produces an extension with a url and no value, which no extension may
  // be, and the resource carrying it is rejected.
  for (const name of ['shoulder-registration', 'shoulder-surgery', 'shoulder-follow-up']) {
    const q = load(name)
    const { bundle } = await extract(q, respond(q), offlineFetch)
    const bad = []
    const walk = (n, path) => {
      if (Array.isArray(n)) return n.forEach((v, i) => walk(v, `${path}[${i}]`))
      if (!n || typeof n !== 'object') return
      for (const [k, v] of Object.entries(n)) {
        if (k === 'extension') {
          for (const [i, ext] of (Array.isArray(v) ? v : [v]).entries()) {
            const hasValue = Object.keys(ext).some((x) => x.startsWith('value')) || ext.extension
            if (!hasValue) bad.push(`${path}.extension[${i}] has no value, url=${ext.url}`)
            // an extension without a url is an extension of nothing
            if (!ext.url) bad.push(`${path}.extension[${i}] has no url`)
          }
        }
        walk(v, `${path}.${k}`)
      }
    }
    walk(bundle.entry.map((e) => e.resource), name)
    assert.deepEqual(bad, [], `${name} wrote an extension with no value`)
  }
})

test('a single value inside a repeating element is still single', async () => {
  // A reference lives inside an element that repeats, and is itself one value.
  // Taking the parent's repeatability for the leaf's wrote it as a list of one.
  const q = load('shoulder-surgery')
  const { bundle } = await extract(q, respond(q), offlineFetch)
  const bad = []
  const walk = (n, path) => {
    if (Array.isArray(n)) return n.forEach((v, i) => walk(v, `${path}[${i}]`))
    if (!n || typeof n !== 'object') return
    for (const [k, v] of Object.entries(n)) {
      if (k === 'reference' && Array.isArray(v)) bad.push(`${path}.${k}`)
      walk(v, `${path}.${k}`)
    }
  }
  walk(bundle.entry.map((e) => e.resource), 'surgery')
  assert.deepEqual(bad, [], 'a reference was written as a list')
})

test('an optional element is absent, not half built', async () => {
  // The profile pins what kind of value a recorded sex is. Applied whether or
  // not anyone recorded one, it produced an extension saying a sex was recorded
  // and not saying which, which is less conformant than no extension at all.
  const q = load('shoulder-registration')
  const withoutSex = respond(q)
  for (const g of withoutSex.item) {
    g.item = (g.item ?? []).filter((i) => i.linkId !== 'patient.sexAssignedAtBirth')
  }
  const bare = await extract(q, withoutSex, offlineFetch)
  const patA = bare.bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient')
  assert.equal(patA.extension, undefined, 'an unanswered optional extension was created anyway')

  const answered = await extract(q, respond(q), offlineFetch)
  const patB = answered.bundle.entry.map((e) => e.resource).find((r) => r.resourceType === 'Patient')
  const rsg = (patB.extension ?? [])[0]
  assert.ok(rsg, 'the answered extension is missing')
  const parts = (rsg.extension ?? []).map((x) => x.url).sort()
  assert.deepEqual(parts, ['type', 'value'], `the extension carries ${parts.join(', ')}`)
})

// ---- population, both mechanisms ------------------------------------------

const PATIENT = { resourceType: 'Patient', id: 'pat-long-001', name: [{ family: 'Muller', given: ['Anna'] }] }
const CONDITION = { resourceType: 'Condition', id: 'cond-rc-1', code: { coding: [{ display: 'Rotator cuff tear' }] } }

async function populateWith(q) {
  const queries = []
  const fake = async (url) => {
    queries.push(url)
    return { resourceType: 'Bundle', entry: [{ resource: CONDITION }] }
  }
  const res = await populate(q, { patient: PATIENT }, fake)
  return { ...res, queries }
}

test('every form declares what it wants handed to it at launch', () => {
  // A registration form creates the patient, so it has nothing to be handed.
  // Every other form asks for identifiers that already exist and must say how
  // they can be obtained.
  for (const name of ['shoulder-surgery-full-template', 'shoulder-followup-full-template',
                      'shoulder-surgery', 'shoulder-follow-up']) {
    const ctxs = launchContextsOf(load(name))
    assert.ok(ctxs.length > 0, `${name} declares no launch context`)
    for (const c of ctxs) assert.ok(c.name && c.type, `${name}: incomplete launch context`)
  }
})

test('a query placeholder resolves against the launch resources', () => {
  const url = resolveQuery('Condition?subject={{%patient.id}}&_profile=x', { patient: PATIENT })
  assert.equal(url, 'Condition?subject=pat-long-001&_profile=x')
})

test('population seeds the identifiers on both kinds of form', async () => {
  for (const name of ['shoulder-surgery-full-template', 'shoulder-followup-full-template',
                      'shoulder-surgery', 'shoulder-follow-up']) {
    const q = load(name)
    const { values, failed } = await populateWith(q)
    assert.deepEqual(failed, [], `${name}: population failed`)
    assert.ok(Object.keys(values).length > 0, `${name}: nothing was pre-filled`)
  }
})

test('a populated identifier reaches the extracted resource', async () => {
  // Population and extraction meet here: the seeded answer is what the
  // template reads, so this needs no change in either engine.
  const q = load('shoulder-surgery-full-template')
  const { values } = await populateWith(q)
  assert.equal(values['context.patientId'], PATIENT.id, 'patient id was not seeded')
  assert.equal(values['context.conditionId'], CONDITION.id, 'condition id was not seeded')
  const qr = respond(q)
  for (const g of qr.item) for (const i of g.item ?? []) {
    if (values[i.linkId] !== undefined) i.answer = [{ valueString: String(values[i.linkId]) }]
  }
  const r = extractByTemplate(q, qr)
  const refs = JSON.stringify(r.bundle)
  assert.ok(refs.includes(`Patient/${PATIENT.id}`), 'the seeded patient never reached the bundle')
  assert.ok(refs.includes(`Condition/${CONDITION.id}`), 'the seeded condition never reached the bundle')
})

// ── An optional group nobody filled in ───────────────────────────────────────
// Both of these guard one rule, applied in two places: a required item can be
// present only inside its group, and a group that no given answer brought into
// the response is not there. A value the form computes does not put it there.

test('an optional group nobody answered owes no required answer', () => {
  const q = load('shoulder-registration')
  const prior = q.item.find((i) => i.linkId === 'priorTreatment')
  assert.ok(prior, 'the registration form has a prior-treatment group')
  assert.equal(prior.required ?? false, false, 'the group is optional')
  const required = (prior.item ?? []).filter((i) => i.required)
  assert.ok(required.length >= 2, 'it holds required questions')

  // nothing answered anywhere in it
  assert.equal(groupIsPresent(prior, {}), false)
  // the derived side alone must not bring it in: it is computed, not given
  assert.equal(answeredWithin(prior, { 'condition.laterality': { code: '91775009' } }), false)
  // one real answer does
  assert.equal(groupIsPresent(prior, { 'priorTreatment.type': { code: '91251008' } }), true)
})

test('a required group is owed its answers even before anything is entered', () => {
  assert.equal(groupIsPresent({ linkId: 'g', type: 'group', required: true }, {}), true)
  assert.equal(groupIsPresent({ linkId: 'g', type: 'group' }, {}), false)
})

// ── A repeating group ────────────────────────────────────────────────────────
// A form that says a group may occur more than once has to be able to record
// more than one. Anna Muller's registration carries two prior treatments,
// physical therapy and an injection, so a filler that draws one occurrence
// records one of them and loses the other in silence.

const PT = { code: '91251008', display: 'Physical therapy procedure', system: 'http://snomed.info/sct' }
const INJ = { code: '290035003', display: 'Injection into shoulder joint', system: 'http://snomed.info/sct' }
const CONSERVATIVE = { code: '133495001', display: 'Conservative therapy', system: 'http://snomed.info/sct' }

function twoPriorTreatments() {
  const a = instancePrefix('', 'priorTreatment', 0)
  const b = instancePrefix('', 'priorTreatment', 1)
  return {
    [a + 'priorTreatment.category']: CONSERVATIVE, [a + 'priorTreatment.type']: PT,
    [b + 'priorTreatment.category']: CONSERVATIVE, [b + 'priorTreatment.type']: INJ,
  }
}

test('two occurrences of a repeating group become two groups in the response', () => {
  const q = load('shoulder-registration')
  const qr = buildResponse(q, twoPriorTreatments(), 'Patient/x', undefined, { priorTreatment: 2 })
  const groups = (qr.item ?? []).filter((i) => i.linkId === 'priorTreatment')
  assert.equal(groups.length, 2, 'expected one group per occurrence')
  const types = groups.map((g) => g.item.find((c) => c.linkId === 'priorTreatment.type')
    .answer[0].valueCoding.code)
  assert.deepEqual(types.sort(), [INJ.code, PT.code].sort(), 'both treatments have to survive')
})

test('two occurrences of a repeating group extract two resources', async () => {
  const q = load('shoulder-registration')
  const qr = buildResponse(q, { ...twoPriorTreatments(), 'condition.laterality': { code: '91775009', system: 'http://snomed.info/sct' } },
    'Patient/x', undefined, { priorTreatment: 2 })
  const { bundle } = await extract(q, qr, offlineFetch)
  const procs = bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === 'Procedure')
  assert.equal(procs.length, 2, 'the engine has to build one procedure per occurrence')
  const codes = procs.map((p) => p.code?.coding?.[0]?.code).sort()
  assert.deepEqual(codes, [INJ.code, PT.code].sort())
  for (const p of procs) {
    assert.ok(p.category?.coding?.length, 'each procedure carries its category')
    assert.ok(p.subject?.reference, 'each procedure carries its subject')
  }
})

test('an occurrence left blank adds nothing', () => {
  const q = load('shoulder-registration')
  const a = instancePrefix('', 'priorTreatment', 0)
  const qr = buildResponse(q, {
    [a + 'priorTreatment.category']: CONSERVATIVE, [a + 'priorTreatment.type']: PT,
  }, 'Patient/x', undefined, { priorTreatment: 3 })
  const groups = (qr.item ?? []).filter((i) => i.linkId === 'priorTreatment')
  assert.equal(groups.length, 1, 'two empty occurrences must not reach the response')
})

// ── A question conditioned on an answer inside a repeating group ─────────────
// How many sessions of physical therapy someone had is a property of physical
// therapy they had. The form says so with an enableWhenExpression, because the
// answer that governs sits inside a repeating group and enableWhen can only name
// one question. A filler that skips the expression collects a session count from
// a patient who was never in physical therapy, and extracts an Observation with
// no Procedure behind it.

/** The App's wiring: expressions evaluated against the response so far. */
function gatesOf(q, values, counts) {
  const exprs = collectEnableExpressions(q.item)
  const qr = buildResponse(q, values, 'Patient/x', undefined, counts)
  const out = {}
  for (const [lid, expr] of Object.entries(exprs)) {
    const r = fhirpath.evaluate(qr, expr, { resource: qr }, fhirR4Model)
    out[lid] = Array.isArray(r) && r.length === 1 && r[0] === true
  }
  return out
}

const SESSIONS = {
  code: 'le-10', display: '10 sessions or fewer',
  system: 'https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/prior-physical-therapy-session-count',
}
const SESSION_COUNT = 'obs.prior-physical-therapy-session-count'
const sessionObs = (bundle) => bundle.entry.map((e) => e.resource)
  .filter((r) => r.resourceType === 'Observation'
    && r.code?.coding?.some((c) => c.code === 'prior-physical-therapy-session-count'))

test('a count of treatments is not asked when no such treatment was recorded', async () => {
  const q = load('shoulder-registration')
  const values = { [SESSION_COUNT]: SESSIONS }
  const gates = gatesOf(q, values, {})
  assert.equal(gates[SESSION_COUNT], false, 'the question must not be asked')

  const qr = buildResponse(q, values, 'Patient/x', undefined, {},
    (i) => enabled(i, values, gates))
  const asked = (qr.item ?? []).flatMap((g) => g.item ?? []).filter((i) => i.linkId === SESSION_COUNT)
  assert.equal(asked.length, 0, 'an answer the form stopped asking for must not reach the response')

  const { bundle } = await extract(q, qr, offlineFetch)
  assert.equal(sessionObs(bundle).length, 0,
    'a session count with no physical therapy behind it must not be extracted')
})

test('the same count is asked once the treatment it counts is recorded', async () => {
  const q = load('shoulder-registration')
  const a = instancePrefix('', 'priorTreatment', 0)
  const values = {
    [a + 'priorTreatment.category']: CONSERVATIVE, [a + 'priorTreatment.type']: PT,
    [SESSION_COUNT]: SESSIONS,
  }
  const counts = { priorTreatment: 1 }
  const gates = gatesOf(q, values, counts)
  assert.equal(gates[SESSION_COUNT], true, 'physical therapy was recorded, so the count applies')
  assert.equal(gates['obs.prior-injection-count'], false, 'an injection was not')

  const qr = buildResponse(q, values, 'Patient/x', undefined, counts,
    (i) => enabled(i, values, gates))
  const { bundle } = await extract(q, qr, offlineFetch)
  assert.equal(sessionObs(bundle).length, 1, 'the count has to be extracted when it applies')
})

test('a treatment answered no is not a treatment that happened', async () => {
  // The template gated the prior-treatment entry on `answer.value.where($this)`,
  // which keeps a boolean false rather than filtering it: answering "no" to
  // "prior treatment given" asserted the treatment, and the count with it.
  const q = load('shoulder-registration-full-template')
  const shape = (v) => {
    const qr = buildResponse(q, { 'proc.priorTreatment1': v, [SESSION_COUNT]: SESSIONS },
      'Patient/x', undefined, {})
    const res = extractByTemplate(q, qr).bundle.entry.map((e) => e.resource)
    return [res.filter((r) => r.resourceType === 'Procedure').length, sessionObs({ entry: res.map((r) => ({ resource: r })) }).length]
  }
  assert.deepEqual(shape(true), [1, 1], 'a treatment given is recorded, and so is its count')
  assert.deepEqual(shape(false), [0, 0], 'a treatment not given is not recorded at all')
})

test('a derived value alone brings no occurrence into the response', () => {
  const q = load('shoulder-registration')
  const derived = new Set(['priorTreatment.laterality'])
  const qr = buildResponse(q, { 'priorTreatment.laterality': { code: '91775009' } },
    'Patient/x', derived, { priorTreatment: 1 })
  assert.equal((qr.item ?? []).filter((i) => i.linkId === 'priorTreatment').length, 0)
})

let failed = 0
for (const [name, fn] of tests) {
  try { await fn(); console.log(`  ok    ${name}`) }
  catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} passed`)
process.exit(failed ? 1 : 0)
