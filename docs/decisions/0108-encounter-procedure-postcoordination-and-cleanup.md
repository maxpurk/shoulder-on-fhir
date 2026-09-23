# ADR-0108: Encounter/Procedure wording, incision-suture times, procedure-technique postcoordination, and cleanup (round-2 surgeon feedback, points 12-14)

**Date:** 2026-07-27
**Status:** Accepted

## Context

Continuing the round-2 surgeon feedback ( see ADR-0105/0106/0107 for the earlier points), three points concerned the Surgery wizard's Encounter and Procedure steps:

**Point 12 — Encounter.** Change "Ambulatory" to "Outpatient." Add Schnittzeit (incision time) and Nahtzeit (suture/closure time). Remove a redundant duplicate procedure date, since "we already have the date for the procedure."

**Point 13 — Procedures.** Requested a postcoordination remodel similar to diagnosis: Arthroscopic vs. Open; Partial reconstruction vs. Complete reconstruction vs. Shoulder prosthesis; anchor-based fixation (single-row, etc.).

**Point 14 — Procedure.** "Performed" date not needed (redundant with the surgery date already known). Procedure status must not be asked — delete it. Rename "outcome" to "intraoperative success."

## Decision

**Point 12(a):** `EncounterStep.tsx`'s `v3-ActCode#AMB` option label changed from `"Ambulatory (AMB)"` to `"Outpatient (AMB)"` — wording only; `v3-ActCode` binding (FHIR-required, `L3.B.5`) and the underlying code are unchanged; "ambulatory" is that CodeSystem's own term, not this IG's choice.

**Points 12(b)/12(c)/14(a) — incision/suture times, redundant date removal (one combined fix):** `RotatorCuffProcedure.performed[x]` was already `1..1 MS, only dateTime or Period` with `performedPeriod` already `MS`-flagged but unused (deferred in ADR-0092). `SurgicalProcedureFormItem`'s single `performedDate` field is replaced with `incisionTime`/`sutureTime` (both `datetime-local`), built into `Procedure.performedPeriod.start`/`.end`. This simultaneously satisfies 12(b) (the new granular timestamps) and closes the redundancy the surgeon flagged in 12(c)/14(a): `Encounter.period` (the broader admission window) and the per-procedure date are no longer two independently-editable coarse dates — the procedure now carries only the granular incision/suture clock. The Q11 follow-up-timepoint anchor (`patientStage.ts::findIndexProcedure`, `TimepointPicker.tsx`) is updated to read `performedPeriod.start` via a new `getProcedureEffectiveDate()` helper, falling back to `performedDateTime` for older seeded/submitted data still using that shape. Prior-treatment Procedures (Registration bundle, Q1.f) are unaffected by this change — they still use `performedDateTime`, defaulted to the registration date per ADR-0105, since that is a separate part of the model with its own already-settled redundancy fix.

**Point 14(b) — status:** `ProcedureStep.tsx`'s status dropdown (`completed`/`in-progress`/`preparation`/`stopped`) is removed. `buildProcedureResource` now hardcodes `status: 'completed'` — every procedure recorded through this retrospective wizard is completed by construction. `Procedure.status` stays `1..1 MS` (FHIR-required, `L3.B.4`) — only the UI prompt disappears, the same pattern already used for `Condition.verificationStatus` (ADR-0106) and `Observation.status`.

**Point 14(c) — outcome relabel:** `ProcedureStep.tsx`'s "Outcome" label changed to "Intraoperative Success." No FHIR/FSH change — `Procedure.outcome` (`L3.H.2`) cardinality and coding are unchanged.

**Point 13 — procedure-technique postcoordination:** three new axes, decoupled from `Procedure.code` (which today bakes technique into fused SNOMED concepts, e.g. `699120002` "Arthroscopic repair of rotator cuff" vs. `56060000` open equivalent), each linked to the specific `RotatorCuffProcedure` it describes via `Observation.partOf` (needed because a Surgery encounter can carry an index procedure plus 0..* concomitant procedures):
1. **`ProcedureApproachObservation`** (arthroscopic / open / mini-open) — fully local `ProcedureApproachCodes`/`ProcedureApproach`. Live SNOMED verification found a generic `129236007` "Open approach - access" qualifier but no equivalent standalone "arthroscopic approach" qualifier (SNOMED bakes "arthroscopic" into whole-procedure concepts instead) — kept fully local for internal consistency rather than mixing one real code with two invented ones.
2. **`ReconstructionExtentObservation`** (partial repair / complete repair / prosthesis) — `ReconstructionExtent` ValueSet reusing four precoordinated SNOMED CT concepts (`304385007` partial, `304384006` complete, `308681004` anatomic prosthesis, `785850002` reverse total prosthesis) as Observation values, the same reuse pattern `TearThicknessObservation` (ADR-0106) already applies.
3. **`FixationTechniqueObservation`** (single-row / double-row / suture-bridge / transosseous-no-anchor / not-applicable) — fully local `FixationTechnique` ValueSet. This is the one sub-axis flagged as a genuine **(d) out-of-consensus addition** (a new coded axis with no prior representation in this IG, unlike the other two which decouple axes that were already implicitly present, entangled inside `Procedure.code`) — routed through explicit user go/no-go before implementation, per the project's Clinical Feedback Integration Workflow. Tier list and clinical definitions (including why suture-bridge is kept distinct from plain double-row, and why both a "transosseous without anchors" and a "not applicable" catch-all are needed rather than one generic "other") were confirmed via the `shoulder-surgeon` subagent.

All three are Layer 2 (IG-operational) — the SECEC consensus (Q1-Q13) never enumerates procedure technique (confirmed against Hurley et al. 2024 full text, already established by ADR-0092); new mapping rows `L3.E.6`/`L3.E.7`/`L3.E.8`, all Full, do not affect the Hurley `% Full` headline. `assembleSurgeryEntries`/`surgeryBundleBuilder.ts` were refactored to pre-tag each `Procedure` with its own uuid before assembly (rather than generating one at assembly time) so these Observations can reference the correct procedure.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Model incision/suture times as a new local `Procedure` extension | `performedPeriod` is FHIR's own standard slot for exactly this (a start/end pair for when a procedure was performed) and was already `MS`-flagged on `RotatorCuffProcedure` but unused — no extension needed. |
| Keep `Procedure.performedDateTime` for the surgery wizard, add incision/suture as separate new Observations | Would keep three overlapping temporal facts (Encounter.period, Procedure.performedDateTime, two new Observations) instead of one (Procedure.performedPeriod) — directly reintroduces the redundancy the surgeon flagged. |
| Represent approach/reconstruction-extent as `Procedure.extension` fields rather than sibling Observations | This IG's established precedent (ADR-0064, ADR-0076, ADR-0106) is to decouple sub-axes as sibling Observations linked via a reference (`evidence.detail` for Condition, `partOf` for Procedure), not extensions — keeps the axes independently queryable without a combinatorial explosion of extension definitions. |
| Merge "double-row" and "suture-bridge" into one tier | Per the `shoulder-surgeon` subagent's review, suture-bridge is a specific double-row sub-variant with its own distinct compressive mechanism — a distinction the surgical literature and peer registries preserve; merging loses exactly the biomechanical detail that is the stated reason for capturing this field at all. |
| Add a generic "other" catch-all instead of the two specific tiers (`transosseous-no-anchor`, `not-applicable`) | Per the `shoulder-surgeon` subagent, fixation technique is a closed, well-defined taxonomy in current practice; an open "other" would reintroduce the free-text-equivalent noise problem that motivated several other points in this same feedback round (Q1.n, Q2.a). The two specific tiers are clinically distinct (a real anchor-less repair vs. a genuinely non-repair procedure) and both needed. |
| Require `fixationTechnique` (and the other two technique fields) on every procedure row | All three stay 0..1/optional — forcing an answer on concomitant procedures or non-repair index procedures (debridement, decompression, arthroplasty) would misrepresent "not assessed" as a real answer; cardinality, not a value-set escape hatch, represents "does not apply" here, consistent with this IG's general pattern. |

## Consequences

✅ `L3.B.4`, `L3.B.5`, `L3.C.1`, `L3.H.2` stay Full — all wording/UX cleanups, no consensus-coverage impact.
✅ Three new Layer 2 rows (`L3.E.6`, `L3.E.7`, `L3.E.8`), all Full — Layer 2 total 42 → 45 rows (44 Full + 1 Partial), Hurley headline (45/58, 77.6%) unaffected.
✅ The Encounter/Procedure date redundancy the surgeon flagged is fully closed — one granular temporal fact (incision/suture) replaces the prior coarse, duplicated one.
✅ `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` (tsc + vite) compiles cleanly.
⚠️ The standalone `ProcedureForm.tsx` (ad-hoc post-hoc procedure editing, reachable from `PatientDetail`, independent of the Surgery wizard flow) still uses the old `performedDateTime`/status-dropdown/`"Outcome"` shape — out of scope for this ADR (the surgeon's feedback was specifically about the Surgery wizard), left as a known inconsistency for a future pass.
⚠️ SDC frontend (port 3001) parity not implemented for any of points 12-14, consistent with this IG's standing precedent of SDC parity being a separate call (ADR-0064, ADR-0081-0083, ADR-0105, ADR-0106).
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. These SDC gaps remain open, tracked as ordinary parity items in the cross-frontend parity audit.*
❌ Seed bundles (`seed/bundles/{anna-mueller,kemal-demir}/`) and their narrative stories not yet updated to reflect `performedPeriod`, the new procedure-technique Observations, or the removed status/date fields — tracked as follow-up work in the batch checkpoint across all round-2 feedback points.

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), points 12-14
- ADR-0092 (procedure ValueSet completeness review — confirms `performedPeriod` was already MS-flagged but unused, and that Hurley never enumerates procedure technique)
- `shoulder-surgeon` subagent review — fixation-technique tier design and clinical definitions, 2026-07-27
- Live SNOMED CT lookups (`snomed_lookup`/`snomed_get_by_code`) — approach qualifiers (`129236007`), reconstruction-extent codes (`304385007`/`304384006`/`308681004`/`785850002`), fixation-technique axis (no match), 2026-07-27
- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh`, `ig/input/fsh/profiles/observations/{ProcedureApproach,ReconstructionExtent,FixationTechnique}Observation.fsh`
- `frontend/src/components/{surgery/EncounterStep.tsx,surgery/ProcedureStep.tsx,SurgeryWizard.tsx}`, `frontend/src/lib/{patientStage.ts,surgeryBundleBuilder.ts}`, `frontend/src/components/followup/TimepointPicker.tsx`
- `mapping/SECEC_FHIR_Mapping.csv` rows L3.B.4, L3.B.5, L3.C.1, L3.H.2, L3.E.6, L3.E.7, L3.E.8
