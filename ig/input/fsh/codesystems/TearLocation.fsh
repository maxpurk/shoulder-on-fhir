// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Tear Location CodeSystem                                                  │
// │  Location of a rotator cuff tear along the tendon's course                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: TearLocationCodes
Id: tear-location
Title: "Tear Location"
Description: """
Location of a rotator cuff tear along the affected tendon's course, as
distinct from Patte classification (which describes how far the torn stump
has *retracted*, not where the original tear started). Three positions
along a rotator cuff tendon, proceeding from the bony footprint inward:

Reference: no precoordinated SNOMED CT concept exists for this axis as of
authoring (verified July 2026); modeled as a local classification, the same
pattern already used for Patte / Goutallier / Cofield tear-size bucket.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/tear-location"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-13"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #insertion-near "Near the insertion (footprint)"
    "The tear originates at or immediately adjacent to the tendon's bony insertion on the greater/lesser tuberosity, the most common tear location."

* #musculotendinous "Musculotendinous junction"
    "The tear originates at the junction between the muscle belly and the tendon proper."

* #intratendinous "Intratendinous (mid-substance)"
    "The tear originates within the substance of the tendon itself, between the insertion and the musculotendinous junction, without extending to either."
