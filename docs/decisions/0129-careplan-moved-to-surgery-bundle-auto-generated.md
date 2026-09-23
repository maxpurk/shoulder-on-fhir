# ADR-0129: `RotatorCuffResearchCarePlan` moved from Registration to Surgery bundle, auto-generated from the index procedure date

**Date:** 2026-08-02
**Status:** Accepted
**Found via:** a resource-linkage review of a unified-frontend test patient, walking the mapping's `Full` claims back against what the write path actually produces — `grep -rl "CarePlan" frontend/src` returned zero hits, meaning Q11.a–e's `Full` status rested entirely on the IG profile existing, not on anything either frontend ever submitted.

## Context

`RotatorCuffResearchCarePlan` encodes Hurley Q11 — the five research follow-up timepoints (6 weeks, 3 months, 6 months, 1 year, 2 years), each modeled as a `CarePlan.activity` with `scheduledTiming`. The slice carrying it (`entry[carePlan] 0..1`) had lived on `RotatorCuffRegistrationBundle` since the bundle profiles were first drafted, alongside the other "optional" resource slices (`imagingStudy`, `diagnosticReport`, `serviceRequest`).

That placement doesn't hold up against what Q11 actually anchors to. Re-reading Hurley et al. (2024) directly: Q10/Q11 are both scoped to patients "who underwent **treatment**" — the five timepoints are counted from the index surgery date, not the registration date. At registration (T0), the surgery hasn't happened yet — it may be weeks away, or the patient may end up treated conservatively (PT/injection) rather than surgically, in which case there is no surgery date to anchor the schedule to at all. A `CarePlan` submitted at registration would have to leave `period.start`/`activity[].detail.scheduledTiming` empty or guessed, which defeats the resource's only purpose.

Separately, while implementing the fix, a second thing was confirmed by reading `frontend/src/lib/patientStage.ts`: the *capability* this CarePlan is meant to support — computing the planned-vs-actual follow-up schedule, i.e. lost-to-follow-up detection (`L3.H.4`) — already works today, entirely client-side, via `Q11_TIMEPOINTS`/`computeTimepoints` (offsets applied to `Procedure.performedPeriod.start`, cross-checked against actual follow-up `Encounter`s). The persisted `CarePlan` doesn't add new functional capability to either frontend; it makes the schedule a real, queryable FHIR resource that any *other* system reading this registry's data — not just these two reference frontends — can see, which is the actual point of publishing an IG for a third party to build against.

A third thing surfaced while moving the two longitudinal example patients (Anna Müller, Kemal Demir) over to the new placement: **both already had a hand-authored `CarePlan` sitting in their Registration bundle** (`anna-mueller-research-careplan` / `kemal-demir-research-careplan`), predating this ADR. Inspecting it confirmed the placement was concretely, not just theoretically, wrong: `period.start` was set to the *surgery* date (e.g. Anna Müller's `"2024-04-15"`, identical to her index procedure's `performedPeriod.start` in bundle #2), and every `activity[].detail.status` was `"completed"` — both facts only knowable in hindsight, after the surgery happened and every follow-up was attended, yet the resource was sitting in the *pre-operative* Registration bundle. It was a narrator's after-the-fact summary wearing the shape of a T0 submission, not something a live system could ever have produced at registration time. Both were removed and replaced with a correctly-placed, forward-looking one (`status: scheduled`, not `completed`) in each patient's Surgery bundle.

## Decision

1. **Move the slice.** Remove `entry[carePlan] 0..1` from `RotatorCuffRegistrationBundle`; add it to `RotatorCuffSurgeryBundle` instead (still `0..1` — absent when the index procedure has no dated `performedPeriod.start`/`performedDateTime` yet).
2. **Auto-generate, no new data-entry step.** The five timepoints are fixed by the consensus, not a clinician's choice, so neither frontend asks the user anything new. Both frontends compute the schedule from the same procedure date already being submitted in the same bundle:
   - Unified frontend (`SurgeryWizard.tsx`): `buildResearchCarePlan()` calls the *existing* `computeTimepoints()` from `lib/patientStage.ts` (the same function `TimepointPicker`/`PatientDetail` already use to show planned-vs-actual status) — one call site, one source of truth for the five offsets.
   - SDC frontend (`bundleAssembler.ts`): the two frontends share no package, so the same `Q11_TIMEPOINTS` offset list (42/90/180/365/730 days) is duplicated locally in `buildResearchCarePlan()`, with a comment pointing at the unified frontend's copy to keep them in sync — same self-containment tradeoff this project already accepts for the LaTeX subprojects and for the two frontends generally.
   - Since no Questionnaire item corresponds to the schedule (it's derived, not answered), the SDC-side generation lives in `bundleAssembler.ts`'s assembler-level synthesis, not `extractor.ts`'s per-question `item.definition` extraction — the same architectural slot `bundleAssembler.ts` already uses for other non-extracted structural wiring (Encounter-as-anchor references, `Condition.evidence.detail`).
3. **`CarePlan.status = active`, `intent = plan`** (fixed, matching the existing profile), `period.start` = index procedure date, `period.end` = the 2-year timepoint, one `activity` per timepoint with `detail.scheduledTiming.event = [computed date]` and a human-readable `description`.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the slice on `RotatorCuffRegistrationBundle`, populate it later out-of-band (like the existing `Condition.clinicalStatus` update pattern, ADR-0093) | The bundle profile would keep advertising a slot that structurally can never be filled at the submission it's declared on — describing capability the system doesn't actually have there, the same overclaiming pattern this project has corrected before (ADR-0036, ADR-0039). |
| Leave as a documented `docs/limitations_items/` gap, change nothing | Rejected per explicit instruction — the placement was itself wrong, not just unimplemented; leaving it would perpetuate an incorrect profile, not just an unfinished one. |
| Drop `RotatorCuffResearchCarePlan` entirely, rely only on the client-side `computeTimepoints()` derivation | Works for either frontend individually, but this IG is meant to be handed to a third-party company/hospital building their own client — a derivation living only in this repo's TypeScript is invisible to them. A real persisted resource is the only form of this capability a different implementation can actually consume. |

## Classification (Clinical Feedback Integration Workflow)

**(b) Structural gap fix.** Q11.a–e are named expert-consensus elements already counted `Full`; this closes the gap between that claim and what the reference implementations actually submit. Not new clinical data-collection burden (classification (d)) — no new question is asked of the clinician in either frontend; the schedule is fully computable from data already captured.

## Consequences

✅ Both frontends now emit a real `RotatorCuffResearchCarePlan` in the Surgery submission, with zero added clinician-facing fields.
✅ The unified frontend's generator reuses `computeTimepoints()` rather than re-deriving the offsets, so the persisted schedule and the live-computed planned-vs-actual view (`TimepointPicker`, `PatientDetail`) cannot drift apart.
✅ `RotatorCuffRegistrationBundle`'s slice list no longer advertises a resource it structurally could never populate.
⚠️ The SDC frontend's copy of the five offsets is a manual duplicate of the unified frontend's `Q11_TIMEPOINTS` (no shared package between the two apps) — a future change to the offsets must be applied in both places by hand.
⚠️ Neither frontend backfills a `CarePlan` for a surgery already recorded before this change — this only affects new submissions going forward. The two longitudinal example patients are not an instance of this gap (their stale Registration-bundle `CarePlan`s were removed and replaced with correctly-placed Surgery-bundle ones as part of this same change, per Context above), but any *other* pre-existing registry data recorded under the old model would be.

## Sources

- `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh`, `RotatorCuffSurgeryBundle.fsh` — the moved slice.
- `ig/input/fsh/profiles/RotatorCuffResearchCarePlan.fsh` — unchanged profile shape.
- `frontend/src/lib/patientStage.ts` (`Q11_TIMEPOINTS`, `computeTimepoints`) — the pre-existing planned-vs-actual derivation this ADR's generator reuses rather than duplicates.
- `frontend/src/components/SurgeryWizard.tsx`, `sdc-frontend/src/lib/bundleAssembler.ts` — the two generation sites.
- `seed/bundles/anna-mueller/anna_mueller_01_registration.json`, `anna_mueller_02_surgery.json`, `seed/bundles/kemal-demir/kemal_demir_01_registration.json`, `kemal_demir_02_surgery.json` — the stale hindsight-dated `CarePlan` removed from each patient's Registration bundle, and its correctly-placed replacement in each Surgery bundle.
- `example_data/anna_mueller_story.md`, `example_data/kemal_demir_story.md` — updated to describe the CarePlan as living in bundle #2, not bundle #1.
- Hurley et al. (2024), Round 3 Q10/Q11 — "patients who underwent treatment of a rotator cuff tear" is the scoping phrase that anchors Q11 to the treatment (surgery) date, not the registration date.
- `mapping/SECEC_FHIR_Mapping.csv` rows `Q11.a`–`Q11.e`, `L3.G.4` (Bundle column corrected `Registration` → `Surgery`).
- ADR-0034 (three-bundle architecture), ADR-0068 (CarePlan named as a "known pragmatic shortcut... future extension point" — this ADR closes that shortcut), ADR-0093 (the out-of-band update pattern considered and rejected above), ADR-0108/ADR-0110/ADR-0121 (the incision/suture-closure date model `getProcedureEffectiveDate`/`performedPeriod.start` reads from).
