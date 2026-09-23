Profile: ShoulderPassiveInternalRotationObservation
Parent: ShoulderObservation
Id: shoulder-passive-internal-rotation-observation
Title: "Shoulder Internal Rotation Passive Range of Motion Observation"
Description: """
Observation documenting passive shoulder internal rotation at the side
(adducted position), recorded by the "hand behind back" functional reach
test, the highest vertebral landmark the examiner can passively bring the
patient's hand to, on an eight-tier ordinal (InternalRotationVertebralLevel).
Covers expert consensus Q2.c (passive range of motion, pre-treatment) and Q9.c
(post-treatment); pre/post differentiation is by effectiveDateTime.

The reach test is the measure used in clinical practice. It reuses most of the
Constant-Murley score's own internal-rotation landmarks and adds finer rungs, so
deriving the Constant range-of-motion sub-score from it applies a documented
lossy remapping. It is preferred here
because at-side internal rotation is confounded by scapulothoracic
substitution and trunk rotation, which makes a goniometric degree value
clinically unreliable. Internal rotation measured at 90° abduction is a
controlled, goniometer-reliable position and stays degree-valued; see
ShoulderPassiveInternalRotation90AbductionObservation.

No precoordinated SNOMED CT or LOINC ordinal value codes exist for a
vertebral-level internal-rotation scale (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-passive-internal-rotation-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#passive-internal-rotation
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from InternalRotationVertebralLevel (required)
