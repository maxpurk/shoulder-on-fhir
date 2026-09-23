// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorNonSurgicalTreatmentType                                             │
// │  Narrow enumeration of the 3 non-surgical treatment codes already listed   │
// │  at the bottom of RotatorCuffProcedureType (consensus Q1.f — PT/injection). │
// │  Binds ShoulderRegistrationQuestionnaire's priorTreatment.type item so the │
// │  SDC form cannot offer a surgical procedure code for a "prior             │
// │  non-surgical treatment" question. See ADR-0133.                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PriorNonSurgicalTreatmentType
Id: prior-non-surgical-treatment-type
Title: "Prior Non-Surgical Treatment Type ValueSet"
Description: "SNOMED CT codes for prior non-surgical shoulder treatments (physical therapy, injections), the non-surgical subset of RotatorCuffProcedureType. Binding is extensible, matching the parent enumeration's own tolerance."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-non-surgical-treatment-type"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-08-03"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#91251008 "Physical therapy procedure"
* http://snomed.info/sct#27813003 "Intra-articular injection"
* http://snomed.info/sct#290035003 "Injection into shoulder joint"
