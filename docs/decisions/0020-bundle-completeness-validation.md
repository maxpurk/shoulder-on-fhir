# ADR-0020: Bundle-level validation — scope, SECEC completeness, and HAPI provenance gap

**Date:** 2026-05-05
**Status:** Accepted

## Context

After implementing the `ShoulderRegistrationBundle` profile and the validate-before-submit pattern (ADR-0017), the question arose: should the bundle profile enforce which *observation categories* must be present in a conformant submission? A submission of Patient + Condition + Procedure with zero observations would pass structural validation despite being clinically incomplete.

The SECEC paper (Hurley et al. 2024, JSES International 8(3):478-482) was reviewed to determine whether any elements could be attributed as mandatory.

**What the paper actually says:**

The paper does not distinguish mandatory from optional elements. It defines 13 questions with four consensus levels:

| Level | Definition | Questions |
|-------|------------|-----------|
| Unanimous (100%) | Patient history: age, gender, comorbidities, smoking, traumatic etiology, prior treatment, pain, sleep disturbance, sports, occupation, workmen's compensation, hand dominance, functional limitations | Q1 |
| Strong consensus (90–99%) | Physical exam, tear classification, treatment success, post-treatment exam, research follow-up, PROMs, follow-up imaging | Q2, Q4, Q8, Q9, Q11, Q12, Q13 |
| Consensus (80–89%) | Radiographs, advanced imaging (MRI/CT), follow-up duration | Q3, Q5, Q6, Q10 |
| No consensus (<80%) | Ultrasound as first-line | Q7 |

The paper's conclusion states: *"We encourage surgeons to use this minimum set of variables to establish rotator cuff registries and multicenter studies."* The "minimum set" refers to the entire 13-question dataset as a whole — it is not a ranked or prioritized list.

Attributing specific observation categories (e.g., ROM, imaging classification) as "mandatory" in the IG would misrepresent the paper: it does not single out any Q2-Q13 items as more required than others.

**A second finding emerged during this analysis: HAPI does not retain the original transaction bundle.**

After a transaction bundle is POSTed to `POST /fhir/DEFAULT/`, HAPI processes the entries atomically and stores the individual resources. The bundle envelope is discarded — confirmed by querying `GET /Bundle` which returns `total: 0`. There is no server-side record of which resources were submitted together as a single registration. Bundle-level validation therefore requires either (a) calling `Bundle/$validate` before submission, or (b) reconstructing the bundle from stored resources for post-hoc audit.

## Decision

**Do not add FHIRPath invariants** to `ShoulderRegistrationBundle` for observation categories.

The bundle profile already enforces what can be justified as required for any registry entry:
- `ShoulderPatient 1..1` — without a patient, no registry entry is possible
- `RotatorCuffCondition 1..1` — the diagnosis is the clinical reason for the entry
- `ShoulderProcedure 1..1` — this IG scopes to surgical treatment; a procedure-free entry is out of scope

All other entries (`ShoulderObservation 0..*`, `ShoulderImagingStudy 0..1`, etc.) remain optional. This is consistent with the SECEC paper's equal weighting of Q2-Q13 as a recommended minimum set for registries — not a per-submission checklist.

**What is implemented for completeness:**

1. **Validate-before-submit in both frontends** — `fhirClient.validateBundle()` calls `POST /Bundle/$validate` before `submitBundle()`. This validates the bundle structure (required slices present, cardinality, resource type conformance) and each entry resource against its declared profile. Any `error` or `fatal` issue blocks submission. Implemented in `RegistrationWizard.tsx` (primary wizard) and `QuestionnaireForm.tsx` (SDC frontend).

2. **SDC Questionnaire `required: true`** — In the SDC frontend, the Questionnaire resource marks 9 fields as `required: true`: given name, family name, date of birth, gender (Q1 core), rotator cuff diagnosis, affected side (Q4), and procedure type, date, side (surgical core). These block form submission in the browser. This enforces the same surgical core as the bundle profile — it does **not** enforce ROM measurements, provocation tests, imaging classifications, or PROMs, which are optional fields in the Questionnaire.

## Architectural Context — Three Submission Patterns

The FHIR ecosystem offers three distinct architectures for registry data submission, each with different completeness enforcement characteristics. This IG uses Architecture 1; the others are documented here for context and future work.

**Architecture 1 — Multiple resources, per-profile validation (this IG)**

The submission is a `ShoulderRegistrationBundle` containing discrete FHIR resources (Patient, Condition, Procedure, Observations). Each resource is validated against its declared profile. Completeness at the bundle level is limited to the three required slices (`1..1`); all observations are `0..*`. This is the norm in registry FHIR IGs and maximises semantic queryability — clinicians can query `Observation?code=forward-flexion&value-quantity=lt90` directly against stored resources.

*Both frontends use this architecture.* The wizard (localhost:3000) builds resources directly from form fields; steps 4/5/6 (Imaging, Clinical Assessment, Outcome Scores) are explicitly skippable. The SDC frontend (localhost:3001) additionally captures data as a `QuestionnaireResponse` and runs client-side extraction (`extractor.ts`) before submitting both the extracted resources and the QR together — following the FHIR spec recommendation to retain the QR as an audit trail. Crucially, extraction is conditional: every observation is only added `if (value !== undefined)`, so unanswered fields produce no resource and no error.

**Architecture 2 — Single QuestionnaireResponse**

The entire dataset is captured and stored as one QR. Completeness is enforced via `required: true` on Questionnaire items — one `$validate` call covers the whole submission. However, a QR is not semantically queryable: a server cannot answer "all patients with abduction < 90°" against a QR without parsing registry-specific `linkId` strings. The HL7 SDC IG itself anticipates extracting QR content back into discrete resources for downstream use, which collapses Architecture 2 back into Architecture 1.

**Architecture 3 — FHIR Logical Model + server-side completeness (CREDS pattern)**

The HL7 CREDS IG (Protocols for Clinical Registry Extraction and Data Submission) defines a `CREDSStructureDefinition` — a Logical Model that maps every registry data element to a FHIRPath location across resources. The server validates the whole bundle against this model and returns a `CREDSOperationOutcome` listing which elements were found, missing, or require manual entry. This solves the cross-resource completeness gap of Architecture 1.

In practice, the CREDS approach carries substantial implementation complexity: the CathPCI registry pilot required >11,000 lines of StructureDefinition code, and only 111 of 344 data concepts (32%) were sufficiently discrete for automated FHIRPath mapping. For a first-of-kind IG with no prior FHIR standardisation in this domain, Architecture 1 is the appropriate starting point. Architecture 3 is the natural next step for production deployment and is identified here as future work.

**Summary**

| Architecture | Completeness enforcement | Semantic queryability | Complexity |
|---|---|---|---|
| 1 — Multi-resource bundle (this IG) | Bundle profile: surgical core only | ✅ Full FHIR queryability | Low |
| 2 — Single QuestionnaireResponse | `required: true` per item | ❌ Not queryable without parsing linkIds | Low |
| 3 — Logical Model + CREDS | Server-side, whole-bundle | ✅ Full (resources extracted) | High |

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| FHIRPath invariants for observation categories (e.g. ROM, imaging) | Cannot be attributed to the SECEC paper — the paper treats all Q2-Q13 items as equally recommended. Arbitrary IG-author choices dressed up as paper requirements would misrepresent the source and weaken the thesis argument. |
| FHIRPath invariants framed explicitly as IG design choices (not paper-derived) | Valid in principle, but the selection of which categories to enforce would remain arbitrary without clinical evidence beyond the paper. The thesis evaluation is stronger with a transparent, paper-grounded rationale. |
| HAPI server-side interceptor enforcing bundle profile at POST | Would require custom HAPI Java code outside the thesis scope. The validate-before-submit pattern achieves the same user-facing effect for the prototype. Compatible future extension. |
| CQL Measure for registry completeness | Appropriate for population-level quality measurement (e.g., "what % of registrations include a Constant score?"), not for blocking individual submissions. Requires a CQL engine not deployed in this stack. |

## Consequences

✅ Bundle profile cardinality (`Patient/Condition/Procedure 1..1`) is grounded in clinical necessity, not arbitrary selection  
✅ Validate-before-submit catches structural conformance issues (wrong resource types, missing required slices, profile violations) before any data is written  
✅ The design is honest about what the IG enforces vs. what is a clinical workflow expectation  
⚠️ **Observations beyond the surgical core are not enforced at any layer.** ROM measurements, strength tests, provocation tests, imaging classifications (Goutallier, Patte), and PROMs are optional in the bundle profile (`0..*`), have no `required: true` in the Questionnaire, and have no FHIRPath invariant. A technically conformant submission can consist of Patient + Condition + Procedure only. Completeness of the full SECEC dataset beyond the surgical core is a clinical workflow expectation, not a technical constraint enforced by this IG.  
⚠️ HAPI discards the transaction bundle after processing — post-hoc bundle-level validation requires reconstructing the bundle from stored resources; there is no server query to retrieve "all resources from submission X"  
⚠️ A client that bypasses `validateBundle()` and POSTs directly will succeed even if optional entries are absent — this is by design, consistent with the paper's "recommended" framing  
⚠️ The Q7 ultrasound "no consensus" finding is not modelled as a FHIR constraint — `ShoulderImagingStudy` accepts all DICOM modalities; the no-consensus status is documented in the mapping only  

## Sources

- Hurley et al. (2024) — JSES International 8(3):478-482 — primary source; consensus levels and "minimum set" language
- `mapping/SECEC_FHIR_Honest_Mapping.md` — implementation-verified element-by-element coverage
- `ig/input/fsh/profiles/ShoulderRegistrationBundle.fsh` — current bundle profile (no invariants)
- `frontend/src/lib/fhirClient.ts` — `validateBundle()` method
- `frontend/src/components/RegistrationWizard.tsx` — validate-before-submit
- `sdc-frontend/src/lib/fhirClient.ts` — `validateBundle()` method
- `sdc-frontend/src/components/QuestionnaireForm.tsx` — validate-before-submit
- ADR-0017 — `ShoulderRegistrationBundle` profile rationale and `entry` slice cardinalities
- ADR-0018 — SDC Questionnaire frontend; `required: true` item semantics
- HL7 CREDS IG — Protocols for Clinical Registry Extraction and Data Submission; Architecture 3 reference
- `sdc-frontend/src/lib/extractor.ts` — conditional observation extraction (`if value !== undefined`)
