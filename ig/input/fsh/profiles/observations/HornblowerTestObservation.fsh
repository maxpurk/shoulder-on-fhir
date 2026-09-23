Profile: HornblowerTestObservation
Parent: ShoulderObservation
Id: hornblower-test-observation
Title: "Hornblower Test Observation"
Description: "Observation documenting the result of the Hornblower (Signe du Clairon) teres minor provocation test. Covers expert consensus Q2.i (pre-treatment; the post-op exam set Q9.a–g does not include Hornblower, so post-op use is informative)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hornblower-test-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#hornblower-test
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
