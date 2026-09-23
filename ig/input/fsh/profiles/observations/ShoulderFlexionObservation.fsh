Profile: ShoulderFlexionObservation
Parent: ShoulderObservation
Id: shoulder-flexion-observation
Title: "Shoulder Flexion Active Range of Motion Observation"
Description: "Observation documenting active shoulder flexion range of motion in degrees, coded with LOINC 41389-8. Covers expert consensus Q2.b (active range of motion, pre-treatment) and Q9.b (post-treatment); pre/post differentiation is by effectiveDateTime. The expert consensus names this movement 'Forward Flexion'; LOINC uses 'Flexion'."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-flexion-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-19"
* code = http://loinc.org#41389-8 "Shoulder Flexion Active Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 180)
