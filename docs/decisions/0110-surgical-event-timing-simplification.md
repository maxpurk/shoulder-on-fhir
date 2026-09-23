# ADR-0110: Single surgery-date + derived Encounter.period; merge Encounter step into Surgical Event step

**Date:** 2026-07-28
**Status:** Accepted

## Context

ADR-0108 closed the redundancy between a separate per-procedure "performed date" field and `Encounter.period` by replacing the former with incision-time/suture-time (`Procedure.performedPeriod`). What remained after that fix, flagged in a follow-up review of the live `/surgery` flow, is a second, related redundancy: the wizard still presented a standalone **"Encounter"** step asking for a full start *and* end `datetime-local` (plus a Class dropdown), immediately followed by a **"Procedures"** step asking for per-procedure incision/suture `datetime-local` values. For a same-day operation this meant the date component of the same day got typed up to four times, and the surgeon was confronted with "Encounter" — an administrative/FHIR concept, not a clinical one — as its own wizard step.

`Procedure.performedPeriod.start` is the load-bearing anchor for all Q11 research follow-up timepoint computation (`patientStage.ts`). `Encounter.period` (mapping row `L3.C.2`) and the temporal-anchor row `L3.C.1` are both **Layer 2 — IG-operational**, never named by the SECEC expert consensus, so how they are captured is design-free per the Clinical Feedback Integration Workflow's classification (a) "refinement" — no Full/Partial coverage claim is affected.

Separately, while auditing the existing datetime handling, a latent FHIR-conformance defect was found: `Procedure.performedPeriod.start`/`.end` were built directly from the raw `datetime-local` input string (e.g. `2024-04-15T09:00`), which carries **no timezone offset**. FHIR's `dateTime` type requires an offset once minute precision is present. `Encounter.period`, built via `new Date(...).toISOString()`, did carry an offset but only ever UTC (`Z`), which is correct but inconsistent with how the Procedure timestamps were built — the two resources used two different, inconsistent conventions for the same information.

## Decision

**One "day of surgery" date, operative times only.** The wizard-level `EncounterFormState` (`start`, `end`, `classCode`) is replaced with a slimmer `SurgicalEventFormState { surgeryDate: string; setting: 'IMP' | 'AMB' }`. Per-procedure `incisionTime`/`sutureTime` change from full `datetime-local` values to **time-only** (`HH:mm`) values — the date is no longer re-entered per procedure. A separate hospital admission/discharge window is no longer captured at all.

**`Encounter.period` is derived, not captured.** For the Surgery bundle, `Encounter.period.start`/`.end` are computed as the earliest incision time and latest suture time across the index procedure plus any concomitant procedures, composed against the single `surgeryDate`. This removes one of the two previously-independent temporal facts entirely rather than just deduplicating their entry UI — there is only one clock in this model now, the operative one, and `Encounter.period` reports a view onto it.

**Steps merged.** `EncounterStep.tsx` is deleted. Its one remaining substantive field (Class, relabeled "Setting" with wording "Day surgery (outpatient)" / "Inpatient") moves into a new `SurgicalEventStep.tsx` (renamed from `ProcedureStep.tsx`), which now renders, in order: day-of-surgery date + setting, then the existing procedure rows (code, approach/extent/fixation, incision/closure **time** inputs, intraoperative success, notes). The wizard's step sequence changes from `lookup → encounter → procedure → intraop → review` (5 steps) to `lookup → surgical-event → intraop → review` (4 steps). No more standalone "Encounter" terminology anywhere in the surgeon-facing flow.

**Offset-aware composition.** A shared `composeDateTime(date: string, time: string): string` helper in `SurgeryWizard.tsx` combines the wizard's `surgeryDate` with an `HH:mm` time using the browser's local timezone offset (e.g. `2024-04-15T09:00:00+02:00`), used identically for both `Procedure.performedPeriod` and the derived `Encounter.period` — closing both the missing-offset defect on Procedure and the UTC-vs-local inconsistency between the two resources.

`Procedure.performedPeriod.start` remains exactly what Q11 timepoint computation reads (`patientStage.ts`, unchanged) — only how the value is composed changed, not its meaning or its presence.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep a separate admission-window Encounter step but auto-fill it from the operative window (editable) | Still two independently-editable temporal facts in the UI even if pre-filled identically most of the time; the whole point of the redundancy complaint was one date typed once. A registry documenting research follow-up has no operational need for admission/discharge tracking the way a hospital ADT system would. |
| Keep `datetime-local` per procedure (full date+time) instead of splitting into a shared date + per-row time | Would keep the same-day-retyped-N-times problem for every concomitant procedure; the date is identical across all procedures in one surgical event by construction (this wizard records one encounter), so factoring it out to the wizard level is a strict simplification with no loss of expressiveness. |
| Fix the missing timezone offset on Procedure without also collapsing the Encounter step | Would leave the UX complaint (four datetime entries, "Encounter" jargon) unaddressed while only fixing the FHIR-conformance nit; both problems live in the same code path and are cheaper to fix together than sequentially. |
| Derive `Encounter.period` from `Procedure.performedPeriod` server-side or via FHIRPath at submit time rather than in the frontend `useMemo` | No such computed-field mechanism exists anywhere in this architecture (both frontends build FHIR resources by hand or via typed builders, ADR-0031/ADR-0044); introducing one for a single derived field would be disproportionate. A plain client-side `useMemo` reduction over the existing procedure form state is the same pattern already used everywhere else in this wizard. |

## Consequences

✅ `L3.C.1` and `L3.C.2` stay Full — wording/derivation refinement only, no consensus-coverage impact (classification (a) per the Clinical Feedback Integration Workflow).
✅ The residual Encounter/Procedure date redundancy is now fully closed — one wizard-level date, two time-only fields per procedure, nothing else.
✅ `Procedure.performedPeriod` and the derived `Encounter.period` are both offset-aware FHIR `dateTime`s, composed by the same helper — closes the missing-offset defect and the UTC-vs-local inconsistency between the two resources.
✅ `sushi .` unaffected (no FSH change — `ShoulderEncounter.period` and `RotatorCuffProcedure.performed[x]` already supported this shape); frontend `npm run build` (tsc + vite) and `npm run lint` (zero-warning gate) both pass.
✅ Wizard step count drops 5 → 4; no more "Encounter" step label in the surgeon-facing UI.
⚠️ The example longitudinal bundles (`seed/bundles/{anna-mueller,kemal-demir}/`) previously modeled `Encounter.period` as a distinct, wider admission window (e.g. Anna 07:30–13:00 vs. operative 09:00–10:35) — updated in this same change to the operative window so the reference data matches what the wizard now emits. The wider admission-window concept itself is no longer representable through this wizard.
⚠️ The standalone `ProcedureForm.tsx` (ad-hoc post-hoc procedure editing, reachable from `PatientDetail`, independent of the Surgery wizard flow) still uses the pre-ADR-0108 shape — already a known, out-of-scope inconsistency per ADR-0108, unchanged here.
⚠️ SDC frontend (port 3001) parity not implemented, consistent with this IG's standing precedent (ADR-0064, ADR-0081–0083, ADR-0105–0108) of SDC parity being a separate call; its Surgery Questionnaire still captures a full Encounter start/end and per-procedure datetimes.
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. This SDC gap remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*

## Sources

- Live review of the `/surgery` flow (unified frontend, port 3000), 2026-07-28
- ADR-0108 (prior round of the same redundancy — procedure date vs. Encounter.period)
- `mapping/SECEC_FHIR_Mapping.csv` rows `L3.C.1`, `L3.C.2`
- `ig/input/fsh/profiles/ShoulderEncounter.fsh` (`period`/`period.start`/`period.end` MS, cardinality unchanged), `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` (`performed[x] 1..1 MS`, `only dateTime or Period`)
- `frontend/src/components/SurgeryWizard.tsx`, `frontend/src/components/surgery/SurgicalEventStep.tsx` (new, replaces `EncounterStep.tsx` + `ProcedureStep.tsx`), `frontend/src/components/surgery/SurgeryReview.tsx`, `frontend/src/lib/patientStage.ts` (Q11 anchor, unchanged)
- `seed/bundles/anna-mueller/anna_mueller_02_surgery.json`, `seed/bundles/kemal-demir/kemal_demir_02_surgery.json`
