# ADR-0100: Real SDC `itemPopulationContext` + `initialExpression` prefill

**Date:** 2026-07-26
**Status:** Accepted
**Supersedes:** ADR-0097 (deferred this same work)
**Builds on:** ADR-0039 (SDC features overview), ADR-0040 (SDC IG v3.0.0 conformance), ADR-0090 (hand-rolled-regex FHIRPath pitfall)

## Context

ADR-0097 found that the documented claim — "SDC `launchContext` + `itemPopulationContext`
pre-fill Patient/Condition references in the Surgery and Follow-Up flows" (the project guide)
— did not match what the code did. `PatientLookup.tsx` resolved Patient + Condition via two plain
REST searches and handed the result to `bundleAssembler.ts`, which wired the actual
`Encounter.reasonReference` / `subject` references at submit time. That path is correct at the
bundle level, but no Questionnaire item was ever visibly pre-filled from the declared SDC
extension, and the Questionnaire FSH's `sdc-questionnaire-initialExpression` alias was declared
but never used on any leaf item. ADR-0097 recorded a scoped implementation plan
(a scoped implementation plan) and deferred acting on
it. This ADR implements that plan.

## Decision

Implement the plan as scoped, with its explicit non-goal preserved: **this mechanism does not
touch cross-resource reference wiring.** `bundleAssembler.ts`'s `LaunchContext`-based wiring is
unchanged — it remains the sole source of truth for what reference ends up on
`Encounter.reasonReference` / `Observation.subject` in the submitted bundle.

1. **`sdc-frontend/src/lib/populationContext.ts`** (new module):
   - `extractPopulationContexts(items)` walks Questionnaire groups for the
     `sdc-questionnaire-itemPopulationContext` extension, mirroring the existing
     `extractionContextOf()` pattern in `extractor.ts`.
   - `resolvePopulationContexts(contexts, launchContext)` substitutes `{{%patient.id}}` →
     `launchContext.patientId` via a plain string replace (the IG only ever uses this one query
     variable — no general templating engine built for a single substitution), then resolves each
     `application/x-fhir-query` template via the existing `fhirClient.search()`.
   - `evaluateInitialExpressions(items, resolvedContexts)` walks leaf items for the
     `sdc-questionnaire-initialExpression` extension and evaluates each expression via the
     **`fhirpath`** npm package (v5.0.0) against the resolved named resources — not a hand-rolled
     regex evaluator. ADR-0090 found this codebase's one prior hand-rolled FHIRPath-lite evaluator
     (`QuestionnaireForm.tsx`'s `evaluateCalcExpr`, for `calculatedExpression`) silently broken for
     years on a regex paren-counting bug; `initialExpression` can be an arbitrary dot-path, so
     repeating that approach was explicitly ruled out by the plan.
2. **`FlowPage.tsx`**: once `PatientLookup`'s `onResolved` callback fires, calls
   `resolvePopulationContexts()` then `evaluateInitialExpressions()` (best-effort — a failed
   resolution just leaves `initialOverrides` empty, it never blocks the form), and passes the
   result into `<QuestionnaireForm initialOverrides={...} />`.
3. **`QuestionnaireForm.tsx`**: new optional prop `initialOverrides?: Record<string, string>`,
   merged into `formState` via a `useEffect` keyed on the prop (population-context resolution
   happens asynchronously, well after the form has mounted, so the initial-defaults effect alone
   would miss it). No renderer change needed — `item.readOnly` was already supported by
   `QuestionField` for `string`-type items.
4. **FSH**: one new read-only `string` leaf item added to both `ShoulderSurgeryQuestionnaire.fsh`
   and `ShoulderFollowUpQuestionnaire.fsh`, under the existing `encounter` group —
   `encounter.linkedDiagnosis`, `initialExpression` =
   `%rotatorCuffCondition.code.coding.first().display & ' — ' & %rotatorCuffCondition.bodySite.coding.first().display`.
   No `item.definition` — this item is display-only and is deliberately **not** extracted (if a
   value happens to be present in `formState` it is simply included in the submitted
   `QuestionnaireResponse`, as any other rendered/answered item would be; `extractor.ts` skips it
   because it has no `definition`).
5. **Classification** (per the project guide's clinical-feedback workflow): category
   (c), IG-operational — a re-display of already-captured data via a new mechanism, not new data
   collection, and not a Hurley element. No `mapping/SECEC_FHIR_Mapping.csv` change.
6. **Documentation accuracy**: `PatientLookup.tsx`'s docblock and on-page copy, and the Follow-Up
   Questionnaire's FSH `Description` block, were overstating what `itemPopulationContext` did
   (claiming it pre-filled Patient/Condition *references*, when that was always `LaunchContext` +
   `bundleAssembler.ts`). Both corrected to describe the two mechanisms as separate: `LaunchContext`
   wires the actual references; `itemPopulationContext` + `initialExpression` now genuinely drives
   a read-only confirmation display, nothing more.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Make `itemPopulationContext` resolution the source of truth for `Encounter.reasonReference` | Would run two independent mechanisms capable of setting the same field from two different resolutions (one ID-based via `LaunchContext`, one re-derived from a form answer at submit time) — a real source of subtle bugs for no benefit. The plan's non-goal, preserved. |
| Hand-rolled regex/string-templating FHIRPath evaluator (matching `evaluateCalcExpr`'s existing style) | `initialExpression` can be an arbitrary dot-path (`%var.a.b.first().c`); ADR-0090 already found the codebase's one prior hand-rolled evaluator silently broken for years. Using the real `fhirpath` package costs one dependency and avoids repeating that mistake. |
| Show a raw `Condition/id` reference as the pre-filled value | Confirms wiring but isn't meaningful to a clinician. A diagnosis + laterality display text is more useful UX confirmation before the user proceeds — the plan's open question, resolved here in favor of clinical usefulness over minimal-plumbing-proof. |

## Consequences

✅ `itemPopulationContext` and `initialExpression` are now genuinely evaluated in-browser, closing
the SDC-spec-conformance gap ADR-0097 identified — both extensions were previously declared but
inert.
✅ The non-goal holds: `bundleAssembler.ts` is untouched; `git diff` on that file is empty for this
change.
✅ `sushi .` compiles both Questionnaires cleanly (0 errors, 0 warnings); `tsc --noEmit` and
`npm run build` pass in `sdc-frontend/`.
⚠️ One new runtime dependency (`fhirpath`, ~830 KB minified into the SDC frontend's single JS
bundle — Vite's build already warns about the >500 KB chunk size; not addressed here, out of
scope for this item).
⚠️ The read-only `encounter.linkedDiagnosis` field briefly renders blank until the population-context
REST call resolves (typically one fast round-trip) — no loading spinner was added; acceptable for
a demonstration field, per the plan's scope.

## Sources

- a scoped implementation plan — the scoped plan this ADR implements
- ADR-0097 — the deferral this ADR reverses
- ADR-0090 — the hand-rolled-regex pitfall this plan explicitly avoided repeating
- `sdc-frontend/src/lib/populationContext.ts` — new module
- `sdc-frontend/src/components/FlowPage.tsx`, `QuestionnaireForm.tsx`, `PatientLookup.tsx` — wiring + doc-accuracy changes
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh` — new `encounter.linkedDiagnosis` leaf item
