# ADR-0158: Port the Constant-Murley POOS-15 sub-item calculator (ADR-0112) and its read-only fix (ADR-0113) to SDC

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** `docs/limitations_items/` — two related entries logged 2026-07-28/29: "SDC frontend has no Constant-Murley POOS-15 sub-item calculator" and "SDC frontend Constant-Murley entry still vulnerable to the out-of-range corruption fixed in the unified frontend." Both deferred at the time under the since-retired "SDC parity is a separate call" precedent (ADR-0144).

## Context

ADR-0112 built a POOS-15 sub-item calculator for the unified frontend: four of ten Constant-Murley sub-items (Sleep, Flexion, Abduction, Internal Rotation) auto-derive from data already captured elsewhere in the same flow; six more (Pain-normal-activities, ADL-occupation/leisure/arm-use, ROM-external-rotation, the Constant power test) are dedicated new manual inputs, all reviewed by the `shoulder-surgeon` subagent against the POOS-15 worksheet before implementation (two originally-proposed derivations — Pain and Power reusing existing fields directly — were rejected outright on clinical grounds; see ADR-0112's own review table). ADR-0113 then found and fixed a real data-integrity bug: the four `Observation.component[]` sub-scores and the total were plain typeable number inputs whose `min`/`max` HTML attributes don't block keyboard entry, letting a hand-typed out-of-range value (a reported case: Strength `555` → total `589`) bypass every clamp built into the derivation functions. The fix made all five fields calculated, read-only outputs.

Both ADRs explicitly deferred the SDC frontend. This ADR closes both gaps together, since the read-only fix only makes sense once the calculator exists to drive the values it displays.

## Decision

**Shared calculator module, not a reimplementation.** ADR-0157 (this same session) built a sync-script mechanism for sharing pure TypeScript between the two independent frontends specifically to make this port possible without duplicating ADR-0112's ~260 lines (and its surgeon-reviewed clinical judgment calls) by hand. `sdc-frontend/src/lib/shared/constantScore.ts` is the generated copy of the same canonical module the unified frontend uses — identical derivation functions, identical option catalogs, identical surgeon-reviewed rationale in the comments.

**New Questionnaire items**, mirroring ADR-0112's per-flow scope exactly:
- Both `ShoulderRegistrationQuestionnaire.fsh` (`item[4].item[7-12]`, version 0.8.0→0.9.0) and `ShoulderFollowUpQuestionnaire.fsh` (`item[2].item[9-15]`, version 0.3.0→0.4.0) gain six manual calculator-input items (Pain-normal-activities, ADL-occupation, ADL-leisure, ADL-arm-use, ROM-external-rotation, Constant power test).
- Follow-Up additionally gets a seventh (ADL-sleep) — Registration auto-derives ADL-sleep from `patient.sleepDisturbance` (`obs.sleep-disturbance`, already captured in that Questionnaire's patient-history group); Follow-Up captures no equivalent axis at all, same asymmetry ADR-0112 built into the unified frontend.
- All seven are deliberately **not** given `item.definition` — they exist only to feed the calculator client-side and are never submitted as their own resource, mirroring ADR-0112's "none of them is independently named by the consensus... keeping them UI-only avoids new profiles/ValueSets/CodeSystems." Answer options use inline `valueCoding` against a local, unregistered pseudo-system (`.../CodeSystem/constant-calculator-input`) rather than `valueString`, so each option keeps a proper short code (matching the shared module's lookup keys) distinct from its display label — a real `CodeSystem` isn't needed since these codes are never written to a submitted resource.

**Live calculation effect** (`QuestionnaireForm.tsx`): a new `useEffect`, structurally parallel to the existing `calculatedExpression` effect, reads whichever derivation/manual-input linkIds are present (Registration and Follow-Up expose different subsets; reading both `obs.sleep-disturbance` and `constant-calc.adl-sleep` with a nullish-coalesce covers both without a flow-specific branch) and calls `computeConstantSubscores`. Confirms **ADR-0122's generic extraction architecture needed zero changes** for this — the six/seven new items have no `item.definition`, so `collectExtractionTargets`/`buildResourceForExtractionGroup` never see them at all (verified via `parseDefinition(undefined)` returning `undefined`, the same short-circuit the read-only confirmation-display items already rely on).

**Read-only port** (ADR-0113 → SDC): the four sub-score items and the total item all gain `readOnly = true` directly in FSH, the SDC-spec mechanism `QuestionnaireForm.tsx` already respected for exactly this purpose (its own code comment: "Only an explicit item.readOnly = true still blocks editing," previously unused by any item). This removes ADR-0090's original direct-total-entry mode for SDC too, same trade-off the unified frontend already accepted. The new calculator effect writes each sub-score **unconditionally** (the derived value when `isSubscoreComplete`, or an explicit empty string when not) rather than only writing when complete — matching ADR-0113's "unconditional mirror" behavior, so a sub-score correctly clears if a clinician un-answers a contributing dropdown after having filled it. The pre-existing `calculatedExpression`-driven total computation needed no changes: it already only fires once all four `obs.constant-score.*` dependencies have values (ADR-0118), so gating the sub-scores on `isSubscoreComplete` before writing them automatically gates the total the same way.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Hand-duplicate `constantScore.ts` into `sdc-frontend` without the ADR-0157 sync mechanism | Rejected — would recreate exactly the Q11-offset-style drift risk ADR-0157 was built to close, for a much larger (~260-line) and more clinically-sensitive module; any future correction to a derivation table (as already happened once for the Internal Rotation ladder) would need to be manually reapplied to both copies with nothing to catch a missed one. |
| `valueString`-only answerOption for the six/seven calculator inputs (matching the Q11 timepoint picker's existing pattern) | Rejected — would collapse code and display into the same string, losing the short-code/label distinction the shared module's `pointsForCode()` lookup depends on; a real (if unregistered) `Coding` keeps the two properly separate, same as every other coded item in this Questionnaire. |
| Leave the total's direct-entry mode in place, only make the four sub-scores read-only | Rejected — this is exactly the bypass ADR-0113 identified: a manually-typed total can still exceed 100 even if the sub-scores themselves are correctly clamped, since nothing then constrains the total to equal their sum. |
| A full FHIRPath rewrite of the derivation logic (banding tables, the internal-rotation ladder, etc.) as a `calculatedExpression`, avoiding a React-level effect entirely | Rejected — FHIRPath's `calculatedExpression` extension is the right tool for a single sum (already used for the total), but the ROM-band/ladder/rescale logic involves surgeon-reviewed clinical judgment calls (see ADR-0112's rejected-derivation table) that are far more maintainable as named, commented TypeScript functions than as deeply nested `iif()`/`where()` FHIRPath, and this port's whole point is reusing that already-reviewed logic verbatim, not re-deriving it in a different language. |

## Classification (Clinical Feedback Integration Workflow)

**(b) Structural gap fix / parity port**, not a new clinical judgment — every derivation rule, option catalog, and clamping bound is verbatim from ADR-0112 (itself already `shoulder-surgeon`-reviewed) and ADR-0113; this ADR only changes which frontend the same reviewed logic reaches. `Q12-Constant` mapping classification unchanged (Full).

## Verification

- `sushi .` — 0 errors/0 warnings; both Questionnaires' compiled JSON confirmed carrying `readOnly: true` on all five constant-score items.
- `npm run build`/`npm run lint` clean on the SDC frontend.
- Not yet exercised end-to-end through a live browser submission (filling the new calculator inputs and confirming the sub-scores/total populate and stay read-only) — flagged for this session's batched server-side verification pass, alongside every other change in this batch.

## Consequences

✅ The SDC frontend now offers the same POOS-15 sub-item calculator experience as the unified frontend — closes the "SDC has no calculator" gap.
✅ The same out-of-range corruption class ADR-0113 fixed in the unified frontend is now structurally impossible in SDC too — the four sub-scores and the total are calculated outputs, not typeable fields.
✅ Confirms ADR-0157's sync-script sharing mechanism works for a second, larger, more clinically-sensitive module beyond its first use (`Q11_TIMEPOINTS`).
✅ Confirms ADR-0122's generic SDC extraction architecture needed zero changes to safely coexist with new, deliberately non-extractable UI-only Questionnaire items.
⚠️ Not yet re-verified against a live server deploy — flagged for this session's batch verification pass.

## Sources

- `docs/limitations_items/` — the two entries this ADR closes.
- ADR-0112 — the unified frontend's POOS-15 calculator, including the shoulder-surgeon review table this port reuses verbatim.
- ADR-0113 — the read-only fix this port replicates for SDC.
- ADR-0157 — the shared-code sync mechanism this port depends on.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh` — new calculator-input items, `readOnly = true` on the five constant-score items.
- `sdc-frontend/src/components/QuestionnaireForm.tsx` — new live-calculation effect.
- `sdc-frontend/src/lib/shared/constantScore.ts` — generated copy (canonical: `shared/constantScore.ts`).
