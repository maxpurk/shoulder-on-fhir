// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Shoulder Follow-Up Questionnaire (SDC)                                    │
// │  Per-visit (Q11 timepoint) data capture → RotatorCuffFollowUpBundle          │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Usage: #definition — this is a form definition, not an example.
// SUSHI outputs this to ig/fsh-generated/resources/Questionnaire-shoulder-follow-up.json.
//
// SDC conformance: parents from sdc-questionnaire-extr-defn. Every extracted
// resource is declared by a definitionExtract extension naming its target
// profile, on the item whose answers populate it. Leaf items carry
// item.definition pointing at their target profile element, and
// definitionExtractValue supplies the values no question asks, on the item
// carrying the extract or beneath it, because the specification's traversal
// scans down from there. Client-side extraction walks these to assemble a
// RotatorCuffFollowUpBundle: Encounter (1..1) + Observations (1..*) + optional
// ImagingStudy / QuestionnaireResponse.
// The retired itemExtractionContext extension is declared alongside on the
// groups that predate definitionExtract, naming the same target profile, and is
// read only by the older definition-driven frontend. definitionExtract is
// authoritative.
//
// launchContext: the form receives a Patient resource resolved by the
// frontend's PatientLookup step. itemPopulationContext queries for the
// patient's RotatorCuffCondition so Observation.subject and Encounter.
// reasonReference can be wired without asking the user. The Q11 timepoint
// is selected explicitly (no canonical FHIRPath available to infer the
// closest scheduled timepoint from the index Procedure date).
//
// Per ADR-0030 + ADR-0034: this submission references Patient + Condition by
// persisted ID. No Patient or Condition resource is created here.
//
// Constant-Murley total is read-only and computed by calculatedExpression
// from four sub-scores captured as Observation.component[] (ADR-0090,
// ADR-0158) — same pattern as the Registration Questionnaire.
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
Alias: $SDC_CALC_EXPR = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression
Alias: $SDC_LAUNCH_CS = http://hl7.org/fhir/uv/sdc/CodeSystem/launchContext

Instance: shoulder-follow-up
InstanceOf: Questionnaire
Usage: #definition
Title: "Shoulder Registry Follow-Up (SDC)"
Description: """
SDC-conformant Questionnaire for the Shoulder on FHIR registry per-visit
(longitudinal) submission. Captures one Q11 timepoint's worth of data:
Encounter, post-operative examination Observations (Q9), and outcome-score
Observations (Q12 instruments + components a–g).

Patient and Condition are NOT captured, they exist from the prior
RotatorCuffRegistrationBundle submission. The frontend resolves them in its
PatientLookup step and injects them via launchContext.

SDC features demonstrated:
- launchContext + itemPopulationContext + initialExpression: encounter.linkedDiagnosis
  is a read-only field whose value is resolved live, via FHIRPath, from both
  the launchContext-declared %patient and the itemPopulationContext-declared
  %rotatorCuffCondition query, a genuine client-side evaluation of all three
  extensions, not just their declaration. The Encounter.reasonReference /
  Observation.subject references actually written into the submitted bundle
  are wired separately, by LaunchContext in bundleAssembler.ts, this
  mechanism is additive UX/spec-conformance, not the source of truth for
  those references.
- calculatedExpression: Constant-Murley total auto-computes from four
  sub-scores (pain / ADL / ROM / strength), captured as
  Observation.component[]. Total and sub-scores are all read-only in this
  form; the ConstantScoreObservation profile itself still permits a
  direct total with no components, for sites submitting outside these forms.
"""

* meta.profile = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-defn"
* url = "https://maxpurk.github.io/shoulder-on-fhir/Questionnaire/shoulder-follow-up"
* version = "0.4.0"
// sdc-2: version present requires an accompanying versionAlgorithm (ADR-0120).
// Uses [+]/[=] append syntax, matching the launchContext extension below —
// a URL-bracket selector here collides with that [+] append counter and
// silently merges both extensions into one corrupted array element.
* extension[+].url = "http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm"
* extension[=].valueCoding = http://hl7.org/fhir/version-algorithm#semver

// Named uuid for the visit, allocated once for the whole bundle.
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "encounterId"

* name = "ShoulderFollowUp"
* status = #draft
* subjectType = #Patient

// ── Launch context ────────────────────────────────────────────────────────────
* extension[+].url = $SDC_LAUNCH_CTX
* extension[=].extension[0].url = "name"
* extension[=].extension[0].valueCoding = $SDC_LAUNCH_CS#patient "Patient"
* extension[=].extension[1].url = "type"
* extension[=].extension[1].valueCode = #Patient
* extension[=].extension[2].url = "description"
* extension[=].extension[2].valueString = "The patient whose follow-up visit is being recorded, resolved via PatientLookup before form launch."

// ── Encounter (per-visit follow-up) ───────────────────────────────────────────
// definitionExtract: target a single ShoulderEncounter resource.
// itemPopulationContext on Condition lets the encounter.reasonReference
// pre-fill against the patient's RotatorCuffCondition.
* item[0].linkId = "encounter"
* item[0].text = "Follow-Up Encounter"
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
* item[0].item[0].initial[0].valueCoding = $SCT#390906007 "Follow-up encounter"

* item[0].item[1].linkId = "encounter.date"
* item[0].item[1].text = "Visit Date"
* item[0].item[1].type = #dateTime
* item[0].item[1].required = true
* item[0].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.period.start"

* item[0].item[2].linkId = "encounter.timepoint"
* item[0].item[2].text = "Q11 Follow-Up Timepoint"
* item[0].item[2].type = #choice
* item[0].item[2].required = true
* item[0].item[2].answerOption[0].valueString = "6 weeks"
* item[0].item[2].answerOption[1].valueString = "3 months"
* item[0].item[2].answerOption[2].valueString = "6 months"
* item[0].item[2].answerOption[3].valueString = "1 year"
* item[0].item[2].answerOption[4].valueString = "2 years"

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

// The identifier of that diagnosis, seeded from the same query and hidden, so
// the visit's reason resolves without asking anyone to type it.
* item[0].item[4].linkId = "encounter.conditionId"
* item[0].item[4].text = "Rotator Cuff Condition ID"
* item[0].item[4].type = #string
* item[0].item[4].extension[+].url = "http://hl7.org/fhir/StructureDefinition/questionnaire-hidden"
* item[0].item[4].extension[=].valueBoolean = true
* item[0].item[4].extension[+].url = $SDC_INITIAL_EXPR
* item[0].item[4].extension[=].valueExpression.language = #text/fhirpath
* item[0].item[4].extension[=].valueExpression.expression = "%rotatorCuffCondition.id"

// The side of that diagnosis, seeded from the same query and hidden. The
// follow-up form does not ask it, because the side is a property of the
// diagnosis being followed up rather than of this visit. Extraction reads only
// the response, so the value has to be in the response before it can be carried
// onto the observations that name a physical site.
* item[0].item[5].linkId = "encounter.laterality"
* item[0].item[5].text = "Side"
* item[0].item[5].type = #choice
* item[0].item[5].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality"
* item[0].item[5].extension[+].url = "http://hl7.org/fhir/StructureDefinition/questionnaire-hidden"
* item[0].item[5].extension[=].valueBoolean = true
* item[0].item[5].extension[+].url = $SDC_INITIAL_EXPR
* item[0].item[5].extension[=].valueExpression.language = #text/fhirpath
* item[0].item[5].extension[=].valueExpression.expression = "%rotatorCuffCondition.bodySite.coding.first()"

// ── Post-operative examination (Q9) ───────────────────────────────────────────
// Per-leaf extraction; each item → its own Observation profile.
* item[1].linkId = "postOpExam"
* item[1].text = "Post-Operative Examination"
* item[1].type = #group

// ROM — active angles
* item[1].item[0].linkId = "obs.abduction"
* item[1].item[0].text = "Active Abduction (°)"
* item[1].item[0].type = #decimal
* item[1].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation#Observation.value[x]"
* item[1].item[0].extension[0].url = $MAX_VALUE_EXT
* item[1].item[0].extension[0].valueDecimal = 180
* item[1].item[0].extension[1].url = $MIN_VALUE_EXT
* item[1].item[0].extension[1].valueDecimal = 0

* item[1].item[1].linkId = "obs.forward-flexion"
* item[1].item[1].text = "Active Forward Flexion (°)"
* item[1].item[1].type = #decimal
* item[1].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation#Observation.value[x]"
* item[1].item[1].extension[0].url = $MAX_VALUE_EXT
* item[1].item[1].extension[0].valueDecimal = 180
* item[1].item[1].extension[1].url = $MIN_VALUE_EXT
* item[1].item[1].extension[1].valueDecimal = 0

* item[1].item[2].linkId = "obs.external-rotation"
* item[1].item[2].text = "Active External Rotation, at side (°)"
* item[1].item[2].type = #decimal
* item[1].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation#Observation.value[x]"
* item[1].item[2].extension[0].url = $MAX_VALUE_EXT
* item[1].item[2].extension[0].valueDecimal = 360
* item[1].item[2].extension[1].url = $MIN_VALUE_EXT
* item[1].item[2].extension[1].valueDecimal = 0

// ADR-0088: at-side Internal Rotation redesigned from degrees to the
// "hand behind back" vertebral-level ordinal.
* item[1].item[3].linkId = "obs.internal-rotation"
* item[1].item[3].text = "Active Internal Rotation, at side (hand behind back)"
* item[1].item[3].type = #choice
* item[1].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation#Observation.value[x]"
* item[1].item[3].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/internal-rotation-vertebral-level"

// ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
* item[1].item[4].linkId = "obs.external-rotation-90-abduction"
* item[1].item[4].text = "Active External Rotation, at 90° abduction (°)"
* item[1].item[4].type = #decimal
* item[1].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation#Observation.value[x]"
* item[1].item[4].extension[0].url = $MAX_VALUE_EXT
* item[1].item[4].extension[0].valueDecimal = 360
* item[1].item[4].extension[1].url = $MIN_VALUE_EXT
* item[1].item[4].extension[1].valueDecimal = 0

* item[1].item[5].linkId = "obs.internal-rotation-90-abduction"
* item[1].item[5].text = "Active Internal Rotation, at 90° abduction (°)"
* item[1].item[5].type = #decimal
* item[1].item[5].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation#Observation.value[x]"
* item[1].item[5].extension[0].url = $MAX_VALUE_EXT
* item[1].item[5].extension[0].valueDecimal = 360
* item[1].item[5].extension[1].url = $MIN_VALUE_EXT
* item[1].item[5].extension[1].valueDecimal = 0

// ROM — passive angles (parity port from unified frontend, ADR-0146 — this
// entire passive battery was previously absent from SDC's Follow-Up form).
* item[1].item[6].linkId = "obs.passive-abduction"
* item[1].item[6].text = "Passive Abduction (°)"
* item[1].item[6].type = #decimal
* item[1].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation#Observation.value[x]"
* item[1].item[6].extension[0].url = $MAX_VALUE_EXT
* item[1].item[6].extension[0].valueDecimal = 180
* item[1].item[6].extension[1].url = $MIN_VALUE_EXT
* item[1].item[6].extension[1].valueDecimal = 0

* item[1].item[7].linkId = "obs.passive-forward-flexion"
* item[1].item[7].text = "Passive Forward Flexion (°)"
* item[1].item[7].type = #decimal
* item[1].item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation#Observation.value[x]"
* item[1].item[7].extension[0].url = $MAX_VALUE_EXT
* item[1].item[7].extension[0].valueDecimal = 180
* item[1].item[7].extension[1].url = $MIN_VALUE_EXT
* item[1].item[7].extension[1].valueDecimal = 0

* item[1].item[8].linkId = "obs.passive-external-rotation"
* item[1].item[8].text = "Passive External Rotation, at side (°)"
* item[1].item[8].type = #decimal
* item[1].item[8].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation#Observation.value[x]"
* item[1].item[8].extension[0].url = $MAX_VALUE_EXT
* item[1].item[8].extension[0].valueDecimal = 360
* item[1].item[8].extension[1].url = $MIN_VALUE_EXT
* item[1].item[8].extension[1].valueDecimal = 0

* item[1].item[9].linkId = "obs.passive-internal-rotation"
* item[1].item[9].text = "Passive Internal Rotation, at side (hand behind back)"
* item[1].item[9].type = #choice
* item[1].item[9].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation#Observation.value[x]"
* item[1].item[9].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/internal-rotation-vertebral-level"

* item[1].item[10].linkId = "obs.passive-external-rotation-90-abduction"
* item[1].item[10].text = "Passive External Rotation, at 90° abduction (°)"
* item[1].item[10].type = #decimal
* item[1].item[10].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation#Observation.value[x]"
* item[1].item[10].extension[0].url = $MAX_VALUE_EXT
* item[1].item[10].extension[0].valueDecimal = 360
* item[1].item[10].extension[1].url = $MIN_VALUE_EXT
* item[1].item[10].extension[1].valueDecimal = 0

* item[1].item[11].linkId = "obs.passive-internal-rotation-90-abduction"
* item[1].item[11].text = "Passive Internal Rotation, at 90° abduction (°)"
* item[1].item[11].type = #decimal
* item[1].item[11].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation#Observation.value[x]"
* item[1].item[11].extension[0].url = $MAX_VALUE_EXT
* item[1].item[11].extension[0].valueDecimal = 360
* item[1].item[11].extension[1].url = $MIN_VALUE_EXT
* item[1].item[11].extension[1].valueDecimal = 0

// Muscle Strength
* item[1].item[12].linkId = "obs.supraspinatus-strength"
* item[1].item[12].text = "Supraspinatus Strength (MMT 0–5)"
* item[1].item[12].type = #decimal
* item[1].item[12].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation#Observation.value[x]"
* item[1].item[12].extension[0].url = $MAX_VALUE_EXT
* item[1].item[12].extension[0].valueDecimal = 5
* item[1].item[12].extension[1].url = $MIN_VALUE_EXT
* item[1].item[12].extension[1].valueDecimal = 0

* item[1].item[13].linkId = "obs.external-rotation-strength"
* item[1].item[13].text = "External Rotation Strength (MMT 0–5, Janda)"
* item[1].item[13].type = #decimal
* item[1].item[13].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation#Observation.value[x]"
* item[1].item[13].extension[0].url = $MAX_VALUE_EXT
* item[1].item[13].extension[0].valueDecimal = 5
* item[1].item[13].extension[1].url = $MIN_VALUE_EXT
* item[1].item[13].extension[1].valueDecimal = 0

// ADR-0089: surgeon feedback — Internal Rotation strength (mirror position
// of External Rotation) and Supraspinatus dynamometry, new alongside the
// existing ordinal grades.
* item[1].item[14].linkId = "obs.internal-rotation-strength"
* item[1].item[14].text = "Internal Rotation Strength (MMT 0–5, Janda)"
* item[1].item[14].type = #decimal
* item[1].item[14].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation#Observation.value[x]"
* item[1].item[14].extension[0].url = $MAX_VALUE_EXT
* item[1].item[14].extension[0].valueDecimal = 5
* item[1].item[14].extension[1].url = $MIN_VALUE_EXT
* item[1].item[14].extension[1].valueDecimal = 0

// Subscapularis Strength — parity port from unified frontend (ADR-0146;
// ADR-0089 originally noted this profile was absent from both SDC
// Questionnaire instances, closed here for Follow-Up).
* item[1].item[15].linkId = "obs.subscapularis-strength"
* item[1].item[15].text = "Subscapularis Strength (MMT 0–5)"
* item[1].item[15].type = #decimal
* item[1].item[15].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation#Observation.value[x]"
* item[1].item[15].extension[0].url = $MAX_VALUE_EXT
* item[1].item[15].extension[0].valueDecimal = 5
* item[1].item[15].extension[1].url = $MIN_VALUE_EXT
* item[1].item[15].extension[1].valueDecimal = 0

* item[1].item[16].linkId = "obs.supraspinatus-strength-dynamometry"
* item[1].item[16].text = "Supraspinatus Strength (Dynamometry, kg)"
* item[1].item[16].type = #decimal
* item[1].item[16].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation#Observation.value[x]"
* item[1].item[16].extension[0].url = $MAX_VALUE_EXT
* item[1].item[16].extension[0].valueDecimal = 50
* item[1].item[16].extension[1].url = $MIN_VALUE_EXT
* item[1].item[16].extension[1].valueDecimal = 0

* item[1].item[17].linkId = "obs.pain-average"
* item[1].item[17].text = "Pain Severity, On Average (0–10)"
* item[1].item[17].type = #decimal
* item[1].item[17].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation#Observation.value[x]"
* item[1].item[17].extension[0].url = $MAX_VALUE_EXT
* item[1].item[17].extension[0].valueDecimal = 10
* item[1].item[17].extension[1].url = $MIN_VALUE_EXT
* item[1].item[17].extension[1].valueDecimal = 0

* item[1].item[18].linkId = "obs.pain-active-movement"
* item[1].item[18].text = "Pain Severity, With Active Movement (0–10)"
* item[1].item[18].type = #decimal
* item[1].item[18].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation#Observation.value[x]"
* item[1].item[18].extension[0].url = $MAX_VALUE_EXT
* item[1].item[18].extension[0].valueDecimal = 10
* item[1].item[18].extension[1].url = $MIN_VALUE_EXT
* item[1].item[18].extension[1].valueDecimal = 0

* item[1].item[19].linkId = "obs.pain-passive-movement"
* item[1].item[19].text = "Pain Severity, With Passive Movement (0–10)"
* item[1].item[19].type = #decimal
* item[1].item[19].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation#Observation.value[x]"
* item[1].item[19].extension[0].url = $MAX_VALUE_EXT
* item[1].item[19].extension[0].valueDecimal = 10
* item[1].item[19].extension[1].url = $MIN_VALUE_EXT
* item[1].item[19].extension[1].valueDecimal = 0

* item[1].item[20].linkId = "obs.pain-rest"
* item[1].item[20].text = "Pain Severity, At Rest (0–10)"
* item[1].item[20].type = #decimal
* item[1].item[20].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation#Observation.value[x]"
* item[1].item[20].extension[0].url = $MAX_VALUE_EXT
* item[1].item[20].extension[0].valueDecimal = 10
* item[1].item[20].extension[1].url = $MIN_VALUE_EXT
* item[1].item[20].extension[1].valueDecimal = 0

// Provocation tests (Hurley A9 e/f/g — exactly Jobe/lift-off/belly-press;
// bear-hug/Hornblower deliberately excluded from the post-op set, ADR-0093
// documents this as intentional, not a gap to "fix"). Matches the unified
// frontend, per the parity rule in ADR-0144.
* item[1].item[21].linkId = "obs.jobe-test"
* item[1].item[21].text = "Jobe Test (Supraspinatus)"
* item[1].item[21].type = #choice
* item[1].item[21].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation#Observation.value[x]"
* item[1].item[21].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[1].item[21].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[1].item[22].linkId = "obs.lift-off-test"
* item[1].item[22].text = "Lift-Off Test (Subscapularis)"
* item[1].item[22].type = #choice
* item[1].item[22].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation#Observation.value[x]"
* item[1].item[22].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[1].item[22].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[1].item[23].linkId = "obs.belly-press-test"
* item[1].item[23].text = "Belly Press Test (Subscapularis)"
* item[1].item[23].type = #choice
* item[1].item[23].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation#Observation.value[x]"
* item[1].item[23].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[1].item[23].answerOption[1].valueCoding = $SCT#260385009 "Negative"

// Visual inspection — 3 structured findings (ADR-0086). Matches the
// unified frontend, per ADR-0144.
* item[1].item[24].linkId = "obs.atrophy"
* item[1].item[24].text = "Atrophy"
* item[1].item[24].type = #choice
* item[1].item[24].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation#Observation.value[x]"
* item[1].item[24].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[1].item[24].answerOption[1].valueCoding = $SCT#2667000 "Absent"

* item[1].item[25].linkId = "obs.deformity"
* item[1].item[25].text = "Deformity"
* item[1].item[25].type = #choice
* item[1].item[25].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation#Observation.value[x]"
* item[1].item[25].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[1].item[25].answerOption[1].valueCoding = $SCT#2667000 "Absent"

* item[1].item[26].linkId = "obs.normal-shoulder-contour"
* item[1].item[26].text = "Normal Shoulder Contour"
* item[1].item[26].type = #choice
* item[1].item[26].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation#Observation.value[x]"
* item[1].item[26].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[1].item[26].answerOption[1].valueCoding = $SCT#2667000 "Absent"

// ── Outcome Scores (Q12 PROMs at this timepoint) ──────────────────────────────
// Constant-Murley total: read-only, calculatedExpression auto-sum of the four
// component sub-scores (ADR-0090, ADR-0158; same as Registration Questionnaire).
* item[2].linkId = "outcomeScores"
* item[2].text = "Outcome Scores"
* item[2].type = #group

// Constant-Murley sub-scores — captured as Observation.component slices on
// ConstantScoreObservation. ADR-0158 (porting ADR-0112's POOS-15 calculator
// + ADR-0113's read-only fix to SDC): these four are now calculated,
// read-only outputs of QuestionnaireForm.tsx's live calculator effect,
// driven by the granular constant-calc.*/obs.* inputs below and elsewhere
// in this Questionnaire — no longer hand-typed.
* item[2].item[0].linkId = "obs.constant-score.pain"
* item[2].item[0].text = "Constant: Pain (0–15), calculated"
* item[2].item[0].type = #decimal
* item[2].item[0].readOnly = true
* item[2].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:Pain.value[x]"
* item[2].item[0].extension[0].url = $MAX_VALUE_EXT
* item[2].item[0].extension[0].valueDecimal = 15
* item[2].item[0].extension[1].url = $MIN_VALUE_EXT
* item[2].item[0].extension[1].valueDecimal = 0

* item[2].item[1].linkId = "obs.constant-score.adl"
* item[2].item[1].text = "Constant: Activities of Daily Living (0–20), calculated"
* item[2].item[1].type = #decimal
* item[2].item[1].readOnly = true
* item[2].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:ADL.value[x]"
* item[2].item[1].extension[0].url = $MAX_VALUE_EXT
* item[2].item[1].extension[0].valueDecimal = 20
* item[2].item[1].extension[1].url = $MIN_VALUE_EXT
* item[2].item[1].extension[1].valueDecimal = 0

* item[2].item[2].linkId = "obs.constant-score.rom"
* item[2].item[2].text = "Constant: Range of Motion (0–40), calculated"
* item[2].item[2].type = #decimal
* item[2].item[2].readOnly = true
* item[2].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:ROM.value[x]"
* item[2].item[2].extension[0].url = $MAX_VALUE_EXT
* item[2].item[2].extension[0].valueDecimal = 40
* item[2].item[2].extension[1].url = $MIN_VALUE_EXT
* item[2].item[2].extension[1].valueDecimal = 0

* item[2].item[3].linkId = "obs.constant-score.strength"
* item[2].item[3].text = "Constant: Strength (0–25), calculated"
* item[2].item[3].type = #decimal
* item[2].item[3].readOnly = true
* item[2].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:Strength.value[x]"
* item[2].item[3].extension[0].url = $MAX_VALUE_EXT
* item[2].item[3].extension[0].valueDecimal = 25
* item[2].item[3].extension[1].url = $MIN_VALUE_EXT
* item[2].item[3].extension[1].valueDecimal = 0

// Constant-Murley TOTAL — ADR-0158 (porting ADR-0113 to SDC): now readOnly
// unconditionally. calculatedExpression still drives the value (sums the
// four sub-scores above, only once all four have values, ADR-0118); the
// direct-total-entry mode ADR-0090 originally allowed is removed, same as
// the unified frontend's ADR-0113 fix.
* item[2].item[4].linkId = "obs.constant-score"
* item[2].item[4].text = "Constant-Murley Total (0–100), calculated from the four items above"
* item[2].item[4].type = #decimal
* item[2].item[4].readOnly = true
* item[2].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.value[x]"
* item[2].item[4].extension[0].url = $SDC_CALC_EXPR
* item[2].item[4].extension[0].valueExpression.language = #text/fhirpath
* item[2].item[4].extension[0].valueExpression.expression = "%resource.repeat(item).where(linkId.startsWith('obs.constant-score.')).answer.valueDecimal.sum()"
* item[2].item[4].extension[1].url = $MAX_VALUE_EXT
* item[2].item[4].extension[1].valueDecimal = 100
* item[2].item[4].extension[2].url = $MIN_VALUE_EXT
* item[2].item[4].extension[2].valueDecimal = 0

* item[2].item[5].linkId = "obs.ssv-score"
* item[2].item[5].text = "Subjective Shoulder Value (0–100)"
* item[2].item[5].type = #decimal
// RotatorCuffFollowUpBundle requires at least one Observation entry, so the form
// has to guarantee at least one measurement. The Subjective Shoulder Value is the
// single-question global outcome, the smallest answer that makes a follow-up
// visit a follow-up. The template-based sibling marks the same item required.
* item[2].item[5].required = true
* item[2].item[5].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation#Observation.value[x]"
* item[2].item[5].extension[0].url = $MAX_VALUE_EXT
* item[2].item[5].extension[0].valueDecimal = 100
* item[2].item[5].extension[1].url = $MIN_VALUE_EXT
* item[2].item[5].extension[1].valueDecimal = 0

* item[2].item[6].linkId = "obs.sane-score"
* item[2].item[6].text = "SANE Score (0–100)"
* item[2].item[6].type = #decimal
* item[2].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation#Observation.value[x]"
* item[2].item[6].extension[0].url = $MAX_VALUE_EXT
* item[2].item[6].extension[0].valueDecimal = 100
* item[2].item[6].extension[1].url = $MIN_VALUE_EXT
* item[2].item[6].extension[1].valueDecimal = 0

* item[2].item[7].linkId = "obs.patient-satisfaction"
* item[2].item[7].text = "Patient Satisfaction"
* item[2].item[7].type = #choice
* item[2].item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patient-satisfaction-observation#Observation.value[x]"
* item[2].item[7].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/satisfaction-scale"

* item[2].item[8].linkId = "obs.return-to-sport-work"
* item[2].item[8].text = "Return to Sport / Work"
* item[2].item[8].type = #choice
* item[2].item[8].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/return-to-activity-observation#Observation.value[x]"
* item[2].item[8].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/return-to-activity"

// ── Constant-Murley POOS-15 sub-item calculator inputs (ADR-0158) ─────────────
// UI-only — no item.definition, never extracted as a standalone resource. All
// seven manual here (unlike Registration, which auto-derives ADL-sleep from
// patient.sleepDisturbance) — Follow-Up captures no sleep/occupation/leisure/
// arm-use axis at all (ADR-0112's own scoping). Local pseudo-system, same as
// the Registration Questionnaire's identical items — see that file's fuller
// comment.
* item[2].item[9].linkId = "constant-calc.pain-normal-activities"
* item[2].item[9].text = "POOS-15: Pain, impact on normal activities"
* item[2].item[9].type = #choice
* item[2].item[9].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[2].item[9].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#mild "Mild"
* item[2].item[9].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[2].item[9].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[2].item[10].linkId = "constant-calc.adl-occupation"
* item[2].item[10].text = "POOS-15: ADL, occupation/daily-living limitation"
* item[2].item[10].type = #choice
* item[2].item[10].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[2].item[10].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[2].item[10].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[2].item[11].linkId = "constant-calc.adl-leisure"
* item[2].item[11].text = "POOS-15: ADL, leisure/recreation limitation"
* item[2].item[11].type = #choice
* item[2].item[11].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[2].item[11].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[2].item[11].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[2].item[12].linkId = "constant-calc.adl-sleep"
* item[2].item[12].text = "POOS-15: ADL, sleep disturbance (due to shoulder)"
* item[2].item[12].type = #choice
* item[2].item[12].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#unaffected "Unaffected"
* item[2].item[12].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#occasional "Occasionally disturbed"
* item[2].item[12].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#nightly "Nightly disturbed"

* item[2].item[13].linkId = "constant-calc.adl-arm-use"
* item[2].item[13].text = "POOS-15: ADL, painless arm-use ceiling"
* item[2].item[13].type = #choice
* item[2].item[13].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#waist "Waist"
* item[2].item[13].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#xiphoid "Xiphoid"
* item[2].item[13].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#neck "Neck"
* item[2].item[13].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#head "Head"
* item[2].item[13].answerOption[4].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head "Above head"

* item[2].item[14].linkId = "constant-calc.rom-external-rotation"
* item[2].item[14].text = "POOS-15: ROM, External Rotation functional position"
* item[2].item[14].type = #choice
* item[2].item[14].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#behind-head-elbow-forward "Hand behind head, elbow forward"
* item[2].item[14].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#behind-head-elbow-back "Hand behind head, elbow back"
* item[2].item[14].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head-elbow-forward "Hand above head, elbow forward"
* item[2].item[14].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head-elbow-back "Hand above head, elbow back"
* item[2].item[14].answerOption[4].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#full-elevation "Full elevation"

* item[2].item[15].linkId = "constant-calc.power-test"
* item[2].item[15].text = "POOS-15: Constant power test (kg, scaption-plane resisted abduction)"
* item[2].item[15].type = #decimal
* item[2].item[15].extension[0].url = $MAX_VALUE_EXT
* item[2].item[15].extension[0].valueDecimal = 50
* item[2].item[15].extension[1].url = $MIN_VALUE_EXT
* item[2].item[15].extension[1].valueDecimal = 0

// ── Re-imaging (Q13 exception) ────────────────────────────────────────────────
// definitionExtract: target a single ShoulderImagingStudy resource,
// only present at the research re-imaging timepoint — mirrors Registration
// Questionnaire's Q6 imaging group (ADR-0130). RotatorCuffFollowUpBundle's
// entry[imagingStudy] slice is 0..1; unlike the postOpExam/outcomeScores
// groups this one had no UI affordance on either frontend until now.
* item[3].linkId = "reimaging"
* item[3].text = "Re-imaging (optional)"
* item[3].type = #group
* item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy"
* item[3].extension[+].url = $SDC_DEF_EXTRACT
* item[3].extension[=].extension[+].url = "definition"
* item[3].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[3].extension[+].url = $SDC_EXTRACT_CTX
* item[3].extension[=].valueExpression.language = #application/x-fhir-query
* item[3].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study"

* item[3].item[0].linkId = "reimaging.modality"
* item[3].item[0].text = "Imaging Modality"
* item[3].item[0].type = #choice
* item[3].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.modality"
* item[3].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/imaging-modality"

// ── SDC extraction declarations ───────────────────────────────
// Generated. Placed after every literal item rule so the soft index [+] appends
// past any extension an item already declares. A profile reached by more than one
// item is declared once on their shared parent, so component slices fill one
// resource instead of producing one resource per component.

* insert DeclareObservationExistingSubject(item[1].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[10], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[11], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[12], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation)
* insert DeclareObservationExistingSubject(item[1].item[13], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation)
* insert DeclareObservationExistingSubject(item[1].item[14], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation)
* insert DeclareObservationExistingSubject(item[1].item[15], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation)
* insert DeclareObservationExistingSubject(item[1].item[16], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation)
* insert DeclareObservationExistingSubject(item[1].item[17], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation)
* insert DeclareObservationExistingSubject(item[1].item[18], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation)
* insert DeclareObservationExistingSubject(item[1].item[19], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation)
* insert DeclareObservationExistingSubject(item[1].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation)
* insert DeclareObservationExistingSubject(item[1].item[20], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation)
* insert DeclareObservationExistingSubject(item[1].item[21], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation)
* insert DeclareObservationExistingSubject(item[1].item[22], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation)
* insert DeclareObservationExistingSubject(item[1].item[23], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation)
* insert DeclareObservationExistingSubject(item[1].item[24], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation)
* insert DeclareObservationExistingSubject(item[1].item[25], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation)
* insert DeclareObservationExistingSubject(item[1].item[26], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation)
* insert DeclareObservationExistingSubject(item[1].item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation)
* insert DeclareObservationExistingSubject(item[1].item[3], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation)
* insert DeclareObservationExistingSubject(item[1].item[4], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation)
* insert DeclareObservationExistingSubject(item[1].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation)
* insert DeclareObservationExistingSubject(item[1].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation)
* insert DeclareObservationExistingSubject(item[1].item[9], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation)
* insert DeclareObservationExistingSubject(item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation)
* insert DeclareFocusExistingCondition(item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation)
* insert DeclareObservationExistingSubject(item[2].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation)
* insert DeclareFocusExistingCondition(item[2].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation)
* insert DeclareObservationExistingSubject(item[2].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation)
* insert DeclareFocusExistingCondition(item[2].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation)
* insert DeclareObservationExistingSubject(item[2].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patient-satisfaction-observation)
* insert DeclareFocusExistingCondition(item[2].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patient-satisfaction-observation)
* insert DeclareObservationExistingSubject(item[2].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/return-to-activity-observation)
* insert DeclareFocusExistingCondition(item[2].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/return-to-activity-observation)

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
* item[0].extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/v3-ActCode#AMB "ambulatory"

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

* item[3].extension[+].url = $SDC_DEF_VALUE
* item[3].extension[=].extension[+].url = "definition"
* item[3].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.status"
* item[3].extension[=].extension[+].url = "fixed-value"
* item[3].extension[=].extension[=].valueCode = #available

* item[3].extension[+].url = $SDC_DEF_VALUE
* item[3].extension[=].extension[+].url = "definition"
* item[3].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.subject.reference"
* item[3].extension[=].extension[+].url = "expression"
* item[3].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[3].extension[=].extension[=].valueExpression.expression = "%resource.subject.reference"

// ── The side, carried onto every observation that names a physical site ──
//    The side is answered once, in encounter.laterality. Each declaration sits on the item
//    whose definitionExtract creates the observation, so an engine that walks
//    down from that item finds it. Observations of the patient in general
//    (history, social history, aggregate scores) name no site and are absent here.
* insert DeclareBodySite(item[1].item[24], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[23], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[25], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[13], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[14], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[21], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[22], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[26], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[18], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[17], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[19], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[20], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[4], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[3], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[10], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[11], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[9], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[15], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[16], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation, encounter.laterality)
* insert DeclareBodySite(item[1].item[12], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation, encounter.laterality)
