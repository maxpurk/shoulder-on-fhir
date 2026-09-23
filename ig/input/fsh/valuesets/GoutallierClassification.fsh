// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  GoutallierClassification                                                │
// │                                                                            │
// │  A ValueSet is required because FHIR profile bindings must reference a    │
// │  ValueSet, never a CodeSystem directly. This thin ValueSet includes all   │
// │  codes from the complete GoutallierClassificationCodes.                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: GoutallierClassification
Id: goutallier-classification
Title: "Goutallier Classification ValueSet"
Description: "ValueSet containing all Goutallier classification grades (0–4) for fatty infiltration of rotator cuff muscles. Bound to Observation.valueCodeableConcept in ShoulderObservation instances that record Goutallier findings."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/goutallier-classification"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-04-03"
* ^publisher = "Hasso Plattner Institute"
* ^copyright = "See GoutallierClassificationCodes copyright."

// Concepts inlined so HAPI does not need to walk the CodeSystem via its
// Lucene index at $expand time (Lucene-on-tmpfs race after restart).
* GoutallierClassificationCodes#0 "Grade 0 – Normal muscle"
* GoutallierClassificationCodes#1 "Grade 1 – Some fatty streaks"
* GoutallierClassificationCodes#2 "Grade 2 – More muscle than fat"
* GoutallierClassificationCodes#3 "Grade 3 – Equal amounts of fat and muscle"
* GoutallierClassificationCodes#4 "Grade 4 – More fat than muscle"
