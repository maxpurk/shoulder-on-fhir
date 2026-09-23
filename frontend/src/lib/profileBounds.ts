/**
 * Extract min/max Quantity bounds from a FHIR StructureDefinition's
 * `Observation.value[x]` element. Used to drive HTML5 min/max attributes on
 * numeric inputs from the IG itself (single source of truth — see ADR-0008
 * and the *Observation.fsh maxValueQuantity declarations).
 *
 * Falls back gracefully to undefined fields when the SD doesn't declare bounds.
 */

interface QuantityValue {
  value?: number
  code?: string
  unit?: string
}

interface ElementDefinition {
  id?: string
  path?: string
  minValueQuantity?: QuantityValue
  maxValueQuantity?: QuantityValue
}

export interface StructureDefinition {
  resourceType: 'StructureDefinition'
  id?: string
  url?: string
  differential?: { element?: ElementDefinition[] }
  snapshot?: { element?: ElementDefinition[] }
}

export interface QuantityBounds {
  min?: number
  max?: number
  unit?: string
}

const VALUE_X_PATH = 'Observation.value[x]'

function pickValueElement(elements: ElementDefinition[] | undefined): ElementDefinition | undefined {
  if (!elements) return undefined
  return elements.find(
    (el) => el.path === VALUE_X_PATH || el.id === VALUE_X_PATH,
  )
}

export function extractQuantityBounds(sd: StructureDefinition): QuantityBounds {
  const element =
    pickValueElement(sd.differential?.element) ??
    pickValueElement(sd.snapshot?.element)
  if (!element) return {}
  return {
    min: element.minValueQuantity?.value,
    max: element.maxValueQuantity?.value,
    unit: element.maxValueQuantity?.code ?? element.minValueQuantity?.code,
  }
}
