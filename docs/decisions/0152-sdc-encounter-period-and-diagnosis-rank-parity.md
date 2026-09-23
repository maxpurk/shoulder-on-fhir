# ADR-0152: SDC parity — incision/closure Period, Registration Encounter.period, Encounter.diagnosis.rank

**Date:** 2026-08-04
**Status:** Accepted

## Context

the field-level cross-frontend comparison (2026-08-04), cross-checked directly against current source (not just ADR
history, since the audit that fed it had already been shown to miss a few things), found three
genuine, still-open SDC-vs-unified asymmetries — each previously logged as an accepted deferral
under the "SDC parity is a separate call" precedent that ADR-0144 retired the same day:

1. **Surgical procedure timing.** `RotatorCuffProcedure.performed[x]`: the unified frontend
   captures one incision/closure time pair per surgical event and composes both
   `Encounter.period` and every `Procedure.performedPeriod` from it (ADR-0110/ADR-0121). SDC's
   `ShoulderSurgeryQuestionnaire` still asked a single `procedure.date` per procedure repetition
   and a separate `encounter.startDate`/`encounter.endDate` admission window — never brought in
   line with ADR-0121, explicitly flagged as open by that ADR's own Consequences section.
2. **Registration `Encounter.period`.** The unified frontend's `RegistrationWizard.tsx` sets it
   to submission time (`new Date()`). SDC's Registration `Encounter` literal
   (`bundleAssembler.ts`) had no `period` field at all — not a documented deferral, just an
   omission never previously caught.
3. **`Encounter.diagnosis.rank`.** The unified frontend ranks the principal diagnosis (rank 1)
   against any `otherDiagnosis` entries (rank 2+) when more than one diagnosis is submitted
   (`L3.F.5`, ADR-0077). SDC only gained multi-diagnosis support the same day, via ADR-0145 (a
   different, concurrent session's work) — that port added the `otherDiagnosis` repeatable group
   but not the ranking that becomes meaningful once it exists.

A fourth candidate — `RotatorCuffProcedure.reasonReference` pointing a concomitant procedure at a
non-index `ShoulderDiagnosisCondition` — was **investigated and dropped**: `ADR-0127`'s own
Consequences section states the unified frontend never built UI for this either ("the unified
frontend's Surgery wizard... has no per-procedure diagnosis picker... Logged as a
`docs/limitations_items/` follow-up, not fixed here"). It is a shared gap in both frontends, already
tracked, not an SDC-specific asymmetry — the field-level cross-frontend comparison's original "Unified: Yes" finding
for this row was itself an overclaim, corrected alongside this ADR.

## Decision

**(a) Incision/closure Period.** `ShoulderSurgeryQuestionnaire.fsh`'s `encounter.startDate`/
`encounter.endDate` items relabeled "Incision Time"/"Closure Time" (both now `required`) —
`Encounter.period` is composed from them exactly as the unified frontend does, not a separate
admission window. The per-procedure `procedure.date` item is **removed**; every `Procedure` in
the event now shares the one incision/closure pair via `performedPeriod`, applied in
`bundleAssembler.ts`'s Surgery-procedure loop (mirrors `SurgeryWizard.tsx`'s
`buildProcedureResource` exactly). The Q11 schedule anchor (`indexProcedureDate`) now reads
`encounter.period?.start` instead of a per-procedure `performedDateTime` that no longer exists.

**(b) Registration `Encounter.period`.** The Registration `Encounter` literal in
`bundleAssembler.ts` gains `period: { start: new Date().toISOString() }`.

**(c) `Encounter.diagnosis.rank`.** When `extracted.otherDiagnoses.length > 0`,
`assembleRegistrationBundle` now builds `Encounter.diagnosis[]`: the main `Condition` at rank 1
(`diagnosis-role` `CC` "Chief complaint"), each `otherDiagnosis` at rank 2+ (`diagnosis-role`
`CM` "comorbidity diagnosis") — identical structure and codes to
`RegistrationWizard.tsx`'s existing logic, including the "only populated when >1 diagnosis"
guard (with exactly one, rank is unambiguous and `reasonReference` alone already identifies it).

All three implemented together in the same pass per ADR-0144 (mandatory parity, not
unified-first-then-maybe-SDC) — though in this case the unified frontend already had all three;
this ADR is purely an SDC-side port.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep per-procedure `procedure.date` alongside the new event-level incision/closure pair | Reintroduces exactly the redundancy ADR-0121 eliminated on the unified side — two overlapping ways to express when a procedure happened. |
| Also build the missing per-procedure diagnosis picker (closing the `reasonReference` gap too) | Out of scope for a parity port — that gap exists in *both* frontends equally (per ADR-0127), so "porting SDC to match unified" doesn't apply; building it fresh in both would be new UI work, not ported from an existing pattern, and wasn't part of the go/no-go scope agreed for this pass. |
| Derive Registration `Encounter.period` from something else (e.g. `Condition.recordedDate`) | The unified frontend uses plain submission-time `now()`; matching that exactly is the actual parity target, not inventing a different derivation. |

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement** for all three — each element is already named/modeled in the IG (`L3.C.1`
performedPeriod, `L3.C.2` Encounter.period, `L3.F.5` diagnosis.rank, all Layer 2/`Full`); this
closes an implementation gap in one frontend against an already-established pattern in the
other, not a new data-collection burden or a new IG element.

## Consequences

✅ SDC's Surgery timing model now matches the unified frontend's ADR-0121 shape exactly — one
incision/closure pair per event, shared across index + concomitant procedures.
✅ SDC's Registration `Encounter` now always has a `period`, closing a plain omission.
✅ SDC can now express principal-vs-secondary diagnosis ranking, matching what its own
same-day `otherDiagnosis` support (ADR-0145) made meaningful for the first time.
✅ `sushi .` compiles clean (0 errors/warnings, `ShoulderSurgeryQuestionnaire` version `0.4.0` →
`0.5.0`); `sdc-frontend` `npm run build`/`npm run lint` both clean.
⚠️ `RotatorCuffProcedure.reasonReference`-to-`otherDiagnosis` remains open in **both** frontends
(confirmed, not fixed here) — the field-level cross-frontend comparison corrected to reflect this as a shared gap,
not an SDC-specific one.

## Sources

- the field-level cross-frontend comparison (2026-08-04) — the field-level audit that surfaced these gaps and the
  `reasonReference` false-positive.
- ADR-0110, ADR-0121 (incision/closure Period model this ports), ADR-0077/ADR-0145
  (`otherDiagnosis` + ranking this makes meaningful), ADR-0127 (the `reasonReference` gap
  confirmed shared, not SDC-specific), ADR-0144 (mandatory both-frontends parity).
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`.
- `sdc-frontend/src/lib/extractor.ts`, `bundleAssembler.ts`, `types/fhir.ts`.
- `frontend/src/components/RegistrationWizard.tsx`, `SurgeryWizard.tsx` — the unified-frontend
  reference behavior this ports.
