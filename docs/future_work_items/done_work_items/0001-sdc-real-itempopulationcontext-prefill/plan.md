# SDC frontend — real `itemPopulationContext` + `initialExpression` prefill

> **Status:** Done — implemented 2026-07-26, see ADR-0100
> (`docs/decisions/0100-sdc-real-itempopulationcontext-prefill.md`), which
> supersedes ADR-0097's deferral. Same-session follow-up, ADR-0101, additionally made the SDC
> `launchContext` extension itself declaration-driven (it was still declared-but-unread after
> ADR-0100 landed). Captured 2026-07-25 after checking the actual `sdc-frontend/` source to
> establish whether the "SDC launchContext + itemPopulationContext
> pre-fill Patient/Condition references" claim in the project guide reflects what the
> code really does.

## Context

The SDC frontend (`sdc-frontend/`, port 3001) is documented as demonstrating SDC
`itemPopulationContext`-driven pre-fill for the Surgery and Follow-Up flows. Reading the code
shows that claim is only half true: the Questionnaire FSH correctly *declares* the SDC extension
(so the artifact is spec-conformant on paper), but the frontend never evaluates it. What actually
happens today is a parallel, hand-written mechanism that produces the same *bundle* correctness
but no visible form pre-fill. This item closes that gap — genuinely, not just cosmetically.

## Verified facts (do not re-derive when picking this up)

- **`sdc-frontend/src/components/PatientLookup.tsx`** resolves `Patient` (by identifier/name
  search) then `Condition` (`Condition?subject=Patient/{id}&_profile=...rotator-cuff-condition`)
  via two plain `fhirClient.search()` calls, and returns
  `LaunchContext {patientId, conditionId, conditionBodySite}` to the caller.
- **`sdc-frontend/src/components/FlowPage.tsx`** stores that `LaunchContext` in React state and
  only reads it inside `handleSubmit` (a closure, line ~56-59), passing it to `assembleBundle()`.
  It is **never** passed as a prop into `<QuestionnaireForm>` (call site at line 147-152 passes
  only `questionnaire`, `flow`, `onSubmit`, `onSuccess`).
- **`sdc-frontend/src/components/QuestionnaireForm.tsx`** states this outright in its top
  docblock: *"launchContext / itemPopulationContext are not evaluated in-browser — pre-fill
  happens at the FlowPage layer via the PatientLookup step."* Concretely: `formState` is seeded
  only from `collectInitialDefaults()` (line 66-78), which reads the **static**
  `item.initial[0].value[x]` off each Questionnaire item — there is no code path that reads the
  `itemPopulationContext`/`initialExpression` extensions at all.
- **`sdc-frontend/src/lib/bundleAssembler.ts`** is where `LaunchContext` actually gets used — it
  stamps `subject`, `bodySite`, and (for Surgery/Follow-Up) `Encounter.reasonReference` directly
  from `launchContext.conditionId`/`.patientId`, bypassing the QuestionnaireResponse entirely.
  **This path is correct and already tested — the plan below must not change it.**
- **FSH declarations** (`ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` line ~76-88,
  `ShoulderFollowUpQuestionnaire.fsh` line ~78-101): the `encounter` group on both Questionnaires
  declares `$SDC_POPULATION_CTX` as an `application/x-fhir-query`:
  `Condition?subject={{%patient.id}}&_profile=.../rotator-cuff-condition`, named
  `%rotatorCuffCondition`. Both files also declare a `$SDC_INITIAL_EXPR` alias
  (`sdc-questionnaire-initialExpression`) — **grep confirms it is never actually used** on any
  leaf item in either file. Nothing in the Questionnaire itself currently consumes
  `%rotatorCuffCondition`.
- **`sdc-frontend/src/lib/extractor.ts`**'s `setEncounterField()` (line 458-472) only handles
  `Encounter.type` / `Encounter.period.start` / `Encounter.period.end`. There is no case for
  `Encounter.reasonReference` — by design, since that field is set in `bundleAssembler.ts`, not
  via extraction.
- **`sdc-frontend/package.json`** has no FHIRPath library dependency today (`react`,
  `react-dom`, `react-router-dom` only).
- **A cautionary precedent already in this codebase**: `QuestionnaireForm.tsx`'s
  `evaluateCalcExpr()` (for `calculatedExpression`) is a hand-rolled regex approximation of
  FHIRPath. ADR-0090 (`docs/decisions/0090-*.md`) found it had a real bug that
  made it silently return `undefined` for years — "decorative" per the code's own former comment.
  **Do not repeat a hand-rolled regex approach for anything beyond trivial dot-paths.**
- Related, not overlapping: `docs/decisions/0095-server-side-extract-not-implemented.md`
  covers server-side `$extract` (a separate topic — turning a raw `QuestionnaireResponse` into a
  bundle). This item is about *rendering*, not extraction.

## Goal / non-goals

**Goal:** after `PatientLookup` resolves a patient, the rendered Questionnaire form should show
a real, visible, read-only confirmation value that was populated by evaluating the Questionnaire's
own declared `itemPopulationContext` + `initialExpression` — not just a "Launch context: Anna
Müller" banner floating above an otherwise-blank form.

**Non-goal, explicitly:** do **not** make this new mechanism the source of truth for
`Encounter.reasonReference` or any other reference actually written into the submitted bundle.
`bundleAssembler.ts`'s existing `LaunchContext`-based wiring is correct, tested, and simpler
(ID-based, not re-derived from a form answer). Running two independent mechanisms that could set
the same field from two different resolutions (one from `LaunchContext`, one from a QR answer
extracted at submit time) is a real source of subtle bugs for no benefit. This item is additive
UX/spec-conformance, not a rewire of reference plumbing.

## Recommended architecture

1. **New module `sdc-frontend/src/lib/populationContext.ts`** (~80–120 lines):
   - `extractPopulationContexts(items)` — walk Questionnaire groups for the
     `sdc-questionnaire-itemPopulationContext` extension (mirrors the existing
     `extractionContextOf()` pattern in `extractor.ts`), returning
     `{contextName, queryTemplate}` pairs.
   - `resolvePopulationContexts(contexts, launchContext)` — for each `application/x-fhir-query`
     template, substitute `{{%patient.id}}` → `launchContext.patientId` (string replace is
     sufficient; the IG only ever uses this one variable today — don't build a general templating
     engine for a single substitution), parse the resulting query string into
     `resourceType` + params, call the existing `fhirClient.search()`, take `entry[0].resource`.
     Returns `Record<contextName, FhirResource>`.
2. **`FlowPage.tsx`**: once `launchContext` is set (existing `PatientLookup` `onResolved`
   callback), call `resolvePopulationContexts()`, then evaluate each leaf's `initialExpression`
   (new items — see step 4) against the resolved named resource. **Use the `fhirpath` npm package**
   for this evaluation, not a hand-rolled regex — these expressions can be arbitrary dot-paths
   (`%rotatorCuffCondition.bodySite.coding.first().display`) and the codebase already has one
   cautionary tale about under-scoped regex matching (see Verified Facts). Produces
   `initialOverrides: Record<linkId, string>`.
3. **`QuestionnaireForm.tsx`**: accept a new prop `initialOverrides?: Record<string, string>`;
   merge it into the `formState` seed alongside `initialDefaults` (same pattern already used at
   line 380/387-389), and render the target item(s) read-only (`item.readOnly` already supported
   by `QuestionField`, no renderer change needed there).
4. **FSH content** (`ShoulderSurgeryQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh`): add
   one new read-only `string`-type leaf item per Questionnaire under the `encounter` group — e.g.
   `encounter.linkedDiagnosis`, `initialExpression` = `%rotatorCuffCondition.bodySite.coding.first().display`
   (or similar — **exact expression and exact field shown is a modeling decision to make at
   implementation time**, not fixed here). No `item.definition` — this item is display-only, not
   extracted (extraction of this value is explicitly out of scope, see Non-goals).
5. **Classify before implementing**, per the project guide's clinical-feedback workflow:
   this is a re-display of already-captured data via a new mechanism, not new data collection —
   almost certainly category (c) IG-operational (structural/demonstrative, not a Hurley element),
   but state that classification explicitly before writing FSH, per project convention.
6. Re-run `sushi .` + `seed/load-profiles.sh`, then `tools/validate.sh`.

## Effort estimate

| Step | Estimate |
|---|---|
| `populationContext.ts` (query template resolution) | 2–4 h |
| `fhirpath` integration + `initialExpression` evaluation in `FlowPage.tsx` | 3–5 h |
| `QuestionnaireForm.tsx` prop + merge wiring | 1–2 h |
| FSH: new leaf item × 2 Questionnaires + modeling decision | 1–2 h |
| End-to-end browser verification (Surgery + Follow-Up flows) | 2–3 h |
| ADR documenting the modeling decision (project convention) | 0.5 h |
| **Total** | **~1.5–2 days** |

## Open questions for whoever implements this

- Which field is most useful to show pre-filled? A raw `Condition/id` reference confirms wiring
  but isn't meaningful to a clinician; laterality/diagnosis display text is more useful UX but is
  a content/modeling choice, not just plumbing — needs an explicit decision before FSH is written.
- Should `populationContext.ts` eventually *replace* `PatientLookup.tsx`'s hand-written Condition
  search (both do functionally the same REST lookup)? Recommended: **no, not in this item** — keep
  them separate to avoid conflating "resolve who we're submitting for" (must stay simple and
  reliable) with "demonstrate a spec feature" (can be additive and lower-stakes). Revisit only if
  a future item wants to genuinely consolidate.
