# ADR-0097: Real `itemPopulationContext` prefill in the SDC frontend — evaluated, deferred

**Date:** 2026-07-25
**Status:** Superseded by ADR-0100 (implemented the next day)
**Builds on:** ADR-0039 (SDC features overview), ADR-0040 (SDC IG v3.0.0 conformance), ADR-0090 (hand-rolled-regex FHIRPath pitfall)

## Context

A chat session on this date found that the documented claim — "SDC `launchContext` +
`itemPopulationContext` pre-fill Patient/Condition references in the Surgery and Follow-Up flows"
(the project guide) — does not match what the code does. `QuestionnaireForm.tsx`'s own
docblock states plainly: *"launchContext / itemPopulationContext are not evaluated in-browser."*
What actually happens: `PatientLookup.tsx` resolves Patient + Condition via two plain REST
searches, and the result is injected silently into `bundleAssembler.ts` at submit time — correct
at the bundle level, but no Questionnaire item is ever visibly pre-filled from the declared SDC
extension. The Questionnaire FSH also declares an `sdc-questionnaire-initialExpression` alias that
is never actually used on any leaf item in either Questionnaire.

A concrete, scoped implementation plan was produced —
a scoped implementation plan — including a recommended
architecture (additive only; does **not** touch `bundleAssembler.ts`'s existing, correct reference
wiring; uses the `fhirpath` npm package rather than a hand-rolled regex evaluator, learning
directly from ADR-0090's finding that this codebase's one prior hand-rolled FHIRPath-lite
evaluator silently no-op'd for a long time). Nothing has been implemented.

## Decision

**Defer.** Do not implement now. The plan stays in
a scoped implementation plan, fully scoped
(~1.5–2 days), ready to pick up. The the project guide wording that overstates current behavior is left
uncorrected for now — a separate, smaller documentation-accuracy fix, noted here so it isn't lost,
not actioned by this ADR.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Implement now | Well-scoped and the codebase is already halfway there (`PatientLookup.tsx` does the equivalent REST lookup by hand) — but "well-scoped" isn't "urgent"; no consumer needs visible pre-fill today. |
| Fix only the project-guide wording, abandon the feature | Cheaply resolves the claim/reality mismatch, but discards a real (if minor) SDC-spec-conformance gap this project otherwise actively closes (see ADR-0040 and the broader SDC-feature ADR history). |
| Defer to the scoped work-item plans, record via this ADR | **Chosen.** Plan is written and ready; the doc-wording gap is real but low-stakes (internal the project guide, not the published IG) and not worth a separate ADR of its own. |

## Consequences

✅ The plan is fully scoped — implementing later costs no rediscovery time.
✅ The plan's explicit non-goal (don't touch `bundleAssembler.ts`'s reference wiring) heads off a future two-sources-of-truth bug before it can be written.
⚠️ the project guide's architecture section continues to overstate what the SDC frontend currently does until either the wording is corrected or the feature is built.
❌ The SDC frontend's spec-conformance claim (ADR-0040) stays narrower in practice than its own Questionnaire declarations suggest, for as long as this is deferred.

## Sources

- `sdc-frontend/src/components/PatientLookup.tsx`, `QuestionnaireForm.tsx`, `FlowPage.tsx` — read in full to establish current behavior
- `sdc-frontend/src/lib/bundleAssembler.ts` — the reference-wiring path this item must not disturb
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh` — the unused `initialExpression` declaration
- a scoped implementation plan — the scoped plan this ADR defers
- ADR-0090 — the hand-rolled-regex pitfall this plan explicitly avoids repeating
