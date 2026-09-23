# ADR-0132: Fix Cofield Observation missing `display` and enumerate Pack-Years in `ShoulderObservationCode`

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, items #10 and #11 — a cross-frontend content-parity audit (SDC vs unified) that built one identical complete patient through each frontend and diffed the resulting `$everything` output plus the FHIR Validator CLI run.

## Context

Two small, unrelated defects surfaced in the same audit pass and are grouped into one ADR because both are one-line, non-architectural fixes with no design freedom involved (Clinical Feedback Integration Workflow classification: neither touches an expert-consensus element's modeling — the first is a display-text omission, the second is a terminology-enumeration completeness gap).

**#10 — missing `display` on intra-op Cofield coding.** `SurgeryWizard.tsx`'s `buildIntraOpObservations` built the intra-operative Tear Size Classification (Cofield) `Observation.valueCodeableConcept.coding` with only `system`/`code`, unlike every sibling coded Observation in the same file (and unlike the Registration-time Cofield Observation built in `StepImaging.tsx`, which already resolves `display` from the live `$expand`ed `cofieldOptions`). The Surgery Review page derives its label text from `coding[0].display`, so it silently rendered "Tear Size Classification (Cofield): —" even though `code: 'medium'` was correctly persisted — a display-layer bug, not data loss.

**#11 — Pack-Years SNOMED code not enumerated.** `SmokingPackYearsObservation` fixes `Observation.code` to SNOMED `782516008`, but `ShoulderObservationCode.fsh` — the IG's own "intent declaration" enumeration ValueSet (ADR-0065's pattern: every external LOINC/SNOMED code fixed by a derived profile gets listed alongside the bulk `ShoulderObservationCodes` include) — was never updated when that profile was added. FHIR Validator CLI flagged this as a non-blocking extensible-binding warning (`782516008` not a member of `ShoulderObservationCode`) on every unified-frontend submission that includes a Pack-Years value.

## Decision

1. **`frontend/src/components/SurgeryWizard.tsx`**: `buildIntraOpObservations` now takes a `cofieldOptions: TermOption[]` parameter (the same `useValueSet(VALUESET_URLS.COFIELD_TEAR_SIZE_CLASSIFICATION)` result already used elsewhere in the component for the procedure/approach/extent/fixation option lists) and resolves `display: cofieldOptions.find((o) => o.code === form.tearSizeClassification)?.display` on the coding, matching the pattern in `StepImaging.tsx`. `cofieldOptions` was added to the `entries` `useMemo`'s dependency array — this codebase has hit the stale-deps class of bug before (Constant-Murley composite score silently dropping), so every value read inside that memo must be a listed dependency.
2. **`ig/input/fsh/valuesets/ShoulderObservationCode.fsh`**: added `http://snomed.info/sct#782516008 "Number of calculated smoking pack years"` to the enumerated SNOMED CT concepts, version bumped `0.1.8` → `0.1.9`, date `2026-08-03`, per the file's existing bump-on-every-edit convention.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| #10: hardcode the Cofield display strings as a local lookup object in `SurgeryWizard.tsx` instead of threading `cofieldOptions` through | `StepImaging.tsx` already resolves the identical display from the live VS `$expand` — duplicating it as a hardcoded table would drift the moment the ValueSet's `display` text changes, and the component already had every other option list (`procedureOptions`, `approachOptions`, etc.) wired the same way. |
| #11: leave the warning as accepted tolerance (ADR-0065 already tolerates *some* enumeration gaps as non-blocking) | Rejected — ADR-0065's whole point is that this VS should be an accurate declaration of intent; a one-line fix removing a known-missing entry is strictly better than accruing enumeration debt for no reason. |

## Consequences

✅ Surgery Review page now shows the correct Cofield label instead of `—` for intra-operative tear size classification.
✅ Pack-Years submissions from the unified frontend no longer trigger the extensible-binding warning; `ShoulderObservationCode` is one code closer to accurately declaring every code the IG's profiles fix.
✅ No mapping status change — both are display/enumeration fixes, not modeling changes.

## Sources

- the cross-frontend parity audit, items #10, #11.
- ADR-0065 — origin of the `ShoulderObservationCode` enumerated-hybrid pattern this ADR extends.
- `frontend/src/components/wizard/StepImaging.tsx` — the existing sibling pattern `buildIntraOpObservations` now matches.
- `ig/input/fsh/profiles/observations/SmokingPackYearsObservation.fsh` — fixes `782516008`, the code this ADR enumerates.
