// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Shoulder Surgery Questionnaire (SDC)                                      │
// │  T1 surgical-event data capture → RotatorCuffSurgeryBundle                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Usage: #definition — this is a form definition, not an example.
// SUSHI outputs this to ig/fsh-generated/resources/Questionnaire-shoulder-surgery.json.
//
// SDC conformance: parents from sdc-questionnaire-extr-defn. Every extracted
// resource is declared by a definitionExtract extension naming its target
// profile, on the item whose answers populate it, or at the root for a resource
// no question describes, which is how the research follow-up plan is declared.
// Leaf items carry item.definition pointing at their target profile element, and
// definitionExtractValue supplies the values no question asks, on the item
// carrying the extract or beneath it, because the specification's traversal
// scans down from there. Client-side extraction walks these to assemble a
// RotatorCuffSurgeryBundle: Encounter (1..1) + Procedure (1..*, surgical
// category) + optional intra-operative Observations + optional research CarePlan.
// The retired itemExtractionContext extension is declared alongside on the
// groups that predate definitionExtract, naming the same target profile, and is
// read only by the older definition-driven frontend. definitionExtract is
// authoritative.
//
// launchContext: the form receives a Patient resource resolved by the
// frontend's PatientLookup step. Patient and Condition references on extracted
// resources are filled from the launch context, not asked of the user.
//
// Per ADR-0034, the Patient and Condition are NOT created here — they exist
// from the prior RotatorCuffRegistrationBundle submission and are referenced by
// their persisted server-side IDs.
//
// linkId convention:
//   <section>           — group items
//   <section>.<field>   — leaf question items

Alias: $SCT = http://snomed.info/sct
Alias: $IG = https://maxpurk.github.io/shoulder-on-fhir
Alias: $MAX_VALUE_EXT = http://hl7.org/fhir/StructureDefinition/maxValue
Alias: $MIN_VALUE_EXT = http://hl7.org/fhir/StructureDefinition/minValue
Alias: $SDC_EXTRACT_CTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemExtractionContext
Alias: $SDC_DEF_EXTRACT = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtract
Alias: $SDC_DEF_VALUE = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtractValue
Alias: $SDC_ALLOC_ID = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extractAllocateId
Alias: $SDC_LAUNCH_CTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext
Alias: $SDC_POPULATION_CTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemPopulationContext
Alias: $SDC_INITIAL_EXPR = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression
Alias: $SDC_LAUNCH_CS = http://hl7.org/fhir/uv/sdc/CodeSystem/launchContext
Alias: $V3_ACT_CODE = http://terminology.hl7.org/CodeSystem/v3-ActCode

Instance: shoulder-surgery
InstanceOf: Questionnaire
Usage: #definition
Title: "Shoulder Registry Surgery (SDC)"
Description: """
SDC-conformant Questionnaire for the Shoulder on FHIR registry T1 (surgical
event) submission. Captures the surgical Encounter, one or more index/
concomitant Procedures (category=Surgical per RotatorCuffProcedureCategory),
and optional intra-operative Observations.

Patient and Condition are NOT captured, they exist from the prior
RotatorCuffRegistrationBundle submission. The frontend resolves them in its
PatientLookup step and injects them via launchContext.

Extraction model: definition-based. Groups carry SDC definitionExtract
declaring their target profile; leaf items carry item.definition pointing at
their target element.
"""

* meta.profile = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-defn"
* url = "https://maxpurk.github.io/shoulder-on-fhir/Questionnaire/shoulder-surgery"
* version = "0.6.0"
// sdc-2: version present requires an accompanying versionAlgorithm (ADR-0120).
// Uses [+]/[=] append syntax, matching the launchContext extension below —
// a URL-bracket selector here collides with that [+] append counter and
// silently merges both extensions into one corrupted array element.
* extension[+].url = "http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm"
* extension[=].valueCoding = http://hl7.org/fhir/version-algorithm#semver

// Named uuid for the visit, allocated once for the whole bundle.
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "encounterId"

// ── Research follow-up plan ───────────────────────────────────────────────────
// The five research follow-up timepoints of expert consensus Q11 follow from the
// surgery date, so no question asks about them. Declared at the root, where a
// definitionExtract always extracts even with no answer beneath it. The profile
// slices `activity` on the timepoint code, so each timepoint is addressable by
// element id and the code identifying it comes from the profile rather than from
// this form. Only the scheduled date and the description are stated here.
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "carePlanId"

* extension[+].url = $SDC_DEF_EXTRACT
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan"
* extension[=].extension[+].url = "fullUrl"
* extension[=].extension[=].valueString = "%carePlanId"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #active

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.subject.reference"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.subject.reference"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.period.start"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.period.end"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 2 years"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixWeeks.detail.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #scheduled

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixWeeks.detail.description"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueString = "Q11 research follow-up, 6 wk post-surgery"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixWeeks.detail.scheduled[x].event"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 6 weeks"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:threeMonths.detail.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #scheduled

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:threeMonths.detail.description"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueString = "Q11 research follow-up, 3 mo post-surgery"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:threeMonths.detail.scheduled[x].event"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 3 months"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixMonths.detail.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #scheduled

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixMonths.detail.description"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueString = "Q11 research follow-up, 6 mo post-surgery"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:sixMonths.detail.scheduled[x].event"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 6 months"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:oneYear.detail.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #scheduled

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:oneYear.detail.description"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueString = "Q11 research follow-up, 12 mo post-surgery"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:oneYear.detail.scheduled[x].event"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 1 year"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:twoYears.detail.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #scheduled

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:twoYears.detail.description"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueString = "Q11 research follow-up, 24 mo post-surgery"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan#CarePlan.activity:twoYears.detail.scheduled[x].event"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value + 2 years"

* name = "ShoulderSurgery"
* status = #draft
* subjectType = #Patient

// ── Launch context ────────────────────────────────────────────────────────────
// Patient resolved by frontend PatientLookup and injected at form launch.
* extension[+].url = $SDC_LAUNCH_CTX
* extension[=].extension[0].url = "name"
* extension[=].extension[0].valueCoding = $SDC_LAUNCH_CS#patient "Patient"
* extension[=].extension[1].url = "type"
* extension[=].extension[1].valueCode = #Patient
* extension[=].extension[2].url = "description"
* extension[=].extension[2].valueString = "The patient whose surgery is being recorded, resolved via PatientLookup before form launch."

// ── Encounter (surgical admission) ────────────────────────────────────────────
// definitionExtract: target a single ShoulderEncounter resource.
// itemPopulationContext binds the in-scope Patient so child initialExpression
// queries can resolve the patient's RotatorCuffCondition for the reasonReference.
* item[0].linkId = "encounter"
* item[0].text = "Surgical Encounter"
* item[0].type = #group
* item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter"
* item[0].extension[+].url = $SDC_DEF_EXTRACT
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter"
* item[0].extension[=].extension[+].url = "fullUrl"
* item[0].extension[=].extension[=].valueString = "%encounterId"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[0].extension[+].url = $SDC_EXTRACT_CTX
* item[0].extension[=].valueExpression.language = #application/x-fhir-query
* item[0].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter"
* item[0].extension[+].url = $SDC_POPULATION_CTX
* item[0].extension[=].valueExpression.name = "rotatorCuffCondition"
* item[0].extension[=].valueExpression.language = #application/x-fhir-query
* item[0].extension[=].valueExpression.expression = "Condition?subject={{%patient.id}}&_profile=https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition"

* item[0].item[0].linkId = "encounter.type"
* item[0].item[0].text = "Encounter Type"
* item[0].item[0].type = #choice
* item[0].item[0].required = true
* item[0].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.type"
* item[0].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-encounter-type"
// Default to "Patient encounter procedure" (308335008) — surgical admission.
// Uses core FHIR R4 Questionnaire.item.initial (not an SDC extension).
* item[0].item[0].initial[0].valueCoding = $SCT#308335008 "Patient encounter procedure"

// Incision / closure time (ADR-0110, refined by ADR-0121, ported here
// 2026-08-04): Encounter.period is composed directly from the one incision/
// closure pair for the whole surgical event, not a separately-captured
// admission/discharge window — same model the unified frontend uses. This
// pair also becomes every Procedure's performedPeriod in this bundle (see
// extractor.ts/bundleAssembler.ts), replacing the former per-procedure
// procedure.date item below.
* item[0].item[1].linkId = "encounter.startDate"
* item[0].item[1].text = "Incision Time"
* item[0].item[1].type = #dateTime
* item[0].item[1].required = true
* item[0].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.period.start"

* item[0].item[2].linkId = "encounter.endDate"
* item[0].item[2].text = "Closure Time"
* item[0].item[2].type = #dateTime
* item[0].item[2].required = true
* item[0].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.period.end"

// Read-only confirmation display, resolved from the itemPopulationContext
// query above via initialExpression — NOT extracted (no item.definition):
// this is a visible pre-fill demonstration only, the actual Condition
// reference used for the submitted bundle stays LaunchContext-driven
// (ADR-0100, ADR-0101).
* item[0].item[3].linkId = "encounter.linkedDiagnosis"
* item[0].item[3].text = "Linked Patient & Diagnosis (confirm before continuing)"
* item[0].item[3].type = #string
* item[0].item[3].readOnly = true
* item[0].item[3].extension[+].url = $SDC_INITIAL_EXPR
* item[0].item[3].extension[=].valueExpression.language = #text/fhirpath
* item[0].item[3].extension[=].valueExpression.expression = "%patient.name.first().family & ': ' & %rotatorCuffCondition.code.coding.first().display & ', ' & %rotatorCuffCondition.bodySite.coding.first().display"

// The identifier of that diagnosis, seeded from the same query and hidden.
// Encounter.reasonReference and Procedure.reasonReference are both read from
// here, so a filler that knows nothing of this guide can still state them
// instead of leaving two required elements empty.
* item[0].item[6].linkId = "encounter.conditionId"
* item[0].item[6].text = "Rotator Cuff Condition ID"
* item[0].item[6].type = #string
* item[0].item[6].extension[+].url = "http://hl7.org/fhir/StructureDefinition/questionnaire-hidden"
* item[0].item[6].extension[=].valueBoolean = true
* item[0].item[6].extension[+].url = $SDC_INITIAL_EXPR
* item[0].item[6].extension[=].valueExpression.language = #text/fhirpath
* item[0].item[6].extension[=].valueExpression.expression = "%rotatorCuffCondition.id"

// Setting (ambulatory day surgery vs. inpatient) — a real per-case fact, not a
// constant: this IG deliberately leaves Encounter.class unconstrained (see
// ShoulderEncounter.fsh) precisely because it varies here, unlike Registration
// and Follow-Up encounters, which are always ambulatory office visits. Mirrors
// the unified frontend's existing "Day surgery / Inpatient" dropdown
// (SurgicalEventStep.tsx) — this Questionnaire never asked for it before.
* item[0].item[4].linkId = "encounter.setting"
* item[0].item[4].text = "Setting"
* item[0].item[4].type = #choice
* item[0].item[4].required = true
* item[0].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.class"
// Display strings must match v3-ActCode's own official display exactly (the
// same class of drift ADR-0103 fixed for local CodeSystems) — the answer's
// full Coding, including display, flows verbatim onto the submitted
// Encounter.class, and the validator checks it against the real CodeSystem,
// not against whatever wording is friendliest to show a user.
* item[0].item[4].answerOption[0].valueCoding = $V3_ACT_CODE#AMB "ambulatory"
* item[0].item[4].answerOption[1].valueCoding = $V3_ACT_CODE#IMP "inpatient encounter"

// Surgeon / performer (not Hurley-named — verified against the full Hurley
// et al. 2024 text; pure Layer 2, RotatorCuffProcedure.performer.actor,
// L3.H.1). Loose leaf, no item.definition: this IG has no Practitioner
// directory, so the plain-text answer is applied to every Procedure's
// performer.actor.display in bundleAssembler.ts (same event-level pattern
// as incision/closure above), not resolved through the generic per-path
// extractor.
* item[0].item[5].linkId = "encounter.performer"
* item[0].item[5].text = "Surgeon / Performer"
* item[0].item[5].type = #string

// ── Procedure (1..*) — primary + optional concomitants ────────────────────────
// definitionExtract: each repeating group entry produces one
// RotatorCuffProcedure resource. category is set by the extractor to surgical
// (387713003) since RotatorCuffProcedureCategory is extensible and the
// surgical category is the bundle's gate (see ADR-0033 / ADR-0034).
* item[1].linkId = "procedure"
* item[1].text = "Surgical Procedure (primary, then concomitants)"
* item[1].type = #group
* item[1].repeats = true
* item[1].required = true
* item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure"
* item[1].extension[+].url = $SDC_DEF_EXTRACT
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[1].extension[+].url = $SDC_EXTRACT_CTX
* item[1].extension[=].valueExpression.language = #application/x-fhir-query
* item[1].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure"

// What every procedure in this event carries and no question asks for. These
// were supplied by the application that assembled the bundle, which meant a
// filler reading only this form produced a procedure without a subject, an
// encounter, a category or a date, all four of them required. Stated here, the
// form carries them itself.
* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.subject.reference"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%resource.subject.reference"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.encounter.reference"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%encounterId"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.category"
* item[1].extension[=].extension[+].url = "fixed-value"
* item[1].extension[=].extension[=].valueCoding = $SCT#387713003 "Surgical procedure"

// The event's own incision and closure times, shared by every procedure in it.
* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.performed[x]:performedPeriod.start"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.startDate').answer.value"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.performed[x]:performedPeriod.end"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.endDate').answer.value"

* item[1].item[0].linkId = "procedure.type"
* item[1].item[0].text = "Procedure Type"
* item[1].item[0].type = #choice
* item[1].item[0].required = true
* item[1].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.code"
* item[1].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-procedure-type"

// procedure.date removed 2026-08-04: performedPeriod is now composed from
// the single event-level incision/closure pair (item[0].item[1]/[2]),
// shared by every procedure in the event — mirrors the unified frontend's
// ADR-0121 model instead of asking a redundant per-procedure date. See
// bundleAssembler.ts.

* item[1].item[1].linkId = "procedure.laterality"
* item[1].item[1].text = "Side"
* item[1].item[1].type = #choice
* item[1].item[1].required = true
* item[1].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.bodySite"
* item[1].item[1].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality"

* item[1].item[2].linkId = "procedure.note"
* item[1].item[2].text = "Operative Note / Comments"
* item[1].item[2].type = #text
* item[1].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.note"

// Intraoperative Success — a plain Procedure.outcome field
// (MS, open binding), so unlike Approach/Extent/Fixation below it resolves
// fully generically through the same extraction-context mechanism as
// type/laterality/note above.
* item[1].item[3].linkId = "procedure.outcome"
* item[1].item[3].text = "Intraoperative Success"
* item[1].item[3].type = #choice
* item[1].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.outcome"
* item[1].item[3].answerOption[0].valueCoding = $SCT#385669000 "Successful"
* item[1].item[3].answerOption[1].valueCoding = $SCT#385671000 "Unsuccessful"

// Approach / Reconstruction Extent / Fixation Technique — loose leaves, same reason as Coverage/RSG/phone: these are SEPARATE
// Observation resources (ProcedureApproachObservation etc.), not Procedure
// fields, so they cannot use item.definition inside a group whose
// extraction context targets Procedure (the generic resolver only reads
// leaves matching the group's own resource type). Unlike those simpler
// loose leaves, each answer here must also produce an Observation linked
// via `partOf` to *this specific* procedure repetition (ADR-0108's
// pattern) — for a repeating group that means per-repetition correlation,
// not just a single hardcoded builder call. Handled in
// `bundleAssembler.ts` (ADR-0141): each procedure repetition's own
// approach/extent/fixation answers travel alongside it through extraction
// and get their `partOf` wired at the same point every other cross-
// resource reference (subject/encounter/reasonReference) already is.
* item[1].item[4].linkId = "procedure.approach"
* item[1].item[4].text = "Approach"
* item[1].item[4].type = #choice
* item[1].item[4].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/procedure-approach"

* item[1].item[5].linkId = "procedure.reconstructionExtent"
* item[1].item[5].text = "Reconstruction Extent"
* item[1].item[5].type = #choice
* item[1].item[5].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/reconstruction-extent"

* item[1].item[6].linkId = "procedure.fixationTechnique"
* item[1].item[6].text = "Fixation Technique"
* item[1].item[6].type = #choice
* item[1].item[6].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/fixation-technique"

// Diagnosis addressed (ADR-0159) — loose leaf, no item.definition and no
// answerValueSet: the candidate list is the specific patient's own
// otherDiagnosis Conditions (ShoulderDiagnosisCondition, recorded at
// Registration), which is dynamic per-patient data, not a fixed
// terminology-bound choice a static FSH answerValueSet could enumerate.
// QuestionnaireForm.tsx merges a runtime-computed option list for this one
// linkId into its existing staticOptions mechanism (already used for
// Questionnaire-declared-but-non-ValueSet-bound choices), sourced from the
// resolved LaunchContext's otherDiagnoses instead of the Questionnaire's own
// static answerOption. Empty answer means "index rotator cuff diagnosis" —
// the same default RotatorCuffProcedure.reasonReference already had before
// this ADR. Only meaningful for a concomitant procedure; harmless if
// answered (or left blank) on the index repetition too.
* item[1].item[7].linkId = "procedure.diagnosis"
* item[1].item[7].text = "Diagnosis addressed (only if different from the index rotator cuff diagnosis)"
* item[1].item[7].type = #choice

// ── Intra-operative observations (optional) ──────────────────────────────────
// Per-leaf extraction; each item → its own Observation profile.
* item[2].linkId = "intraOpObservations"
* item[2].text = "Intra-operative Findings (optional)"
* item[2].type = #group

* item[2].item[0].linkId = "obs.tear-size"
* item[2].item[0].text = "Confirmed Tear Size (cm)"
* item[2].item[0].type = #decimal
* item[2].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-observation#Observation.value[x]"
* item[2].item[0].extension[0].url = $MAX_VALUE_EXT
* item[2].item[0].extension[0].valueDecimal = 10
* item[2].item[0].extension[1].url = $MIN_VALUE_EXT
* item[2].item[0].extension[1].valueDecimal = 0

* item[2].item[1].linkId = "obs.tear-size-classification"
* item[2].item[1].text = "Tear Size Classification (Cofield)"
* item[2].item[1].type = #choice
* item[2].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-classification-observation#Observation.value[x]"
* item[2].item[1].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/cofield-tear-size-classification"

// Patte / Goutallier classification is not captured here (ADR-0140): it lives in Registration's clinicalAssessment group to match the
// unified frontend's pre-operative, imaging-based timepoint for these two
// classifications — this Surgery form previously captured them intra-
// operatively, a different clinical method/timepoint than unified, which
// made the "same" classification mean different things depending on which
// frontend a given patient went through. Tear Size Classification (Cofield)
// above is unaffected — it already has separate Registration (imaging-
// estimated) and Surgery (intra-op-confirmed) profiles by design, not a
// single shared one.

// ── SDC extraction declarations ───────────────────────────────
// Generated. Placed after every literal item rule so the soft index [+] appends
// past any extension an item already declares. A profile reached by more than one
// item is declared once on their shared parent, so component slices fill one
// resource instead of producing one resource per component.

* insert DeclareObservationExistingSubject(item[2].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-observation)
* insert DeclareObservationExistingSubject(item[2].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-classification-observation)

// ── Values no question asks for, declared on the item that extracts the
//    resource they belong to, which is the scope the specification walks ──

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.status"
* item[0].extension[=].extension[+].url = "fixed-value"
* item[0].extension[=].extension[=].valueCode = #finished

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.class"
* item[0].extension[=].extension[+].url = "fixed-value"
* item[0].extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/v3-ActCode#IMP "inpatient encounter"

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.subject.reference"
* item[0].extension[=].extension[+].url = "expression"
* item[0].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[0].extension[=].extension[=].valueExpression.expression = "%resource.subject.reference"

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.reasonReference.reference"
* item[0].extension[=].extension[+].url = "expression"
* item[0].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[0].extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.conditionId').answer.value.select('Condition/' + $this)"

// ── The side, carried onto every observation that names a physical site ──
//    The side is answered once, in procedure.laterality. Each declaration sits on the item
//    whose definitionExtract creates the observation, so an engine that walks
//    down from that item finds it. Observations of the patient in general
//    (history, social history, aggregate scores) name no site and are absent here.
* insert DeclareBodySite(item[2].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-classification-observation, procedure.laterality)
* insert DeclareBodySite(item[2].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-observation, procedure.laterality)
