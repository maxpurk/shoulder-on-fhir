Profile: ShoulderPassiveFlexionObservation
Parent: ShoulderObservation
Id: shoulder-passive-flexion-observation
Title: "Shoulder Flexion Passive Range of Motion Observation"
Description: "Observation documenting passive shoulder flexion range of motion in degrees, coded with LOINC 41390-6. Covers expert consensus Q2.c (passive range of motion, pre-treatment) and Q9.c (post-treatment); pre/post differentiation is by effectiveDateTime. The expert consensus names this movement 'Forward Flexion'; LOINC uses 'Flexion'."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-flexion-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-19"
* code = http://loinc.org#41390-6 "Shoulder Flexion Passive Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 180)
