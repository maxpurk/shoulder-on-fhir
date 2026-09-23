# ADR-0153: Build the Follow-Up flow's optional Q13 re-imaging `ImagingStudy`, never instantiated by either frontend

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** `docs/limitations_items/`'s own running log — flagged 2026-08-02 as a direct follow-on to ADR-0130 ("Follow-up re-imaging slot (`RotatorCuffFollowUpBundle`'s `imagingStudy 0..1`) never instantiated by either frontend"), left open at the time pending a UI affordance. Picked up now while working through the log's fixable items.

## Context

`RotatorCuffFollowUpBundle.fsh`'s own Description explicitly documents an optional `ShoulderImagingStudy` entry "only at the research re-imaging timepoint (Q13 exception)," and the profile slice (`entry[imagingStudy].resource 0..1`) has existed since the bundle was first modeled. ADR-0130 built the equivalent Registration-side slot for Q6 (pre-op imaging modality) in both frontends, but explicitly scoped Q13's follow-up slot out ("left out of this ADR's scope... the existing `0..1 ImagingStudy` slice on `RotatorCuffFollowUpBundle` already structurally available for the rare research-driven exception"). Neither frontend's follow-up write path (`FollowUpWizard.tsx`/`observationBuilder.ts` for the unified frontend, `bundleAssembler.ts`/`extractor.ts` for SDC) ever constructed an `ImagingStudy` on a follow-up submission — confirmed via `grep` before this ADR, matching the same defect class as the already-fixed Q6 gap and the still-open Q3 gap.

## Decision

Build the same minimal `ImagingStudy` shape ADR-0130 established for Registration (`status = "available"`, `subject`, `modality` — one `Coding` bound to the existing `ImagingModality` ValueSet), reused as-is, in both frontends' Follow-Up flow. One deliberate difference from Registration's shape: the follow-up study also sets `encounter` (a new optional field added to both frontends' `ImagingStudy` TS interface), since a patient can have several follow-up visits and the study needs to be attributable to the specific visit it was obtained at — Registration's pre-op study has no such ambiguity (exactly one registration per patient) and is left unchanged.

**Unified frontend:** a small "Re-imaging (optional)" card (`ReImagingField`, `FollowUpWizard.tsx`) rendered after the Q9 exam step, using the same `useValueSet(VALUESET_URLS.IMAGING_MODALITY)` pattern `StepImaging.tsx` already established. `followUpBundleBuilder.ts`'s `AssembleInput` gained an optional `imagingStudy` field, appended as a bundle entry when present. `FollowUpResource` (the type-level union constraining what a follow-up `BundleEntry.resource` can be) widened to include `ImagingStudy`. `ReviewSubmit.tsx` gained a "Re-imaging: yes/no" stat alongside the existing Observations/QR counts, so a submitter can confirm at review time whether a study will be included.

**SDC frontend:** new top-level `item[3]` "reimaging" group added to `ShoulderFollowUpQuestionnaire.fsh` (`^version` 0.2.0 → 0.3.0), mirroring Registration's `item[6]` "imaging" group structurally (same `itemExtractionContext` targeting `ShoulderImagingStudy`, one `reimaging.modality` leaf bound to the same `ImagingModality` answerValueSet). No `extractor.ts` dispatcher changes were needed — ADR-0130 already added the generic `ImagingStudy` resource-bucket case (`resource.resourceType === 'ImagingStudy' → out.imagingStudy = resource`) with no linkId-specific logic, so the new group is picked up automatically by the existing generic mechanism; only `bundleAssembler.ts`'s `assembleFollowUpBundle` needed a new `imagingStudyEntry` block (previously only `assembleRegistrationBundle` had one), wiring `subject` (via the existing `attachSubjectRef` helper) and the new `encounter` field.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Reuse Registration's exact `ImagingStudy` shape, no `encounter` field | Considered for minimal footprint (matching ADR-0130 exactly), but a follow-up patient can have up to five visits (Q11 timepoints); an unlinked re-imaging study would be ambiguous about which visit it belongs to in a way Registration's single pre-op study never is. `encounter` is a base-R4 `ImagingStudy` element already (0..1, unconstrained by `ShoulderImagingStudy`), so adding it is a pure extension, not a profile change. |
| Add the field to the existing `Q9ExamForm.tsx`/`Q9_FIELDS` generic metadata-driven form | Rejected — that form and its SDC-side per-leaf-extraction sibling are `Observation`-only by construction (each field maps to one `ShoulderObservation` child profile); `ImagingStudy` is a different resource type entirely and needs its own extraction-context group, not a new entry in an Observation-shaped field table. |
| Leave open, defer further (status quo) | Rejected — the fix is a direct structural mirror of already-solved Q6, low risk, and the profile slice has sat unused since the bundle was first modeled. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition, closing a Layer-2 gap.** The `entry[imagingStudy] 0..1` slice already existed on the bundle profile (`L3.G.*`-adjacent scaffolding, not a new IG element); this ADR only builds the frontend write path that was always missing. No SECEC/coverage-count impact — Q13 was never itself a numbered consensus element (it names an *absence* of routine imaging as the correct common case; ADR-0130 already noted this).

## Consequences

✅ The follow-up re-imaging slot is now genuinely demonstrated by both frontends' write paths, closing the last of the three never-instantiated-`ImagingStudy` gaps ADR-0130 and its follow-on log entries identified (Q6 fixed by ADR-0130; this ADR fixes the Follow-Up/Q13 slot; Q3/radiographs remains open, logged separately in `docs/limitations_items/`, deliberately out of scope here — same triage ADR-0130 itself used).
✅ Confirms ADR-0122's generic SDC extraction dispatcher genuinely required zero `extractor.ts` changes for a second flow reusing an already-modeled resource type — direct evidence the genericity claim holds beyond its original Registration-only use.
✅ `npm run build`/`npm run lint` clean on both frontends; `sushi .` compiles 0 errors/0 warnings (156 resources, `item[3]` verified in the compiled `Questionnaire-shoulder-follow-up.json`).
⚠️ Not yet re-verified against a live `validator-service`/server deploy (this ADR was authored and locally verified only) — the next `tools/validate.sh`/live-deploy pass should confirm a submitted follow-up bundle with a populated `reimaging` group validates cleanly end-to-end.

## Sources

- `docs/limitations_items/` — "Follow-up re-imaging slot... never instantiated by either frontend," the entry this ADR closes.
- ADR-0130 — the Registration-side Q6 fix this ADR structurally mirrors, including its own explicit "Q13 left out of scope" note.
- `ig/input/fsh/profiles/RotatorCuffFollowUpBundle.fsh` — pre-existing `entry[imagingStudy] 0..1` slice, unchanged.
- `ig/input/fsh/instances/ShoulderFollowUpQuestionnaire.fsh` — new `item[3]` "reimaging" group.
- `frontend/src/components/followup/FollowUpWizard.tsx` (`ReImagingField`), `frontend/src/components/followup/ReviewSubmit.tsx`, `frontend/src/lib/followUpBundleBuilder.ts`, `frontend/src/types/fhir.ts` (`ImagingStudy.encounter`, `FollowUpResource` widened) — unified frontend.
- `sdc-frontend/src/lib/bundleAssembler.ts` (`assembleFollowUpBundle`'s new `imagingStudyEntry`), `sdc-frontend/src/lib/extractor.ts` (stale "Registration only" comment corrected), `sdc-frontend/src/types/fhir.ts` (`ImagingStudy.encounter`) — SDC frontend.
