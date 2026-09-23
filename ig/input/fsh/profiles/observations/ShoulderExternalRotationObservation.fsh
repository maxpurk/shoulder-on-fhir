Profile: ShoulderExternalRotationObservation
Parent: ShoulderObservation
Id: shoulder-external-rotation-observation
Title: "Shoulder External Rotation Active Range of Motion Observation"
Description: """
Observation documenting active shoulder external rotation range of motion
at the side (adducted position) in degrees, coded with LOINC 41387-2.
Covers expert consensus Q2.b (active range of motion, pre-treatment) and Q9.b
(post-treatment); pre/post differentiation is by effectiveDateTime.

`maxValueQuantity` is 360°, a permissive data-entry bound rather than a
physiological ceiling. A 90° ceiling would silently reject legitimate
external-rotation values above 90° (around 100–110° in throwers). 360° is not
a claim that such a range is achievable; no single shoulder rotation
measurement reaches 360°.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = http://loinc.org#41387-2 "Shoulder External rotation Active Range of Motion Quantitative"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 360)
