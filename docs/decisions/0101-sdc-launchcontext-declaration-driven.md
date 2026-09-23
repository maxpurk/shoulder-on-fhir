# ADR-0101: SDC `launchContext` becomes declaration-driven, not just declared

**Date:** 2026-07-26
**Status:** Accepted
**Builds on:** ADR-0100 (real `itemPopulationContext` + `initialExpression` prefill, same session)

## Context

While reviewing ADR-0100's work, a follow-up gap was identified: the Questionnaires also declare
an SDC `sdc-questionnaire-launchContext` extension at the root level (naming a `%patient` variable
of type `Patient`, "the patient whose surgery/visit is being recorded"), but nothing in the
frontend ever read that declaration. `FlowPage.tsx` decided whether to show `PatientLookup` via a
hardcoded `flow !== 'registration'` check, and no `initialExpression` referenced `%patient` at all
— the declaration was decorative, the same "switch with no bulb" problem ADR-0100 fixed for
`itemPopulationContext`.

## Decision

Make the `launchContext` declaration genuinely drive behavior, in two small, scoped ways:

1. **`FlowPage.tsx`'s `requiresLookup`** is now derived from
   `requiresPatientLaunchContext(questionnaire)` (new function in `lib/populationContext.ts`,
   reads the Questionnaire's own `extension` array for `sdc-questionnaire-launchContext` entries
   whose `type` sub-extension is `Patient`) instead of the flow-name string comparison. Behavior is
   unchanged for all three flows — Registration declares no `launchContext` extension at all (the
   patient doesn't exist yet), Surgery/Follow-Up both declare one — but the *reason* PatientLookup
   shows up is now the Questionnaire's own content, not an assumption that happened to match it.
2. **`withLaunchContextResources()`** (new function, same module) merges the already-resolved
   Patient resource into the FHIRPath environment passed to `evaluateInitialExpressions()`, keyed
   by whatever name the extension declares (`%patient` in this IG today) rather than a hardcoded
   string — and keyed generically by resource *type*, so a future launch context of a different
   type would work without changing this function.
3. **FSH**: both Questionnaires' `encounter.linkedDiagnosis` `initialExpression` extended from
   `%rotatorCuffCondition...` alone to `%patient.name.first().family & ': ' & %rotatorCuffCondition...`
   — so `%patient` is not just *available* but actually *referenced*, closing the same
   declared-but-unused pattern this ADR is otherwise fixing. Item `text` updated to "Linked Patient
   & Diagnosis" to match.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave `launchContext` declared-only, since it doesn't gate any submitted-bundle field | Same rationale ADR-0100 rejected for `itemPopulationContext`: a declared-but-inert SDC extension is a spec-conformance gap, and this one was cheap to close correctly. |
| Build a general "resolve any launch context of any type via a registry of resolvers" mechanism | Over-engineering for an IG that only ever declares one launch context (`patient`/`Patient`). `withLaunchContextResources()` is generic enough to need no change if a second launch context appeared, without pre-building unused flexibility. |
| Add `%patient` to the FHIRPath environment but leave no `initialExpression` referencing it | Would just move the "declared but unused" problem from the `launchContext` extension to the `%patient` variable itself — the whole point was closing that gap, not relocating it. |

## Consequences

✅ `launchContext` is now genuinely read and drives real behavior (which step renders, what's in
the FHIRPath environment) — not just declared.
✅ Both Surgery and Follow-Up now show a combined "Patient family name: diagnosis — laterality"
confirmation, using two independently-resolved SDC contexts in one expression — a stronger
demonstration than ADR-0100's diagnosis-only version.
✅ No behavior change for end users — the derivation matches what the hardcoded check already did;
this is a "for the right reason" fix, not a functional one.
✅ `sushi .` (0 errors/warnings), `tsc --noEmit`, `npm run build`, `npm run lint` all pass.

## Sources

- ADR-0100 — the prefill work this directly follows up on, same session
- `sdc-frontend/src/lib/populationContext.ts` — `extractLaunchContextDecls`, `requiresPatientLaunchContext`, `withLaunchContextResources`
- `sdc-frontend/src/components/FlowPage.tsx` — `requiresLookup` derivation + FHIRPath environment wiring
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh` — `%patient` now referenced in `encounter.linkedDiagnosis`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — confirmed no `launchContext` extension declared (verifies the `requiresLookup` derivation matches prior hardcoded behavior)
