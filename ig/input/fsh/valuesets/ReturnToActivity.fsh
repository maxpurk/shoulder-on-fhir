// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ReturnToActivity                                                        │
// │  All codes from ReturnToActivityCodes                                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ReturnToActivity
Id: return-to-activity
Title: "Return to Activity Status ValueSet"
Description: "ValueSet containing all codes from ReturnToActivityCodes. Bound to Observation.valueCodeableConcept when code = ShoulderObservationCodes#return-to-sport-work."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/return-to-activity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-04-08"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined so HAPI does not need to walk the CodeSystem via its
// Lucene index at $expand time (Lucene-on-tmpfs race after restart).
* ReturnToActivityCodes#returned-full "Returned to Full Activities"
* ReturnToActivityCodes#returned-modified "Returned to Modified Activities"
* ReturnToActivityCodes#not-returned "Not Returned"
