// Resolve StructureDefinitions from the packages on disk instead of a server, so
// extraction can be exercised without one. Same contract as the browser fetcher:
// given a search URL, answer with a searchset Bundle.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PKG = path.join(os.homedir(), '.fhir', 'packages')
// ig/output first, because that is what seed/load-profiles.sh uploads to HAPI:
// its StructureDefinitions carry snapshots, and fsh-generated ones do not.
const DIRS = [
  path.resolve('../ig/output'),
  path.resolve('../ig/fsh-generated/resources'),
  path.join(PKG, 'hl7.fhir.r4.core#4.0.1', 'package'),
  path.join(PKG, 'hl7.fhir.uv.sdc#4.0.0', 'package'),
  path.join(PKG, 'hl7.fhir.eu.base#2.0.0', 'package'),
  path.join(PKG, 'hl7.fhir.uv.ips#1.1.0', 'package'),
  path.join(PKG, 'hl7.fhir.uv.extensions.r4#5.2.0', 'package'),
]

let index = null
function build() {
  if (index) return index
  index = new Map()
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      let doc
      try { doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
      if (doc?.resourceType === 'StructureDefinition' && doc.url && !index.has(doc.url)) index.set(doc.url, doc)
    }
  }
  return index
}

export function offlineFetch(url) {
  const m = /StructureDefinition\?url=([^&]+)/.exec(url)
  if (!m) return Promise.resolve({ resourceType: 'Bundle', entry: [] })
  const canonical = decodeURIComponent(m[1]).split('|')[0]
  const sd = build().get(canonical)
  return Promise.resolve({ resourceType: 'Bundle', entry: sd ? [{ resource: sd }] : [] })
}

export function known(canonical) { return build().has(canonical) }

/**
 * The same resolver with the published profiles withheld, so only the
 * differential-only compiled ones are available. A profile is allowed to be
 * published that way, and an extractor that reads only snapshots cannot resolve
 * anything the profile does not itself constrain.
 */
let diffIndex = null
export function differentialOnlyFetch(url) {
  if (!diffIndex) {
    diffIndex = new Map()
    for (const dir of DIRS.filter((d) => !d.endsWith('/ig/output'))) {
      if (!fs.existsSync(dir)) continue
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        let doc
        try { doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
        if (doc?.resourceType === 'StructureDefinition' && doc.url && !diffIndex.has(doc.url)) {
          diffIndex.set(doc.url, doc)
        }
      }
    }
  }
  const m = /StructureDefinition\?url=([^&]+)/.exec(url)
  if (!m) return Promise.resolve({ resourceType: 'Bundle', entry: [] })
  const sd = diffIndex.get(decodeURIComponent(m[1]).split('|')[0])
  return Promise.resolve({ resourceType: 'Bundle', entry: sd ? [{ resource: sd }] : [] })
}
export function count() { return build().size }
