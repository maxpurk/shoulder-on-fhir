// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderEtiology CodeSystem                                               │
// │  Local codes for rotator cuff causation classes that have no apt SNOMED    │
// │  cause-concept. Used together with SNOMED codes in RotatorCuffEtiology.  │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: ShoulderEtiology
Id: shoulder-etiology
Title: "Shoulder Etiology"
Description: """
Local codes for rotator cuff causation classes that have no apt SNOMED concept
in the cause-of-condition role. SNOMED's `255212004 Acute-on-chronic` is a
qualifier value, not a cause; a dedicated local code is used to keep the
classifier semantics clean. Used together with SNOMED concepts in
`RotatorCuffEtiology` for `Condition.extension[condition-dueTo]` on
`RotatorCuffCondition`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/shoulder-etiology"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-19"
* ^publisher = "Hasso Plattner Institute"
* ^caseSensitive = true
* ^content = #complete
* ^count = 1

* #acute-on-chronic "Acute-on-chronic (mixed) etiology"
    "Combined traumatic and degenerative causation, e.g. a degenerative tear extended by a discrete traumatic event. Clinically common; SNOMED has no cause-domain concept covering this combination."
