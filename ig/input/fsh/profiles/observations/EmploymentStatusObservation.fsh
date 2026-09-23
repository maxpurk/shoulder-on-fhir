// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  EmploymentStatusObservation Profile                                       │
// │  Current employment status, part of "Occupation" (expert consensus Q1.k)   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: EmploymentStatusObservation
Parent: ShoulderObservation
Id: employment-status-observation
Title: "Employment Status Observation"
Description: """
Observation documenting the patient's current employment status. Part of
the unanimous-consensus Q1.k "Occupation," which names no mechanism, decomposed here into employment status (this profile) and occupational
physical demand (`OccupationalPhysicalDemandObservation`) rather than a
free-text job title, which has low analytical value across a registry.

`Observation.code` is the standard LOINC 67875-5 "Employment status -
current". `valueCodeableConcept` is bound to `EmploymentStatus`, LOINC's
own official answer list (LL1901-9) plus one local addition
(self-employed), which no LOINC answer list captures (verified July 2026).

"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/employment-status-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-17"

* code = http://loinc.org#67875-5 "Employment status - current"
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from EmploymentStatus (required)
