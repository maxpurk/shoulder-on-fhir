// Form behaviour the Questionnaire declares about itself.
//
// A question an author says not to ask unless an earlier answer calls for it is
// a property of the form. A filler that ignores that shows questions the author
// meant to hide, and collects answers the author meant not to collect.

export interface EnableWhen { question: string; operator: string; [k: string]: unknown }
export interface EnableItem {
  linkId: string; enableWhen?: EnableWhen[]; enableBehavior?: string
}
export type Values = Record<string, unknown>

export const ENABLE_EXPR_EXT =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression'

interface ExprItem {
  linkId: string
  extension?: Array<{ url: string; [k: string]: unknown }>
  item?: ExprItem[]
}

/**
 * linkId -> FHIRPath, for every item whose condition is a whole expression.
 *
 * `enableWhen` names one question by linkId, which is enough while that question
 * is a sibling. It is not enough when the answer that governs lives inside a
 * repeating group: R4 leaves undefined which occurrence the name resolves to, so
 * a form that asks "was there any such answer, in any occurrence" has to say so
 * as an expression. SDC defines that as enableWhenExpression, evaluated against
 * the response so far.
 */
export function collectEnableExpressions(
  items: ExprItem[] | undefined, acc: Record<string, string> = {},
): Record<string, string> {
  for (const i of items ?? []) {
    const e = (i.extension ?? []).find((x) => x.url === ENABLE_EXPR_EXT) as
      { valueExpression?: { expression?: string } } | undefined
    const expr = e?.valueExpression?.expression
    if (expr) acc[i.linkId] = expr
    collectEnableExpressions(i.item, acc)
  }
  return acc
}

/** The value an enableWhen condition compares against, whatever its type. */
export function conditionValue(c: EnableWhen): unknown {
  const k = Object.keys(c).find((x) => x.startsWith('answer'))
  return k ? c[k] : undefined
}

export function comparable(v: unknown): string | number | boolean | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'object') {
    const o = v as { code?: string; value?: number }
    return o.code ?? o.value
  }
  return v as string | number | boolean
}

/**
 * Whether an item's own condition is met. A question the form does not ask
 * unless an earlier answer calls for it is a property of the form, so a filler
 * that ignores it shows questions the author meant to hide.
 *
 * `gates` carries the already-evaluated result of any enableWhenExpression, by
 * linkId. An expression is evaluated against the whole response rather than one
 * answer, so it is worked out once per keystroke for the whole form and handed
 * in here; an item carrying one is disabled whenever it resolved false or to
 * nothing.
 */
export function enabled(
  item: EnableItem, values: Values, gates?: Record<string, boolean>,
): boolean {
  if (gates && item.linkId in gates && !gates[item.linkId]) return false
  const when = item.enableWhen ?? []
  if (!when.length) return true
  const results = when.map((c) => {
    const actual = comparable(values[c.question])
    const expect = comparable(conditionValue(c))
    switch (c.operator) {
      case 'exists': return (actual !== undefined && actual !== '') === (conditionValue(c) === true)
      case '=': return actual === expect
      case '!=': return actual !== expect
      case '>': return Number(actual) > Number(expect)
      case '<': return Number(actual) < Number(expect)
      case '>=': return Number(actual) >= Number(expect)
      case '<=': return Number(actual) <= Number(expect)
      default: return true
    }
  })
  return item.enableBehavior === 'any' ? results.some(Boolean) : results.every(Boolean)
}

export interface PresenceItem {
  linkId: string; type?: string; required?: boolean; item?: PresenceItem[]
}

/**
 * Whether a group was brought into the response by an answer.
 *
 * Nesting in a QuestionnaireResponse happens inside the parent, so an item can
 * be present only where its group is. A group that nobody answered anything in
 * is not there, and a value the Questionnaire computes rather than asks does not
 * put it there: pass only the answers given, not the calculated ones.
 *
 * This is what keeps an optional section optional. A registration recording no
 * prior treatment has no prior-treatment group, so the category and type that a
 * prior treatment would require are not owed, and extraction starts no resource
 * from a group holding nothing but a derived value.
 */
export function answeredWithin(item: PresenceItem, answers: Values): boolean {
  const v = answers[item.linkId]
  if (v !== undefined && v !== '' && v !== null) return true
  return (item.item ?? []).some((c) => answeredWithin(c, answers))
}

/** Whether a group's contents are owed an answer at all. */
export function groupIsPresent(item: PresenceItem, answers: Values): boolean {
  return !!item.required || answeredWithin(item, answers)
}

/**
 * The instance prefix for occurrence `n` of a repeating group.
 *
 * Every answer inside a repeating group is stored under a key carrying the
 * occurrence it belongs to, so two prior treatments have two sets of answers
 * rather than overwriting one. The prefix accumulates, so a repeating group
 * inside a repeating group would still address its own answers.
 */
export function instancePrefix(prefix: string, linkId: string, n: number): string {
  return `${prefix}${linkId}~${n}|`
}

/**
 * The answers as one occurrence of a repeating group sees them.
 *
 * An `enableWhen` names a sibling by linkId, and inside an occurrence that
 * sibling's answer is stored under the occurrence's prefix. This exposes both:
 * the occurrence's own answers under their bare linkId, shadowing anything of
 * the same name outside it, so a condition reads the occurrence it is in.
 */
export function scopeView(values: Values, prefix: string): Values {
  if (!prefix) return values
  const out: Values = { ...values }
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v
  }
  return out
}
