// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorTreatmentCategory                                                  │
// │  Category codes for consensus Q1.f prior non-surgical treatments. Used      │
// │  as a required binding on RotatorCuffRegistrationBundle.entry[priorTreatment] │
// │  to guarantee that surgical procedures (category 387713003) cannot appear  │
// │  in the Registration bundle — they belong in RotatorCuffSurgeryBundle.     │
// │  See ADR-0034.                                                             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PriorTreatmentCategory
Id: prior-treatment-category
Title: "Prior Non-Surgical Treatment Category ValueSet"
Description: "SNOMED CT category codes for expert consensus Q1.f (prior treatment including physical therapy / injections). Required binding on RotatorCuffRegistrationBundle.entry[priorTreatment].resource.category, enforces that surgical procedures cannot be placed in the Registration bundle."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-treatment-category"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true

* http://snomed.info/sct#91251008 "Physical therapy procedure"
* http://snomed.info/sct#18629005 "Administration of medication"
