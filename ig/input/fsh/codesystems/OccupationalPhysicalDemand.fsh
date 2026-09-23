// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Occupational Physical Demand CodeSystem                                   │
// │  Physical demand category of the patient's occupation (consensus Q1.k)     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: OccupationalPhysicalDemandCodes
Id: occupational-physical-demand
Title: "Occupational Physical Demand"
Description: """
Physical demand (intensity) category of the patient's occupation, part of
"Occupation" (expert consensus Q1.k). Intensity is one of two independent occupational
axes, the other, whether the occupation involves regular overhead work, is
captured separately by `OccupationalOverheadExposureObservation` /
`OccupationalOverheadExposureCodes`. The two are kept as independent axes
rather than folded into a single enum because an occupation can be
simultaneously heavy and overhead (a roofer, for example); one enum would
force an artificial either/or choice.

No SNOMED CT or LOINC concept exists for occupational physical demand
intensity level as of authoring (SNOMED CT and LOINC both checked, July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/occupational-physical-demand"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #sedentary "Sedentary / desk-based work"
    "No regular manual physical demand (Schreibtischtätigkeit)."

* #light-manual "Light manual work"
    "Occasional light lifting/carrying."

* #heavy-manual "Heavy manual work"
    "Regular heavy lifting/carrying (Körperliche Arbeit)."
