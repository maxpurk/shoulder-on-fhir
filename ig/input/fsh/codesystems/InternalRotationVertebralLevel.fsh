// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Internal Rotation Vertebral Level CodeSystem                              │
// │  "Hand behind back" functional IR scale (consensus Q2.b/Q2.c, Q9.b/Q9.c)   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: InternalRotationVertebralLevelCodes
Id: internal-rotation-vertebral-level
Title: "Internal Rotation Vertebral Level"
Description: """
Eight-tier ordinal recording at-side (adducted) shoulder internal rotation
by the highest vertebral landmark the patient's hand can reach behind the
back ("hand behind back" test), worst to best. Standard clinical
convention. It reuses most of the landmarks of the Constant-Murley score's own
IR grading (the expert consensus Q12 preferred instrument already modeled in
this IG via ConstantScoreObservation) and adds finer rungs, so deriving that
score's range-of-motion sub-score applies a documented lossy remapping.

ShoulderInternalRotationObservation and
ShoulderPassiveInternalRotationObservation bind this scale instead of a
degree-valued (`valueQuantity`) measurement: at-side internal rotation is
confounded by scapulothoracic substitution and trunk rotation, so a
goniometric degree value is clinically unreliable, and the reachable-level
test is what is used in practice. Distinct from IR measured at 90° abduction
(ShoulderInternalRotation90AbductionObservation), which is a controlled,
goniometer-reliable position and stays degree-valued.

No precoordinated SNOMED CT or LOINC ordinal value codes exist for a
vertebral-level IR scale as of authoring (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/internal-rotation-vertebral-level"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* ^caseSensitive = true
* ^content = #complete
* ^count = 8

* #unable "Unable to reach behind back"
    "Patient cannot bring the hand behind the back far enough to reach the lateral thigh / greater trochanter."

* #greater-trochanter "Greater trochanter (lateral thigh)"
    "Hand reaches the lateral thigh at the level of the greater trochanter, the lowest scored rung of the scale."

* #buttock "Buttock"
    "Hand reaches the buttock."

* #sacrum "Sacrum"
    "Hand reaches the sacrum."

* #l5 "L5 (belt line)"
    "Hand reaches the fifth lumbar vertebra, approximately the belt line."

* #l3 "L3 (waist)"
    "Hand reaches the third lumbar vertebra, approximately the waist."

* #t12 "T12 (thoracolumbar junction)"
    "Hand reaches the twelfth thoracic vertebra, the thoracolumbar junction."

* #t7-or-above "T7 or above (inferior scapular angle / interscapular)"
    "Hand reaches the seventh thoracic vertebra (inferior scapular angle) or higher, up to the interscapular region, the highest scored rung of the scale."
