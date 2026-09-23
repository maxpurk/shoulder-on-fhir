// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SmokingStatusObservation Profile                                          │
// │  Tobacco smoking status (expert consensus Q1.d)                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: SmokingStatusObservation
Parent: ShoulderObservation
Id: smoking-status-observation
Title: "Smoking Status Observation"
Description: """
Observation documenting the patient's tobacco smoking status, expert consensus
Q1.d (unanimous consensus, required patient-history element).

`Observation.code` is LOINC `72166-2` (Tobacco smoking status), matching the
IPS `Observation-tobaccouse-uv-ips` profile. `valueCodeableConcept` is
extensible-bound to IPS `CurrentSmokingStatusUvIps`, which IPS 1.1.0
publishes as a LOINC answer-list value set (8 `LA*` codes). The IG tightens
IPS's `preferred` to `extensible` for registry-comparability: a single-jurisdiction
surgical registry needs the validator to enforce the encoding, not merely
encourage it. IPS ships a `loinc-smoking-status-to-snomed-ct-uv-ips` concept
map for exporters that need SNOMED downstream; that translation is not
inline in this profile.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-status-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-22"

* code = http://loinc.org#72166-2 "Tobacco smoking status"
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips (extensible)
