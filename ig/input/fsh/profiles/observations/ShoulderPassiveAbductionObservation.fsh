Profile: ShoulderPassiveAbductionObservation
Parent: ShoulderObservation
Id: shoulder-passive-abduction-observation
Title: "Shoulder Abduction Passive Range of Motion Observation"
Description: "Observation documenting passive shoulder abduction range of motion in degrees, coded with LOINC 41382-3. Covers expert consensus Q2.c (passive range of motion, pre-treatment) and Q9.c (post-treatment); pre/post differentiation is by effectiveDateTime."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-abduction-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-19"
* code = http://loinc.org#41382-3 "Shoulder Abduction Passive Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 180)
