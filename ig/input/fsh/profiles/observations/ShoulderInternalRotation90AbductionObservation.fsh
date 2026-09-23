Profile: ShoulderInternalRotation90AbductionObservation
Parent: ShoulderObservation
Id: shoulder-internal-rotation-90-abduction-observation
Title: "Shoulder Internal Rotation at 90° Abduction Active Range of Motion Observation"
Description: """
Observation documenting active shoulder internal rotation measured with the
arm abducted to 90°, in degrees. Distinct from at-side IR
(ShoulderInternalRotationObservation), which is recorded on a vertebral-level
ordinal because it is confounded by scapulothoracic substitution, at 90°
abduction the scapula is stabilised and the glenohumeral rotation arc is
measured against a fixed reference, so a goniometric degree value is
reliable and reproducible here. Together with the at-side
measurements, IR and ER at 90° abduction allow assessment of both capsular
tightness (GIRD, glenohumeral internal rotation deficit) and rotator-cuff
competence, which at-side measurement alone cannot quantify.
Covers expert consensus Q2.b (active range of motion, pre-treatment) and Q9.b
(post-treatment); pre/post differentiation is by effectiveDateTime.

No precoordinated LOINC or SNOMED CT code exists for a position-specific
("at 90° abduction") shoulder rotation measurement (verified July 2026), so a
local code is used. `maxValueQuantity` is set permissively (360°) rather than
at a strict physiological ceiling: it is a data-entry bound, not a claim that
360° is an achievable physiological range.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-internal-rotation-90-abduction-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#internal-rotation-90-abduction
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#deg, 0, 360)
