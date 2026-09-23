// The engines against the examples HL7 ships with the SDC specification itself.
//
// Nothing here mentions this guide. The forms are the spec's own, the answers are
// in sdc-spec-answers.json, and the StructureDefinitions come from the FHIR core
// package on disk, so what is tested is whether a generic filler is generic.
//
// Two examples are the same form written three ways: extract-complex-defn3
// (definition-based), extract-complex-template (a template per resource) and
// extract-complex-template2 (one contained Bundle template). Both engines must
// therefore arrive at the same submission from the same answers.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { offlineFetch } from './offlineFixtures.mjs'
import { extract } from '../dist-test/sdcExtract.mjs'
import { extractByTemplate, mechanismOf } from '../dist-test/templateExtract.mjs'
import { launchContextsOf, populate } from '../dist-test/populate.mjs'
import { enabled } from '../dist-test/formLogic.mjs'

const PKG = path.join(os.homedir(), '.fhir', 'packages', 'hl7.fhir.uv.sdc#4.0.0', 'package')
if (!fs.existsSync(PKG)) {
  console.log('  skip  hl7.fhir.uv.sdc#4.0.0 is not installed; nothing to test against')
  process.exit(0)
}
const spec = (f) => JSON.parse(fs.readFileSync(path.join(PKG, f), 'utf8'))
const answers = JSON.parse(fs.readFileSync(new URL('./sdc-spec-answers.json', import.meta.url), 'utf8'))
const obsOf = (b) => (b.entry ?? []).map((e) => e.resource).filter((r) => r.resourceType === 'Observation')
const codesOf = (o) => (o.code?.coding ?? []).map((c) => c.code)

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('every extraction mechanism the spec ships is recognised for what it is', () => {
  assert.equal(mechanismOf(spec('Questionnaire-extract-complex-defn3.json')), 'definition')
  assert.equal(mechanismOf(spec('Questionnaire-extract-complex-template.json')), 'template')
  assert.equal(mechanismOf(spec('Questionnaire-extract-complex-template2.json')), 'template')
  // StructureMap-based extraction is not implemented, and must not be mistaken
  // for one that is: a form claiming it is better refused than silently mishandled.
  assert.equal(mechanismOf(spec('Questionnaire-extract-complex-smap.json')), 'unknown')
})

test("the spec's template examples extract every resource they describe", () => {
  for (const name of ['extract-complex-template', 'extract-complex-template2']) {
    const r = extractByTemplate(spec(`Questionnaire-${name}.json`), answers)
    assert.deepEqual(r.emptied, [], `${name}: elements emptied`)
    assert.equal(r.bundle.entry.length, 6, `${name}: expected Patient + 2 RelatedPerson + 3 Observation`)
    assert.deepEqual(obsOf(r.bundle).map((o) => codesOf(o)[0]).sort(),
      ['29463-7', '8302-2', 'sigmoidoscopy-complication'])
  }
  // The contained-Bundle example writes every reference as a reference.
  assert.deepEqual(extractByTemplate(spec('Questionnaire-extract-complex-template2.json'), answers).failed, [])
})

test('a template writing a value over an element it drew as an object says so', () => {
  // The spec's own package writes a Reference three ways. RelatedPerson.patient
  // annotates `reference`, template2 writes the reference literally, and the
  // per-item Observation template annotates `subject` whole, where the expression
  // yields a bare id. The template is followed, and the mismatch is reported.
  const r = extractByTemplate(spec('Questionnaire-extract-complex-template.json'), answers)
  assert.equal(r.failed.length, 3, r.failed.join('; '))
  assert.ok(r.failed.every((f) => f.includes('subject')), r.failed.join('; '))
})

test('an answer of false is a value, not an absence', () => {
  // Dropping it would lose the only answer that says a complication did not occur.
  const r = extractByTemplate(spec('Questionnaire-extract-complex-template.json'), answers)
  const o = obsOf(r.bundle).find((x) => codesOf(x).includes('sigmoidoscopy-complication'))
  assert.equal(o.valueBoolean, false)
})

test('an id allocated at the root reaches every resource that refers to it', () => {
  for (const name of ['extract-complex-template', 'extract-complex-template2']) {
    const b = extractByTemplate(spec(`Questionnaire-${name}.json`), answers).bundle
    const patient = b.entry.find((e) => e.resource.resourceType === 'Patient')
    const referrers = b.entry.map((e) => e.resource).filter((r) => r.resourceType !== 'Patient')
    assert.equal(referrers.length, 5)
    for (const r of referrers) {
      // Observation.subject arrives as a bare id where the template annotated the
      // whole element; either spelling has to carry the allocated id.
      const ref = r.patient?.reference ?? r.subject?.reference ?? r.subject
      assert.equal(ref, patient.fullUrl, `${name}: ${r.resourceType} points elsewhere`)
    }
  }
})

test('a choice element named without its type is still written under its type', async () => {
  // The spec's example names "Observation.effective", not "Observation.effective[x]".
  // Written verbatim it produced a literal `effective` property, which is not FHIR.
  const { bundle } = await extract(spec('Questionnaire-extract-complex-defn3.json'), answers, offlineFetch)
  for (const o of obsOf(bundle)) {
    assert.equal(o.effective, undefined, 'a literal "effective" property was written')
    assert.ok(o.effectiveDateTime, 'effectiveDateTime is missing')
  }
})

test('a choice element sliced by type holds one value, not a list of one', async () => {
  // "Observation.value[x]:valueQuantity.value" is a type slice, and a type slice
  // is not a repetition: valueQuantity is 0..1 however it is spelled.
  const { bundle } = await extract(spec('Questionnaire-extract-complex-defn3.json'), answers, offlineFetch)
  const quantities = obsOf(bundle).filter((o) => o.valueQuantity !== undefined)
  assert.equal(quantities.length, 2)
  for (const o of quantities) {
    assert.ok(!Array.isArray(o.valueQuantity), 'valueQuantity was written as an array')
    assert.equal(typeof o.valueQuantity.value, 'number')
    assert.ok(o.valueQuantity.unit, 'the unit the form pins did not travel with the answer')
  }
})

test('a value with no extraction context is reported, not written somewhere else', async () => {
  // The spec's own defn3 example declares values for a third Observation without
  // ever declaring the context that creates it. Those values belong to no
  // resource, and folding them into the first Observation of that profile gave
  // the height reading a second code and a second performer.
  const { bundle, unresolved } = await extract(
    spec('Questionnaire-extract-complex-defn3.json'), answers, offlineFetch)
  const height = obsOf(bundle).find((o) => codesOf(o).includes('8302-2'))
  assert.deepEqual(codesOf(height), ['8302-2'], 'the height observation picked up a foreign code')
  assert.equal(height.performer.length, 1, 'the height observation picked up a second performer')
  assert.ok(unresolved.length >= 7, 'the orphaned values were not reported')
  assert.ok(unresolved.every((u) => u.includes('Observation')), unresolved.join('; '))
})

test('both mechanisms build the same resources out of the same answers', async () => {
  const defn = await extract(spec('Questionnaire-extract-complex-defn3.json'), answers, offlineFetch)
  const tmpl = extractByTemplate(spec('Questionnaire-extract-complex-template.json'), answers)
  const shape = (b) => (b.entry ?? []).map((e) => e.resource.resourceType).sort()
  // The definition form is short one Observation, because it is short one context.
  assert.deepEqual(shape(defn.bundle), ['Observation', 'Observation', 'Patient', 'RelatedPerson', 'RelatedPerson'])
  assert.deepEqual(shape(tmpl.bundle),
    ['Observation', 'Observation', 'Observation', 'Patient', 'RelatedPerson', 'RelatedPerson'])
  const byCode = (b) => obsOf(b).map((o) => codesOf(o)[0]).sort()
  assert.deepEqual(byCode(defn.bundle), ['29463-7', '8302-2'])
  for (const c of byCode(defn.bundle)) assert.ok(byCode(tmpl.bundle).includes(c))
})

const PATIENT = {
  resourceType: 'Patient', id: 'proband',
  name: [{ use: 'official', family: 'Doe', given: ['Jane'] }],
  gender: 'female', birthDate: '1985-03-14',
}
const PRACTITIONER = { resourceType: 'Practitioner', id: 'user1', name: [{ family: 'Smith', given: ['Al'] }] }
const launchFor = (q) => Object.fromEntries(launchContextsOf(q)
  .map((c) => [c.name, c.type === 'Practitioner' ? PRACTITIONER : PATIENT]))

test('the launch resources a form asks for are read from the form itself', () => {
  const q = spec('example/Questionnaire-questionnaire-sdc-test-fhirpath-prepop-initialexpression.json')
  assert.deepEqual(launchContextsOf(q).map((c) => `${c.name}:${c.type}`), ['patient:Patient', 'user:Practitioner'])
})

test("the spec's pre-population examples seed their answers", async () => {
  const q = spec('example/Questionnaire-questionnaire-sdc-test-fhirpath-prepop-initialexpression.json')
  const { values, failed } = await populate(q, launchFor(q), async () => ({ resourceType: 'Bundle', entry: [] }))
  assert.deepEqual(failed, [])
  assert.equal(values['family-name'], 'Doe')
  assert.equal(values['given-names'], 'Jane')
  assert.equal(values['dob'], '1985-03-14')
  assert.equal(values['provider-name'], 'Al Smith', 'the practitioner handed at launch was not read')
})

test('a fixed initial value is seeded whether it is a code or a string', async () => {
  const q = spec('example/Questionnaire-questionnaire-sdc-test-initialvalue.json')
  const { values } = await populate(q, {}, async () => ({ resourceType: 'Bundle', entry: [] }))
  assert.equal(values['init-val-string'], 'YUP')
  assert.ok(Object.values(values).some((v) => v && typeof v === 'object' && v.code === 'Y'))
})

test('a contained batch of source queries is run before the form is drawn', async () => {
  // sourceQueries names a contained Bundle of requests and binds the answers
  // under that Bundle's own id, which is the name the item expressions use.
  const q = spec('example/Questionnaire-questionnaire-sdc-test-fhirpath-prepop-source-query.json')
  const ran = []
  const { failed } = await populate(q, launchFor(q), async (url) => {
    ran.push(url)
    return { resourceType: 'Bundle', type: 'searchset', total: 2, entry: [] }
  })
  assert.deepEqual(failed, [])
  assert.equal(ran.length, 3, 'the contained batch was not run')
  assert.ok(ran.some((u) => u.startsWith('Condition?')), ran.join('; '))
  assert.ok(ran.some((u) => u.startsWith('MedicationStatement?')), ran.join('; '))
})

test('every enableWhen operator the spec exercises is honoured', () => {
  const q = spec('example/Questionnaire-questionnaire-sdc-test-enableWhen.json')
  const conditioned = []
  const walk = (items) => (items ?? []).forEach((i) => { if (i.enableWhen) conditioned.push(i); walk(i.item) })
  walk(q.item)
  assert.ok(conditioned.length >= 19, 'the example lost its conditional items')
  const used = new Set(conditioned.flatMap((i) => i.enableWhen.map((c) => c.operator)))
  const known = new Set(['exists', '=', '!=', '>', '<', '>=', '<='])
  assert.deepEqual([...used].filter((o) => !known.has(o)), [], 'an operator the spec uses is not implemented')
  // Each condition must actually decide something rather than defaulting to shown.
  for (const i of conditioned) {
    if (!i.enableWhen.every((c) => c.operator === '=')) continue
    // enableBehavior 'all' means every condition, so every one of them is answered.
    const on = Object.fromEntries(i.enableWhen.map((c) =>
      [c.question, c[Object.keys(c).find((k) => k.startsWith('answer'))]]))
    assert.equal(enabled(i, on), true, `${i.linkId}: an exact match did not enable it`)
    assert.equal(enabled(i, {}), false, `${i.linkId}: shown with nothing answered`)
  }
})

test('every item type the spec uses is drawn, or declared undrawable', () => {
  // The renderer maps these itself; a type absent from both lists would reach the
  // fallback text box and quietly collect an answer of the wrong type.
  const DRAWN = new Set(['group', 'display', 'string', 'text', 'boolean', 'decimal', 'integer',
    'date', 'dateTime', 'time', 'choice', 'open-choice', 'url', 'quantity', 'reference'])
  const DECLARED_UNDRAWABLE = new Set(['attachment'])
  const files = [...fs.readdirSync(PKG).map((f) => f),
                 ...fs.readdirSync(path.join(PKG, 'example')).map((f) => 'example/' + f)]
    .filter((f) => path.basename(f).startsWith('Questionnaire-'))
  const seen = new Set()
  for (const f of files) {
    let q
    try { q = spec(f) } catch { continue }
    if (q.resourceType !== 'Questionnaire') continue
    const walk = (items) => (items ?? []).forEach((i) => { seen.add(i.type); walk(i.item) })
    walk(q.item)
  }
  assert.ok(seen.size > 10, 'the corpus did not load')
  const unknown = [...seen].filter((t) => !DRAWN.has(t) && !DECLARED_UNDRAWABLE.has(t))
  assert.deepEqual(unknown, [], `item types neither drawn nor declared undrawable: ${unknown}`)
})

let failed = 0
for (const [name, fn] of tests) {
  try { await fn(); console.log(`  ok    ${name}`) }
  catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} passed`)
process.exit(failed ? 1 : 0)
