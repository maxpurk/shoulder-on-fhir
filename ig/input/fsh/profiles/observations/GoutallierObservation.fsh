Profile: GoutallierObservation
Parent: ShoulderObservation
Id: goutallier-observation
Title: "Goutallier Classification Observation"
Description: "Observation documenting Goutallier fatty infiltration grade (0–4). Covers expert consensus Q4.e (Goutallier grading of fatty infiltration)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/goutallier-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#goutallier-classification
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from GoutallierClassification (required)
