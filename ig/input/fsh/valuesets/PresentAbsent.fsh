// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PresentAbsent                                                             │
// │  SNOMED CT codes for binary presence/absence exam findings                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PresentAbsent
Id: present-absent
Title: "Present/Absent Finding ValueSet"
Description: "ValueSet for recording binary (present/absent) visual inspection findings, used for shoulder atrophy, deformity, and normal-contour exam items (expert consensus Q2.a / Q9.a)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/present-absent"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-18"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#52101004 "Present"
* http://snomed.info/sct#2667000 "Absent"
