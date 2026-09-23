// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Shoulder Registration Questionnaire (SDC)                                 │
// │  Pre-operative (T0) data capture → RotatorCuffRegistrationBundle           │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Usage: #definition — this is a form definition, not an example.
// SUSHI outputs this to ig/fsh-generated/resources/Questionnaire-shoulder-registration.json
// and the IG Publisher lists it under Artifacts.
//
// SDC conformance: parents from sdc-questionnaire-extr-defn (HL7 SDC IG v4.0.0
// "Extractable Questionnaire - Definition" — the definition-based extraction
// profile this IG implements).
// Every extracted resource is declared by a definitionExtract extension naming
// its target profile, on the item whose answers populate it, or at the root for
// a resource no question describes. Leaf items carry item.definition pointing at
// their target profile element, and definitionExtractValue supplies the values
// no question asks. A value has to sit on the item carrying the extract, or
// beneath it, because the specification's traversal scans down from there.
// Client-side extraction walks these to assemble a RotatorCuffRegistrationBundle
// (Patient + Condition + 0..* priorTreatment + 0..* Observation + …); the
// surgical procedure portion lives in a separate ShoulderSurgeryQuestionnaire
// per ADR-0034.
// The retired itemExtractionContext extension is declared alongside on the
// groups that predate definitionExtract, naming the same target profile, and is
// read only by the older definition-driven frontend. definitionExtract is
// authoritative.
//
// linkId convention:
//   <section>             — group items (one per FHIR resource type or
//                           per-leaf-extraction group)
//   <section>.<field>     — leaf question items
//   obs.<code>            — observation items (code matches ShoulderObservationCodes,
//                           LOINC, or SNOMED CT per ADR-0027)

Alias: $SCT = http://snomed.info/sct
Alias: $ADMIN_GENDER = http://hl7.org/fhir/administrative-gender
Alias: $IG = https://maxpurk.github.io/shoulder-on-fhir
Alias: $MAX_VALUE_EXT = http://hl7.org/fhir/StructureDefinition/maxValue
Alias: $MIN_VALUE_EXT = http://hl7.org/fhir/StructureDefinition/minValue
Alias: $SDC_CALC_EXPR = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression
Alias: $SDC_EXTRACT_CTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemExtractionContext
Alias: $SDC_DEF_EXTRACT = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtract
Alias: $SDC_DEF_VALUE = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtractValue
Alias: $SDC_ALLOC_ID = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extractAllocateId
Alias: $SDC_ENABLE_EXPR = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression
Alias: $ENC_SD = https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter

Instance: shoulder-registration
InstanceOf: Questionnaire
Usage: #definition
Title: "Shoulder Registry Registration (SDC)"
Description: """
SDC-conformant Questionnaire for the Shoulder on FHIR registry T0 (pre-operative)
submission. Captures expert consensus minimum dataset elements (Hurley et al. 2024) that
populate a RotatorCuffRegistrationBundle: Patient, RotatorCuffCondition, optional
prior non-surgical treatments (Q1.f), baseline clinical assessment (Q2),
baseline PROMs (Q12 a–g + preferred instruments), and unanimous-consensus Q1
patient-history items.

Surgical procedures are captured by ShoulderSurgeryQuestionnaire and post-
operative visits by ShoulderFollowUpQuestionnaire.

Extraction model: definition-based. Groups whose contents map to a single
resource carry an SDC definitionExtract extension naming the target
profile; leaf items carry item.definition pointing at their target element.

The Constant-Murley total item demonstrates SDC calculatedExpression. The
four sub-scores (pain 0–15, ADL 0–20, ROM 0–40, strength 0–25) are
read-only values computed from the granular worksheet inputs and captured
as Observation.component[] slices. The 0–100 total auto-computes via
FHIRPath as their sum, is read-only in the same way, and is captured as
Observation.valueQuantity.

"""

* meta.profile = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-defn"
* url = "https://maxpurk.github.io/shoulder-on-fhir/Questionnaire/shoulder-registration"
* version = "0.9.0"
// sdc-2: version present requires an accompanying versionAlgorithm (ADR-0120).
// [+]/[=] append syntax for consistency with the other two Questionnaires —
// a URL-bracket selector here would collide with any future [+]-appended
// extension's own index counter (see Surgery/FollowUp's launchContext).
* extension[+].url = "http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm"
* extension[=].valueCoding = http://hl7.org/fhir/version-algorithm#semver

// Named uuids for the resources the rest of the bundle references. Allocated
// at the root, so one value each for the whole extracted transaction bundle.
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "patientId"
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "encounterId"
* extension[+].url = $SDC_ALLOC_ID
* extension[=].valueString = "conditionId"

// The registration visit. No question describes it, so it is declared at the
// root: a root-level definitionExtract always extracts, even when no answer
// sits under it. Its required values are fixed here rather than asked.
* extension[+].url = $SDC_DEF_EXTRACT
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueCanonical = $ENC_SD
* extension[=].extension[+].url = "fullUrl"
* extension[=].extension[=].valueString = "%encounterId"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.status"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCode = #finished

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.class"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/v3-ActCode#AMB "ambulatory"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.type"
* extension[=].extension[+].url = "fixed-value"
* extension[=].extension[=].valueCoding = $SCT#185349003 "Encounter for check up"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.period.start"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "now()"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.subject.reference"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%patientId"

* extension[+].url = $SDC_DEF_VALUE
* extension[=].extension[+].url = "definition"
* extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter#Encounter.reasonReference.reference"
* extension[=].extension[+].url = "expression"
* extension[=].extension[=].valueExpression.language = #text/fhirpath
* extension[=].extension[=].valueExpression.expression = "%conditionId"

* name = "ShoulderRegistration"
* status = #draft
* subjectType = #Patient

// ── Patient Information ───────────────────────────────────────────────────────
// definitionExtract: target a single ShoulderPatient resource
* item[0].linkId = "patient"
* item[0].text = "Patient Information"
* item[0].type = #group
* item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient"
* item[0].extension[+].url = $SDC_DEF_EXTRACT
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient"
* item[0].extension[=].extension[+].url = "fullUrl"
* item[0].extension[=].extension[=].valueString = "%patientId"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[0].extension[+].url = $SDC_EXTRACT_CTX
* item[0].extension[=].valueExpression.language = #application/x-fhir-query
* item[0].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient"

* item[0].item[0].linkId = "patient.givenName"
* item[0].item[0].text = "Given Name"
* item[0].item[0].type = #string
* item[0].item[0].required = true
* item[0].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.name.given"

// The registry's own identifier for this patient. Required, and asked for here
// rather than assigned by whichever application submits, so two applications
// submitting the same patient agree on who that is.
* item[0].item[9].linkId = "patient.identifier"
* item[0].item[9].text = "Registry Patient ID"
* item[0].item[9].type = #string
* item[0].item[9].required = true

* item[0].item[1].linkId = "patient.familyName"
* item[0].item[1].text = "Family Name"
* item[0].item[1].type = #string
* item[0].item[1].required = true
* item[0].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.name.family"

* item[0].item[2].linkId = "patient.birthDate"
* item[0].item[2].text = "Date of Birth"
* item[0].item[2].type = #date
* item[0].item[2].required = true
* item[0].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.birthDate"

* item[0].item[3].linkId = "patient.gender"
* item[0].item[3].text = "Gender"
* item[0].item[3].type = #choice
* item[0].item[3].required = true
* item[0].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.gender"
* item[0].item[3].answerOption[0].valueCoding = $ADMIN_GENDER#male "Male"
* item[0].item[3].answerOption[1].valueCoding = $ADMIN_GENDER#female "Female"
* item[0].item[3].answerOption[2].valueCoding = $ADMIN_GENDER#other "Other"
* item[0].item[3].answerOption[3].valueCoding = $ADMIN_GENDER#unknown "Unknown"

// Sex Assigned at Birth (HL7 Gender Harmony RSG, ADR-0053, L3.A.6) — a loose
// leaf like coverage.workersCompensation: the generic per-element resolver
// (ADR-0103/ADR-0122) only reads a single leaf's own item.definition target;
// it has no mechanism to also fix a *sibling* element (here,
// extension[value] AND extension[type] both need setting from one answer,
// with type additionally fixed to LOINC 76689-9) the way
// resolveObservationFixedValues does for Observation.code/category
// specifically. Read out-of-band via findAnswerByLinkId and built by a small
// hardcoded helper in extractor.ts, same pattern as Coverage.
* item[0].item[4].linkId = "patient.sexAssignedAtBirth"
* item[0].item[4].text = "Sex Assigned at Birth"
* item[0].item[4].type = #choice
* item[0].item[4].answerOption[0].valueCoding = $ADMIN_GENDER#male "Male"
* item[0].item[4].answerOption[1].valueCoding = $ADMIN_GENDER#female "Female"
* item[0].item[4].answerOption[2].valueCoding = $ADMIN_GENDER#other "Other"
* item[0].item[4].answerOption[3].valueCoding = $ADMIN_GENDER#unknown "Unknown"

// Contact information. `patient.phone` is a loose leaf
// (no item.definition), same reason as Coverage/RSG above: base FHIR's
// `cpt-2` invariant ("a system is required if a value is provided") means
// `Patient.telecom.value` alone — with no sibling `system` — is not just
// imprecise but genuinely INVALID, and the generic per-element resolver
// has no mechanism to also fix a sibling element from one answer. Found
// live (ADR-0138) when a first attempt at a plain item.definition-based
// leaf failed pre-flight validation on this exact invariant; corrected to
// a hand-built ContactPoint (system=phone, use=home fixed, matching the
// unified frontend) in extractor.ts.
* item[0].item[5].linkId = "patient.phone"
* item[0].item[5].text = "Phone Number"
* item[0].item[5].type = #string

* item[0].item[6].linkId = "patient.street"
* item[0].item[6].text = "Street Address"
* item[0].item[6].type = #string
* item[0].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.address.line"

* item[0].item[7].linkId = "patient.postalCode"
* item[0].item[7].text = "Postal Code"
* item[0].item[7].type = #string
* item[0].item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.address.postalCode"

* item[0].item[8].linkId = "patient.city"
* item[0].item[8].text = "City"
* item[0].item[8].type = #string
* item[0].item[8].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.address.city"

// ── Diagnosis ─────────────────────────────────────────────────────────────────
// definitionExtract: target a single RotatorCuffCondition resource
* item[1].linkId = "condition"
* item[1].text = "Diagnosis"
* item[1].type = #group
* item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition"
* item[1].extension[+].url = $SDC_DEF_EXTRACT
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition"
* item[1].extension[=].extension[+].url = "fullUrl"
* item[1].extension[=].extension[=].valueString = "%conditionId"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[1].extension[+].url = $SDC_EXTRACT_CTX
* item[1].extension[=].valueExpression.language = #application/x-fhir-query
* item[1].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.subject.reference"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%patientId"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.encounter.reference"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "%encounterId"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.clinicalStatus"
* item[1].extension[=].extension[+].url = "fixed-value"
* item[1].extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/condition-clinical#active "Active"

* item[1].extension[+].url = $SDC_DEF_VALUE
* item[1].extension[=].extension[+].url = "definition"
* item[1].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.recordedDate"
* item[1].extension[=].extension[+].url = "expression"
* item[1].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[1].extension[=].extension[=].valueExpression.expression = "today()"

* item[1].item[0].linkId = "condition.diagnosis"
* item[1].item[0].text = "Rotator Cuff Diagnosis"
* item[1].item[0].type = #choice
* item[1].item[0].required = true
* item[1].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.code"
* item[1].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-diagnosis"

* item[1].item[1].linkId = "condition.laterality"
* item[1].item[1].text = "Affected Side"
* item[1].item[1].type = #choice
* item[1].item[1].required = true
* item[1].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.bodySite"
* item[1].item[1].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality"

* item[1].item[2].linkId = "condition.onsetDate"
* item[1].item[2].text = "Onset Date"
* item[1].item[2].type = #date
* item[1].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.onset[x]"

// Etiology classifier (expert consensus Q1.e) — post-coordinates causation onto whatever
// anatomic SNOMED code the user chose in condition.diagnosis. Required by
// profile (1..1); clinicians select "Unknown (origin)" rather than omit when
// causation is not determinable. See ADR-0046.
* item[1].item[3].linkId = "condition.etiology"
* item[1].item[3].text = "Etiology"
* item[1].item[3].type = #choice
* item[1].item[3].required = true
* item[1].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition#Condition.extension:dueTo"
* item[1].item[3].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-etiology"

// ── Prior Treatment (expert consensus Q1.f — physical therapy / injection) ────
// Replaces the prior surgical-procedure group (moved to ShoulderSurgeryQuestionnaire
// per ADR-0034). The priorTreatment group is REPEATABLE — each entry produces
// one RotatorCuffProcedure resource with category bound to PriorTreatmentCategory.
// The Registration bundle's required category binding rejects any surgical-
// category procedure submitted here.
* item[2].linkId = "priorTreatment"
* item[2].text = "Prior Non-Surgical Treatment (optional)"
* item[2].type = #group
* item[2].repeats = true
* item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure"
* item[2].extension[+].url = $SDC_DEF_EXTRACT
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[2].extension[+].url = $SDC_EXTRACT_CTX
* item[2].extension[=].valueExpression.language = #application/x-fhir-query
* item[2].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure"

* item[2].extension[+].url = $SDC_DEF_VALUE
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.subject.reference"
* item[2].extension[=].extension[+].url = "expression"
* item[2].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[2].extension[=].extension[=].valueExpression.expression = "%patientId"

* item[2].extension[+].url = $SDC_DEF_VALUE
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.encounter.reference"
* item[2].extension[=].extension[+].url = "expression"
* item[2].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[2].extension[=].extension[=].valueExpression.expression = "%encounterId"

* item[2].extension[+].url = $SDC_DEF_VALUE
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.status"
* item[2].extension[=].extension[+].url = "fixed-value"
* item[2].extension[=].extension[=].valueCode = #completed

* item[2].extension[+].url = $SDC_DEF_VALUE
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.reasonReference.reference"
* item[2].extension[=].extension[+].url = "expression"
* item[2].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[2].extension[=].extension[=].valueExpression.expression = "%conditionId"

* item[2].item[0].linkId = "priorTreatment.category"
* item[2].item[0].text = "Treatment Category"
* item[2].item[0].type = #choice
* item[2].item[0].required = true
* item[2].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.category"
* item[2].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-treatment-category"

// Narrowed to PriorNonSurgicalTreatmentType (ADR-0133) — the prior full
// RotatorCuffProcedureType binding let a clinician pick a surgical code
// (e.g. "Reverse total shoulder arthroplasty") for a question explicitly
// scoped to non-surgical treatment. The bundle-level category binding
// already prevented an invalid *bundle*, but not a semantically nonsensical
// code/category combination on a validly-shaped one.
* item[2].item[1].linkId = "priorTreatment.type"
* item[2].item[1].text = "Treatment Type"
* item[2].item[1].type = #choice
* item[2].item[1].required = true
* item[2].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.code"
* item[2].item[1].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-non-surgical-treatment-type"

// Exact treatment date removed (ADR-0133, porting ADR-0105 to SDC): judged
// clinically unhelpful by surgeon feedback and replaced by the bucketed
// session/injection counts below. `Procedure.performedDateTime` (FHIR-
// required 1..1) now defaults to today via extractor.ts's
// submissionDefaults() — see that module for why, and ADR-0105 for the
// original unified-frontend decision this ports.
* item[2].item[2].linkId = "priorTreatment.laterality"
* item[2].item[2].text = "Side (derived from Diagnosis)"
* item[2].item[2].type = #choice
* item[2].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.bodySite"
* item[2].item[2].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality"
// Laterality is captured once, on the Diagnosis step. This item is hidden and
// its value is derived from that answer via calculatedExpression, so
// Procedure.bodySite (1..1 required) stays populated without re-asking (single
// source of truth; portable — any SDC engine evaluates the expression).
* item[2].item[2].extension[0].url = "http://hl7.org/fhir/StructureDefinition/questionnaire-hidden"
* item[2].item[2].extension[0].valueBoolean = true
* item[2].item[2].extension[1].url = $SDC_CALC_EXPR
* item[2].item[2].extension[1].valueExpression.language = #text/fhirpath
* item[2].item[2].extension[1].valueExpression.expression = "%resource.repeat(item).where(linkId='condition.laterality').answer.valueCoding"

* item[3].linkId = "priorTreatmentFrequency"
* item[3].text = "Prior Treatment, Frequency (optional)"
* item[3].type = #group
* item[3].item[0].linkId = "obs.prior-physical-therapy-session-count"
* item[3].item[0].text = "Prior Physical Therapy, Number of Sessions"
* item[3].item[0].type = #choice
* item[3].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-physical-therapy-session-count-observation#Observation.value[x]"
* item[3].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-physical-therapy-session-count"
// How many sessions is a property of a therapy that happened, so the question is
// asked only once one is recorded above. Without the gate a session count is
// answerable, and extractable, with no physical therapy Procedure behind it.
// Expressed as an expression rather than enableWhen because the governing answer
// lives inside a repeating group, where R4 leaves it undefined which occurrence
// an enableWhen.question resolves against; the expression says "any of them".
* item[3].item[0].extension[0].url = $SDC_ENABLE_EXPR
* item[3].item[0].extension[0].valueExpression.language = #text/fhirpath
* item[3].item[0].extension[0].valueExpression.expression = "%resource.repeat(item).where(linkId='priorTreatment.type').answer.valueCoding.where(system='http://snomed.info/sct' and code='91251008').exists()"
* item[3].item[1].linkId = "obs.prior-injection-count"
* item[3].item[1].text = "Prior Shoulder Injection, Number of Injections"
* item[3].item[1].type = #choice
* item[3].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-injection-count-observation#Observation.value[x]"
* item[3].item[1].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-injection-count"
// Both injection codes PriorNonSurgicalTreatmentType offers count as an
// injection having happened.
* item[3].item[1].extension[0].url = $SDC_ENABLE_EXPR
* item[3].item[1].extension[0].valueExpression.language = #text/fhirpath
* item[3].item[1].extension[0].valueExpression.expression = "%resource.repeat(item).where(linkId='priorTreatment.type').answer.valueCoding.where(system='http://snomed.info/sct' and (code='27813003' or code='290035003')).exists()"

// ── Clinical Assessment ───────────────────────────────────────────────────────
// Each obs.* item maps to a separate ShoulderObservation child profile.
// The group has no single resource definition; extraction is per-leaf-item
// driven by item.definition. No definitionExtract on this group.
// ── Prior Treatment — Frequency ─────────────────────────────
// Session/injection counts for the prior treatment(s) above — kept adjacent to
// priorTreatment, not buried in patientHistory. No definitionExtract: each
// leaf self-extracts as its own Observation via item.definition.

* item[4].linkId = "clinicalAssessment"
* item[4].text = "Clinical Assessment"
* item[4].type = #group

// ROM — active angles
* item[4].item[0].linkId = "obs.abduction"
* item[4].item[0].text = "Active Abduction (°)"
* item[4].item[0].type = #decimal
* item[4].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation#Observation.value[x]"
* item[4].item[0].extension[0].url = $MAX_VALUE_EXT
* item[4].item[0].extension[0].valueDecimal = 180
* item[4].item[0].extension[1].url = $MIN_VALUE_EXT
* item[4].item[0].extension[1].valueDecimal = 0

* item[4].item[1].linkId = "obs.forward-flexion"
* item[4].item[1].text = "Active Forward Flexion (°)"
* item[4].item[1].type = #decimal
* item[4].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation#Observation.value[x]"
* item[4].item[1].extension[0].url = $MAX_VALUE_EXT
* item[4].item[1].extension[0].valueDecimal = 180
* item[4].item[1].extension[1].url = $MIN_VALUE_EXT
* item[4].item[1].extension[1].valueDecimal = 0

* item[4].item[2].linkId = "obs.external-rotation"
* item[4].item[2].text = "Active External Rotation, at side (°)"
* item[4].item[2].type = #decimal
* item[4].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation#Observation.value[x]"
* item[4].item[2].extension[0].url = $MAX_VALUE_EXT
* item[4].item[2].extension[0].valueDecimal = 360
* item[4].item[2].extension[1].url = $MIN_VALUE_EXT
* item[4].item[2].extension[1].valueDecimal = 0

// ADR-0088: at-side Internal Rotation redesigned from degrees to the
// "hand behind back" vertebral-level ordinal.
* item[4].item[3].linkId = "obs.internal-rotation"
* item[4].item[3].text = "Active Internal Rotation, at side (hand behind back)"
* item[4].item[3].type = #choice
* item[4].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation#Observation.value[x]"
* item[4].item[3].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/internal-rotation-vertebral-level"

// ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
* item[4].item[4].linkId = "obs.external-rotation-90-abduction"
* item[4].item[4].text = "Active External Rotation, at 90° abduction (°)"
* item[4].item[4].type = #decimal
* item[4].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation#Observation.value[x]"
* item[4].item[4].extension[0].url = $MAX_VALUE_EXT
* item[4].item[4].extension[0].valueDecimal = 360
* item[4].item[4].extension[1].url = $MIN_VALUE_EXT
* item[4].item[4].extension[1].valueDecimal = 0

* item[4].item[5].linkId = "obs.internal-rotation-90-abduction"
* item[4].item[5].text = "Active Internal Rotation, at 90° abduction (°)"
* item[4].item[5].type = #decimal
* item[4].item[5].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation#Observation.value[x]"
* item[4].item[5].extension[0].url = $MAX_VALUE_EXT
* item[4].item[5].extension[0].valueDecimal = 360
* item[4].item[5].extension[1].url = $MIN_VALUE_EXT
* item[4].item[5].extension[1].valueDecimal = 0

// Provocation Tests
* item[4].item[6].linkId = "obs.jobe-test"
* item[4].item[6].text = "Jobe Test (Supraspinatus)"
* item[4].item[6].type = #choice
* item[4].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation#Observation.value[x]"
* item[4].item[6].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[4].item[6].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[4].item[7].linkId = "obs.lift-off-test"
* item[4].item[7].text = "Lift-Off Test (Subscapularis)"
* item[4].item[7].type = #choice
* item[4].item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation#Observation.value[x]"
* item[4].item[7].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[4].item[7].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[4].item[8].linkId = "obs.belly-press-test"
* item[4].item[8].text = "Belly Press Test (Subscapularis)"
* item[4].item[8].type = #choice
* item[4].item[8].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation#Observation.value[x]"
* item[4].item[8].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[4].item[8].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[4].item[9].linkId = "obs.bear-hug-test"
* item[4].item[9].text = "Bear Hug Test (Subscapularis)"
* item[4].item[9].type = #choice
* item[4].item[9].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/bear-hug-test-observation#Observation.value[x]"
* item[4].item[9].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[4].item[9].answerOption[1].valueCoding = $SCT#260385009 "Negative"

// Patient characteristics captured as Observation
* item[4].item[10].linkId = "obs.hand-dominance"
* item[4].item[10].text = "Hand Dominance"
* item[4].item[10].type = #choice
* item[4].item[10].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hand-dominance-observation#Observation.value[x]"
* item[4].item[10].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/hand-dominance"

// ROM — passive angles
* item[4].item[11].linkId = "obs.passive-abduction"
* item[4].item[11].text = "Passive Abduction (°)"
* item[4].item[11].type = #decimal
* item[4].item[11].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation#Observation.value[x]"
* item[4].item[11].extension[0].url = $MAX_VALUE_EXT
* item[4].item[11].extension[0].valueDecimal = 180
* item[4].item[11].extension[1].url = $MIN_VALUE_EXT
* item[4].item[11].extension[1].valueDecimal = 0

* item[4].item[12].linkId = "obs.passive-forward-flexion"
* item[4].item[12].text = "Passive Forward Flexion (°)"
* item[4].item[12].type = #decimal
* item[4].item[12].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation#Observation.value[x]"
* item[4].item[12].extension[0].url = $MAX_VALUE_EXT
* item[4].item[12].extension[0].valueDecimal = 180
* item[4].item[12].extension[1].url = $MIN_VALUE_EXT
* item[4].item[12].extension[1].valueDecimal = 0

* item[4].item[13].linkId = "obs.passive-external-rotation"
* item[4].item[13].text = "Passive External Rotation, at side (°)"
* item[4].item[13].type = #decimal
* item[4].item[13].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation#Observation.value[x]"
* item[4].item[13].extension[0].url = $MAX_VALUE_EXT
* item[4].item[13].extension[0].valueDecimal = 360
* item[4].item[13].extension[1].url = $MIN_VALUE_EXT
* item[4].item[13].extension[1].valueDecimal = 0

// ADR-0088: at-side Internal Rotation redesigned from degrees to the
// "hand behind back" vertebral-level ordinal.
* item[4].item[14].linkId = "obs.passive-internal-rotation"
* item[4].item[14].text = "Passive Internal Rotation, at side (hand behind back)"
* item[4].item[14].type = #choice
* item[4].item[14].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation#Observation.value[x]"
* item[4].item[14].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/internal-rotation-vertebral-level"

// ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
* item[4].item[15].linkId = "obs.passive-external-rotation-90-abduction"
* item[4].item[15].text = "Passive External Rotation, at 90° abduction (°)"
* item[4].item[15].type = #decimal
* item[4].item[15].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation#Observation.value[x]"
* item[4].item[15].extension[0].url = $MAX_VALUE_EXT
* item[4].item[15].extension[0].valueDecimal = 360
* item[4].item[15].extension[1].url = $MIN_VALUE_EXT
* item[4].item[15].extension[1].valueDecimal = 0

* item[4].item[16].linkId = "obs.passive-internal-rotation-90-abduction"
* item[4].item[16].text = "Passive Internal Rotation, at 90° abduction (°)"
* item[4].item[16].type = #decimal
* item[4].item[16].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation#Observation.value[x]"
* item[4].item[16].extension[0].url = $MAX_VALUE_EXT
* item[4].item[16].extension[0].valueDecimal = 360
* item[4].item[16].extension[1].url = $MIN_VALUE_EXT
* item[4].item[16].extension[1].valueDecimal = 0

// Muscle Strength (MMT 0–5)
* item[4].item[17].linkId = "obs.supraspinatus-strength"
* item[4].item[17].text = "Supraspinatus Strength (MMT 0–5)"
* item[4].item[17].type = #decimal
* item[4].item[17].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation#Observation.value[x]"
* item[4].item[17].extension[0].url = $MAX_VALUE_EXT
* item[4].item[17].extension[0].valueDecimal = 5
* item[4].item[17].extension[1].url = $MIN_VALUE_EXT
* item[4].item[17].extension[1].valueDecimal = 0

* item[4].item[18].linkId = "obs.external-rotation-strength"
* item[4].item[18].text = "External Rotation Strength (MMT 0–5, Janda)"
* item[4].item[18].type = #decimal
* item[4].item[18].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation#Observation.value[x]"
* item[4].item[18].extension[0].url = $MAX_VALUE_EXT
* item[4].item[18].extension[0].valueDecimal = 5
* item[4].item[18].extension[1].url = $MIN_VALUE_EXT
* item[4].item[18].extension[1].valueDecimal = 0

// ADR-0089: surgeon feedback — Internal Rotation strength (mirror position
// of External Rotation) and Supraspinatus dynamometry, new alongside the
// existing ordinal grades.
* item[4].item[19].linkId = "obs.internal-rotation-strength"
* item[4].item[19].text = "Internal Rotation Strength (MMT 0–5, Janda)"
* item[4].item[19].type = #decimal
* item[4].item[19].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation#Observation.value[x]"
* item[4].item[19].extension[0].url = $MAX_VALUE_EXT
* item[4].item[19].extension[0].valueDecimal = 5
* item[4].item[19].extension[1].url = $MIN_VALUE_EXT
* item[4].item[19].extension[1].valueDecimal = 0

* item[4].item[20].linkId = "obs.supraspinatus-strength-dynamometry"
* item[4].item[20].text = "Supraspinatus Strength (Dynamometry, kg)"
* item[4].item[20].type = #decimal
* item[4].item[20].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation#Observation.value[x]"
* item[4].item[20].extension[0].url = $MAX_VALUE_EXT
* item[4].item[20].extension[0].valueDecimal = 50
* item[4].item[20].extension[1].url = $MIN_VALUE_EXT
* item[4].item[20].extension[1].valueDecimal = 0

// Imaging finding
* item[4].item[21].linkId = "obs.tear-size"
* item[4].item[21].text = "Tear Size (cm)"
* item[4].item[21].type = #decimal
* item[4].item[21].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-observation#Observation.value[x]"
* item[4].item[21].extension[0].url = $MAX_VALUE_EXT
* item[4].item[21].extension[0].valueDecimal = 10
* item[4].item[21].extension[1].url = $MIN_VALUE_EXT
* item[4].item[21].extension[1].valueDecimal = 0

* item[4].item[22].linkId = "obs.tear-size-classification"
* item[4].item[22].text = "Tear Size Classification (Cofield)"
* item[4].item[22].type = #choice
* item[4].item[22].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-classification-observation#Observation.value[x]"
* item[4].item[22].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/cofield-tear-size-classification"

* item[4].item[23].linkId = "obs.hornblower-test"
* item[4].item[23].text = "Hornblower Test (Teres Minor)"
* item[4].item[23].type = #choice
* item[4].item[23].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hornblower-test-observation#Observation.value[x]"
* item[4].item[23].answerOption[0].valueCoding = $SCT#10828004 "Positive"
* item[4].item[23].answerOption[1].valueCoding = $SCT#260385009 "Negative"

* item[4].item[24].linkId = "obs.atrophy"
* item[4].item[24].text = "Atrophy"
* item[4].item[24].type = #choice
* item[4].item[24].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation#Observation.value[x]"
* item[4].item[24].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[4].item[24].answerOption[1].valueCoding = $SCT#2667000 "Absent"

* item[4].item[25].linkId = "obs.deformity"
* item[4].item[25].text = "Deformity"
* item[4].item[25].type = #choice
* item[4].item[25].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation#Observation.value[x]"
* item[4].item[25].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[4].item[25].answerOption[1].valueCoding = $SCT#2667000 "Absent"

* item[4].item[26].linkId = "obs.normal-shoulder-contour"
* item[4].item[26].text = "Normal Shoulder Contour"
* item[4].item[26].type = #choice
* item[4].item[26].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation#Observation.value[x]"
* item[4].item[26].answerOption[0].valueCoding = $SCT#52101004 "Present"
* item[4].item[26].answerOption[1].valueCoding = $SCT#2667000 "Absent"

* item[4].item[27].linkId = "obs.pain-average"
* item[4].item[27].text = "Pain Severity, On Average (0–10)"
* item[4].item[27].type = #decimal
* item[4].item[27].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation#Observation.value[x]"
* item[4].item[27].extension[0].url = $MAX_VALUE_EXT
* item[4].item[27].extension[0].valueDecimal = 10
* item[4].item[27].extension[1].url = $MIN_VALUE_EXT
* item[4].item[27].extension[1].valueDecimal = 0

* item[4].item[28].linkId = "obs.pain-active-movement"
* item[4].item[28].text = "Pain Severity, With Active Movement (0–10)"
* item[4].item[28].type = #decimal
* item[4].item[28].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation#Observation.value[x]"
* item[4].item[28].extension[0].url = $MAX_VALUE_EXT
* item[4].item[28].extension[0].valueDecimal = 10
* item[4].item[28].extension[1].url = $MIN_VALUE_EXT
* item[4].item[28].extension[1].valueDecimal = 0

* item[4].item[29].linkId = "obs.pain-passive-movement"
* item[4].item[29].text = "Pain Severity, With Passive Movement (0–10)"
* item[4].item[29].type = #decimal
* item[4].item[29].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation#Observation.value[x]"
* item[4].item[29].extension[0].url = $MAX_VALUE_EXT
* item[4].item[29].extension[0].valueDecimal = 10
* item[4].item[29].extension[1].url = $MIN_VALUE_EXT
* item[4].item[29].extension[1].valueDecimal = 0

* item[4].item[30].linkId = "obs.pain-rest"
* item[4].item[30].text = "Pain Severity, At Rest (0–10)"
* item[4].item[30].type = #decimal
* item[4].item[30].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation#Observation.value[x]"
* item[4].item[30].extension[0].url = $MAX_VALUE_EXT
* item[4].item[30].extension[0].valueDecimal = 10
* item[4].item[30].extension[1].url = $MIN_VALUE_EXT
* item[4].item[30].extension[1].valueDecimal = 0

// Tendons involved (expert consensus Q4.b) — ADR-0064. Each selected tendon produces a
// separate TendonsInvolvedObservation linked from RotatorCuffCondition.evidence.detail.
// Moved out of the condition group (where it incorrectly targeted Condition.bodySite)
// to this per-leaf-extraction group so the extractor creates one Observation per answer.
* item[4].item[31].linkId = "obs.tendons-involved"
* item[4].item[31].text = "Tendons Involved"
* item[4].item[31].type = #choice
* item[4].item[31].repeats = true
* item[4].item[31].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tendons-involved-observation#Observation.value[x]"
* item[4].item[31].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tendons-involved"

// Muscle Strength (MMT 0-5) — subscapularis-specific isolation test (lift-off/
// belly-press position), distinct from the composite InternalRotationStrength
// above. Present in both frontends per ADR-0144; ADR-0089 records why it
// was needed.
* item[4].item[32].linkId = "obs.subscapularis-strength"
* item[4].item[32].text = "Subscapularis Strength (MMT 0–5)"
* item[4].item[32].type = #decimal
* item[4].item[32].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation#Observation.value[x]"
* item[4].item[32].extension[0].url = $MAX_VALUE_EXT
* item[4].item[32].extension[0].valueDecimal = 5
* item[4].item[32].extension[1].url = $MIN_VALUE_EXT
* item[4].item[32].extension[1].valueDecimal = 0

// Tear Thickness / Location (expert consensus Q4.c) — imaging-category Observations,
// generically wired into Condition.evidence.detail by bundleAssembler.ts's
// isImagingObservation() check (same mechanism as tear-size-classification
// and tendons-involved above — no extractor/assembler changes needed).
* item[4].item[33].linkId = "obs.tear-thickness"
* item[4].item[33].text = "Tear Thickness"
* item[4].item[33].type = #choice
* item[4].item[33].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-thickness-observation#Observation.value[x]"
* item[4].item[33].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tear-thickness"

* item[4].item[34].linkId = "obs.tear-location"
* item[4].item[34].text = "Tear Location"
* item[4].item[34].type = #choice
* item[4].item[34].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-location-observation#Observation.value[x]"
* item[4].item[34].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tear-location"

// Patte / Goutallier classification — moved here from SDC's Surgery
// questionnaire (ADR-0140): unified only ever captured these pre-operatively,
// from imaging, at Registration; SDC previously captured them intra-
// operatively, from direct inspection, at Surgery — same nominal "Patte"/
// "Goutallier" mapping row either way, but a different clinical timepoint
// and method per frontend, which made the same classification mean different
// things depending on which frontend a patient went through. Registration,
// imaging-based staging is canonical for both (StepImaging.tsx).
* item[4].item[35].linkId = "obs.patte-classification"
* item[4].item[35].text = "Patte Tendon Retraction Grade"
* item[4].item[35].type = #choice
* item[4].item[35].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patte-observation#Observation.value[x]"
* item[4].item[35].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/patte-classification"

* item[4].item[36].linkId = "obs.goutallier-classification"
* item[4].item[36].text = "Goutallier Fatty Infiltration Grade"
* item[4].item[36].type = #choice
* item[4].item[36].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/goutallier-observation#Observation.value[x]"
* item[4].item[36].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/goutallier-classification"

// ── Patient History (expert consensus Q1 unanimous consensus) ────────────────────────────
// Per-leaf extraction; each item → its own Observation.
* item[5].linkId = "patientHistory"
* item[5].text = "Patient History (expert consensus Q1)"
* item[5].type = #group

* item[5].item[0].linkId = "obs.smoking-status"
* item[5].item[0].text = "Smoking Status"
* item[5].item[0].type = #choice
* item[5].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-status-observation#Observation.value[x]"
* item[5].item[0].answerValueSet = "http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips"

// Sibling to smoking-status, not a replacement (ADR-0105/ADR-0133): cumulative
// dose (pack-years) vs current category. Only meaningful for current/former
// smokers.
* item[5].item[1].linkId = "obs.smoking-pack-years"
* item[5].item[1].text = "Pack-Years"
* item[5].item[1].type = #decimal
* item[5].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-pack-years-observation#Observation.value[x]"
* item[5].item[1].extension[0].url = $MIN_VALUE_EXT
* item[5].item[1].extension[0].valueDecimal = 0

* item[5].item[2].linkId = "obs.employment-status"
* item[5].item[2].text = "Employment Status"
* item[5].item[2].type = #choice
* item[5].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/employment-status-observation#Observation.value[x]"
* item[5].item[2].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/employment-status"

* item[5].item[3].linkId = "obs.occupational-physical-demand"
* item[5].item[3].text = "Occupational Physical Demand"
* item[5].item[3].type = #choice
* item[5].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-physical-demand-observation#Observation.value[x]"
* item[5].item[3].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/occupational-physical-demand"

// Independent axis from physical-demand intensity (ADR-0105/ADR-0133): an
// occupation can be simultaneously heavy-manual AND overhead-exposed (e.g. a
// roofer) — the two can co-occur, so they're captured separately.
* item[5].item[4].linkId = "obs.occupational-overhead-exposure"
* item[5].item[4].text = "Occupational Overhead Work"
* item[5].item[4].type = #choice
* item[5].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-overhead-exposure-observation#Observation.value[x]"
* item[5].item[4].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/occupational-overhead-exposure"

* item[5].item[5].linkId = "obs.sleep-disturbance"
* item[5].item[5].text = "Sleep Disturbance (due to shoulder)"
* item[5].item[5].type = #choice
* item[5].item[5].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sleep-disturbance-observation#Observation.value[x]"
* item[5].item[5].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/sleep-disturbance-severity"

* item[5].item[6].linkId = "obs.sports-participation"
* item[5].item[6].text = "Sports Participation"
* item[5].item[6].type = #choice
* item[5].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sports-participation-observation#Observation.value[x]"
* item[5].item[6].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/sports-participation-level"

* item[5].item[7].linkId = "obs.functional-limitations"
* item[5].item[7].text = "Functional Limitations"
* item[5].item[7].type = #choice
* item[5].item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/functional-limitations-observation#Observation.value[x]"
* item[5].item[7].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/functional-limitation-severity"

// Bucketed prior-treatment counts (ADR-0105/ADR-0133), replacing the exact
// treatment date removed from the priorTreatment group above. Per-leaf
// Observations, independent of the priorTreatment Procedure group above (an
// extraction-context group's children can only target that group's
// own resource type — these target a different profile, so they must live
// in this per-leaf-extraction group instead, not nested inside priorTreatment).


// Workers' compensation (expert consensus Q1.l) — a "loose leaf" like encounter.timepoint
// in ShoulderFollowUpQuestionnaire: no item.definition, since the answer
// doesn't populate a single resource element but instead gates whether a
// whole separate ShoulderCoverage resource is emitted at all (Coverage.type
// is fixed to v3-ActCode#WCBPOL by the extractor, not derived from an
// answer — see ADR-0061 / ADR-0131).
* item[5].item[8].linkId = "coverage.workersCompensation"
* item[5].item[8].text = "Workers' Compensation / Berufsgenossenschaft"
* item[5].item[8].type = #choice
* item[5].item[8].answerOption[0].valueString = "Yes"
* item[5].item[8].answerOption[1].valueString = "No"
* item[5].item[8].answerOption[2].valueString = "Unknown"

// Comorbidities (expert consensus Q1.c, ADR-0055/ADR-0084). `#open-choice` + `repeats` + a SNOMED implicit-VS
// answerValueSet (all descendants of `404684003` Clinical finding, same as
// unified's typeahead) signals free-text search rather than a bounded
// dropdown — SDC's QuestionnaireForm.tsx renders this as a typeahead
// (SnomedTypeahead component, ADR-0137) instead of the checkbox list used
// for smaller repeating `#choice` items like tendons-involved, since the
// underlying VS is far too large to `$expand` and render as options.
// No item.definition: like Coverage/RSG above, the target profile
// (ShoulderComorbidityCondition) needs fixed values (category =
// problem-list-item) the generic per-element resolver doesn't derive for
// Condition, so extraction is hand-built in extractor.ts.
* item[5].item[9].linkId = "obs.comorbidities"
* item[5].item[9].text = "Comorbidities (non-shoulder)"
* item[5].item[9].type = #open-choice
* item[5].item[9].repeats = true
* item[5].item[9].answerValueSet = "http://snomed.info/sct?fhir_vs=isa/404684003"

// Only consulted when the typeahead above is left empty at submission —
// distinguishes "asked, none reported" from "not asked / no information",
// matching the unified frontend's tri-state comorbidityStatus semantics.
* item[5].item[10].linkId = "comorbidity.absentReason"
* item[5].item[10].text = "If no specific comorbidities entered above"
* item[5].item[10].type = #choice
* item[5].item[10].answerOption[0].valueCoding = http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips#no-known-problems "No known problems"
* item[5].item[10].answerOption[1].valueCoding = http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips#no-problem-info "No information about problems"

// ── Outcome Scores ────────────────────────────────────────────────────────────
// Per-leaf extraction. The Constant-Murley total is computed via SDC
// calculatedExpression from four sub-scores (pain / ADL / ROM / strength).
* item[6].linkId = "outcomeScores"
* item[6].text = "Outcome Scores"
* item[6].type = #group

// Constant-Murley sub-scores — captured as Observation.component slices on
// ConstantScoreObservation. ADR-0158 (porting ADR-0112's POOS-15 calculator
// + ADR-0113's read-only fix to SDC): these four are now calculated,
// read-only outputs of QuestionnaireForm.tsx's live calculator effect,
// driven by the granular constant-calc.*/obs.* inputs below and elsewhere
// in this Questionnaire — no longer hand-typed. readOnly = true is the SDC
// spec's own mechanism for this (QuestionnaireForm.tsx already respects an
// explicit item.readOnly regardless of calculatedExpression presence).
* item[6].item[0].linkId = "obs.constant-score.pain"
* item[6].item[0].text = "Constant: Pain (0–15), calculated"
* item[6].item[0].type = #decimal
* item[6].item[0].readOnly = true
* item[6].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:Pain.value[x]"
* item[6].item[0].extension[0].url = $MAX_VALUE_EXT
* item[6].item[0].extension[0].valueDecimal = 15
* item[6].item[0].extension[1].url = $MIN_VALUE_EXT
* item[6].item[0].extension[1].valueDecimal = 0

* item[6].item[1].linkId = "obs.constant-score.adl"
* item[6].item[1].text = "Constant: Activities of Daily Living (0–20), calculated"
* item[6].item[1].type = #decimal
* item[6].item[1].readOnly = true
* item[6].item[1].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:ADL.value[x]"
* item[6].item[1].extension[0].url = $MAX_VALUE_EXT
* item[6].item[1].extension[0].valueDecimal = 20
* item[6].item[1].extension[1].url = $MIN_VALUE_EXT
* item[6].item[1].extension[1].valueDecimal = 0

* item[6].item[2].linkId = "obs.constant-score.rom"
* item[6].item[2].text = "Constant: Range of Motion (0–40), calculated"
* item[6].item[2].type = #decimal
* item[6].item[2].readOnly = true
* item[6].item[2].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:ROM.value[x]"
* item[6].item[2].extension[0].url = $MAX_VALUE_EXT
* item[6].item[2].extension[0].valueDecimal = 40
* item[6].item[2].extension[1].url = $MIN_VALUE_EXT
* item[6].item[2].extension[1].valueDecimal = 0

* item[6].item[3].linkId = "obs.constant-score.strength"
* item[6].item[3].text = "Constant: Strength (0–25), calculated"
* item[6].item[3].type = #decimal
* item[6].item[3].readOnly = true
* item[6].item[3].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.component:Strength.value[x]"
* item[6].item[3].extension[0].url = $MAX_VALUE_EXT
* item[6].item[3].extension[0].valueDecimal = 25
* item[6].item[3].extension[1].url = $MIN_VALUE_EXT
* item[6].item[3].extension[1].valueDecimal = 0

// Constant-Murley TOTAL — ADR-0158 (porting ADR-0113 to SDC): now readOnly
// unconditionally. calculatedExpression still drives the value (sums the
// four sub-scores above, only once all four have values, ADR-0118); the
// direct-total-entry mode ADR-0090 originally allowed is removed, same as
// the unified frontend's ADR-0113 fix, since it was the mechanism that let
// an out-of-range value bypass every clamp downstream of it.
* item[6].item[4].linkId = "obs.constant-score"
* item[6].item[4].text = "Constant-Murley Total (0–100), calculated from the four items above"
* item[6].item[4].type = #decimal
* item[6].item[4].readOnly = true
* item[6].item[4].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation#Observation.value[x]"
* item[6].item[4].extension[0].url = $SDC_CALC_EXPR
* item[6].item[4].extension[0].valueExpression.language = #text/fhirpath
* item[6].item[4].extension[0].valueExpression.expression = "%resource.repeat(item).where(linkId.startsWith('obs.constant-score.')).answer.valueDecimal.sum()"
* item[6].item[4].extension[1].url = $MAX_VALUE_EXT
* item[6].item[4].extension[1].valueDecimal = 100
* item[6].item[4].extension[2].url = $MIN_VALUE_EXT
* item[6].item[4].extension[2].valueDecimal = 0

* item[6].item[5].linkId = "obs.ssv-score"
* item[6].item[5].text = "Subjective Shoulder Value (0–100)"
* item[6].item[5].type = #decimal
* item[6].item[5].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation#Observation.value[x]"
* item[6].item[5].extension[0].url = $MAX_VALUE_EXT
* item[6].item[5].extension[0].valueDecimal = 100
* item[6].item[5].extension[1].url = $MIN_VALUE_EXT
* item[6].item[5].extension[1].valueDecimal = 0

* item[6].item[6].linkId = "obs.sane-score"
* item[6].item[6].text = "SANE Score (0–100)"
* item[6].item[6].type = #decimal
* item[6].item[6].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation#Observation.value[x]"
* item[6].item[6].extension[0].url = $MAX_VALUE_EXT
* item[6].item[6].extension[0].valueDecimal = 100
* item[6].item[6].extension[1].url = $MIN_VALUE_EXT
* item[6].item[6].extension[1].valueDecimal = 0

// ── Constant-Murley POOS-15 sub-item calculator inputs (ADR-0158) ─────────────
// UI-only — no item.definition, never extracted as a standalone resource.
// Ported from the unified frontend's calculator (ADR-0112, shared/constantScore.ts):
// Pain-item-1, ADL-occupation/leisure/arm-use, ROM-external-rotation, and the
// Constant power test all have no FHIR home of their own — they exist only
// to compute the four obs.constant-score.* sub-scores above (item[6].item[0-3]),
// client-side, via QuestionnaireForm.tsx's live calculation effect. Sleep is
// NOT repeated here — Registration already captures patient.sleepDisturbance
// (patientHistory group above), auto-deriving the ADL sleep sub-item from it.
// Local pseudo-system: these codes are never submitted, so no real CodeSystem
// is registered for them — the code value itself is all the calculator reads.
* item[6].item[7].linkId = "constant-calc.pain-normal-activities"
* item[6].item[7].text = "POOS-15: Pain, impact on normal activities"
* item[6].item[7].type = #choice
* item[6].item[7].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[6].item[7].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#mild "Mild"
* item[6].item[7].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[6].item[7].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[6].item[8].linkId = "constant-calc.adl-occupation"
* item[6].item[8].text = "POOS-15: ADL, occupation/daily-living limitation"
* item[6].item[8].type = #choice
* item[6].item[8].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[6].item[8].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[6].item[8].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[6].item[9].linkId = "constant-calc.adl-leisure"
* item[6].item[9].text = "POOS-15: ADL, leisure/recreation limitation"
* item[6].item[9].type = #choice
* item[6].item[9].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#none "None"
* item[6].item[9].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#moderate "Moderate"
* item[6].item[9].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#severe "Severe"

* item[6].item[10].linkId = "constant-calc.adl-arm-use"
* item[6].item[10].text = "POOS-15: ADL, painless arm-use ceiling"
* item[6].item[10].type = #choice
* item[6].item[10].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#waist "Waist"
* item[6].item[10].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#xiphoid "Xiphoid"
* item[6].item[10].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#neck "Neck"
* item[6].item[10].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#head "Head"
* item[6].item[10].answerOption[4].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head "Above head"

* item[6].item[11].linkId = "constant-calc.rom-external-rotation"
* item[6].item[11].text = "POOS-15: ROM, External Rotation functional position"
* item[6].item[11].type = #choice
* item[6].item[11].answerOption[0].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#behind-head-elbow-forward "Hand behind head, elbow forward"
* item[6].item[11].answerOption[1].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#behind-head-elbow-back "Hand behind head, elbow back"
* item[6].item[11].answerOption[2].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head-elbow-forward "Hand above head, elbow forward"
* item[6].item[11].answerOption[3].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#above-head-elbow-back "Hand above head, elbow back"
* item[6].item[11].answerOption[4].valueCoding = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input#full-elevation "Full elevation"

* item[6].item[12].linkId = "constant-calc.power-test"
* item[6].item[12].text = "POOS-15: Constant power test (kg, scaption-plane resisted abduction)"
* item[6].item[12].type = #decimal
* item[6].item[12].extension[0].url = $MAX_VALUE_EXT
* item[6].item[12].extension[0].valueDecimal = 50
* item[6].item[12].extension[1].url = $MIN_VALUE_EXT
* item[6].item[12].extension[1].valueDecimal = 0

// Patient Satisfaction and Return to Sport/Work are Follow-Up-only concepts
// (Q8.e / Q12.e / Q12.g are all mapped Timepoint=FollowUp) — both ask about
// treatment retrospectively and have no referent before surgery has
// happened. Previously duplicated here at Registration; removed per
// ADR-0091.

// ── Imaging ───────────────────────────────────────────────────────────────────
// definitionExtract: extract one ShoulderImagingStudy per modality obtained
// (Q3 radiograph / Q5-Q6 MRI-CT / Q7 ultrasound). The registry-capturable fact
// is which modality was used; the consensus names no imaging order or radiology
// report object, so none is produced.
* item[7].linkId = "imaging"
* item[7].text = "Imaging"
* item[7].type = #group
* item[7].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy"
* item[7].extension[+].url = $SDC_DEF_EXTRACT
* item[7].extension[=].extension[+].url = "definition"
* item[7].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[7].extension[+].url = $SDC_EXTRACT_CTX
* item[7].extension[=].valueExpression.language = #application/x-fhir-query
* item[7].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study"

* item[7].extension[+].url = $SDC_DEF_VALUE
* item[7].extension[=].extension[+].url = "definition"
* item[7].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.subject.reference"
* item[7].extension[=].extension[+].url = "expression"
* item[7].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[7].extension[=].extension[=].valueExpression.expression = "%patientId"

* item[7].extension[+].url = $SDC_DEF_VALUE
* item[7].extension[=].extension[+].url = "definition"
* item[7].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.encounter.reference"
* item[7].extension[=].extension[+].url = "expression"
* item[7].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[7].extension[=].extension[=].valueExpression.expression = "%encounterId"

* item[7].extension[+].url = $SDC_DEF_VALUE
* item[7].extension[=].extension[+].url = "definition"
* item[7].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.status"
* item[7].extension[=].extension[+].url = "fixed-value"
* item[7].extension[=].extension[=].valueCode = #available

// ADR-0155: repeats = true — a patient can have both a plain radiograph
// (Q3, DX) and an advanced study (Q6, MR/CT/US); ImagingStudy.modality is
// itself 0..* on base R4, so multiple answers map straight onto the array.
* item[7].item[0].linkId = "imaging.modality"
* item[7].item[0].text = "Imaging Modality"
* item[7].item[0].type = #choice
* item[7].item[0].repeats = true
* item[7].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study#ImagingStudy.modality"
* item[7].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/imaging-modality"

// ── Additional (non-rotator-cuff) Diagnosis (ADR-0145) ────────────────────────
// Parity port of the unified frontend's repeatable "+ Add another diagnosis"
// (StepCondition.tsx, ADR-0077) — was entirely absent from this Questionnaire.
// Repeatable group (0..*, RotatorCuffRegistrationBundle.otherDiagnosis) — same
// repeating-group mechanism Surgery's concomitant procedures already use
// (ADR-0141). bodySite is NOT asked here: the profile requires it to match
// the laterality of the RotatorCuffCondition(s) in the same bundle
// (ShoulderDiagnosisCondition.fsh's own documented invariant), so
// bundleAssembler.ts copies it from the already-resolved main Condition
// rather than risking a mismatched second answer.
* item[8].linkId = "otherDiagnosis"
* item[8].text = "Additional Diagnosis (optional)"
* item[8].type = #group
* item[8].repeats = true
* item[8].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition"
* item[8].extension[+].url = $SDC_DEF_EXTRACT
* item[8].extension[=].extension[+].url = "definition"
* item[8].extension[=].extension[=].valueCanonical = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition"
// Retired extension kept alongside the current one so the existing
// definition-driven frontend, which reads only this, keeps working.
* item[8].extension[+].url = $SDC_EXTRACT_CTX
* item[8].extension[=].valueExpression.language = #application/x-fhir-query
* item[8].extension[=].valueExpression.expression = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition"

* item[8].extension[+].url = $SDC_DEF_VALUE
* item[8].extension[=].extension[+].url = "definition"
* item[8].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition.subject.reference"
* item[8].extension[=].extension[+].url = "expression"
* item[8].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[8].extension[=].extension[=].valueExpression.expression = "%patientId"

* item[8].extension[+].url = $SDC_DEF_VALUE
* item[8].extension[=].extension[+].url = "definition"
* item[8].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition.encounter.reference"
* item[8].extension[=].extension[+].url = "expression"
* item[8].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[8].extension[=].extension[=].valueExpression.expression = "%encounterId"

* item[8].extension[+].url = $SDC_DEF_VALUE
* item[8].extension[=].extension[+].url = "definition"
* item[8].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition.clinicalStatus"
* item[8].extension[=].extension[+].url = "fixed-value"
* item[8].extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/condition-clinical#active "Active"

* item[8].item[0].linkId = "otherDiagnosis.code"
* item[8].item[0].text = "Diagnosis"
* item[8].item[0].type = #choice
* item[8].item[0].definition = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition.code"
* item[8].item[0].answerValueSet = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-diagnosis"

// ── SDC extraction declarations ───────────────────────────────
// Generated. Placed after every literal item rule so the soft index [+] appends
// past any extension an item already declares. A profile reached by more than one
// item is declared once on their shared parent, so component slices fill one
// resource instead of producing one resource per component.

* insert DeclareObservation(item[3].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-physical-therapy-session-count-observation)
* insert DeclareObservation(item[3].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-injection-count-observation)
* insert DeclareObservation(item[4].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation)
* insert DeclareObservation(item[4].item[10], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hand-dominance-observation)
* insert DeclareObservation(item[4].item[11], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation)
* insert DeclareObservation(item[4].item[12], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation)
* insert DeclareObservation(item[4].item[13], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation)
* insert DeclareObservation(item[4].item[14], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation)
* insert DeclareObservation(item[4].item[15], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation)
* insert DeclareObservation(item[4].item[16], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation)
* insert DeclareObservation(item[4].item[17], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation)
* insert DeclareObservation(item[4].item[18], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation)
* insert DeclareObservation(item[4].item[19], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation)
* insert DeclareObservation(item[4].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation)
* insert DeclareObservation(item[4].item[20], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation)
* insert DeclareObservation(item[4].item[21], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-observation)
* insert DeclareObservation(item[4].item[22], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-classification-observation)
* insert DeclareObservation(item[4].item[23], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hornblower-test-observation)
* insert DeclareObservation(item[4].item[24], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation)
* insert DeclareObservation(item[4].item[25], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation)
* insert DeclareObservation(item[4].item[26], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation)
* insert DeclareObservation(item[4].item[27], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation)
* insert DeclareObservation(item[4].item[28], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation)
* insert DeclareObservation(item[4].item[29], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation)
* insert DeclareObservation(item[4].item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation)
* insert DeclareObservation(item[4].item[30], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation)
* insert DeclareObservation(item[4].item[31], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tendons-involved-observation)
* insert DeclareObservation(item[4].item[32], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation)
* insert DeclareObservation(item[4].item[33], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-thickness-observation)
* insert DeclareObservation(item[4].item[34], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-location-observation)
* insert DeclareObservation(item[4].item[35], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patte-observation)
* insert DeclareObservation(item[4].item[36], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/goutallier-observation)
* insert DeclareObservation(item[4].item[3], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation)
* insert DeclareObservation(item[4].item[4], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation)
* insert DeclareObservation(item[4].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation)
* insert DeclareObservation(item[4].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation)
* insert DeclareObservation(item[4].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation)
* insert DeclareObservation(item[4].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation)
* insert DeclareObservation(item[4].item[9], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/bear-hug-test-observation)
* insert DeclareObservation(item[5].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-status-observation)
* insert DeclareObservation(item[5].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-pack-years-observation)
* insert DeclareObservation(item[5].item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/employment-status-observation)
* insert DeclareObservation(item[5].item[3], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-physical-demand-observation)
* insert DeclareObservation(item[5].item[4], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-overhead-exposure-observation)
* insert DeclareObservation(item[5].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sleep-disturbance-observation)
* insert DeclareObservation(item[5].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sports-participation-observation)
* insert DeclareObservation(item[5].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/functional-limitations-observation)
* insert DeclareObservation(item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation)
* insert DeclareFocusAllocatedCondition(item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation)
* insert DeclareObservation(item[6].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation)
* insert DeclareFocusAllocatedCondition(item[6].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation)
* insert DeclareObservation(item[6].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation)
* insert DeclareFocusAllocatedCondition(item[6].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation)

// ── Values no question asks for, declared on the item that extracts the
//    resource they belong to, which is the scope the specification walks ──

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.identifier.system"
* item[0].extension[=].extension[+].url = "fixed-value"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/identifier/patient"

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.identifier.value"
* item[0].extension[=].extension[+].url = "expression"
* item[0].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[0].extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='patient.identifier').answer.value"

* item[2].extension[+].url = $SDC_DEF_VALUE
* item[2].extension[=].extension[+].url = "definition"
* item[2].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure#Procedure.performed[x]:performedDateTime"
* item[2].extension[=].extension[+].url = "expression"
* item[2].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[2].extension[=].extension[=].valueExpression.expression = "%resource.authored"

* item[8].extension[+].url = $SDC_DEF_VALUE
* item[8].extension[=].extension[+].url = "definition"
* item[8].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition#Condition.verificationStatus"
* item[8].extension[=].extension[+].url = "fixed-value"
* item[8].extension[=].extension[=].valueCoding = http://terminology.hl7.org/CodeSystem/condition-ver-status#confirmed "Confirmed"

* item[0].extension[+].url = $SDC_DEF_VALUE
* item[0].extension[=].extension[+].url = "definition"
* item[0].extension[=].extension[=].valueUri = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient#Patient.extension:recordedSexOrGender.extension:value.value[x]"
* item[0].extension[=].extension[+].url = "expression"
* item[0].extension[=].extension[=].valueExpression.language = #text/fhirpath
* item[0].extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='patient.sexAssignedAtBirth').answer.value"

// ── The side, carried onto every observation that names a physical site ──
//    The side is answered once, in condition.laterality. Each declaration sits on the item
//    whose definitionExtract creates the observation, so an engine that walks
//    down from that item finds it. Observations of the patient in general
//    (history, social history, aggregate scores) name no site and are absent here.
* insert DeclareBodySite(item[4].item[24], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[9], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/bear-hug-test-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[8], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[25], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[18], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[36], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/goutallier-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[23], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hornblower-test-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[19], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[6], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[7], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[26], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[28], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[27], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-average-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[29], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-passive-movement-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[30], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[35], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patte-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[0], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[4], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[2], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[1], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[5], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[3], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[11], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[15], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[13], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[12], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[16], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[14], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[32], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[20], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[17], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[34], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-location-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[22], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-classification-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[21], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[33], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-thickness-observation, condition.laterality)
* insert DeclareBodySite(item[4].item[31], https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tendons-involved-observation, condition.laterality)
