Profile: BearHugTestObservation
Parent: ShoulderObservation
Id: bear-hug-test-observation
Title: "Bear Hug Test Observation"
Description: "Observation documenting the result of the Bear Hug subscapularis provocation test. Covers expert consensus Q2.h (pre-treatment; the post-op exam set Q9.a–g does not include Bear Hug, so post-op use is informative)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/bear-hug-test-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#bear-hug-test
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
