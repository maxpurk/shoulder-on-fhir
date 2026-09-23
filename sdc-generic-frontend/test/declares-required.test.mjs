// Does a definition-based form say how to fill everything its profiles require?
//
// A form is meant to be sufficient on its own: hand it to someone and they can
// produce a conformant submission. That only holds if, for every profile the
// form extracts into, every required element is either asked for by a question
// or stated by a declaration. Anything neither asked nor declared was being
// supplied by whichever application happened to assemble the bundle, which is
// the dependency the form exists to remove.

import fs from 'node:fs'
import assert from 'node:assert/strict'

const RES = '../ig/fsh-generated/resources'
const PUB = '../ig/output'
const SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/'
const EXTRACT = SDC + 'sdc-questionnaire-definitionExtract'
const VALUE = SDC + 'sdc-questionnaire-definitionExtractValue'

const load = (n) => JSON.parse(fs.readFileSync(`${RES}/Questionnaire-${n}.json`, 'utf8'))
const profileOf = (canonical) => {
  const id = canonical.split('/').pop()
  for (const dir of [PUB, RES]) {
    const p = `${dir}/StructureDefinition-${id}.json`
    if (fs.existsSync(p)) {
      const sd = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (sd.snapshot) return sd
    }
  }
  return null
}

/** Top-level elements a profile requires, excluding what every resource has. */
const ALWAYS = new Set(['id', 'meta', 'implicitRules', 'language', 'text', 'contained', 'extension', 'modifierExtension'])
const isFixed = (e) => Object.keys(e).some((k) => k.startsWith('fixed') || k.startsWith('pattern'))

function requiredOf(sd) {
  const root = sd.type
  // An element the profile pins needs no question and no declaration: the value
  // is in the profile and extraction applies it. Only what a profile requires
  // and leaves open has to come from the form.
  const pinned = new Set()
  for (const e of sd.snapshot.element) {
    if (isFixed(e)) pinned.add((e.id ?? '').slice(root.length + 1).split('.')[0].split(':')[0])
  }
  const out = []
  for (const e of sd.snapshot.element) {
    const id = e.id ?? ''
    if (!id.startsWith(root + '.')) continue
    const name = id.slice(root.length + 1)
    // Top-level elements only. Going deeper reports the value of every optional
    // sub-slice of every complex extension, because a slice's own value is
    // required once that slice is present, and a check nobody can read is a
    // check nobody runs. What it therefore cannot see is a required part of an
    // optional extension, which is how a recorded sex reached a patient
    // carrying its type and no value.
    if (name.split('.').length !== 1) continue
    if (ALWAYS.has(name) || pinned.has(name.split('[')[0])) continue
    if ((e.min ?? 0) >= 1) out.push(name)
  }
  return out
}

const subExt = (e, url) => (e.extension || []).find((x) => x.url === url)
const valueOf = (e) => e && Object.entries(e).find(([k]) => k.startsWith('value'))?.[1]

/** Every element the form fills, whether by question or by declaration. */
function covered(q) {
  const filled = new Set()
  const note = (canonical, elementId) => {
    if (!canonical || !elementId) return
    const seg = elementId.split('.')[1]
    if (seg) filled.add(`${canonical.split('/').pop()}.${seg.split('[')[0].replace(/(Period|DateTime|Age|Range|String|CodeableConcept|Quantity|Boolean|Integer)$/, '')}`)
  }
  const walk = (node) => {
    for (const e of node.extension || []) {
      if (e.url !== VALUE) continue
      const def = String(valueOf(subExt(e, 'definition')) ?? '')
      const [canonical, elementId] = def.split('#')
      note(canonical, elementId)
    }
    if (node.definition) {
      const [canonical, elementId] = String(node.definition).split('#')
      note(canonical, elementId)
    }
    for (const c of node.item || []) walk(c)
  }
  walk(q)
  return filled
}

/** Profiles the form extracts into. */
function targets(q) {
  const out = new Set()
  const walk = (node) => {
    for (const e of node.extension || []) {
      if (e.url !== EXTRACT) continue
      const c = valueOf(subExt(e, 'definition'))
      if (c) out.add(String(c))
    }
    for (const c of node.item || []) walk(c)
  }
  walk(q)
  return [...out]
}

let failed = 0
for (const name of ['shoulder-registration', 'shoulder-surgery', 'shoulder-follow-up']) {
  const q = load(name)
  const filled = covered(q)
  const gaps = []
  for (const canonical of targets(q)) {
    const sd = profileOf(canonical)
    if (!sd) continue
    const short = canonical.split('/').pop()
    for (const el of requiredOf(sd)) {
      const key = `${short}.${el.replace(/\[x\]$/, '')}`
      if (![...filled].some((f) => f === key || f.startsWith(key))) gaps.push(key)
    }
  }
  try {
    assert.deepEqual([...new Set(gaps)], [], `${name} neither asks for nor declares`)
    console.log(`  ok    ${name} says how to fill everything its profiles require`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name}\n        ${e.message.split('\n')[0]}`)
    console.log('        ' + [...new Set(gaps)].join(', '))
  }
}

// ---- a template form has to guarantee the entries its bundle profile requires --

const TEC = SDC + 'sdc-questionnaire-templateExtractContext'
const TEV = SDC + 'sdc-questionnaire-templateExtractValue'

for (const name of ['shoulder-registration-full-template', 'shoulder-surgery-full-template',
                    'shoulder-followup-full-template']) {
  const q = load(name)
  const template = q.contained?.[0]
  // the profile the extracted bundle claims, stated as an expression on the template
  const metaExt = (template?.meta?._profile?.[0]?.extension || [])
    .find((e) => e.url === TEV)
  const claimed = String(metaExt?.valueString ?? '').replace(/'/g, '')
  const sd = claimed && profileOf(claimed)
  if (!sd) { console.log(`  ok    ${name} claims no bundle profile to check`); continue }

  const required = sd.snapshot.element
    .filter((e) => (e.id ?? '').startsWith('Bundle.entry:') && (e.id ?? '').split('.').length === 2)
    .filter((e) => (e.min ?? 0) >= 1)
    .map((e) => e.id.split(':')[1])

  // an entry with no context gate is always produced; a gated one may vanish
  const always = new Set()
  for (const entry of template.entry || []) {
    const gated = (entry.extension || []).some((e) => e.url === TEC)
    if (!gated && entry.resource?.resourceType) always.add(entry.resource.resourceType.toLowerCase())
  }
  const missing = required.filter((slice) => ![...always].some((t) => slice.toLowerCase().startsWith(t) || t.startsWith(slice.toLowerCase())))
  try {
    assert.deepEqual(missing, [], `${name}: answering only what it marks required yields no`)
    console.log(`  ok    ${name} always produces the entries its bundle profile requires`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name}\n        every question producing a required entry is optional: ${missing.join(', ')}`)
  }
}

// ---- a definition-based form has to guarantee those entries too ---------------
//
// The block above reads the claimed bundle profile off the template. A
// definition-based form names only the resource profiles it extracts into and
// leaves the envelope to the submitting client, so the pairing is stated here.
// Without this, a form could mark every measurement optional and still look
// complete, while the bundle it exists to produce is rejected for an empty
// required slice.
const DEFN_BUNDLE = {
  'shoulder-registration': 'rotator-cuff-registration-bundle',
  'shoulder-surgery': 'rotator-cuff-surgery-bundle',
  'shoulder-follow-up': 'rotator-cuff-follow-up-bundle',
}

const hasRequired = (node) =>
  Boolean(node.required) || (node.item || []).some(hasRequired)

for (const [name, bundleId] of Object.entries(DEFN_BUNDLE)) {
  const q = load(name)
  const sd = profileOf(bundleId)
  if (!sd) { console.log(`  ok    ${name} has no built bundle profile to check`); continue }

  const required = sd.snapshot.element
    .filter((e) => (e.id ?? '').startsWith('Bundle.entry:') && (e.id ?? '').split('.').length === 2)
    .filter((e) => (e.min ?? 0) >= 1)
    .map((e) => e.id.split(':')[1])

  // An extraction context produces a resource only when something under it is
  // answered, so only a context holding a required answer is guaranteed. A
  // context on the form root has no question to gate it and always fires.
  // Matching is by resource type, like the template check above: it cannot tell
  // two slices of the same type apart, which is the granularity both checks read at.
  const always = new Set()
  const walk = (node, depth) => {
    for (const e of node.extension || []) {
      if (e.url !== EXTRACT) continue
      const canonical = valueOf(subExt(e, 'definition'))
      const target = canonical && profileOf(String(canonical))
      if (target && (depth === 0 || hasRequired(node))) always.add(String(target.type).toLowerCase())
    }
    for (const c of node.item || []) walk(c, depth + 1)
  }
  walk(q, 0)

  const missing = required.filter((slice) =>
    ![...always].some((t) => slice.toLowerCase().startsWith(t) || t.startsWith(slice.toLowerCase())))
  try {
    assert.deepEqual(missing, [], `${name}: answering only what it marks required yields no`)
    console.log(`  ok    ${name} always produces the entries ${bundleId} requires`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name}\n        every question producing a required entry is optional: ${missing.join(', ')}`)
  }
}

process.exit(failed ? 1 : 0)
