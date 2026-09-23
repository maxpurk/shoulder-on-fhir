// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  OccupationalOverheadExposureObservation Profile                           │
// │  Overhead-work exposure, part of "Occupation" (consensus Q1.k)             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: OccupationalOverheadExposureObservation
Parent: ShoulderObservation
Id: occupational-overhead-exposure-observation
Title: "Occupational Overhead Exposure Observation"
Description: """
Observation documenting whether the patient's occupation regularly involves
overhead reaching or repetitive shoulder-loading tasks, independent of
occupational physical-demand intensity (`OccupationalPhysicalDemandObservation`).
It is a separate axis because intensity and overhead exposure can co-occur
(a roofer is both heavy-manual and overhead-exposed), which a single enum
could not represent simultaneously.

Part of the unanimous-consensus Q1.k "Occupation," which names no
mechanism. `Observation.code` is a local `ShoulderObservationCodes` catalog
entry; `valueCodeableConcept` is bound to `OccupationalOverheadExposure`
(fully local), no SNOMED CT or LOINC concept exists for this axis (verified
July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/occupational-overhead-exposure-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#occupational-overhead-exposure
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from OccupationalOverheadExposure (required)
