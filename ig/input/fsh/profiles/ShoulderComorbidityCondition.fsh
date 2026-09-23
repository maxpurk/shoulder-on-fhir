// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderComorbidityCondition Profile                                      │
// │  Problem-list Condition for pre-existing comorbidities (consensus Q1.c)    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderComorbidityCondition
Parent: http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core
Id: shoulder-comorbidity-condition
Title: "Shoulder Comorbidity Condition"
Description: """
Profile for pre-existing comorbid Conditions captured alongside a rotator
cuff registry entry, expert consensus Q1.c. Distinct from RotatorCuffCondition
(the index encounter diagnosis): a comorbidity is a problem-list item
coexisting with the rotator-cuff pathology, not the reason for the surgical
encounter.

Out of scope: shoulder-region disorders (rotator cuff pathology, AC joint
osteoarthritis, impingement, etc.) are never comorbidities in this registry
, they belong on RotatorCuffCondition (the principal diagnosis) or on
ShoulderDiagnosisCondition (a coexisting non-rotator-cuff shoulder finding,
e.g. incidental AC joint OA). Comorbidities are strictly non-shoulder,
systemic or other-body-part conditions. Both demonstration frontends enforce
this by excluding, from the comorbidity typeahead, the SNOMED descendants of
three anchor concepts: `118944007 |Disorder of shoulder region|`,
`239960007 |Impingement syndrome of shoulder region|` and
`359532006 |Rotator cuff impingement syndrome|`. This profile's binding
does not technically forbid a shoulder-region code, since IPS's Problems VS
has no anatomical-region exclusion mechanism.

Derives from HL7 Europe Core `condition-eu-core`. Instances
additionally claim IPS `Condition-uv-ips` via `meta.profile[]`, the
cross-resource patient reference chain holds because `subject` ultimately
resolves to a `Reference(ShoulderPatient)` which is a derived profile of
both `patient-eu-core` (parent of `condition-eu-core.subject`) and claims
`PatientUvIps` via `meta.profile[]` (parent of `Condition-uv-ips.subject`).

Code binding: `code from http://hl7.org/fhir/uv/ips/ValueSet/problems-
snomed-absent-unknown-uv-ips (extensible)`. This sits on top of EU Core's
inherited preferred binding to `problems-uv-ips`, the IG tightens
EU/IPS's `preferred` to `extensible` for registry-comparability. Where a SNOMED
concept exists, clinicians MUST use it; ICD-10 (WHO base, or a national
modification such as ICD-10-GM at deployment) and other codings remain
permitted as additional `coding[]` siblings (dual-coding pattern).

Carried on RotatorCuffRegistrationBundle.entry[comorbidity] (0..*).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-comorbidity-condition"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"
// version bumped 2026-05-22 (ADR-0058: reparent from base Condition to condition-eu-core)
// version bumped 2026-07-18 (ADR-0084: explicit shoulder-region-exclusion scoping note)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Clinical Status                                                           │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* clinicalStatus 1..1 MS
* clinicalStatus from http://hl7.org/fhir/ValueSet/condition-clinical (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Verification Status                                                       │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* verificationStatus 1..1 MS
* verificationStatus from http://hl7.org/fhir/ValueSet/condition-ver-status (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Category, fixed to problem-list-item (distinguishes from                  │
// │  RotatorCuffCondition.category = encounter-diagnosis)                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* category 1..* MS
* category = http://terminology.hl7.org/CodeSystem/condition-category#problem-list-item

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Code, IPS / EU Base alignment (preferred)                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* code 1..1 MS
* code from http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Recorded Date, when the comorbidity was first recorded                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* recordedDate MS
