// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffEtiology                                                     │
// │  Causation classifier for RotatorCuffCondition.                            │
// │  Bound `required` to Condition.extension[condition-dueTo] on               │
// │  RotatorCuffCondition. Hybrid: SNOMED concepts where the cause-domain has  │
// │  an apt concept (traumatic, degenerative, unknown/idiopathic); local code  │
// │  for mixed/acute-on-chronic. See ADR-0046.                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: RotatorCuffEtiology
Id: rotator-cuff-etiology
Title: "Rotator Cuff Etiology ValueSet"
Description: "Mutually-exclusive causation classifier for rotator cuff pathology, used in Condition.extension[condition-dueTo] on RotatorCuffCondition. Required binding."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-etiology"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-19"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#773760007 "Traumatic event"
* http://snomed.info/sct#362975008 "Degenerative disorder"
* ShoulderEtiology#acute-on-chronic "Acute-on-chronic (mixed) etiology"
* http://snomed.info/sct#54690008 "Unknown (origin)"
