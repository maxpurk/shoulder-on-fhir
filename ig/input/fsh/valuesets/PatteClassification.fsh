// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PatteClassification                                                     │
// │  All codes from PatteClassificationCodes                                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PatteClassification
Id: patte-classification
Title: "Patte Classification ValueSet"
Description: "ValueSet containing all Patte classification stages for rotator cuff tendon retraction."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/patte-classification"
* ^version = "0.1.1"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-18"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system PatteClassificationCodes`)
// so HAPI does not need to walk the CodeSystem via its Lucene index at
// $expand time. The CS-walk path is flaky after a HAPI restart because
// Lucene runs on tmpfs and the scheduled pre-expander races against an
// empty index. Inlining moves the concepts into the VS resource itself.
* PatteClassificationCodes#I "Stage I - Retracted tendon end at the bony insertion"
* PatteClassificationCodes#II "Stage II - Retracted tendon end at the humeral head"
* PatteClassificationCodes#III "Stage III - Retracted tendon end at the glenoid"
