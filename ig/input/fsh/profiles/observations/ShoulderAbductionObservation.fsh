Profile: ShoulderAbductionObservation
Parent: ShoulderObservation
Id: shoulder-abduction-observation
Title: "Shoulder Abduction Active Range of Motion Observation"
Description: "Observation documenting active shoulder abduction range of motion in degrees, coded with LOINC 41381-5. Covers expert consensus Q2.b (active range of motion, pre-treatment) and Q9.b (post-treatment); pre/post differentiation is by effectiveDateTime."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-abduction-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-19"
* code = http://loinc.org#41381-5 "Shoulder Abduction Active Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 180)
