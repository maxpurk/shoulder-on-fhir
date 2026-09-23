# ADR-0093: Follow-Up/Registration alignment pass

**Date:** 2026-07-21
**Status:** Accepted

## Context

Surgeon note: align the information captured in the follow-up part with what registration now captures — *"when we ask for pain, it shall create the same style of data elements in the registration, and in the follow ups."* That is, align the Follow-Up flow's data elements with whatever changed at Registration across the recent redesign ADRs (0085–0092), pain cited as the concrete example. This is the workflow's "batch checkpoint" pass (this project's Clinical Feedback Integration Workflow, step 4) — reviewing cross-cutting fallout across everything already decided individually, not a new clinical point of its own.

Two Explore agents surveyed 9 areas of parity between Registration and Follow-Up: ROM, muscle strength, provocation tests, visual inspection, pain, Q1 patient history, Q12 PROM styling, `Condition.clinicalStatus`, and general UX conventions. ROM, strength (in the unified frontend), and visual inspection were already at full parity — no action needed there.

### Two apparent gaps were checked against Hurley 2024 directly and found to be consensus-correct as-is

Per explicit user instruction ("look into Hurley, align there, if not specified make it logical"), both candidate fixes were checked against the paper (`shoulder-surgeon` subagent, Zotero item `TU27GN8G`) before any code change, rather than mechanically copying Registration's field set onto Follow-Up:

1. **Provocation tests.** Registration captures 5 (Jobe, lift-off, belly-press, bear-hug, Hornblower); Follow-Up captures only 3 (Jobe, lift-off, belly-press). This looked like a missing-field gap. It isn't: Hurley's own **A9** (post-op physical exam) names exactly 3 tests ("e) Jobe test, f) Lift off, and g) Belly press test"); **A2** (pre-op exam, which Registration's 5-test set correctly maps to) additionally names bear-hug and Hornblower. The panel deliberately narrowed the post-op set — Round 2 offered the same candidate list for Q9 as Q2, and bear-hug/Hornblower were voted below threshold specifically for the post-op setting. Mechanically copying the 5-test set onto Follow-Up would have *broken* Q9 alignment and added an out-of-consensus data-collection burden. **No fix — documented as intentional instead**, so a future reviewer doesn't "fix" this again by mistake.
2. **Q1 patient-history re-capture at Follow-Up** (sleep disturbance, functional limitations, employment status, sports participation — all plausibly changeable post-op). Also not a Hurley gap: **A12** (follow-up PROM domains) already names the correct follow-up construct — "e) Return to sport/work" — which this IG already implements as a graded outcome (`return-to-sport-work`), distinct from and superseding a raw re-ask of the Q1 baseline enums. Hurley never re-asks Q1's baseline items at follow-up; the shift from "what is your occupation" (baseline) to "did you return to it" (follow-up) is the consensus's own intended design. Sleep is additionally covered, partially, by Constant-Murley's own ADL sub-score (a standard 4-component instrument — work/recreation/sleep/hand-positioning — already captured at Follow-Up per ADR-0090). **No fix.**

### One real bug, narrower than it first looked

Follow-Up's pain fields (the surgeon's own cited example) initially looked completely unbounded in a quick live check. A second, more careful live check — waiting long enough for the async `useQuantityBounds` profile fetch to resolve, rather than reading the DOM immediately after render — showed `min`/`max` **do** correctly resolve to 0/10 from the profile's `minValueQuantity`/`maxValueQuantity`; that mechanism already works correctly and needed no fix. The actual, narrower defect: `ObservationField.tsx` hardcoded `step="any"` unconditionally, so Follow-Up silently accepted decimal pain values (e.g. "7.3") where Registration enforces integer-only entry via a hardcoded `step={1}`. Confirmed with the `shoulder-surgeon` subagent that Hurley specifies no numeric pain-scale bounds at all (mechanism-silent, IG design freedom) and that a 0–10 integer NRS (matching the already-verified LOINC 72514-3 "Pain severity 0-10 verbal numeric rating") is the clinically standard, correct choice — so Registration's existing constraint is the one to propagate, not to second-guess.

### One real, deliberately-kept-simple gap: `Condition.clinicalStatus` unreachable after Registration

`RotatorCuffCondition.clinicalStatus` (active/recurrence/inactive/resolved, ADR-0075) is set once at Registration and never revisited — so `recurrence`/`resolved`, values this IG itself defined, are currently unreachable after registration, even though a follow-up visit is exactly when a clinician would learn a repair failed or fully resolved. Checked against Hurley first (per the same discipline as the two near-misses above): not a consensus mandate — the panel considered and *dropped* a "no retear" treatment-success criterion from the final A8, and Q13 confirms routine follow-up re-imaging (which would often be what detects a retear) isn't done outside a research protocol. So this is a real but IG-internal-consistency gap, not a Hurley-driven one.

Initially scoped as adding an optional Condition slice to `RotatorCuffFollowUpBundle` — rejected on reflection: that bundle's own profile documentation explicitly states it "does NOT contain Patient, Condition, or Procedure" as a deliberate ADR-0034 architectural boundary, and amending it is a bigger, riskier change than this point warrants. Per explicit user instruction ("keep it rather simple, FHIR best practice, if workload too big drop and document"), implemented instead as a **standalone PUT to `Condition/{id}`**, entirely separate from the Follow-Up bundle's own transaction POST — reusing `frontend/src/lib/fhirClient.ts`'s existing `update()` utility (already used by the CRUD edit pages, already implements optimistic concurrency via `If-Match`/`versionId` — genuine FHIR best practice, not a new pattern). This leaves `RotatorCuffFollowUpBundle`'s documented invariant completely untouched.

### Approved infrastructure gap: no helpText/required capability in the Follow-Up renderer

Follow-Up's generic metadata-driven `ObservationField` had no mechanism at all for per-field help text or required markers — Registration's hand-authored wizard has both throughout (e.g. SSV and SANE each have an explanatory gloss at Registration; Follow-Up had none for either). Closing this needed extending the shared type/renderer, not a one-line tweak; approved as in-scope infrastructure work rather than a cosmetic sweep of every remaining minor label/layout difference the Explore agents found (heading level h2 vs h3, card vs fieldset/legend grouping, "Active" label-prefix presence, unit-display convention) — those are lower-value and out of this pass's scope.

## Decision

### A. Pain step-granularity fix
- `frontend/src/config/followupObservationMetadata.ts`: added `step?: number` to `ObservationMeta`; set `step: 1` on all 4 pain entries (`pain-average`, `pain-active-movement`, `pain-passive-movement`, `pain-rest`).
- `frontend/src/components/followup/ObservationField.tsx`: `step="any"` (hardcoded) → `step={meta.step ?? 'any'}` (defaults preserved for every other field).
- SDC frontend not touched — its Follow-Up Questionnaire FSH (`ig/input/fsh/instances/ShoulderFollowUpQuestionnaire.fsh`) already declares correct `$MIN_VALUE_EXT`/`$MAX_VALUE_EXT` on all 4 pain items; no step-equivalent defect found there.

### B. Provocation-test asymmetry documented as intentional
- One-line comment above the Q9 provocation entries in `followupObservationMetadata.ts` citing Hurley A9 vs A2, so this is not "fixed" again by mistake. No functional change.

### C. `Condition.clinicalStatus` update at Follow-Up
- `frontend/src/components/followup/ReviewSubmit.tsx`: new optional "Update Condition Status" control (defaults to "No change"), offering the same 4 values as Registration's dropdown (`active`/`recurrence`/`inactive`/`resolved`, same `http://terminology.hl7.org/CodeSystem/condition-clinical` system) plus a display of the Condition's current status for context.
- On submit, if a change is selected: re-`fhirClient.read()`s the Condition fresh (not the possibly-stale copy from patient lookup) to get a current `versionId`, mutates only `clinicalStatus`, and `fhirClient.update()`s it — a standalone PUT, run before the bundle POST but independent of it. A failed status update surfaces its own error banner and does **not** block or roll back the follow-up bundle submission; a successful one shows its own confirmation banner.
- `frontend/src/components/followup/FollowUpWizard.tsx`: passes `conditionId` and the Condition's current `clinicalStatus` code down to `ReviewSubmit`.
- No FSH/profile changes anywhere. SDC frontend: explicitly deferred — matches this project's standing precedent (unified frontend first, SDC parity a separate call per point, e.g. ADR-0064).
  *Amended by ADR-0144 (2026-08-03): that standing precedent is retired going forward.*

### D. helpText/required infrastructure, applied to close specific gaps
- `followupObservationMetadata.ts`: added `helpText?: string` and `required?: boolean` to `ObservationMeta`.
- `ObservationField.tsx`: renders `meta.helpText` under the label (byte-identical convention to Registration's existing `<p className="text-xs text-gray-500 mb-1">` pattern) and a `*` suffix + native `required` attribute when `meta.required` is set, for both the `quantity` and `codeable` render paths.
- Applied immediately: SSV gains "Subjective Shoulder Value — patient self-rating"; SANE gains "Single Assessment Numeric Evaluation" — both copied verbatim from Registration's existing glosses. Constant-Murley's total-field label corrected from "Constant-Murley Total Score" to "Constant-Murley Score" (byte-match with Registration) and gains Registration's existing help text ("Higher = better function. Hurley A12 preferred instrument..."). `Q12PromForm.tsx`'s bespoke `ConstantMurleyFields` component (which renders the total field outside the generic per-field loop, per ADR-0090) updated to read `helpText` from metadata instead of a separately hardcoded, shorter string.
- `required` is added as reusable capability but not applied to any field in this pass — every Follow-Up field remains optional-by-design (partial visits are an explicit, longstanding project convention), so there was nothing concrete to mark required.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Mechanically copy Registration's 5 provocation tests onto Follow-Up | Would have broken Hurley A9 alignment — the panel deliberately specifies fewer tests post-op; checked before implementing rather than assumed |
| Re-ask Q1 baseline enums (sleep/employment/sports/function) at Follow-Up | Hurley's own A12 already names the correct follow-up construct (return-to-sport/work), already implemented; re-asking baseline enums would be redundant, out-of-consensus burden |
| Add a Condition slice to `RotatorCuffFollowUpBundle` for status updates | Rejected — that bundle's profile explicitly documents "does NOT contain Patient, Condition, or Procedure" as a deliberate ADR-0034 boundary; a slice addition is architecturally bigger and riskier than this point warrants, and a simpler standalone-PUT path already existed via `fhirClient.update()` |
| Make the Condition status update block/gate the follow-up bundle submission | Rejected — the status change is a genuinely optional side-effect of a visit, not a dependency; a clinician recording exam findings shouldn't be blocked by an unrelated Condition-update failure (e.g. a stale version conflict) |
| Full cosmetic sweep of every remaining label/heading/grouping difference (h2 vs h3, card vs fieldset, "Active" prefix, unit-display convention) | Lower-value, not what the surgeon's note or the user's explicit scoping asked for; left as-is |

## Consequences

✅ Pain entry now behaves identically at both timepoints (0–10 integer, matching the surgeon's own cited example) — closes the one real bug this review found in that area.

✅ `recurrence`/`resolved` clinicalStatus values are now reachable post-registration, closing a genuine internal-consistency gap, via a minimal, non-invasive standalone PUT that leaves `RotatorCuffFollowUpBundle`'s documented scope untouched.

✅ SSV/SANE/Constant-Murley now carry the same explanatory text and exact labeling at both timepoints; the helpText/required capability is reusable for any future Follow-Up field gap of this kind.

✅ Two near-miss "fixes" were caught and avoided before any code was written, by checking Hurley directly rather than assuming visual asymmetry implies a defect — both are now explicitly documented (one in code comments, one in this ADR) as intentional, not silently different.

⚠️ SDC frontend Condition-status-update parity is deferred, not silently skipped — flagged here per this project's standing convention for such calls.
*Amended by ADR-0144 (2026-08-03): the underlying convention (SDC parity as a separate, deferrable call) is retired going forward. This gap remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*

⚠️ The broader label/heading/grouping cosmetic differences between the hand-authored Registration wizard and the metadata-driven Follow-Up renderer (documented by the Explore agents) remain unaddressed; explicitly out of scope for this pass, not forgotten.

## Sources

- Clinical review by the reviewing shoulder surgeon
- Two Explore agent reports (2026-07-21) — 9-area structural diff between Registration and Follow-Up capture
- `shoulder-surgeon` subagent reviews (2026-07-21, two passes) — Hurley A9 vs A2 provocation-test scoping, A12 return-to-sport/work vs Q1 baseline re-ask, Constant-ADL sleep-item redundancy, Q8/Q13 basis (or lack thereof) for recurrence reassessment, pain-scale bounds (LOINC 72514-3)
- Live empirical re-check of `useQuantityBounds` resolution timing (Playwright, live server deployment) — confirmed min/max bounds already worked correctly before assuming otherwise
- `frontend/src/config/followupObservationMetadata.ts`, `components/followup/{ObservationField,Q12PromForm,ReviewSubmit,FollowUpWizard}.tsx`
- `frontend/src/lib/fhirClient.ts` (`update()` — pre-existing optimistic-concurrency utility, reused here rather than duplicated)
- ADR-0075 (Condition.clinicalStatus semantics), ADR-0086/0087/0088/0089/0090 (the Registration-side redesigns this pass checked for parity), ADR-0034 (RotatorCuffFollowUpBundle's documented Patient/Condition/Procedure exclusion, respected not amended)
