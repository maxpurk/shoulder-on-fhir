Profile: JobeTestObservation
Parent: ShoulderObservation
Id: jobe-test-observation
Title: "Jobe Test (Empty Can) Observation"
Description: """
Observation documenting the result of the Jobe (Empty Can) supraspinatus
provocation test. Coded via SNOMED CT 1231437004 "Empty can test"
(procedure; synonym "Jobe test"), a verified SNOMED procedure concept for this
test. Covers expert consensus Q2.e (pre-treatment) and
Q9.e (post-treatment); pre/post differentiation is by effectiveDateTime.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/jobe-test-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"
* code = http://snomed.info/sct#1231437004 "Empty can test"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
