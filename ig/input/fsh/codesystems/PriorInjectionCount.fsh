// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Prior Shoulder Injection Count CodeSystem                                 │
// │  Bucketed injection count, part of expert consensus Q1.f                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: PriorInjectionCountCodes
Id: prior-injection-count
Title: "Prior Shoulder Injection Count"
Description: """
Bucketed count of prior shoulder injections received for the condition
being registered, part of the unanimous-consensus Q1.f "Prior
treatment (PT/injections)," which names no mechanism.

The count is bucketed rather than captured as free text or as injection dates:
what matters for treatment history is how many injections were given, not
exactly when. It is only asked when the prior-injection yes/no flag is "yes";
the "no injections" case is already represented by that flag, so this
CodeSystem carries no redundant zero-count member.

No SNOMED CT or LOINC concept exists for a bucketed injection-count axis as
of authoring (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/prior-injection-count"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 2

* #1-3 "1 to 3 injections"
    "1 to 3 shoulder injections received for this condition."

* #gt-3 "More than 3 injections"
    "More than 3 shoulder injections received for this condition."
