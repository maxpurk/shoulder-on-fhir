/**
 * FHIR Questionnaire and QuestionnaireResponse Type Definitions
 *
 * These types support rendering Questionnaires dynamically and
 * capturing responses for extraction into granular FHIR resources.
 */

import type { Coding, CodeableConcept, Reference } from './fhir'

// ============================================
// Questionnaire Resource
// ============================================

export interface Questionnaire {
  resourceType: 'Questionnaire'
  id?: string
  url?: string
  version?: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  subjectType?: string[]
  item?: QuestionnaireItem[]
}

export interface QuestionnaireItem {
  linkId: string
  definition?: string  // SDC definition-based extraction: points to resource element path
  text?: string
  type: QuestionnaireItemType
  required?: boolean
  repeats?: boolean
  readOnly?: boolean
  maxLength?: number
  answerValueSet?: string  // Canonical reference to ValueSet
  answerOption?: QuestionnaireItemAnswerOption[]
  initial?: QuestionnaireItemInitial[]
  item?: QuestionnaireItem[]  // Nested items for groups
  enableWhen?: QuestionnaireItemEnableWhen[]
  enableBehavior?: 'all' | 'any'
  extension?: QuestionnaireExtension[]
}

export type QuestionnaireItemType =
  | 'group'
  | 'display'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'string'
  | 'text'
  | 'url'
  | 'choice'
  | 'open-choice'
  | 'attachment'
  | 'reference'
  | 'quantity'

export interface QuestionnaireItemAnswerOption {
  valueCoding?: Coding
  valueInteger?: number
  valueDate?: string
  valueTime?: string
  valueString?: string
  valueReference?: Reference
  initialSelected?: boolean
}

export interface QuestionnaireItemInitial {
  valueBoolean?: boolean
  valueDecimal?: number
  valueInteger?: number
  valueDate?: string
  valueDateTime?: string
  valueTime?: string
  valueString?: string
  valueCoding?: Coding
  valueQuantity?: QuantityValue
  valueReference?: Reference
}

export interface QuestionnaireItemEnableWhen {
  question: string  // linkId of the question
  operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<='
  answerBoolean?: boolean
  answerDecimal?: number
  answerInteger?: number
  answerDate?: string
  answerDateTime?: string
  answerTime?: string
  answerString?: string
  answerCoding?: Coding
  answerQuantity?: QuantityValue
  answerReference?: Reference
}

export interface QuestionnaireExtension {
  url: string
  valueString?: string
  valueCode?: string
  valueInteger?: number
  valueBoolean?: boolean
  valueCoding?: Coding
  valueCodeableConcept?: CodeableConcept
}

// ============================================
// QuestionnaireResponse Resource
// ============================================

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse'
  id?: string
  questionnaire?: string  // Canonical URL of the Questionnaire
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped'
  subject?: Reference
  authored?: string
  author?: Reference
  source?: Reference
  item?: QuestionnaireResponseItem[]
}

export interface QuestionnaireResponseItem {
  linkId: string
  definition?: string
  text?: string
  answer?: QuestionnaireResponseItemAnswer[]
  item?: QuestionnaireResponseItem[]  // Nested items
}

export interface QuestionnaireResponseItemAnswer {
  valueBoolean?: boolean
  valueDecimal?: number
  valueInteger?: number
  valueDate?: string
  valueDateTime?: string
  valueTime?: string
  valueString?: string
  valueUri?: string
  valueCoding?: Coding
  valueQuantity?: QuantityValue
  valueReference?: Reference
  item?: QuestionnaireResponseItem[]  // Nested items for answer
}

export interface QuantityValue {
  value?: number
  unit?: string
  system?: string
  code?: string
}

// ============================================
// ValueSet for answer options (expanded)
// ============================================

export interface ValueSet {
  resourceType: 'ValueSet'
  id?: string
  url?: string
  version?: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  expansion?: ValueSetExpansion
  compose?: ValueSetCompose
}

export interface ValueSetExpansion {
  identifier?: string
  timestamp?: string
  total?: number
  offset?: number
  contains?: ValueSetExpansionContains[]
}

export interface ValueSetExpansionContains {
  system?: string
  code?: string
  display?: string
  abstract?: boolean
  inactive?: boolean
}

export interface ValueSetCompose {
  include?: ValueSetComposeInclude[]
  exclude?: ValueSetComposeInclude[]
}

export interface ValueSetComposeInclude {
  system?: string
  version?: string
  concept?: ValueSetComposeConcept[]
  valueSet?: string[]
}

export interface ValueSetComposeConcept {
  code: string
  display?: string
}

// ============================================
// SDC Extension URLs (Structured Data Capture)
// ============================================

export const SDC_EXTENSIONS = {
  // Definition-based extraction
  DEFINITION: 'definition',  // Built into item.definition

  // Item control (how to render)
  ITEM_CONTROL: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',

  // Hidden items
  HIDDEN: 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden',

  // Unit for quantity
  UNIT: 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit',

  // Min/max values
  MIN_VALUE: 'http://hl7.org/fhir/StructureDefinition/minValue',
  MAX_VALUE: 'http://hl7.org/fhir/StructureDefinition/maxValue',

  // Observation extraction
  OBSERVATION_EXTRACT: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract',

  // Target resource for extraction
  TARGET_STRUCTURE_MAP: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-targetStructureMap',
} as const

// ============================================
// Helper Types
// ============================================

export interface RenderedQuestionnaireItem extends QuestionnaireItem {
  answerOptions?: Coding[]  // Resolved from ValueSet
  currentValue?: QuestionnaireResponseItemAnswer
}
