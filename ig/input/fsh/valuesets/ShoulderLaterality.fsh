// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderLaterality                                                      │
// │  SNOMED CT codes for left/right shoulder region                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ShoulderLaterality
Id: shoulder-laterality
Title: "Shoulder Laterality ValueSet"
Description: "ValueSet for shoulder laterality (left, right). Used in bodySite to specify which shoulder is affected."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-12"
* ^publisher = "Hasso Plattner Institute"

// SNOMED CT codes for laterality combined with shoulder
* http://snomed.info/sct#91775009 "Structure of left shoulder region"
* http://snomed.info/sct#91774008 "Structure of right shoulder region"
