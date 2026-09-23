// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  FixationTechnique                                                         │
// │  All codes from FixationTechniqueCodes                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: FixationTechnique
Id: fixation-technique
Title: "Fixation Technique ValueSet"
Description: "ValueSet containing the five fixation-technique categories."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/fixation-technique"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* FixationTechniqueCodes#single-row "Single-row fixation"
* FixationTechniqueCodes#double-row "Double-row fixation"
* FixationTechniqueCodes#suture-bridge "Suture-bridge / transosseous-equivalent fixation"
* FixationTechniqueCodes#transosseous-no-anchor "Transosseous repair without anchors"
* FixationTechniqueCodes#not-applicable "Not applicable"
