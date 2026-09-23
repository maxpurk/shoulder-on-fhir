# ADR-0147: "Not applicable" marker for the SDC Follow-Up exam

**Date:** 2026-08-03
**Status:** Accepted

## Context

ADR-0109 added a per-field "N/A" checkbox to the unified frontend's Follow-Up post-op exam (ROM active/passive, strength, provocation groups) — a clinician can mark a measurement as contraindicated/not-possible this soon after surgery, which the frontend submits as an `Observation` with `dataAbsentReason = #not-performed` and no `value[x]` (counts toward `RotatorCuffFollowUpBundle`'s `observation 1..*` minimum, unlike simply omitting the field). The SDC Follow-Up Questionnaire has no equivalent mechanism at all — a field is either answered or silently absent, with no way to distinguish "not measured" from "clinician judged this genuinely not applicable and wants that recorded."

This is a materially different capability, not merely a missing checkbox: `QuestionnaireResponse.item.answer` has no "present but no value" shape (every `answer[]` entry is a typed union requiring a concrete value), so recording "assessed, not performed" requires a different signal than a normal answer.

## Decision

Use the FHIR-standard `http://hl7.org/fhir/StructureDefinition/data-absent-reason` extension (verified against the locally-cached `hl7.fhir.uv.extensions.r4` package: `Extension.value[x]` is type `code`, applicable to any `Element` — confirmed, not guessed) placed directly on the `QuestionnaireResponse.item` itself (not on `answer`, which doesn't exist for a not-performed item). A checked N/A checkbox submits `{ linkId, extension: [{ url: data-absent-reason, valueCode: 'not-performed' }] }` with no `answer` array.

Frontend eligibility (`sdc-frontend/src/components/QuestionnaireForm.tsx`) is a hardcoded `Set` of 20 linkIds — the same ROM-active/ROM-passive/strength/provocation scope ADR-0109's `NOT_DONE_GROUPS` uses on the unified side — rather than a new Questionnaire-level marker extension. This is a UI-only policy list (which fields get a checkbox), not clinical data, matching the existing precedent of small hardcoded exceptions already in this codebase (`extractor.ts`'s Coverage/RSG/Comorbidities "loose leaf" handling) rather than inventing new FHIR machinery for a decision that never leaves the frontend.

`extractor.ts`'s `buildObservationsForPerLeafGroup` now checks, for every leaf with zero answers, whether the QR item carries the not-performed extension; if so it builds an `Observation` via a new `buildNotDoneObservation` helper (status `final`, `dataAbsentReason` CodeableConcept, explanatory `note`) — the identical FHIR shape the unified frontend's own `buildNotDoneObservation` (`observationBuilder.ts`) already produces, verified field-for-field against a live example.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| A parallel boolean sibling Questionnaire item per eligible field (20 new items) | Pollutes the item tree and QR payload with 20 items whose only job is a UI toggle; the standard extension-on-item mechanism does the same job with zero new Questionnaire items |
| A custom local extension for "N/A-eligible" marked in FSH on each leaf, read generically by the frontend | Real design-space benefit (self-documenting in the Questionnaire) is outweighed by the extra ceremony for what is, in every other analogous case in this codebase, a hardcoded UI list — see Coverage/RSG/Comorbidities precedent in `extractor.ts`'s own module comment |
| `Observation.status = 'not-done'` | Does not exist for Observation in FHIR R4 (confirmed against the local `hl7.fhir.r4.core` package — that status code exists only for Procedure) — same finding ADR-0109 already made for the unified frontend; reused here rather than re-verified from scratch |

## Consequences

✅ SDC Follow-Up now has full N/A parity with the unified frontend for the 20 eligible fields — both frontends produce byte-for-byte identical `Observation.dataAbsentReason` shapes for the same clinical scenario.
✅ Standard FHIR extension used correctly, verified against the actual cached package rather than assumed — no guessed terminology or extension shape.
⚠️ The 20-linkId eligibility list in `QuestionnaireForm.tsx` and the `NOT_DONE_GROUPS` list in the unified frontend's `ObservationField.tsx` are two independently-maintained lists expressing the same policy — if a future field's N/A-eligibility changes on one side, the other needs updating too; not derived from a shared source.

## Sources

- ADR-0109 (original unified-frontend N/A mechanism, `Observation.dataAbsentReason` shape)
- The locally cached `hl7.fhir.uv.extensions.r4#5.3.0` package (`StructureDefinition-data-absent-reason.json`) — verified `Extension.value[x]` type `code`, context `Element` (the same package version `seed/load-uv-extensions.sh` already loads into HAPI)
- `frontend/src/lib/observationBuilder.ts`'s `buildNotDoneObservation` (shape mirrored exactly)
- `frontend/src/components/followup/ObservationField.tsx`'s `NOT_DONE_GROUPS` (eligibility scope mirrored exactly)
