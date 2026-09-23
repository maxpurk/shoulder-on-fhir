# ADR-0091: Patient Satisfaction and Return-to-Activity removed from Registration (T0)

**Date:** 2026-07-21
**Status:** Accepted

## Context

Next point in the surgeon-review notes, appended directly after the Constant-Murley point (ADR-0090):

> Please check consistency around this term throughout the whole pipeline. What is really a PROM? If the wording is misleading just drop it, if it makes sense leave it.

The note added that "Patient reported status" makes no sense at this timepoint, and began to propose a replacement wording but broke off — no alternative was ever supplied.

Since the note's own suggested replacement wording was never completed, this ADR treats the point as a scope/placement question rather than a renaming question: the surgeon's given reasoning ("makes no sense at this timepoint") is itself the actionable instruction.

**Investigation** (full-pipeline grep across FSH source, both frontends, ADRs, and the mapping files) found the concrete defect: the Registration wizard's Step 5 ("PROMs") rendered a card titled *"Outcome Scores (PROMs)"* containing a sub-section literally headed *"Patient-Reported Status"*, grouping two fields — **Patient Satisfaction** and **Return to Sport/Work** — at the pre-operative (T0) timepoint, before any surgery has occurred. Both fields are inherently retrospective: satisfaction is *with treatment*, and there is no "return" to speak of before an intervention. The mapping CSV already correctly scopes both elements `Timepoint=FollowUp` (Q8.e, Q12.e, Q12.g) — the CSV was never wrong; the Registration Questionnaire FSH instance and both frontends independently duplicated these two Observation profiles into the T0 flow, contradicting the mapping's own scoping. Same defect class ADR-0090 already fixed for Constant-Murley's "PROM" mislabel: correct instrument, wrong timepoint.

A milder, secondary instance of the same looseness was also found: the Registration example bundle's header comment called the baseline Constant-Murley capture a "baseline PROM observation" — defensible in intent (Constant/SSV/SANE *are* legitimately captured at T0, as a pre/post comparator — standard registry practice, unlike Satisfaction/Return-to-Activity which have no baseline meaning at all), but still definitionally loose, since nothing has been an "outcome" yet at baseline either.

User's explicit go/no-go (asked directly, since removing data-collection fields is a scope reduction, not covered by the note's own "if misleading just drop it" phrasing alone): **remove both fields from Registration entirely** (Follow-Up keeps them unchanged, where they are already correctly implemented); **also reword the milder baseline-label issue** to "baseline score" language.

## Decision

### 1. Remove Patient Satisfaction and Return to Sport/Work from the Registration Questionnaire

`ShoulderRegistrationQuestionnaire.fsh` — deleted `item[4].item[7]` (`obs.patient-satisfaction`) and `item[4].item[8]` (`obs.return-to-sport-work`) outright, replaced with a one-line comment explaining why. No renumbering needed (they were the last two items in the `outcomeScores` group). `patient-satisfaction-observation` and `return-to-activity-observation` remain fully defined profiles, untouched and still used exactly as before by `ShoulderFollowUpQuestionnaire.fsh` — this is a Registration-only removal, not a profile deprecation.

### 2. Mirror the removal in the unified frontend

`StepOutcomeScores.tsx` (Registration wizard) — removed the `useValueSet` calls for `SATISFACTION_SCALE`/`RETURN_TO_ACTIVITY`, the `satisfaction`/`returnToActivity` state destructuring, both Observation-building blocks in `handleSubmit`, and the entire "Patient-Reported Status" JSX section (two `<select>` fields). `stepFormData.ts`'s `OutcomeScoresFormData` loses the now-unused `satisfaction`/`returnToActivity` keys. Follow-Up's `Q12PromForm.tsx` — untouched; both fields remain exactly as before, since that's the correct timepoint for them.

### 3. SDC frontend — no extraction-logic change needed

`extractor.ts`'s `PROFILE_METADATA` entries for both profiles are generic (keyed by profile canonical, not by which Questionnaire references them) and required no change — removing the Registration Questionnaire items means the extractor simply never encounters those linkIds when processing a Registration submission; Follow-Up extraction is unaffected. Confirmed via grep that no Registration-specific special-casing of either profile existed anywhere in `extractor.ts`.

### 4. Reword remaining "PROM"/"Patient-Reported" labels still visible at T0

Everything below is comment/label wording only — no data-model or extraction-logic change:
- `StepOutcomeScores.tsx` card header: `"Outcome Scores (PROMs)"` → `"Baseline Outcome Scores"` (the only fields left in this card after §1–2 are Constant-Murley/SSV/SANE, none of which are Follow-Up-only PROMs at this timepoint).
- `RegistrationWizard.tsx` step-tab title: `"PROMs"` → `"Baseline Scores"`.
- `RotatorCuffRegistrationBundle.fsh` example header comment: `"baseline PROM observation"` → `"baseline outcome score observation (Constant-Murley — a pre/post comparator, not a 'PROM' in the outcome sense, since no treatment has happened yet)"`.
- `Home.tsx` (both frontends) landing-page blurb for the Registration flow: `"baseline exam + PROMs"` / `"baseline clinical assessment and PROMs"` → `"baseline outcome scores"` phrasing. The Follow-Up flow's landing-page blurb (`"post-op exam + PROMs"`) is unchanged — correct as-is.

Not touched: ADR prose, FSH doc-comment headers inside `ig/input/fsh/valuesets/ShoulderObservationCode.fsh`, and the mapping CSV/`.md` — all already internally consistent (the CSV's `Timepoint` column was the thing that was right all along), and low-priority per the audit (not user-facing, not misleading to a clinician using the app).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the fields at Registration, just reword the section header | Rejected by explicit user choice — the fields themselves have no valid referent pre-treatment, not just a labeling problem; keeping them would still let a user record "satisfied with treatment" before any treatment exists |
| Update the mapping CSV's `Timepoint` column | Not needed — it already correctly said `FollowUp` for both elements; the bug was entirely in the Registration Questionnaire FSH instance and the two frontends duplicating fields the CSV never claimed belonged at T0 |
| Leave the "baseline PROM" comment as-is (defensible category shorthand) | User explicitly asked to fix this too; low-cost, comment-only change, no reason not to tighten it while already in this area |

## Consequences

✅ No mapping coverage change — Q8.e/Q12.e/Q12.g remain exactly as scoped (`FollowUp`, `Full`/`Partial` unchanged); this ADR fixes an implementation inconsistency the mapping never had.

✅ Registration wizard step count and Questionnaire item count both shrink by 2 (well-defined removal, not a rename-in-place) — `sushi .` recompiles clean (0 errors/warnings), both frontends build and lint clean.

✅ No `example_data/` or seed-bundle changes needed — grepped `RotatorCuffRegistrationBundle.fsh`, `seed/bundles/example-patients.json`, and the Anna Müller longitudinal story; neither profile was ever present in a Registration-context example. Both already correctly appear only in the Anna Müller Follow-Up files (12mo/24mo).

⚠️ This is a structural gap fix (category b — closes a Registration/Follow-Up placement inconsistency the mapping's own `Timepoint` column already implied was wrong), not a Hurley-coverage change, so no category-(d) go/no-go was required for the removal's *clinical* content — only for the *scope-reduction* act of deleting already-working fields, which was asked explicitly per this project's standing practice of treating removals with the same care as additions.

## Sources

- Clinical review by the reviewing shoulder surgeon (the note left its own suggested replacement wording unfinished)
- Full-pipeline grep audit (2026-07-21) across `ig/input/fsh/`, `frontend/src/`, `sdc-frontend/src/`, `docs/decisions/*.md`, `mapping/SECEC_FHIR_Mapping.{md,csv}` — ~60 "PROM" occurrences catalogued and individually assessed against timepoint correctness
- `mapping/SECEC_FHIR_Mapping.csv` rows Q8.e, Q12.e, Q12.g (confirms `Timepoint=FollowUp` predates and is unaffected by this ADR)
- ADR-0090 (same defect category precedent — Constant-Murley's "PROM" mislabel)
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `examples/RotatorCuffRegistrationBundle.fsh`
- `frontend/src/components/{wizard/StepOutcomeScores,RegistrationWizard,Home}.tsx`, `wizard/stepFormData.ts`
- `sdc-frontend/src/components/Home.tsx`, `sdc-frontend/src/lib/extractor.ts` (confirmed no change needed)
