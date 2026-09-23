// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  TendonsInvolved                                                           │
// │  SNOMED CT anatomy codes for rotator cuff tendons                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: TendonsInvolved
Id: tendons-involved
Title: "Tendons Involved ValueSet"
Description: """
SNOMED CT anatomical concepts for the four rotator cuff tendons. Bound to
`TendonsInvolvedObservation.value[x]` to record which tendon or tendons are
torn (expert consensus element Q4.b). One Observation is recorded per
affected tendon, each linked from the index `RotatorCuffCondition` through
`evidence.detail`.

The codes are laterality-neutral. The affected side is carried once, on
`RotatorCuffCondition.bodySite`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tendons-involved"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-12"
* ^publisher = "Hasso Plattner Institute"

// SNOMED CT anatomy codes for rotator cuff tendons (corrected — see ADR-0043; prior versions used muscle-structure codes)
* http://snomed.info/sct#5580002 "Structure of tendon of supraspinatus muscle"
* http://snomed.info/sct#59713001 "Structure of tendon of infraspinatus muscle"
* http://snomed.info/sct#80108009 "Structure of tendon of subscapularis muscle"
* http://snomed.info/sct#700027005 "Structure of tendon of teres minor"
