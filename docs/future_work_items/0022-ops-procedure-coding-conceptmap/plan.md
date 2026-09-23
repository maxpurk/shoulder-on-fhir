# OPS procedure coding (German) as a ConceptMap target

> **Status:** Future work item — deliberate scope boundary, not a defect. Logged 2026-08-15
> from clinical-feedback point #39 ("we are not really using OPS").

## Gap

The IG binds `Procedure.code` to SNOMED CT and carries no OPS (Operationen- und
Prozedurenschlüssel) coding: OPS appears in no binding anywhere under `ig/input/fsh/` (0 hits).
No mapping from the SNOMED-coded rotator cuff procedures to their OPS equivalents currently
exists.

## Why it matters

OPS is the mandatory procedure classification for inpatient billing and reimbursement in German
healthcare (DRG/G-DRG coding), so any real-world German deployment would need rotator cuff
procedures expressible as OPS codes — not just SNOMED CT. The clean way to add this without
disturbing the international-first SNOMED binding is a FHIR `ConceptMap` from the IG's procedure
value set to OPS, populating `Procedure.code` with an additional OPS coding. The same pattern
applies to ICD-10-GM as an alternative comorbidity/diagnosis coding alongside the primary SNOMED
binding.

## Note

Not a defect — the SNOMED-CT-first binding is a conscious international-demonstrability choice
(same rationale as [[0008-german-national-base-ig-layering]]). OPS/ICD-10-GM concept-map targets
become relevant only if real-world German hospital deployment and billing integration are pursued.
