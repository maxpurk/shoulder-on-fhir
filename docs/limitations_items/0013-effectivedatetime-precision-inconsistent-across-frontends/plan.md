# The two frontends disagree on `Observation.effectiveDateTime` precision (date vs instant)

> **Status:** Limitation — open, SDC/unified parity + data-quality gap. Logged 2026-08-12, found
> via a live `Patient/$everything` comparison of two patients created 2026-08-12, one per frontend.

## Gap

The same logical measurement is timestamped at **different precision** depending on the frontend,
and the unified frontend is additionally inconsistent across its own flows:

- **Unified** — split three ways, not two. Registration is itself inconsistent: hand dominance and
  social history emit a **full instant** (`StepPatient.tsx:137,152,176`), while condition, clinical
  assessment, imaging and outcome scores emit a **date** (`StepCondition.tsx:61`,
  `StepClinicalAssessment.tsx:83`, `StepImaging.tsx:47`, `StepOutcomeScores.tsx:284`). Surgery is
  **date-only** (`SurgeryWizard.tsx:192`, `:248`). Follow-Up is a **full instant**
  (`followup/TimepointPicker.tsx:14`).
- **SDC** — a **full instant** on every Observation in every flow
  (`sdc-frontend/src/lib/extractor.ts:379`), with no Questionnaire item overriding it.

> Re-verified against source 2026-09-09. The earlier reading that "Surgery and Follow-Up use a full
> instant" no longer holds: Surgery emits a date. The live counts below (47/43 and 5/83) are from the
> 2026-08-12 run and have not been reproduced since; treat them as indicative only.

Directly comparable example: the Registration Constant-Murley Observation was
`effectiveDateTime: "2026-08-12"` (unified) vs `"2026-08-12T20:01:18.602Z"` (SDC).

## Why it matters

`effectiveDateTime` is the temporal anchor for pre/post outcome comparison and for ordering a
patient's longitudinal record. Mixed precision within one registry weakens time-range queries and
sorting (a bare date sorts ambiguously against an instant on the same day), and the cross-frontend
divergence means two records of the same event are not byte-equivalent — the parity target for the
two demonstrator paradigms. Both are effectively using "submission time", so they should at least encode it at the same
precision. Which time is recorded, as opposed to how precisely, is `limitations_items/0035`:
the surgery and follow-up forms do capture a visit time and spend it elsewhere in the same
bundle. This is a data-shape asymmetry, not a mapping/consensus issue (the affected elements are
already `Full`).

## Note

Pick one precision convention and apply it in both builders: unified's
`frontend/src/lib/observationBuilder.ts` (Registration path currently emits a date) and SDC's
`sdc-frontend/src/lib/extractor.ts` / `bundleAssembler.ts` (emits `new Date().toISOString()`). A
full instant is the safer default (unambiguous ordering); if a date is preferred for
submission-time anchors, apply it uniformly across all three flows on both frontends. Not
implemented here — flagged per this session's request rather than fixed inline.

## Update, 2026-09-18: the declarative forms now take the visit time

The three definition-based Questionnaires no longer stamp an extracted observation with entry time.
The effective time is read from the visit-date answer a form asks for, and falls back to entry time
where a form asks for none.

Precision is unchanged by that. Both visit-date questions are `dateTime`, so the value carries the
same precision the entry timestamp did. What changed is where the value comes from, which is the
subject of `limitations_items/0035` and not of this item.

This item therefore still stands as written: the disagreement here is about precision, date against
instant, and it remains open.
