# ADR-0039: Three-layer SECEC accounting (Hurley / Supplementary / IG-Operational) and Q12 / Q7 corrections

**Date:** 2026-05-19
**Status:** Accepted — supersedes the coverage statistics in ADR-0036; preserves the structural work in ADR-0027; **three-layer accounting revised to two-layer by ADR-0054 (2026-05-22); per-element Full/Partial classification replaced by the code/value provenance axis in ADR-0178 (2026-08-25)**

> **Status update (2026-09-12, ADR-0189):** The Q12 collapse into the single element `Q12-SSV-SANE` stands. Its stated reason does not: the slash is not the paper's notation for one dual-named instrument. SSV and SANE are two separately published instruments, and the pair is counted once because the source never separates them, only the subjective shoulder value having been on the round 2 ballot. The IG keeps a profile for each. Body below unedited for audit trail.

> **Status update (2026-08-25, ADR-0178):** The per-element Full/Partial "coverage status" classification this lineage carries was replaced by a two-facet code/value **terminology-provenance** axis (`Reused` / `Local` / `Numeric`). Representability (0 Missing) and the two-layer (Consensus / IG-Operational) accounting remain in force; only the per-element status column changed. Body below unedited for audit trail.

> **Status update (2026-05-22, ADR-0054):** Layer 2 (Supplementary) was retired — the four convenience PROMs (ASES, WORC, DASH, QuickDASH) were removed from the IG; the fifth row (lost-to-follow-up) was relocated to Layer 3 (`L3.H.4`). The IG is now two-layer (Hurley + Layer 3). The Q7 / Q12-SSV-SANE / Layer-3 structural decisions in this ADR remain in force; the body below is unedited for audit trail.

## Context

ADR-0036 (2026-05-18) re-baselined the SECEC denominator from an inflated 68 to a Hurley-anchored 60 elements (43 Full + 17 Partial + 0 Missing; 71.7% Full; 100% Full+Partial), and introduced a two-layer model separating Hurley-named elements from supplementary clinical PROMs (ASES, WORC, DASH, QuickDASH, lost-to-follow-up).

A subsequent word-by-word audit of Hurley et al. (2024) against the v2 mapping on 2026-05-19 — preparing for thesis defence — surfaced two residual inflation errors that ADR-0036 did not catch, and one structural gap in the accounting framework itself:

### 1. Q12 SSV/SANE is one instrument, not two

Hurley A12 reads, verbatim:

> "The preferred clinical outcome scores are **the Constant score and subjective shoulder value/single assessment numeric evaluation score**."

The slash in "subjective shoulder value/single assessment numeric evaluation score" is Hurley's notation for a single dual-named instrument. The paper's Discussion confirms this:

> "there was strong consensus that **the Constant score and SSV/SANE** were the preferred clinical outcome scores"

Hurley names **two preferred instruments**: Constant and SSV/SANE (treated as one). The current mapping splits SSV and SANE into separate elements (`Q12-SSV` and `Q12-SANE`), yielding 3 preferred-instrument rows where Hurley names 2. This inflates Q12 from 9 to 10 sub-elements and the Hurley total from 59 to 60. It is the same class of fabrication that ADR-0036 was supposed to close — caught on a second pass because the surrounding ADR-0036 decomposition (collapsing Q3/Q5/Q6/Q7/Q10/Q13) had drawn attention to multi-row inflation, not to slash-coordination inside one element name.

### 2. Q7 (ultrasound) did not achieve consensus

Hurley's own Methods section, §"Final voting":

> "Consensus was defined as 80%-89%, strong consensus as 90%-99%, and unanimous consensus was indicated by receiving 100% of the votes in favor of a proposed statement."

And the Results overview:

> "Of the 13 total questions and consensus statements on rotator cuff tears, 1 achieved unanimous consensus, 6 achieved strong consensus, 5 achieved consensus, and **1 did not achieve consensus**."

The one that did not pass is Q7 (ultrasound routinely as first-line, 60% agreement). The current mapping nevertheless counts Q7 in the consensus denominator as a "Full" element. The Q7 row label in the .md table already reads "(no consensus)" but the totals row sums Q7 in. This is methodologically inconsistent: Hurley's own framing is "12 consensus statements achieved + 1 that did not." A faithful Hurley-anchored denominator excludes Q7.

### 3. There is no enumeration of elements the IG carries beyond Hurley

The IG is an interoperable data model, not a clinical minimum data set. To be addressable, it must carry many elements Hurley never names — `Patient.identifier`, `Patient.address`, `Patient.birthDate`, `Procedure.performedDateTime` (load-bearing — Q11 timepoints are computed from it), `Encounter.period`, `Condition.bodySite` for laterality, status fields, cross-resource references, transaction-bundle envelopes, `ShoulderResearchCarePlan`, `ShoulderServiceRequest`, the full `ShoulderCoverage` structure for what Hurley names with one word ("Workmen's compensation"). These are documented piecemeal across ADRs 0014b, 0017, 0021, 0025, 0026, 0028, 0029, 0030, 0032, 0033, 0034, 0037, and 0038, but no ADR frames them as a category, and they are invisible in the current "coverage of N Hurley elements" headline.

This gap is also a thesis-level finding: *a clinical consensus paper is necessary but not sufficient as a specification for an interoperable data model; closing the gap is the engineering contribution.* The accounting framework should make this visible rather than hide it.

## Decision

1. **Collapse `Q12-SSV` and `Q12-SANE` into a single `Q12-SSV-SANE` element.** Hurley names them as one slashed dual instrument; the mapping must too. Status: **Partial** (no SNOMED CT International / LOINC binding at time of authoring; local code used). Q12 sub-element list after fix: `Q12.a–g` (7 components) + `Q12-Constant` + `Q12-SSV-SANE` = 9 elements.

2. **Remove Q7 from the Hurley denominator.** Hurley's own framing is "12 consensus statements achieved + 1 that did not". Q7 moves to Layer 3 with the note: *"IG supports ultrasound recording (`ShoulderImagingStudy` with modality US); Hurley achieved 60% agreement on routine first-line use — below the 80% Delphi threshold."* The IG capability remains; only the accounting changes.

3. **Introduce Layer 3 — IG-Operational completeness.** Enumerate elements the IG carries beyond what Hurley names, grouped by category A–I:

   - **A** Patient identity & contact (identifier, name, birthDate, address, telecom)
   - **B** FHIR-required resource metadata (clinicalStatus, verificationStatus, category, status fields)
   - **C** Temporal anchoring (`Procedure.performedDateTime`, `Encounter.period`, `Observation.effectiveDateTime`, `Condition.onset[x]`, `Condition.recordedDate`, `Procedure.recorded` extension)
   - **D** Laterality (`Condition.bodySite`, `Procedure.bodySite` bound to `ShoulderLaterality`)
   - **E** Diagnosis & procedure coding (`Condition.code` ← `RotatorCuffDiagnosis`; `Procedure.code` ← `ShoulderProcedureType`; `Procedure.category` ← `ShoulderProcedureCategory`)
   - **F** Cross-resource linkage (`Encounter.reasonReference`, `Procedure.reasonReference`, `Condition.evidence.detail`, `subject` slots)
   - **G** Workflow & orchestration (three transaction-bundle profiles, `ShoulderResearchCarePlan`, `ShoulderServiceRequest`, `Questionnaire` / `QuestionnaireResponse` artifacts)
   - **H** Provider / operational (`Procedure.performer.actor`, `Procedure.outcome`, `Procedure.note`)
   - **I** Hurley-named-as-single-word-but-IG-structured-richly (`ShoulderCoverage` for Q1.l; `PriorTreatmentCategory` for Q1.f; Q7 ultrasound relocated here)

   Layer 3 row count is enumerated in `mapping/SECEC_FHIR_Mapping.csv` (~25–30 rows). Layer 3 is **reported but not counted toward `% Full` over Hurley** — coverage statistics remain measured against the Hurley denominator only, so the Bikkanuri (2024) registry-to-FHIR benchmark comparison stays apples-to-apples.

4. **Re-baseline Hurley coverage to 42 Full + 16 Partial + 0 Missing of 58 elements** (100% Full+Partial; 72.4% Full).
   - Denominator: 60 → 58 (−1 Q12 SSV/SANE collapse, −1 Q7 removal)
   - Full: 43 → 42 (Q7 was Full)
   - Partial: 17 → 16 (Q12-SSV + Q12-SANE Partial rows collapsed into one Q12-SSV-SANE Partial row)

5. **Preserve ADR-0027, ADR-0036, and the April 2026 snapshot unchanged.** Add forward-pointer top-of-file status notes to ADR-0027 and ADR-0036 referencing this ADR. No historical content is rewritten.

6. **Profile FSH files are unchanged.** Every Layer 3 element is already encoded in existing FSH; only the mapping doc, CSV, the project guides, and thesis are revised. No HAPI revalidation needed.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| **Three separate ADRs** (one per correction) | The three corrections are mutually reinforcing (all narrow the consensus denominator while making the IG-operational breadth visible); splitting them creates three cross-refs to manage in the mapping doc and thesis without granularity benefit. ADR-0036 set the precedent of bundling related re-baseline changes in one ADR. |
| **Keep Q7 in the denominator with an explicit "no consensus" annotation** | Mapping row text already reads "(no consensus)" but the totals still sum Q7 in — the inconsistency is exactly what defence committee will challenge. Hurley's own framing is "12 statements + 1 that didn't pass"; the mapping should mirror that. |
| **Layer 3 as a separate companion file** (`SECEC_FHIR_IG_Operational.csv`) | CSV is the machine-readable source of truth; one file with a `Layer` column is simpler to maintain and grep than two files to keep in sync. |
| **Combined Hurley + Layer 3 coverage percentage** | Inflates against the Bikkanuri (2024) 80% benchmark, which is consensus-driven. Apples-to-apples comparison requires Hurley-only %. Layer 3 is reported as breadth, not as % coverage. |
| **Edit ADR-0036 in place** | Loses the audit trail showing that a second-pass inflation was caught and corrected. ADR-0036 stays as the record of the first correction; ADR-0039 records the second. |
| **Delete Q12-SSV and Q12-SANE rows from the CSV without an explicit `Q12-SSV-SANE` row** | Loses the implementation hook (one row = one observed mapping target); making it a single row preserves IG-side traceability. |

## Consequences

✅ Hurley denominator is now genuinely faithful: 58 elements that all (a) appear in Hurley A1–A13 as lettered or single-statement items, and (b) achieved the 80% Delphi consensus threshold.

✅ Q7's IG capability is preserved (Layer 3, with `ShoulderImagingStudy` modality US) — only the accounting changes; nothing breaks for any registry that wants to record ultrasound studies.

✅ Layer 3 makes the engineering contribution visible. The thesis can now state both the Hurley % (clinical consensus addressability) and the operational scaffold count (elements required for interoperability beyond consensus).

✅ Three-layer model gives the thesis a reusable framework: future specialty registries translating consensus papers into FHIR IGs can apply the same Consensus / Supplementary / Operational decomposition.

✅ Bikkanuri (2024) 80% benchmark comparison stays apples-to-apples — Hurley % only, against a denominator the paper authors themselves would recognize as faithful.

✅ FSH artifacts are untouched. Zero risk to HAPI loading or IG Publisher build; no revalidation needed.

✅ Audit trail intact: ADR-0027 (v0), ADR-0036 (v1 → v2), ADR-0039 (v2 → v3) form a single chain of forward-pointers.

⚠️ Headline element count drops from 60 → 58. Readers comparing this IG to the prior ADR-0036 figure will see the change.

⚠️ Full count drops from 43 → 42 (Q7 was Full).

⚠️ Coverage percentages shift: 71.7% Full → 72.4% Full (the removed Q7-Full row plus the SSV+SANE Partial collapse pull the % up slightly). 100% Full+Partial is preserved.

⚠️ Q12 implementation hook count drops: the IG still defines `SsvScoreObservation` and `SaneScoreObservation` as separate Observation profiles, but the mapping treats them as one consensus element. The profiles stay valid — only the consensus-element accounting collapses. Documented in the new `Q12-SSV-SANE` CSV row's `IG Implementation` column.

❌ None identified.

## Sources

- Hurley ET et al. (2024). European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus. *JSES International* 8(3):478–482. [doi:10.1016/j.jseint.2024.01.015](https://doi.org/10.1016/j.jseint.2024.01.015). Read in full during the audit.
- ADR-0027 — `0027-complete-secec-coverage-standard-terminologies.md`, amended with forward-pointer; body preserved.
- ADR-0036 — `0036-honest-secec-coverage-rebaseline.md`, amended with forward-pointer; body preserved.
- `mapping/SECEC_FHIR_Mapping.md` — v3 revision with Layer 3 section.
- `mapping/SECEC_FHIR_Mapping.csv` — `Layer` column added; Q12 rows collapsed; Q7 reclassified; Layer 3 rows appended.
- the project guide — coverage paragraph updated.
- the project guide — coverage bullet updated.
- the thesis 04_methods chapter — new subsection on Hurley decomposition methodology.
- the thesis 05_results chapter — coverage section rewritten with three subsections (Hurley / Supplementary / Layer 3).
- the thesis 06_discussion chapter — "consensus is necessary but not sufficient" paragraph added; Q7 limitation noted.
- the thesis 07_conclusion chapter — three-layer-decomposition knowledge bullet added.
- the thesis appendix chapter — three tables populated.
- Audit conducted 2026-05-19: a word-by-word read of the consensus paper against the v2 mapping.
