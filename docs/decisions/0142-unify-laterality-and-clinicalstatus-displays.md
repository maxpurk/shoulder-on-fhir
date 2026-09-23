# ADR-0142: Unify laterality and clinicalStatus coding displays across frontends

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #14 — the SDC and unified frontends emitted different hardcoded `display` text for the same SNOMED shoulder-laterality codes, and the unified frontend omitted `display` on `Condition.clinicalStatus` codings that SDC already carried.

## Context

Two independent hardcoding drifts surfaced during the cross-frontend parity exercise:

1. **`Condition.bodySite`/`Procedure.bodySite` laterality (SNOMED `91774008`/`91775009`).** The unified frontend's `SHOULDER_LATERALITY` constant already used the correct SNOMED preferred term ("Structure of right/left shoulder region" — verified via the `snomed-ct` MCP server's `snomed_get_by_code`, which returns `preferred_term` distinct from the plain "Right shoulder"/"Left shoulder" `synonyms`). SDC's three laterality leaves (`condition.laterality`, `priorTreatment.laterality` in `ShoulderRegistrationQuestionnaire.fsh`; `procedure.laterality` in `ShoulderSurgeryQuestionnaire.fsh`) hardcoded `answerOption[].valueCoding` with the informal synonym instead — a stale copy that never tracked the IG's own `ShoulderLaterality` ValueSet (`ig/input/fsh/valuesets/ShoulderLaterality.fsh`), which has used the correct preferred term since its introduction.
2. **`Condition.clinicalStatus`.** SDC's builders (`extractor.ts`) already paired every `clinicalStatus` coding with a `display`. The unified frontend's four builders (`ConditionForm.tsx` ×2, `StepCondition.tsx` ×2) omitted `display` entirely — the mirror-image gap, on a FHIR-core CodeSystem (`http://terminology.hl7.org/CodeSystem/condition-clinical`) rather than SNOMED.

A third, adjacent finding: `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` — a hand-written TS object also defining a `Questionnaire` resource, dated to the SDC frontend's initial scaffold (commit `68bf580`) — still carried the stale "Right shoulder"/"Left shoulder" synonyms, and a repo-wide grep confirmed it is imported nowhere. It was dead from the moment the FSH-generated Questionnaire (fetched live from HAPI) became the actual runtime source, superseded within the same initial development arc (`1f022af`, "derive observation displays from Questionnaire").

## Decision

**Laterality:** replaced SDC's three hardcoded `answerOption[0..1].valueCoding` pairs with `answerValueSet = ".../ValueSet/shoulder-laterality"`, the same VS the unified frontend's own laterality dropdown implicitly matches. This is a strict improvement over correcting the hardcoded strings in place: it removes the hardcoding rather than relocating it, and it plugs into a mechanism the SDC form renderer already has — `QuestionnaireForm.tsx` dispatches on `item.answerValueSet` (dynamic `$expand`-fetched dropdown) vs. `item.answerOption` (static list) generically for every `#choice` item, so no frontend code changed. Going forward, correcting `ShoulderLaterality.fsh`'s display once corrects the whole IG.

Deleted `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` — confirmed zero references (`grep -rl` across `sdc-frontend/src`), confirmed via `git log` that it was superseded within the same initial development arc as its own introduction. Kept as unused dead code, it was actively misleading (still readable as if it were a live source of the Questionnaire's shape, carrying stale, informal-synonym displays that don't match the IG's own VS).

**`Condition.clinicalStatus`:** added a shared `CONDITION_CLINICAL_DISPLAY: Record<string, string>` constant to `frontend/src/types/fhir.ts` (four values ADR-0075 offers: active/recurrence/inactive/resolved, each capitalized per the official FHIR `condition-clinical` CodeSystem's own concept displays) and wired it into all four unified-frontend builder sites (`ConditionForm.tsx`'s comorbidity and diagnosis paths, `StepCondition.tsx`'s principal and other-diagnosis paths). `StepPatient.tsx`'s comorbidity builders already hardcoded `display: 'Active'` correctly — left unchanged, since the code there is fixed by construction (a newly-registered comorbidity is always `active`), not user-selected, so there's no drift risk to fix.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Fix the hardcoded laterality `display` strings in place (keep `answerOption`, just correct the text) | Would still leave three hand-maintained copies of a string the IG's own ValueSet already declares canonically — the same class of drift that caused this finding would recur the next time someone touches the VS without remembering the three FSH answerOption copies. `answerValueSet` removes the duplication structurally. |
| Keep `ShoulderRegistration.ts`, just correct its display strings | It's unreferenced dead code; fixing strings nobody reads doesn't close the finding (a future reader could still mistake it for live source) and the repo already established precedent for deleting confirmed-unused files rather than patching them. |
| Centralize `CONDITION_CLINICAL_DISPLAY` in a cross-frontend shared package | No shared-code layer exists between `frontend/` and `sdc-frontend/` today (by design — see the project's "no DTO layer" / independent-paradigm architecture); introducing one for a 4-entry string map is disproportionate. Each frontend keeps its own copy, same pattern as `SHOULDER_LATERALITY`. |

## Consequences

✅ Closes clinical-review item #14 — both findings (laterality display divergence, clinicalStatus display omission) resolved.
✅ SDC's laterality fields are now driven by the IG's own `ShoulderLaterality` VS like every other coded SDC field, rather than being a hardcoded exception — one fewer place for terminology drift to hide.
✅ Removes one dead file with actively-misleading (stale, informal) terminology strings.
✅ `sushi .`: 0 errors / 0 warnings (154 resources, unchanged instance/VS/CS counts other than the 3 edited answerOption→answerValueSet swaps). Both frontends: `npm run build` (tsc + vite) and `npm run lint` (zero-warnings gate) clean. SDC's built bundle hash is unchanged from before the dead-file deletion, confirming it was never bundled.
✅ Verified live on the deployment server post-deploy: `ShoulderLaterality` `$expand` returns the correct SNOMED preferred terms for both codes; SDC's three laterality dropdowns render options sourced from that expansion.
⚠️ No mapping status change — laterality and clinicalStatus display text are presentation-layer only, not modeling changes.

## Sources

- the cross-frontend parity audit, item #14.
- `snomed-ct` MCP server, `snomed_get_by_code` for `91774008`/`91775009` — `preferred_term` vs `synonyms` distinction.
- `ig/input/fsh/valuesets/ShoulderLaterality.fsh` — the VS both frontends now agree with.
- `frontend/src/types/fhir.ts` (`SHOULDER_LATERALITY`, new `CONDITION_CLINICAL_DISPLAY`), `frontend/src/components/ConditionForm.tsx`, `frontend/src/components/wizard/StepCondition.tsx`.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderSurgeryQuestionnaire.fsh` — the three `answerOption`→`answerValueSet` edits.
- `sdc-frontend/src/components/QuestionnaireForm.tsx` — the pre-existing generic `answerValueSet` dispatch this port relies on (no changes needed there).
