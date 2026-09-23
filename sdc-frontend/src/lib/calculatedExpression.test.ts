import { describe, it, expect } from 'vitest'
import { dependencyLinkIdsOf, evaluateCalc } from './calculatedExpression'
import { buildQuestionnaireResponse } from './extractor'
import type { Extension, QuestionnaireItem } from '../types/fhir'

// The two calculatedExpressions the IG authors (verbatim from the FSH):
const SUM_EXPR =
  "%resource.repeat(item).where(linkId.startsWith('obs.constant-score.')).answer.valueDecimal.sum()"
const LATERALITY_EXPR =
  "%resource.repeat(item).where(linkId='condition.laterality').answer.valueCoding"

const calcExt = (expression: string): Extension =>
  ({
    url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
    valueExpression: { language: 'text/fhirpath', expression },
  } as unknown as Extension)

// A minimal outcomeScores group: four decimal sub-scores + a read-only total
// carrying the sum calculatedExpression (mirrors ShoulderRegistration/FollowUp).
const outcomeScoresGroup: QuestionnaireItem = {
  linkId: 'outcomeScores',
  type: 'group',
  item: [
    { linkId: 'obs.constant-score.pain', type: 'decimal' },
    { linkId: 'obs.constant-score.adl', type: 'decimal' },
    { linkId: 'obs.constant-score.rom', type: 'decimal' },
    { linkId: 'obs.constant-score.strength', type: 'decimal' },
    { linkId: 'obs.constant-score', type: 'decimal', readOnly: true, extension: [calcExt(SUM_EXPR)] },
  ],
}

// A minimal diagnosis group with the (visible, required) laterality choice.
const diagnosisGroup: QuestionnaireItem = {
  linkId: 'condition',
  type: 'group',
  item: [
    { linkId: 'condition.laterality', type: 'choice', answerValueSet: 'shoulder-laterality' },
  ],
}

// A minimal REPEATING prior-treatment group (item[2].repeats = true) with a
// real answer (category) + the hidden laterality target.
const priorTreatmentGroup: QuestionnaireItem = {
  linkId: 'priorTreatment',
  type: 'group',
  repeats: true,
  item: [
    { linkId: 'priorTreatment.category', type: 'choice' },
    {
      linkId: 'priorTreatment.laterality',
      type: 'choice',
      extension: [
        { url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden', valueBoolean: true },
        calcExt(LATERALITY_EXPR),
      ],
    },
  ],
}

const RIGHT = { code: '24028007', display: 'Right shoulder', system: 'http://snomed.info/sct' }
const lateralityOptions = { 'condition.laterality': [RIGHT], 'priorTreatment.category': [{ code: 'pt', display: 'Physiotherapy', system: 'urn:x' }] }

const flatten = (items: QuestionnaireItem[]): QuestionnaireItem[] =>
  items.flatMap((i) => [i, ...(i.item ? flatten(i.item) : [])])

describe('dependencyLinkIdsOf', () => {
  const flat = flatten([outcomeScoresGroup, diagnosisGroup, priorTreatmentGroup])

  it('resolves a startsWith predicate to the four sub-score leaves (not the total)', () => {
    expect(dependencyLinkIdsOf(SUM_EXPR, flat).sort()).toEqual([
      'obs.constant-score.adl',
      'obs.constant-score.pain',
      'obs.constant-score.rom',
      'obs.constant-score.strength',
    ])
  })

  it('resolves an equality predicate to the single named leaf', () => {
    expect(dependencyLinkIdsOf(LATERALITY_EXPR, flat)).toEqual(['condition.laterality'])
  })

  it('returns [] for an unrecognised expression shape (no gating)', () => {
    expect(dependencyLinkIdsOf('%resource.descendants().count()', flat)).toEqual([])
  })
})

describe('evaluateCalc — Constant-Murley total (expression A)', () => {
  const items = [outcomeScoresGroup]
  const deps = dependencyLinkIdsOf(SUM_EXPR, flatten(items))
  const buildQr = (formState: Record<string, string>) =>
    buildQuestionnaireResponse(formState, {}, 'http://x/Questionnaire/q', {}, items)

  it('sums all four sub-scores when complete', () => {
    const qr = buildQr({
      'obs.constant-score.pain': '10',
      'obs.constant-score.adl': '20',
      'obs.constant-score.rom': '30',
      'obs.constant-score.strength': '15',
    })
    expect(evaluateCalc(SUM_EXPR, qr, deps)).toEqual({ kind: 'number', value: 75 })
  })

  it('is incomplete (no partial total) when one sub-score is missing', () => {
    const qr = buildQr({
      'obs.constant-score.pain': '10',
      'obs.constant-score.adl': '20',
      'obs.constant-score.rom': '30',
      // strength missing
    })
    expect(evaluateCalc(SUM_EXPR, qr, deps)).toEqual({ kind: 'incomplete' })
  })

  it('is incomplete when nothing is filled', () => {
    expect(evaluateCalc(SUM_EXPR, buildQr({}), deps)).toEqual({ kind: 'incomplete' })
  })
})

describe('evaluateCalc — prior-treatment laterality (expression B)', () => {
  const items = [diagnosisGroup, priorTreatmentGroup]
  const deps = dependencyLinkIdsOf(LATERALITY_EXPR, flatten(items))
  const buildQr = (formState: Record<string, string>) =>
    buildQuestionnaireResponse(formState, {}, 'http://x/Questionnaire/q', lateralityOptions, items, {}, { priorTreatment: 1 })

  it('returns the diagnosis laterality Coding when answered', () => {
    const qr = buildQr({ 'condition.laterality': '24028007', 'priorTreatment.category#0': 'pt' })
    const outcome = evaluateCalc(LATERALITY_EXPR, qr, deps)
    expect(outcome.kind).toBe('coding')
    if (outcome.kind === 'coding') {
      expect(outcome.value.code).toBe('24028007')
      expect(outcome.value.system).toBe('http://snomed.info/sct')
    }
  })

  it('is incomplete when the diagnosis laterality is blank', () => {
    const qr = buildQr({ 'priorTreatment.category#0': 'pt' })
    expect(evaluateCalc(LATERALITY_EXPR, qr, deps)).toEqual({ kind: 'incomplete' })
  })
})

// Serialization contract the calc effect relies on: a derived laterality Coding
// merged into the typeahead channel appears on the active repeating instance,
// and an empty instance produces no group item (→ no fabricated Procedure).
describe('buildQuestionnaireResponse — repeating prior-treatment serialization', () => {
  const items = [priorTreatmentGroup]

  it('emits the derived laterality valueCoding on an active instance', () => {
    const qr = buildQuestionnaireResponse(
      { 'priorTreatment.category#0': 'pt' },
      {},
      'http://x/Questionnaire/q',
      lateralityOptions,
      items,
      { 'priorTreatment.laterality#0': [RIGHT] }, // merged calcCodingState
      { priorTreatment: 1 },
    )
    const group = qr.item?.find((g) => g.linkId === 'priorTreatment')
    expect(group).toBeDefined()
    const lat = group?.item?.find((i) => i.linkId === 'priorTreatment.laterality')
    expect(lat?.answer?.[0]?.valueCoding?.code).toBe('24028007')
  })

  it('emits no prior-treatment group item for an empty instance', () => {
    const qr = buildQuestionnaireResponse(
      {}, // no real answer
      {},
      'http://x/Questionnaire/q',
      lateralityOptions,
      items,
      {}, // no derived coding either (the effect gates on instanceHasRealAnswer)
      { priorTreatment: 1 },
    )
    expect(qr.item?.some((g) => g.linkId === 'priorTreatment')).toBe(false)
  })
})
