# ADR-0121: One incision/closure time per surgical event, not per procedure; drop German field-label glosses

**Date:** 2026-08-01
**Status:** Accepted — concomitant-procedure example-data gap closed by ADR-0127 (2026-08-01)

## Context

The Surgery wizard's "Surgical Procedures" card (`SurgicalEventStep.tsx`) asked for incision time and closure time on every procedure row — the index procedure and each concomitant procedure independently. A live review of that page flagged the problem directly: a single surgery frequently performs two different procedures in one operative session (e.g. an arthroscopic rotator cuff repair plus a concomitant biceps tenodesis, performed through the same portals) — not two separate operations with two separate skin incisions. Asking for incision/closure per procedure modeled that as if the surgeon opened, closed, then re-opened and re-closed for the concomitant procedure, which is not what happens and is not clinically meaningful to record that way.

`Encounter.period` was already derived from this per-procedure data (ADR-0110: earliest incision across all procedures, latest suture across all procedures), so the flawed per-procedure capture was also the sole input to the encounter-level summary — a bug in the underlying model, not just a display quirk that could be papered over higher up.

Separately, the two time-input labels read "Incision (Schnittzeit) *" and "Closure (Nahtzeit) *". The German terms were carried over verbatim from the surgeon's own feedback note during ADR-0108 ("Add Schnittzeit (incision time) and Nahtzeit (suture/closure time)") into the shipped UI labels and were never removed once the English wording existed alongside them — the only surviving German-language artifact in either frontend's field labels.

Per the Clinical Feedback Integration Workflow, `Procedure.performedPeriod` / `Encounter.period` are Layer 2 — IG-operational (`L3.C.1`/`L3.C.2`), never named by the SECEC expert consensus, so the capture mechanism is design-free (classification (a) refinement); no Full/Partial coverage claim is affected by either change in this ADR.

## Decision

**One incision time + one closure time per surgical event**, captured once in the "Surgical Event" card (alongside day-of-surgery and setting) rather than once per procedure row. `SurgicalEventFormState` gains `incisionTime`/`sutureTime`; `SurgicalProcedureFormItem` loses them. Every `Procedure` built for that event — the index procedure and any concomitant procedures — gets the identical `performedPeriod`, composed from the same wizard-level pair via the existing `composeDateTime` helper. `Encounter.period` is composed directly from that same pair instead of being derived by scanning across procedures for the earliest/latest time (the earliest/latest computation was only ever needed because the times could disagree across rows; with one shared pair there is nothing left to reduce over).

**Drop the German glosses.** The labels become plain "Incision time *" / "Closure time *" with no parenthetical. English is this project's UI language throughout; the German terms were a one-time note-taking artifact from surgeon feedback, not a naming convention to preserve.

`SurgeryReview.tsx`'s per-procedure line showing "Incision: … · Suture: …" is removed (it would now show the identical value on every row); the Surgical Event summary card's "Operative window (derived)" line is retained, relabeled "Incision – Closure" since the value is no longer derived by scanning but is the direct input.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep per-procedure incision/suture, but let the surgeon leave concomitant-procedure fields blank and fall back to the index procedure's times | Still models the wrong thing structurally (two independently-editable time pairs that happen to usually be typed identically) and leaves the "same skin incision" fact implicit rather than expressed in the form. The surgeon's actual complaint was that the model has two of something that should be one. |
| Support both a single shared incision/closure *and* an optional per-procedure override, for the rare case of genuinely separate incisions in one encounter | No surgeon request for that case, and it reintroduces exactly the redundant-editable-pair problem this change closes, for a scenario (two skin incisions, one recorded Encounter) this registry has never been asked to model. If it comes up, a future ADR can add a per-procedure override on top of this simpler baseline. |
| Leave Encounter.period's earliest/latest derivation logic in place, just feed it a list of one repeated value | Dead code once every item in the list is identical by construction; deleting it is a strict simplification with no behavior change. |

## Consequences

✅ `L3.C.1` and `L3.C.2` stay Full — capture-mechanism refinement only, classification (a) per the Clinical Feedback Integration Workflow.
✅ A concomitant procedure performed in the same surgical event as the index procedure is now modeled as sharing one incision and one closure, matching how the surgery is actually performed.
✅ The last remaining German-language field labels in either frontend are gone; the surgery wizard is English-only, consistent with the rest of both frontends.
✅ `Encounter.period`'s earliest-incision/latest-suture reduction logic is deleted — one fewer derived computation, replaced by a direct pass-through of the single captured pair.
✅ `frontend/npm run build` (tsc + vite) and `npm run lint` (zero-warning gate) both pass.
⚠️ ~~The two existing longitudinal example patients (Anna Müller, Kemal Demir) each record only one Procedure in their surgery bundle, so this change is not exercised by a concomitant-procedure example — the IG has no reference data demonstrating a shared incision/closure across two procedures in one event. Logged as a `docs/limitations_items/` gap, not fixed here.~~ **Closed by ADR-0127** (2026-08-01): Anna Müller's surgery bundle gained a second `RotatorCuffProcedure` (concomitant distal clavicle excision, sharing the index procedure's exact `performedPeriod`), which also surfaced and fixed a real structural gap this ADR didn't anticipate — `RotatorCuffProcedure.reasonReference` couldn't reference anything other than the index RC diagnosis, making it impossible for a concomitant procedure to correctly cite the *different* diagnosis it actually treats.
⚠️ SDC frontend (port 3001) parity not implemented, consistent with this IG's standing precedent (ADR-0064, ADR-0081–0083, ADR-0105–0108, ADR-0110) of SDC parity being a separate call; its Surgery Questionnaire still captures per-procedure datetimes and was never given the Schnittzeit/Nahtzeit labels to begin with.
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. This SDC gap remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*
⚠️ The standalone `ProcedureForm.tsx` (ad-hoc post-hoc procedure editing, reachable from `PatientDetail`, independent of the Surgery wizard flow) still uses the pre-ADR-0108 shape — already a known, out-of-scope inconsistency per ADR-0110, unchanged here.

## Sources

- Live review of the `/surgery` flow (unified frontend, port 3000), 2026-08-01
- ADR-0108 (introduced per-procedure Schnittzeit/Nahtzeit fields from a surgeon feedback note)
- ADR-0110 (derived `Encounter.period` from per-procedure incision/suture times; the mechanism this ADR simplifies)
- `mapping/SECEC_FHIR_Mapping.csv` rows `L3.C.1`, `L3.C.2`
- `frontend/src/components/surgery/SurgicalEventStep.tsx`, `frontend/src/components/SurgeryWizard.tsx`, `frontend/src/components/surgery/SurgeryReview.tsx`
