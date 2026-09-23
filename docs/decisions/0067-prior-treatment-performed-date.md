# ADR-0067: Add date field for prior treatment procedures in the registration form

**Date:** 2026-06-28
**Status:** Accepted

## Context

`RotatorCuffProcedure` (ADR-0059) derives from `procedure-eu-core`, which tightens `Procedure.performed[x]` to **1..1** (required). The IG's own profile further constrains `performed[x]` to `dateTime | Period` only (excluding `string`, `Age`, `Range`), because `performedDateTime` is the load-bearing field for the Q11 follow-up timepoint calculation (6 wk / 3 mo / 6 mo / 1 y / 2 y).

`RotatorCuffProcedure` is used for two distinct purposes:
1. **Index surgical procedure** — `performed[x] 1..1` is appropriate and desirable; the surgery date is always known.
2. **Prior non-surgical treatments** (physiotherapy, shoulder injection) — the date may be approximate or partially unknown, but the field is still required by the profile.

Before this ADR, `StepPatient.tsx` resolved this constraint by hardcoding `performedDateTime: today` (the registration date) for prior PT and injection Procedures. The form never asked the user when those treatments occurred. This produced clinically incorrect data — prior treatments happened weeks or months before registration, not on the day of registration.

## Decision

Add a conditional date input to the registration form for each prior treatment type. The date field appears only when the user selects "Yes" for that treatment. It is marked `required` (HTML5 native validation), so the form cannot advance without a date if "yes" is selected.

When the select changes away from "yes", the date field is hidden and the stored date is cleared (`handlePriorTreatmentChange`).

`makePriorProcedure` in `StepPatient.tsx` is updated to accept an explicit `date: string` parameter instead of capturing the outer `today` constant.

## Why not `performedString`

The IG profile constrains `performed[x]` to `dateTime | Period` only. A `performedString` would fail validation against `RotatorCuffProcedure` — the validator would report a type constraint error. Using the `string` variant is therefore not an option without relaxing the profile constraint, which would break the Q11 timepoint calculation logic.

## Files changed

- `frontend/src/components/wizard/stepFormData.ts` — added `priorPhysicalTherapyDate: string` and `priorInjectionDate: string` to `PatientFormData` and `createInitialPatientForm()`
- `frontend/src/components/wizard/StepPatient.tsx` — updated `makePriorProcedure` signature, added `handlePriorTreatmentChange`, added conditional date inputs in JSX

## Consequences

✅ Prior treatment `Procedure` resources now carry the clinically correct `performedDateTime` — the date the treatment actually occurred, not the registration date.

✅ The `performed[x] 1..1` constraint from `procedure-eu-core` is satisfied with real data.

✅ Selecting "No" or clearing "Yes" does not leave a stale date in the form state.

⚠️ The date is user-entered and may be approximate (patient recall). This is expected and acceptable for a registry context — the label reads "Approximate date".

⚠️ If the exact date is unknown (e.g., PT occurred "several months ago"), the user must still enter a date. The `type="date"` HTML input requires a complete `YYYY-MM-DD` value; there is no partial-date entry at this time.
