Profile: LiftOffTestObservation
Parent: ShoulderObservation
Id: lift-off-test-observation
Title: "Lift-off Test Observation"
Description: """
Observation documenting the result of the Gerber Lift-off subscapularis
provocation test. Coded via SNOMED CT 1231510004 "Lift-off test" (procedure;
synonym "Gerber test"), a verified SNOMED procedure concept for this test.
Covers expert consensus Q2.f (pre-treatment) and Q9.f
(post-treatment); pre/post differentiation is by effectiveDateTime.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/lift-off-test-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"
* code = http://snomed.info/sct#1231510004 "Lift-off test"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
