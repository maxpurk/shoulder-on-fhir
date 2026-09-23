// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffProcedureCategory                                              │
// │  Procedure.category codes used by RotatorCuffProcedure. Three SNOMED CT    │
// │  parent concepts cover every entry in RotatorCuffProcedureType:            │
// │    387713003 — index surgery and concomitant surgical procedures           │
// │     91251008 — expert consensus Q1.f prior physical therapy                 │
// │     18629005 — expert consensus Q1.f prior shoulder injections              │
// │  Binding on RotatorCuffProcedure.category is extensible. See ADR-0033      │
// │  (original binding) and ADR-0066 (rename).                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: RotatorCuffProcedureCategory
Id: rotator-cuff-procedure-category
Title: "Rotator Cuff Procedure Category ValueSet"
Description: "SNOMED CT category codes for RotatorCuffProcedure: surgical procedure, physical therapy procedure, administration of medication. Extends the standard FHIR procedure-category set (which omits PT and injection) to fit the expert consensus scope."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-procedure-category"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-06-07"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#387713003 "Surgical procedure"
* http://snomed.info/sct#91251008 "Physical therapy procedure"
* http://snomed.info/sct#18629005 "Administration of medication"
