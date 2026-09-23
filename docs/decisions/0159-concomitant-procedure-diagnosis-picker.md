# ADR-0159: Per-concomitant-procedure diagnosis picker, both frontends

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** `docs/limitations_items/` — "No frontend UI to wire a concomitant procedure to a non-index diagnosis," logged 2026-08-01 immediately after ADR-0127 widened `RotatorCuffProcedure.reasonReference` to permit exactly this relationship structurally, without any UI able to produce it.

## Context

ADR-0127 widened `RotatorCuffProcedure.reasonReference` from `only Reference(RotatorCuffCondition)` to `Reference(RotatorCuffCondition or ShoulderDiagnosisCondition)`, so a concomitant procedure (e.g. a distal clavicle excision) could correctly cite a coexisting non-rotator-cuff diagnosis (e.g. AC joint osteoarthritis) instead of always the index rotator cuff tear. That widening was demonstrated only by hand-authored example data (Anna Müller's surgery bundle) — neither frontend's Surgery wizard let a user actually wire a concomitant procedure to anything but the index Condition; both `SurgeryWizard.tsx`'s `buildProcedureResource` and SDC's `assembleSurgeryBundle` assigned the identical `conditionReference` to every procedure in a surgical event.

## Decision

**Candidate list, both frontends:** the patient's already-persisted `ShoulderDiagnosisCondition` instances (ADR-0077's `otherDiagnosis` slice, recorded at Registration) — fetched at the same point the index Condition is resolved (`PatientLookup`), not a fresh lookup.

**Unified frontend:** `PatientLookup.tsx`'s `LookupResult` gains `otherDiagnoses: Condition[]`, fetched via the same `Condition?subject=Patient/{id}` search already run for the index Condition, filtered by `meta.profile` (`PROFILE_URLS.OTHER_DIAGNOSIS_CONDITION` vs. not). As a side benefit, this also fixes a latent fragility in how the index `condition` itself was picked — it previously took `conditionBundle.entry[0]` unconditionally (assuming sort order put the index Condition first); it now explicitly `.find()`s the non-other-diagnosis entry, correct regardless of `_lastUpdated` ordering. `SurgicalEventStep.tsx`'s `ProcedureRow` gains a "Diagnosis addressed" dropdown, rendered only for concomitant rows (an `otherDiagnoses` prop, empty for the index row) and only when the list is non-empty — defaulting to "Index rotator cuff diagnosis," matching the pre-ADR-0159 behavior when left unset. `SurgicalProcedureFormItem` gains `diagnosisConditionId: string`; `buildProcedureResource` computes an `effectiveConditionReference` (the picked diagnosis if set, else the index `conditionReference` parameter, unchanged fallback).

**SDC frontend:** the harder half — SDC's Questionnaire items are normally static (`answerOption`/`answerValueSet`), but the candidate list here is genuinely dynamic per-patient data unknown at Questionnaire-authoring time. Solved by extending the already-existing `staticOptions` mechanism (built for Questionnaire-declared-but-non-ValueSet-bound choices, e.g. the Q11 timepoint picker) rather than inventing a new one: `QuestionnaireForm.tsx` merges a runtime-computed option list for the new `procedure.diagnosis` loose leaf (`ShoulderSurgeryQuestionnaire.fsh`'s `item[1].item[7]`, `#choice`, deliberately no `item.definition`/`answerValueSet`) from a new `otherDiagnoses` prop, threaded from `PatientLookup.tsx` (which now fetches them alongside the index Condition, mirroring the unified frontend exactly) through `FlowPage.tsx`'s existing `LaunchContext` plumbing. `extractor.ts` gained `ExtractedResources.diagnosisConditionId: (string | undefined)[]`, index-aligned with `procedures[]` (same alignment convention ADR-0141's `technique[]` already established), populated via the same `findDirectAnswer` "loose leaf" pattern already used for the per-procedure technique fields. `bundleAssembler.ts`'s `assembleSurgeryBundle` computes the same `effectiveConditionReference`-style fallback as the unified frontend.

**A real bug found and fixed while wiring the SDC side**: `procedure.diagnosis` has no static FSH `answerOption`, so `buildGroupItems`' `isStringOption` check (which decides whether a choice answer is echoed as `valueString` or built as `valueCoding`) always resolves false for it, meaning the answer is always serialized as `valueCoding` — never `valueString`. An initial draft of this ADR read `findDirectAnswer(...)?.valueString`, which would have silently always returned `undefined` (the diagnosis picker would have looked functional in the UI but never actually wired anything). Fixed by reading `.valueCoding?.code` instead, once the actual answer shape was traced through `buildGroupItems`. Separately, the runtime-injected option codes (Condition IDs, not real terminology codes) needed a non-empty placeholder `Coding.system` (`urn:hpi:local-condition-ref`) rather than an empty string, since some validators reject an empty-string `uri` — `extractor.ts` only ever reads `.code` back off this answer, so the system value itself is inert, but the QuestionnaireResponse's own conformance shouldn't emit a technically-invalid empty uri.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| SDC: a real `answerValueSet` pointing at a server-side dynamic ValueSet (e.g. a patient-scoped `$expand`) | Rejected — over-engineered for this case; the candidate Conditions are already resolved client-side at `PatientLookup` time (same data the unified frontend already has in hand), so a round-trip through a dynamic terminology ValueSet would just re-fetch data already available, and HAPI has no native "Conditions for this patient" ValueSet mechanism to expand against anyway. |
| SDC: a free-text Condition-ID input instead of a dropdown | Rejected — defeats the purpose of a picker; a clinician shouldn't need to know or type a raw FHIR resource ID. |
| Default every concomitant procedure's diagnosis picker to require an explicit choice (no "index diagnosis" default) | Rejected — the overwhelming majority of concomitant procedures still address the index rotator cuff tear (or its immediate biomechanical consequence); forcing an explicit choice on every row would add friction to the common case for a feature that's genuinely rare. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** Closes a gap between what ADR-0127 already made structurally possible and what either frontend could actually produce — not a new consensus element, no SECEC/coverage-count impact.

## Verification

- `sushi .` — 0 errors/0 warnings; compiled `Questionnaire-shoulder-surgery.json` confirmed carrying the new `procedure.diagnosis` item.
- `npm run build`/`npm run lint` clean on both frontends.
- Verified live on the deployment server (2026-08-05) against both frontends using Anna Müller (the real multi-diagnosis patient, from ADR-0127): both frontends' Surgery flows correctly show the diagnosis picker offering "Osteoarthritis of acromioclavicular joint" — her real, already-persisted otherDiagnosis — as a selectable option (unified: on the concomitant-procedure row only, matching its conditional prop; SDC: on every procedure repetition, per the documented asymmetry in the Alternatives Considered section). Not submitted (to avoid creating a duplicate surgery record for her); a real submission end-to-end remains unexercised.

## Consequences

✅ Both frontends can now produce the relationship ADR-0127 made structurally possible — closes the "IG capability without app capability" gap that entry's own Consequences section flagged.
✅ Side fix: the unified frontend's index-Condition selection in `PatientLookup.tsx` is now robust to `_lastUpdated` sort order, not just correct by accident when the index Condition happens to sort first.
✅ Found and fixed a real would-be-silent bug in the SDC port (`.valueString` vs. `.valueCoding?.code`) before it shipped, by tracing the actual answer-serialization path rather than assuming.
⚠️ Not yet verified live — see Verification above.

## Sources

- `docs/limitations_items/` — the entry this ADR closes.
- ADR-0127 — the `reasonReference` widening this ADR's UI now exercises.
- ADR-0141 — the `technique[]` index-alignment convention this ADR's `diagnosisConditionId[]` mirrors.
- `frontend/src/components/shared/PatientLookup.tsx`, `frontend/src/components/surgery/SurgicalEventStep.tsx`, `frontend/src/components/SurgeryWizard.tsx` — unified frontend.
- `sdc-frontend/src/components/PatientLookup.tsx`, `sdc-frontend/src/components/FlowPage.tsx`, `sdc-frontend/src/components/QuestionnaireForm.tsx`, `sdc-frontend/src/lib/extractor.ts`, `sdc-frontend/src/lib/bundleAssembler.ts` — SDC frontend.
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` — new `procedure.diagnosis` item.
