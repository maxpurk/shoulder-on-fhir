Profile: ShoulderExternalRotation90AbductionObservation
Parent: ShoulderObservation
Id: shoulder-external-rotation-90-abduction-observation
Title: "Shoulder External Rotation at 90° Abduction Active Range of Motion Observation"
Description: """
Observation documenting active shoulder external rotation measured with the
arm abducted to 90° (a controlled, goniometer-reliable position distinct
from at-side/adducted ER, ShoulderExternalRotationObservation), in degrees.
Recorded alongside the at-side rotation measurements. Together they allow
assessment of both capsular tightness and rotator-cuff/subscapularis
competence, which at-side measurement alone cannot quantify. ER at 90°
abduction isolates the glenohumeral rotational arc in the functional
overhead/throwing position. Covers expert consensus Q2.b
(active range of motion, pre-treatment) and Q9.b (post-treatment); pre/post
differentiation is by effectiveDateTime.

No precoordinated LOINC or SNOMED CT code exists for a position-specific
("at 90° abduction") shoulder rotation measurement (verified July 2026), so a
local code is used. `maxValueQuantity` is set permissively (360°) rather than
at a strict physiological ceiling: it is a data-entry bound, not a claim that
360° is an achievable physiological range.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-external-rotation-90-abduction-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#external-rotation-90-abduction
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 360)
