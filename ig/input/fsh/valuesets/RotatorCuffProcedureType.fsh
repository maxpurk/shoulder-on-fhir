// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffProcedureType                                                  │
// │  Enumerated SNOMED CT codes for rotator-cuff procedures: surgical          │
// │  interventions, frequent concomitant procedures, and prior non-surgical    │
// │  treatments (consensus Q1.f — PT / injection). Scope and provenance in      │
// │  ADR-0032; completeness review (debridement, decompression) in ADR-0092.   │
// │  Binding on RotatorCuffProcedure.code is extensible.                       │
// │  Renamed from `ShoulderProcedureType` per ADR-0066.                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: RotatorCuffProcedureType
Id: rotator-cuff-procedure-type
Title: "Rotator Cuff Procedure Type ValueSet"
Description: "Enumerated SNOMED CT codes for rotator cuff procedures (surgical, concomitant, prior non-surgical). Editorial baseline; binding is extensible."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-procedure-type"
* ^version = "0.3.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-21"
* ^publisher = "Hasso Plattner Institute"

// Rotator cuff repair — granularity within the expert consensus index procedure
* http://snomed.info/sct#699120002 "Arthroscopic repair of rotator cuff"
* http://snomed.info/sct#56060000 "Repair of musculotendinous cuff of shoulder"
* http://snomed.info/sct#304384006 "Complete repair of rotator cuff"
* http://snomed.info/sct#304385007 "Partial repair of rotator cuff"
* http://snomed.info/sct#429598009 "Revision of repair of rotator cuff"

// Debridement — for irreparable/partial tears where formal repair is not
// performed; distinct decision from "Partial repair" above (debridement
// removes degenerate tissue without reattaching tendon to footprint).
// Added per ADR-0092.
* http://snomed.info/sct#18856005 "Arthroscopy of shoulder with extensive debridement"
* http://snomed.info/sct#29563005 "Arthroscopy of shoulder with limited debridement"

// Shoulder arthroscopy and bony decompression — three distinct acts, not
// redundant: Acromioplasty = acromial bone resection specifically; Anterior
// decompression = generic/Neer-type decompression (synonym: "Subacromial
// decompression" — already covers that literal term); Arthroscopic shoulder
// decompression = the arthroscopic-technique-specific variant, added per
// ADR-0092 to parallel the arthroscopic/open distinction already made for
// repair above.
* http://snomed.info/sct#281812007 "Arthroscopy of shoulder"
* http://snomed.info/sct#77474007 "Acromioplasty of shoulder"
* http://snomed.info/sct#298672007 "Anterior decompression of shoulder joint"
* http://snomed.info/sct#430263007 "Arthroscopic shoulder decompression"

// Frequent concomitant procedures
// (Biceps tenotomy intentionally omitted — no verified international SNOMED CT
// concept; the prior `847191000168109` is a SNOMED CT-AU national-extension code
// and fails tx.fhir.org lookup. Recordable via Procedure.code.text under the
// extensible binding of RotatorCuffProcedure.code.)
* http://snomed.info/sct#439861005 "Arthroscopy of shoulder with biceps tenodesis"
* http://snomed.info/sct#734057006 "Excision of distal clavicle"

// Shoulder arthroplasty (relevant for rotator cuff tear arthropathy pathway)
* http://snomed.info/sct#308681004 "Prosthetic arthroplasty of shoulder"
* http://snomed.info/sct#785850002 "Reverse total shoulder arthroplasty"

// Prior non-surgical treatments (expert consensus Q1.f — PT / injection)
* http://snomed.info/sct#91251008 "Physical therapy procedure"
* http://snomed.info/sct#27813003 "Intra-articular injection"
* http://snomed.info/sct#290035003 "Injection into shoulder joint"
