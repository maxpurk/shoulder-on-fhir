// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Fixation Technique CodeSystem                                             │
// │  Suture-anchor fixation construct for rotator cuff repair                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: FixationTechniqueCodes
Id: fixation-technique
Title: "Fixation Technique"
Description: """
Suture-anchor fixation construct used for rotator cuff repair, single-row,
double-row, or suture-bridge (transosseous-equivalent), plus two catch-all
tiers for repairs without anchors and procedures where the axis does not
apply. Layer 2 (IG-operational) addition, out-of-consensus: the expert
consensus (Q1-Q13) never names fixation technique.

Single-row, double-row, and suture-bridge are the three biomechanically and
clinically distinct fixation philosophies used throughout current rotator cuff
repair literature and by peer surgical registries, not an arbitrary cut of a
continuum. Suture-bridge is kept as
its own tier rather than merged into "double-row" because it is a specific
double-row sub-variant with its own distinct compressive mechanism
(lateral-row sutures/tapes pass over the tendon surface before anchoring,
compressing the tendon against the footprint), a distinction registries
that lump it into plain double-row lose.

No SNOMED CT concept exists for any of these five tiers as a standalone
fixation-technique axis (verified July 2026), only whole-procedure fused
concepts (e.g. SNOMED `699120002` "Arthroscopic repair of rotator cuff")
exist, with no separate axis for anchor configuration.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/fixation-technique"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 5

* #single-row "Single-row fixation"
    "Suture anchors placed in a single row along the tendon footprint; tendon secured to that row with simple or mattress sutures."

* #double-row "Double-row fixation"
    "Suture anchors placed in two rows (medial articular-margin row and lateral greater-tuberosity row); tendon secured to both rows independently."

* #suture-bridge "Suture-bridge / transosseous-equivalent fixation"
    "Double-row construct in which lateral-row sutures or tapes pass over the tendon surface before lateral anchoring, compressing the tendon against the footprint (transosseous-equivalent technique)."

* #transosseous-no-anchor "Transosseous repair without anchors"
    "Tendon secured directly to bone tunnels drilled through the greater tuberosity, without suture anchors."

* #not-applicable "Not applicable"
    "No tendon-to-bone fixation construct was used (e.g. debridement alone, decompression alone, or arthroplasty)."
