// Drive definition-based extraction offline and report structural defects in the
// bundle it produces. No server, no guide knowledge: the Questionnaire supplies
// everything and the StructureDefinitions come from the packages on disk.

import fs from 'node:fs'
import { offlineFetch } from './offlineFixtures.mjs'
import { extract } from '../dist-test/sdcExtract.mjs'

const qPath = process.argv[2]
const q = JSON.parse(fs.readFileSync(qPath, 'utf8'))

// Answer every leaf with a value of the type it declares. The point is to load
// the writer, not to be clinically sensible.
let n = 0
const answerFor = (it) => {
  n++
  switch (it.type) {
    case 'boolean': return { valueBoolean: true }
    case 'decimal': return { valueDecimal: 12.5 }
    case 'integer': return { valueInteger: 3 }
    case 'date': return { valueDate: '2026-03-04' }
    case 'dateTime': return { valueDateTime: '2026-03-04T09:30:00+01:00' }
    case 'choice': case 'open-choice': {
      const opt = it.answerOption?.[0]
      if (opt?.valueCoding) return { valueCoding: opt.valueCoding }
      if (opt?.valueString !== undefined) return { valueString: String(opt.valueString) }
      return { valueCoding: { system: 'http://snomed.info/sct', code: '7771000', display: 'Test concept' } }
    }
    case 'quantity': return { valueQuantity: { value: 5, unit: 'deg', system: 'http://unitsofmeasure.org', code: 'deg' } }
    default: return { valueString: 'test-' + n }
  }
}
const walk = (items) => (items ?? []).map((it) => it.type === 'group'
  ? { linkId: it.linkId, item: walk(it.item) }
  : { linkId: it.linkId, answer: [answerFor(it)], ...(it.item ? { item: walk(it.item) } : {}) })

const qr = {
  resourceType: 'QuestionnaireResponse', questionnaire: q.url, status: 'completed',
  subject: { reference: 'Patient/pat-long-001' },
  authored: '2026-03-04T09:30:00+01:00', item: walk(q.item),
}

const res = await extract(q, qr, offlineFetch)
const b = res.bundle
console.log(`entries: ${b.entry?.length ?? 0}   unresolved: ${res.unresolved.length}`)

// ---- structural defect scan ----------------------------------------------
const defects = []
const scan = (node, path) => {
  if (Array.isArray(node)) return node.forEach((v, i) => scan(v, `${path}[${i}]`))
  if (node === null || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (k.includes('[x]')) defects.push(`UNRESOLVED CHOICE  ${path}.${k}`)
    if (k === 'value' && !('system' in node) && !('unit' in node) && !('code' in node) && typeof v !== 'object')
      defects.push(`BARE value         ${path}.${k} = ${JSON.stringify(v)}`)
    if (k === 'url' && typeof v !== 'string') defects.push(`BAD extension.url  ${path}`)
    scan(v, `${path}.${k}`)
  }
}
;(b.entry ?? []).forEach((e, i) => scan(e.resource, `entry[${i}](${e.resource?.resourceType})`))

if (res.unresolved.length) { console.log('\n-- unresolved --'); res.unresolved.slice(0, 20).forEach((u) => console.log('  ' + u)) }
if (defects.length) { console.log('\n-- structural defects --'); [...new Set(defects)].slice(0, 40).forEach((d) => console.log('  ' + d)) }
else console.log('\nno structural defects found by the scan')

fs.writeFileSync(process.argv[3] ?? '/tmp/extracted.json', JSON.stringify(b, null, 1))
console.log(`\nbundle written to ${process.argv[3] ?? '/tmp/extracted.json'}`)
