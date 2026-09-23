Profile: ReturnToActivityObservation
Parent: ShoulderObservation
Id: return-to-activity-observation
Title: "Return to Activity Observation"
Description: "Observation documenting the patient's ability to return to pre-injury sport or occupational activities. Covers expert consensus component Q12.e, return to sport/work."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/return-to-activity-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#return-to-sport-work
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
// ADR-0156: disambiguates which RotatorCuffCondition (bilateral case) this
// Observation is about, see SsvScoreObservation.fsh's fuller comment.
* focus 0..1 MS
* focus only Reference(RotatorCuffCondition)
* value[x] only CodeableConcept
* valueCodeableConcept from ReturnToActivity (required)
