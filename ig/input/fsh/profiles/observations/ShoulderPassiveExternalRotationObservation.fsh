Profile: ShoulderPassiveExternalRotationObservation
Parent: ShoulderObservation
Id: shoulder-passive-external-rotation-observation
Title: "Shoulder External Rotation Passive Range of Motion Observation"
Description: """
Observation documenting passive shoulder external rotation range of motion
at the side (adducted position) in degrees, coded with LOINC 41388-0.
Covers expert consensus Q2.c (passive range of motion, pre-treatment) and Q9.c
(post-treatment); pre/post differentiation is by effectiveDateTime.

`maxValueQuantity` is 360°, a permissive data-entry bound rather than a
physiological ceiling. A 90° ceiling would silently reject legitimate
external-rotation values above 90° (around 100–110° in throwers). 360° is not
a claim that such a range is achievable; no single shoulder rotation
measurement reaches 360°.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-external-rotation-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = http://loinc.org#41388-0 "Shoulder External rotation Passive Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 360)
