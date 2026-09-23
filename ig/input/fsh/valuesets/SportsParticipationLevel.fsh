// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SportsParticipationLevel                                                  │
// │  All codes from SportsParticipationLevelCodes                              │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: SportsParticipationLevel
Id: sports-participation-level
Title: "Sports Participation Level ValueSet"
Description: "ValueSet containing the four sports-participation level grades (expert consensus Q1.j)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/sports-participation-level"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-18"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system SportsParticipationLevelCodes`)
// so HAPI does not need to walk the CodeSystem via its Lucene index at
// $expand time — see SleepDisturbanceSeverity.fsh for the same convention.
* SportsParticipationLevelCodes#none "Does not participate in sport"
* SportsParticipationLevelCodes#recreational "Recreational / leisure sport"
* SportsParticipationLevelCodes#competitive "Competitive / organized sport"
* SportsParticipationLevelCodes#professional "Professional / elite sport"
