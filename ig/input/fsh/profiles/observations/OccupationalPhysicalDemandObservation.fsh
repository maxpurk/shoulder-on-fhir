// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  OccupationalPhysicalDemandObservation Profile                             │
// │  Physical demand of occupation, part of "Occupation" (consensus Q1.k)      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: OccupationalPhysicalDemandObservation
Parent: ShoulderObservation
Id: occupational-physical-demand-observation
Title: "Occupational Physical Demand Observation"
Description: """
Observation documenting the physical demand category of the patient's
occupation (sedentary / light manual / heavy manual). Part of the unanimous-consensus
Q1.k "Occupation," which names no mechanism, added as a second axis
alongside `EmploymentStatusObservation`, motivated by overhead/repetitive
shoulder loading being a well-established rotator-cuff risk and
return-to-work factor. No comparable registry (DART, EPRD, IRD, SEPR)
captures this axis (verified against the DART, EPRD, IRD and SEPR dataset
specifications).

`Observation.code` is a local `ShoulderObservationCodes` catalog entry, no
SNOMED CT or LOINC concept exists for occupational physical demand level
(verified July 2026). `valueCodeableConcept` is bound to
`OccupationalPhysicalDemand` (fully local, same reason).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-physical-demand-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-17"

* code = ShoulderObservationCodes#occupational-physical-demand
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from OccupationalPhysicalDemand (required)
