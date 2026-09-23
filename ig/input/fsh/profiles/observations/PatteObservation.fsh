Profile: PatteObservation
Parent: ShoulderObservation
Id: patte-observation
Title: "Patte Classification Observation"
Description: "Observation documenting Patte tendon retraction stage (I–III). Covers expert consensus Q4.d (Patte staging of tendon retraction)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patte-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#patte-classification
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from PatteClassification (required)
