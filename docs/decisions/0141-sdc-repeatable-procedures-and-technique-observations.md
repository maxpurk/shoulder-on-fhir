# ADR-0141: SDC repeatable concomitant procedures + Approach/Reconstruction Extent/Fixation Technique/Intraoperative Success

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, items #7 and #8 — SDC's Surgery form supported only one procedure despite its own section heading reading "Surgical Procedure (primary, then concomitants)"; and lacked the 4 per-procedure technique fields (Approach, Reconstruction Extent, Fixation Technique, Intraoperative Success) the unified frontend's per-procedure sub-form has. Both Human Decisions were "SDC shall capture the same data like the unified frontend! Update it," and both touch the same `procedure` repeating group, so they were implemented together.

## Context

**Item #7's real gap was narrower than it first looked.** `ShoulderSurgeryQuestionnaire.fsh`'s `procedure` group already declared `repeats = true`, and the extraction dispatcher (`extractResources`) already handled multiple top-level QR items sharing the `procedure` linkId correctly (its own doc comment already said so: "each QR group repetition produces a separate resource"). The actual gap was entirely in `QuestionnaireForm.tsx`: the generic form renderer had no concept of "render this group N times with an Add/Remove control" — every group was assumed to appear exactly once. Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** for the repeating mechanism (the FSH/extraction side already supported it; only the UI was missing) and **(b)** for the 4 technique fields (all four profiles already exist and are already wired into the unified frontend, matching the "None of this is a design decision to re-litigate" framing clinical-review item #1 used for the same class of gap).

Three of the four technique fields (`Procedure.outcome` aside) hit a now-familiar architectural limit: `ProcedureApproachObservation`/`ReconstructionExtentObservation`/`FixationTechniqueObservation` are separate Observation resources, not Procedure fields, so they can't use `item.definition` inside the `procedure` group (whose itemExtractionContext targets `Procedure`, and whose generic resolver only reads leaves matching that resource type). Unlike every prior instance of this limitation in this feedback round (Coverage, RSG, phone, comorbidities), this one also needed **per-repetition correlation**: with multiple procedures now possible, each technique Observation must `partOf`-link to the *specific* procedure repetition it describes (ADR-0108's pattern, already used by the unified frontend), not just "the" procedure.

## Decision

**Repeating-group UI (`QuestionnaireForm.tsx`), generalized, not hardcoded to `procedure`:**
- New `repeatCount: Record<groupLinkId, number>` state, defaulting a group to 1 instance until "+ Add" is clicked.
- `QuestionField` gained a `stateKey` prop — the key actually used to read/write `formState`/`multiFormState`/`typeaheadState` and to set DOM `id`/`name`. Normally identical to `item.linkId`; inside a repeating group's Nth instance, `SectionCard` suffixes it (`${child.linkId}#${n}`) via a new `instanceSuffix` prop. `answerOption`/`answerValueSet` lookups stay keyed on the *real* `item.linkId` (those are repetition-independent), so no other state needed namespacing.
- The top-level render loop renders `repeatCount[section.linkId] ?? 1` copies of a repeating section's `SectionCard`, each with its own `instanceSuffix`, plus "+ Add concomitant …" / "Remove" controls.
- `buildQuestionnaireResponse` gained a `repeatCount` parameter and a new internal `buildGroupItems(group, stateSuffix, ...)` helper: for a repeating group it emits one top-level `QRItem` per instance (all sharing the group's linkId, reading suffixed state keys, emitting plain child linkIds) — exactly the QR shape `extractResources`'s dispatcher already expected.

**Intraoperative Success** (`procedure.outcome`, `#choice`, `item.definition` → `Procedure.outcome`, answerOptions Successful/Unsuccessful SNOMED 385669000/385671000) resolves fully generically — `outcome` is a plain `MS` field on `RotatorCuffProcedure`, no sibling-fixing needed, same mechanism as `procedure.laterality`.

**Approach / Reconstruction Extent / Fixation Technique**: loose leaves (`procedure.approach`, `procedure.reconstructionExtent`, `procedure.fixationTechnique`) inside the `procedure` group, each bound to its real `answerValueSet`. New in `extractor.ts`:
- `findDirectAnswer(items, linkId)` — a non-recursive sibling of `findAnswerByLinkId` that searches only one procedure repetition's own direct children (not the whole QR tree), since these leaves must be read per-repetition, not globally.
- `buildTechniqueObservation(coding, profileCanonical, code, display)` — hardcoded code/category (`ShoulderObservationCodes#<slug>`, category=procedure), same reasoning as Coverage/RSG's hardcoded builders: these loose leaves have no `item.definition`, so `collectExtractionTargets` never prefetches profile metadata for them, leaving nothing for the generic resolver to read at submission time.
- `ExtractedResources.technique: ProcedureTechnique[]` — index-aligned with `procedures[]` (`technique[i]` belongs to `procedures[i]`), built alongside each Procedure in the dispatcher loop.
- `bundleAssembler.ts`'s `assembleSurgeryBundle`: procedure UUIDs are now captured up front (mirroring the unified frontend's `indexProcUuid`/`concomitantProcs[i].uuid`), and the technique Observations' `subject`/`encounter`/`partOf` are wired using them — the same place every other cross-resource reference in this function is wired.

`Observation.partOf` added to `sdc-frontend/src/types/fhir.ts`'s `Observation` interface (previously absent). `Questionnaire.version`: Surgery `0.3.0` → `0.4.0` (this ADR's FSH additions were bundled into the same version bump as ADR-0140's Patte/Goutallier removal, both landing in the same edit pass).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Give the repeating-group mechanism a fully generic `item.definition`-driven metadata prefetch for technique Observations too (extend `collectExtractionTargets` to also discover loose leaves some other way) | Would require inventing a new Questionnaire-level signal for "this loose leaf needs profile metadata prefetched" — real generalization work belonging to the extractor's own already-noted follow-up, not this port. Hardcoding 3 more small, stable, well-precedented constants was smaller and consistent with 4 prior instances of the identical tradeoff. |
| Namespace `staticOptions`/`valueSetOptions`/`allAnswerOptions` per-instance instead of `stateKey` | Unnecessary — those are genuinely repetition-independent (a VS's expansion or a static `answerOption` list doesn't change between procedure repetitions), so keeping them keyed on the real linkId is both simpler and correct. |
| Model concomitant procedures as a fixed-count UI (e.g. "index + up to 2 concomitants" like a bounded set of separate groups) instead of a true `repeatCount`-driven Add/Remove | Rejected — doesn't match the unified frontend's genuinely unbounded "+ Add concomitant procedure" button, and would need its own arbitrary cap decision with no clinical basis. |

## Consequences

✅ Closes clinical-review items #7 and #8 together — SDC can now record repeatable concomitant procedures, each with its own Approach/Reconstruction Extent/Fixation Technique/Intraoperative Success, `partOf`-linked to the correct procedure.
✅ The repeating-group mechanism (`stateKey`/`instanceSuffix`/`repeatCount`) is generic, not hardcoded to `procedure` — any future repeating top-level group in any SDC Questionnaire gets the same Add/Remove UI and correct QR-shape emission for free.
✅ `sushi .`: 0 errors / 0 warnings. `sdc-frontend`: `npm run build` (tsc + vite) and `npm run lint` (zero-warnings gate) both clean.
✅ No mapping status change — Approach/Reconstruction Extent/Fixation Technique/Intraoperative Success are all Layer 2 (IG-operational), not consensus elements.
⚠️ Fifth and sixth instances of the "hardcoded builder, no generic resolver" pattern in this feedback round (technique Observations' code/category). The extractor module's own doc comment already flags this class of duplication as a legitimate future generalization; this ADR doesn't attempt it.

## Sources

- the cross-frontend parity audit, items #7, #8.
- ADR-0108 — `partOf` linkage pattern this ADR reuses, originally established for the unified frontend.
- `frontend/src/components/SurgeryWizard.tsx` (`buildTechniqueObservations`, `indexProcUuid`/`concomitantProcs[i].uuid`) — reference implementation this ADR ports.
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` (`procedure` group, items 4–7).
- `sdc-frontend/src/components/QuestionnaireForm.tsx` (`stateKey`, `instanceSuffix`, `repeatCount`), `sdc-frontend/src/lib/extractor.ts` (`findDirectAnswer`, `buildTechniqueObservation`, `ProcedureTechnique`), `sdc-frontend/src/lib/bundleAssembler.ts` (`assembleSurgeryBundle` technique wiring).
