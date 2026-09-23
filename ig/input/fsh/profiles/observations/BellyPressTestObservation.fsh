Profile: BellyPressTestObservation
Parent: ShoulderObservation
Id: belly-press-test-observation
Title: "Belly Press Test Observation"
Description: "Observation documenting the result of the Belly Press subscapularis provocation test. Covers expert consensus Q2.g (pre-treatment) and Q9.g (post-treatment); pre/post differentiation is by effectiveDateTime."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/belly-press-test-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#belly-press-test
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
