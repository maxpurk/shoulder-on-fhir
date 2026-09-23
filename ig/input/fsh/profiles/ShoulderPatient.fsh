// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderPatient Profile                                                   │
// │  Patient profile for shoulder surgery documentation                        │
// │  EU Core foundation + IPS multi-profile (ADR-0057)                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderPatient
Parent: http://hl7.eu/fhir/base/StructureDefinition/patient-eu-core
Id: shoulder-patient
Title: "Shoulder Patient"
Description: """
Profile for patients undergoing shoulder-related treatment, particularly rotator
cuff surgery. Derives from HL7 Europe Core `patient-eu-core` (which inherits
optional EU extension slots for birthPlace, sex-for-clinical-use, gender-identity,
pronouns, citizenship, nationality, birthTime via `patient-eu`, and pins
`Patient.address` to `Address-eu`).

Instances additionally claim conformance to IPS `Patient-uv-ips` via
`meta.profile[]`. Both invariants, EU `eu-pat-1` (family ∨ given ∨ text ∨
data-absent-reason) and IPS `ips-pat-1` (family ∨ given ∨ text), are
satisfied trivially by `name.family 1..1 MS` below.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-22"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Identifier                                                                │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* identifier 1..* MS
* identifier.system 1..1 MS
* identifier.value 1..1 MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Name, family tightened to 1..1 MS; structurally satisfies both           │
// │  eu-pat-1 (inherited) and ips-pat-1 (claimed via meta.profile[]) for every │
// │  conformant registry instance.                                             │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* name 1..* MS
* name.family 1..1 MS
// name.given is MS but not required, given name may be absent in some
// European naming conventions
* name.given MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Demographics                                                              │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* gender 1..1 MS
* birthDate 1..1 MS
// (birthDate 1..1 also satisfies the inherited patient-eu-core constraint
//  that birthDate 1..; tightening is FHIR-legal on a derived profile.)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Recorded Sex or Gender, Sex assigned at birth (ADR-0053)                 │
// │  Hurley A1(b) names only "Gender" (FHIR administrative). The IG carries    │
// │  sex assigned at birth as a separate research stratification variable via  │
// │  the HL7 Gender Harmony RSG extension (R4-backported in                    │
// │  hl7.fhir.uv.extensions.r4). Type is pinned to LOINC 76689-9 so every RSG  │
// │  instance in this registry uniformly represents sex assigned at birth.     │
// │  Cardinality 0..1 (one fixed type → one record per patient). Coexists with │
// │  EU's inherited genderIdentity / pronouns slices via different ext URL.    │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* extension contains
    http://hl7.org/fhir/StructureDefinition/individual-recordedSexOrGender named recordedSexOrGender 0..1 MS
* extension[recordedSexOrGender] ^short = "Sex assigned at birth (Gender Harmony RSG; type pinned to LOINC 76689-9)"
* extension[recordedSexOrGender].extension[value].value[x] 1..1 MS
* extension[recordedSexOrGender].extension[value].value[x] only CodeableConcept
* extension[recordedSexOrGender].extension[value].valueCodeableConcept from http://hl7.org/fhir/ValueSet/administrative-gender (required)
* extension[recordedSexOrGender].extension[type] 1..1 MS
* extension[recordedSexOrGender].extension[type].value[x] only CodeableConcept
* extension[recordedSexOrGender].extension[type].valueCodeableConcept.coding 1..1 MS
* extension[recordedSexOrGender].extension[type].valueCodeableConcept.coding = http://loinc.org#76689-9 "Sex assigned at birth"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Contact Information (optional but supported)                              │
// │  `address only Address-eu` is INHERITED from patient-eu (no need to repeat).│
// ╰─────────────────────────────────────────────────────────────────────────────╯
* telecom MS
* address MS
// The three address parts the registration form collects. Declaring them
// here is what lets Questionnaire.item.definition point at them: a fragment
// may only name an ElementDefinition id, and a complex datatype's children
// are absent from the snapshot until the profile constrains them.
* address.line MS
* address.city MS
* address.postalCode MS
