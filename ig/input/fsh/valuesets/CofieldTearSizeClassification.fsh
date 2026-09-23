// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  CofieldTearSizeClassification                                           │
// │                                                                            │
// │  A ValueSet is required because FHIR profile bindings must reference a    │
// │  ValueSet, never a CodeSystem directly. This thin ValueSet includes all   │
// │  codes from the complete CofieldTearSizeClassificationCodes.                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: CofieldTearSizeClassification
Id: cofield-tear-size-classification
Title: "Cofield Tear Size Classification ValueSet"
Description: "ValueSet containing all four Cofield rotator cuff tear-size categories (small / medium / large / massive). Bound to Observation.valueCodeableConcept in TearSizeClassificationObservation (pre-operative, from imaging) and IntraopTearSizeClassificationObservation (intra-operative)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/cofield-tear-size-classification"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-19"
* ^publisher = "Hasso Plattner Institute"
* ^copyright = "See CofieldTearSizeClassificationCodes copyright."

// Concepts inlined so HAPI does not need to walk the CodeSystem via its
// Lucene index at $expand time (Lucene-on-tmpfs race after restart).
* CofieldTearSizeClassificationCodes#small "Small tear (<1 cm)"
* CofieldTearSizeClassificationCodes#medium "Medium tear (1–3 cm)"
* CofieldTearSizeClassificationCodes#large "Large tear (3–5 cm)"
* CofieldTearSizeClassificationCodes#massive "Massive tear (>5 cm)"
