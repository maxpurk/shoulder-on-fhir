# ADR-0090: Constant-Murley score gains captured components + dual entry modes

**Date:** 2026-07-19
**Status:** Accepted; the **dual-entry mode** half was removed by ADR-0113 (2026-07-27) and the same removal ported to the SDC frontend by ADR-0158 — the Constant-Murley total and sub-scores are read-only, component-derived fields in both frontends. The captured-`component[]` model this ADR introduced is unchanged and still in force.

## Context

Next point in the surgeon-review notes, after Muscle Strength (ADR-0089):

On outcome scores: the Constant-Murley score could perhaps be calculated, and the Constant-Murley score is not a PROM.

The scope agreed in response: capture the items of the Constant-Murley score so the total can be auto-calculated, with two entry modes — either the total is entered directly, or it is derived from the sub-items.

**Current state before this ADR** (confirmed by direct investigation): `ConstantScoreObservation` was a flat, total-only profile (`code = SNOMED#273383002`, `value[x] only Quantity`, `{score}` 0–100). Both Questionnaire instances already scaffolded 4 sub-items — Pain (0–15), ADL (0–20), ROM (0–40), Strength (0–25) — plus a `readOnly` total computed via an SDC `calculatedExpression` summing them. **Critically, the 4 sub-items had no `item.definition`**, so the SDC extractor's per-leaf loop silently skipped them — they were discarded after computing the total, never persisted. The mapping CSV already flagged this gap: *"Optional: define Constant-Murley Questionnaire resource with item-level capture."* Both unified-frontend flows (Registration `StepOutcomeScores.tsx`, Follow-Up `Q12PromForm.tsx`) captured only a single manually-entered total, with no sub-items and no auto-calc in JS.

## Clinical verification (`shoulder-surgeon` subagent, citing Constant & Murley 1987 and the 2008 modification)

- **15/20/40/25 = 100 breakdown confirmed correct** (Pain + ADL = 35 subjective points; ROM + Strength = 65 objective points) — matches the pre-existing scaffolding exactly.
- **Do not decompose ROM further, and do not re-derive it from this IG's other clinical Observations.** Constant's ROM sub-score (0–40) grades four movements via banded ordinal milestones — functional hand-position bands for external rotation, a 6-level vertebral ladder for internal rotation (distinct from this IG's own 8-tier `InternalRotationVertebralLevel` from ADR-0088) — scored on *active, painless* motion. Re-deriving it from the degree-valued/vertebral-level ROM Observations captured elsewhere would be an unvalidated, lossy conversion.
- **Strength (0–25) is a single measured/graded value**, no further decomposition — clinically distinct from `SupraspinatusStrengthDynamometryObservation` (ADR-0089), a different clinical test.
- **Two-entry-mode design confirmed methodologically sound**, reflecting real registry practice (sites often only have a prior report's published total).
- **Refinement (category a)** — Hurley's Q12/Q13-A12 names only "the Constant score" as a preferred instrument, zero mechanism specified. Persisting components does not change `Q12-Constant`'s `Full` status or mint new Hurley sub-rows.
- No LOINC/SNOMED code exists for any of the four sub-components (verified on the LOINC TX server: "Constant Murley," "Constant score shoulder," "shoulder assessment pain score," "shoulder score activities of daily living" — zero matches).

## Decision

### 1. `ConstantScoreObservation` gains `Observation.component[]` — first use of `component` in this IG

Total stays exactly as before (`code = SNOMED#273383002`, `value[x] only Quantity`, `{score}` 0–100) — unchanged, non-breaking. Four named, optional (`0..1` each) component slices — Pain/ADL/ROM/Strength — each `value[x] only Quantity`, `{score}` unit, its own `^minValueQuantity`/`^maxValueQuantity` bounds (0–15/0–20/0–40/0–25), matching this IG's established convention of using those extensions as UI-hint documentation rather than validator-enforced hard constraints. Each component's `code` is a new local `ShoulderObservationCodes` concept (`#constant-score-pain`, `#constant-score-adl`, `#constant-score-rom`, `#constant-score-strength`).

**Provenance signal: implicit, via component presence — not a new coded flag.** `component[]` populated ⇒ component-derived entry (total = their sum); `component[]` absent ⇒ direct total entry. This satisfies the user's two-option request without an extra coded "entry-mode" element, at the cost of the more auditable explicit-flag design the clinical review also raised — rejected here per scope discipline.

### 2. Two entry modes on one field, driven by component presence — not a mode toggle

Originally planned as an explicit UI mode toggle; simplified during implementation once it became clear the pre-existing SDC `calculatedExpression` scaffolding already implies a presence-driven design (see §4). Both frontends now show the total field plus the four component fields together; filling any component live-recomputes the total as the sum of whichever components are filled (partial sums are flagged with a small warning, not blocked — matching the SDC calculation's own partial-sum semantics rather than diverging from it); leaving all four blank leaves the total exactly as typed. No separate mode selector element exists or is needed.

### 3. SDC Questionnaire scaffolding completed, not restructured

**Original plan assumed nesting the 5-item Constant block in its own `itemExtractionContext`-tagged sub-group.** Investigation of `sdc-frontend/src/lib/extractor.ts` during implementation found this would not work: both `buildQuestionnaireResponse` (QR construction) and `extractResources`/`buildResourceForExtractionGroup` (extraction) are hardcoded to a flat two-level hierarchy (top-level group → direct leaf children only) — neither recurses into a nested sub-group. Nesting would have required non-trivial new recursion logic across both functions.

**Simpler fix adopted instead**: keep the Questionnaire flat exactly as already scaffolded. Add `item.definition` to the four sub-items, targeting the new component slices via standard FHIRPath slice-name syntax (`.../constant-score-observation#Observation.component:Pain.valueQuantity`, etc.) — all five Constant leaves (4 components + 1 total) now share the same `profileCanonical`. `buildObservationsForPerLeafGroup` is generalized to merge non-repeating leaves that target the same profile into one shared Observation (previously: always one Observation per leaf) — a minimal, reusable extension of the existing mechanism rather than new nesting machinery, and directly applicable to any future composite score this IG adds.

**A second, unplanned SDC-side fix was required**: the total item's `readOnly = true` (removed) and the custom `QuestionnaireForm.tsx` renderer's blanket `isCalculated → readOnly` coupling (removed) together made direct-total entry *impossible* in the live form — any `calculatedExpression` item was unconditionally read-only regardless of whether its dependencies had values. The calc-effect itself also force-cleared the field to `''` whenever no sub-items were filled, which would have clobbered a manually-typed total on the very next render even after removing `readOnly`. Both fixed; `calculatedExpression` is the *only* usage of that extension in this IG (verified before changing the shared renderer), so the fix is scoped safely.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Explicit coded entry-mode flag (`component[]`-presence made queryable via its own component, e.g. `constant-entry-mode`) | The clinical review's more auditable suggestion; rejected per scope discipline — implicit component-presence signal satisfies the user's literal two-option framing without an extra modeled element |
| Decompose ROM into its 4 constituent movements (flexion/abduction/ER/IR) | Not what the user asked for ("the items" = the 4 already-scaffolded sub-items); the banding doesn't map cleanly onto this IG's existing degree/vertebral-level ROM axes anyway (see Clinical verification) |
| Re-derive ROM/Strength components from this IG's other clinical ROM/strength Observations instead of direct entry | Explicitly rejected as clinically illegitimate per the `shoulder-surgeon` review — different grading mechanism, different measured position, active-vs-passive/painless ambiguity |
| Nested `itemExtractionContext` sub-group for nested SDC extraction | Investigated and abandoned once the extractor's hardcoded 2-level architecture was found — would have required new recursion logic in two core functions for no benefit over the simpler same-profile-leaf-merge approach actually implemented |
| Explicit UI mode toggle (radio button choosing "direct" vs. "component") | Simplified away during implementation — the SDC form's calculatedExpression naturally implies a presence-driven design once its `readOnly` bug is fixed; adding a toggle on top would be redundant UI for no behavioral gain, and would risk the two frontends disagreeing on mode semantics |

## Consequences

✅ `Q12-Constant` remains `Full` — no denominator or percentage change; closes the mapping's own previously-flagged "optional extension, not yet implemented" gap.

✅ Both Registration (`StepOutcomeScores.tsx`) and Follow-Up (`Q12PromForm.tsx`) updated with matching live-auto-calc behavior; Follow-Up required a bespoke `ConstantMurleyFields` sub-component (breaking from its otherwise fully-metadata-driven rendering, same precedent-setting move ADR-0089's dynamometry field already made) plus a new `buildQuantityObservationWithComponents` helper in `observationBuilder.ts` and a special-case in `FollowUpWizard.tsx`'s assembly logic (pulling the 5 Constant keys out of the generic per-key loop, which would otherwise have emitted 5 separate Observations instead of 1 with components).

✅ SDC frontend's `extractor.ts` gains a reusable same-profile-leaf-merging mechanism (not a one-off hack) and its first `Observation.component` targeting capability — both directly reusable for any future composite score this IG adds.

⚠️ Three real, unplanned bugs found and fixed during implementation, all in the pre-existing (not newly authored) SDC `QuestionnaireForm.tsx` renderer: (1) `calculatedExpression` items were unconditionally forced read-only, which alone would have made direct-total entry impossible; (2) the calc-effect force-cleared the field to empty whenever no sub-items were filled, which would have silently clobbered a manually-typed direct total on the next render even after fixing (1); (3) **the calc-effect's own `evaluateCalcExpr` regex could never match the live expression string at all**, discovered only via live end-to-end verification after fixes (1) and (2) still produced no visible auto-calculation. The regex expected exactly one `)` between the quoted linkId prefix and `.answer` (`...startsWith\('([^']+)'\)\.answer...`), but the actual FHIRPath — `%resource.repeat(item).where(linkId.startsWith('PREFIX')).answer...` — has two at that point (one closing `startsWith(`, one closing the surrounding `.where(`), so the regex silently failed on every call and `evaluateCalcExpr` always returned `undefined`. **This means the calculatedExpression demonstration was never actually functional from the day it was introduced** — this IG's own source comment already called it "decorative for now," an honest but easy-to-miss admission that predates this ADR. It stayed invisible because, until this ADR, nothing downstream read the sub-item answers the broken calculation depended on either — a non-functional calculation feeding a value nobody consumed. Fixed by loosening the regex to only capture the prefix (`linkId\.startsWith\('([^']+)'\)`) rather than anchoring to an exact, fragile parenthesis count. None of the three bugs were visible from `sushi .`, `tsc`, or ESLint — only live browser interaction surfaced any of them, and only the third needed a redeploy-with-temporary-console-logging cycle to actually pin down (the first two were diagnosable from static reading of the renderer once the live symptom was known; the third required watching the effect's own runtime state to see it wasn't matching, since the code otherwise looked correct on inspection).

⚠️ 4 new optional data-entry fields per Constant-Murley instance in each frontend — Refinement of an already-named Hurley element, not a new consensus element, so no category-(d) go/no-go was required (same reasoning as ADR-0089).

## Sources

- Clinical review by the reviewing shoulder surgeon, and the two-option framing agreed in response
- `shoulder-surgeon` subagent review (2026-07-19) — 15/20/40/25 breakdown confirmation (Constant & Murley 1987; 2008 modification), ROM banding/vertebral-ladder mechanism, Strength measurement convention, two-mode registry-practice reasonableness, Hurley Q12/Q13-A12 exact-wording check
- LOINC FHIR terminology server (`fhir.loinc.org`) `$expand` queries (2026-07-19) — "Constant Murley," "Constant score shoulder," "shoulder assessment pain score," "shoulder score activities of daily living" — zero matches
- SNOMED CT MCP lookup (2026-07-19) — `273383002` has no child concepts (no sub-component hierarchy exists)
- `ig/input/fsh/profiles/observations/ConstantScoreObservation.fsh` (component slicing — first use of this pattern in the IG; required an explicit `^slicing.discriminator`/`^slicing.rules` declaration, since SUSHI does not auto-apply a default discriminator for `Observation.component` the way it does for some other sliceable elements)
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh`
- `sdc-frontend/src/lib/extractor.ts`, `sdc-frontend/src/components/QuestionnaireForm.tsx`
- `frontend/src/components/wizard/StepOutcomeScores.tsx`, `stepFormData.ts`, `frontend/src/components/followup/{Q12PromForm,FollowUpWizard}.tsx`, `frontend/src/lib/observationBuilder.ts`, `frontend/src/config/followupObservationMetadata.ts`, `types/fhir.ts`
- ADR-0047 (tear-size cm/Cofield dual-encoding precedent this ADR's dual-mode design echoes), ADR-0088/ADR-0089 (freshest sibling redesigns, deploy-verification and permissive-bound lessons carried forward)
