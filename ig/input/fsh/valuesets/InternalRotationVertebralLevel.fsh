// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  InternalRotationVertebralLevel                                            │
// │  All codes from InternalRotationVertebralLevelCodes                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: InternalRotationVertebralLevel
Id: internal-rotation-vertebral-level
Title: "Internal Rotation Vertebral Level ValueSet"
Description: "ValueSet containing the eight-tier 'hand behind back' internal rotation scale (expert consensus Q2.b/Q2.c, Q9.b/Q9.c)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/internal-rotation-vertebral-level"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-19"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system
// InternalRotationVertebralLevelCodes`) so HAPI does not need to walk the
// CodeSystem via its Lucene index at $expand time — see
// SleepDisturbanceSeverity.fsh for the same convention.
* InternalRotationVertebralLevelCodes#unable "Unable to reach behind back"
* InternalRotationVertebralLevelCodes#greater-trochanter "Greater trochanter (lateral thigh)"
* InternalRotationVertebralLevelCodes#buttock "Buttock"
* InternalRotationVertebralLevelCodes#sacrum "Sacrum"
* InternalRotationVertebralLevelCodes#l5 "L5 (belt line)"
* InternalRotationVertebralLevelCodes#l3 "L3 (waist)"
* InternalRotationVertebralLevelCodes#t12 "T12 (thoracolumbar junction)"
* InternalRotationVertebralLevelCodes#t7-or-above "T7 or above (inferior scapular angle / interscapular)"
