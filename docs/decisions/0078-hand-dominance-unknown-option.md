# ADR-0078: Add an explicit "Unknown" answer to `HandDominance`

**Date:** 2026-07-13
**Status:** Accepted

## Context

A shoulder surgeon reviewing the live frontend noted hand dominance has no way to record "we don't know" — `HandDominance` offered only right-handed, left-handed, and ambidextrous. The frontend's blank/default dropdown selection already means "not asked yet" (no `HandDominanceObservation` is emitted for an empty `formData.handDominance`, per `StepPatient.tsx`), but there was no way to positively record that the question *was* asked and the answer is unknown — a real and clinically distinct state from simply never asking.

## Decision

Add `http://snomed.info/sct#261665006` ("Unknown", a generic SNOMED qualifier-value concept) as a fourth concept in `HandDominance`. Chosen over `54690008` ("Unknown (origin)", already used elsewhere in this IG for etiology) because that concept specifically means unknown *causation* — semantically wrong for an unknown demographic fact. `261665006` is the general-purpose "unknown" SNOMED concept, appropriate here.

No frontend code change was needed: `StepPatient.tsx`'s hand-dominance `<select>` already renders its options dynamically from `useValueSet(VALUESET_URLS.HAND_DOMINANCE)`, so the new option appears automatically. Selecting "Unknown" sets `formData.handDominance` to a truthy code, which the existing `if (formData.handDominance)` guard treats like any other answer — a `HandDominanceObservation` is emitted with `valueCodeableConcept` = Unknown, correctly distinguished from the observation being omitted entirely.

## Consequences

✅ A clinician can now positively record "asked, patient doesn't know" rather than the field looking identical to "never asked."

✅ Zero frontend code changes — the dynamic-options pattern already in place absorbed the change.

This is a Q1.m refinement (Hurley names "hand dominance" without fixing its value set); no Hurley denominator or mapping-status change.

## Sources

- `ig/input/fsh/valuesets/HandDominance.fsh`
- `frontend/src/components/wizard/StepPatient.tsx`
- Clinical review by the reviewing shoulder surgeon (2026-07-13)
