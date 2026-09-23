// The QuestionnaireResponse a filled-in form becomes.
//
// Separate from the app because the shape of this resource is what every
// extraction engine reads, so it is the piece worth testing directly rather
// than through a copy of itself living in a test file.

import { instancePrefix, type EnableWhen } from './formLogic'

export interface QItem {
  linkId: string; text?: string; type: string; required?: boolean; readOnly?: boolean; repeats?: boolean
  answerValueSet?: string; answerOption?: unknown[]; item?: QItem[]; definition?: string
  extension?: Array<Record<string, unknown>>
  enableWhen?: EnableWhen[]; enableBehavior?: string
}
export interface Q {
  resourceType: 'Questionnaire'; id?: string; url?: string; title?: string; item?: QItem[]
  extension?: Array<Record<string, unknown>>
  meta?: { profile?: string[] }; contained?: Array<Record<string, unknown>>
}
export type Values = Record<string, unknown>

export interface Unit { system?: string; code?: string; display?: string }

export interface QROut { linkId: string; text?: string; item?: QROut[]; answer?: Array<Record<string, unknown>> }

export const ANSWER_KEY: Record<string, string> = {
  string: 'valueString', text: 'valueString', decimal: 'valueDecimal', integer: 'valueInteger',
  date: 'valueDate', dateTime: 'valueDateTime', boolean: 'valueBoolean',
  choice: 'valueCoding', 'open-choice': 'valueCoding', url: 'valueUri', quantity: 'valueQuantity',
  time: 'valueTime', reference: 'valueReference',
}

function toFhirDateTime(v: string): string {
  if (!v.includes('T')) return v
  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(v)) return v
  const withSeconds = /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v
  const minutes = -new Date(withSeconds).getTimezoneOffset()
  const pad = (n: number) => String(n).padStart(2, '0')
  const abs = Math.abs(minutes)
  return `${withSeconds}${minutes < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export /**
 * The QuestionnaireResponse for the answers given so far.
 *
 * `derived` names the items whose value the Questionnaire computes rather than
 * asks. A group holding nothing but those was never filled in, and emitting it
 * would start a resource from a value nobody entered, so it is left out. R4
 * treats a group as absent when nothing in it was answered.
 *
 * `isEnabled` decides whether the form is asking an item at all. An answer given
 * while a condition held, and kept in the form state after it stopped holding,
 * is not an answer the form asks for any more, and a response carrying it would
 * extract a record the author said not to collect. Left out, the filler keeps
 * the typed value should the condition come back.
 */
function buildResponse(
  q: Q, values: Values, subject: string,
  derived?: ReadonlySet<string>, counts?: Record<string, number>,
  isEnabled?: (item: QItem, prefix: string) => boolean,
): unknown {
  const walk = (items: QItem[] | undefined, prefix = ''): { out: QROut[]; answered: boolean } => {
    let answered = false
    const out = (items ?? []).flatMap<QROut>((i) => {
      if (isEnabled && !isEnabled(i, prefix)) return []
      if (i.type === 'group') {
        // A repeating group becomes one group per occurrence, which is what an
        // extraction engine turns into one resource each. An occurrence nobody
        // answered anything in is left out, so opening a second one and leaving
        // it blank adds nothing to the submission.
        if (i.repeats) {
          const n = Math.max(1, counts?.[prefix + i.linkId] ?? 1)
          const emitted: QROut[] = []
          for (let k = 0; k < n; k++) {
            const kids = walk(i.item, instancePrefix(prefix, i.linkId, k))
            if (!kids.out.length || !kids.answered) continue
            answered = true
            emitted.push({ linkId: i.linkId, text: i.text, item: kids.out })
          }
          return emitted
        }
        const kids = walk(i.item, prefix)
        if (!kids.out.length || !kids.answered) return []
        answered = true
        return [{ linkId: i.linkId, text: i.text, item: kids.out }]
      }
      // A computed value is stored once, under the bare linkId, and applies to
      // every occurrence: the expressions this guide declares inside a repeating
      // group read an answer from outside it, so every occurrence sees the same
      // one. An expression that had to differ per occurrence is not supported.
      const pk = prefix + i.linkId
      const v = values[pk] !== undefined ? values[pk] : values[i.linkId]
      if (v === undefined || v === '' || v === null) return []
      const key = ANSWER_KEY[i.type] ?? 'valueString'
      let out: unknown = v
      // A quantity is carried as {value, unit} by the control; written out as a
      // bare string it is not a Quantity and every profile bound to one rejects it.
      if (key === 'valueQuantity') {
        const q = v as { value?: unknown; unit?: Unit } | number | string
        const num = typeof q === 'object' && q !== null ? Number((q as { value?: unknown }).value) : Number(q)
        if (!Number.isFinite(num)) return []
        const u = typeof q === 'object' && q !== null ? (q as { unit?: Unit }).unit : undefined
        out = { value: num, ...(u?.code ? { unit: u.display ?? u.code, system: u.system, code: u.code } : {}) }
      }
      if (key === 'valueReference' && typeof v === 'string') out = { reference: v }
      if (key === 'valueDecimal') out = Number(v)
      if (key === 'valueInteger') out = Math.trunc(Number(v))
      if (key === 'valueBoolean') out = v === true || v === 'true'
      if (key === 'valueDateTime' && typeof v === 'string') out = toFhirDateTime(v)
      if (key === 'valueCoding') {
        if (typeof v === 'string') {
          try { out = JSON.parse(v) } catch {
            if (!derived?.has(i.linkId) || values[pk] !== undefined) answered = true
            return [{ linkId: i.linkId, text: i.text, answer: [{ valueString: v }] }]
          }
        }
      }
      if (!derived?.has(i.linkId) || values[pk] !== undefined) answered = true
      return [{ linkId: i.linkId, text: i.text, answer: [{ [key]: out }] }]
    })
    return { out, answered }
  }
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: q.url,
    status: 'completed',
    // Surgery and Follow-Up read the patient from here, so a generic filler
    // must set it. Without it %resource.subject resolves to nothing.
    ...(subject ? { subject: { reference: subject } } : {}),
    authored: new Date().toISOString(),
    item: walk(q.item).out,
  }
}
