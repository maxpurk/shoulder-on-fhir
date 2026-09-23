# ADR-0094: Close ShoulderObservationCode enumeration gap for patient satisfaction LOINC

**Date:** 2026-07-24
**Status:** Accepted

## Context

Loading the Anna Müller longitudinal example onto the deployed demo server and validating the live persisted resources against the IG package (FHIR Validator CLI, same engine as the CI gate) surfaced a non-blocking warning on both `PatientSatisfactionObservation` instances (12-month and 24-month follow-up):

> None of the codings provided are in the value set 'Shoulder Observation Code ValueSet' ... (codes = http://loinc.org#77218-6)

`ShoulderObservationCode` (`extensible` binding on `ShoulderObservation.code`, ADR-0027/ADR-0065) is meant to enumerate every external LOINC/SNOMED code fixed by a derived Observation profile, alongside a bulk include of the local `ShoulderObservationCodes` CodeSystem — established explicitly by ADR-0065 as "the IG's intent declaration." ADR-0070 (2026-07-11) migrated `PatientSatisfactionObservation.code` from a local code to LOINC `77218-6`, but never added that code to this enumeration — a gap that predates this session and had gone unnoticed because no prior validation run had exercised the satisfaction profile's live-persisted form against the built IG package.

## Decision

Add `http://loinc.org#77218-6 "Patient satisfaction with healthcare delivery"` to `ShoulderObservationCode` (`ig/input/fsh/valuesets/ShoulderObservationCode.fsh`), in the existing "LOINC — patient history / PROM concepts" enumeration block, with a comment explaining the gap's origin. Version bumped `0.1.5` → `0.1.6`.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave as-is (it's only a non-blocking `extensible`-binding warning) | ADR-0065 already established that this VS's enumeration is a deliberate intent declaration, not just a mechanical binding; a known, cheap-to-close gap left open contradicts that stated purpose |
| Revert to a local code instead of fixing the VS | Would undo ADR-0070's correct LOINC migration; the VS enumeration was the thing out of date, not the profile |

## Consequences

✅ Closes a real, narrow gap; no profile change, no cardinality change, no example-data restructuring — `PatientSatisfactionObservation` instances are unaffected structurally.

✅ No SECEC mapping impact — Q8.e/Q12.g coverage status (`Full`, ADR-0070) is unchanged; this is a VS-completeness fix, not a coverage change.

⚠️ Discovered via a server-side `$everything` + FHIR Validator CLI pass on the deployed demo, not the local `tools/validate.sh` example suite — a reminder that the example/seed corpus doesn't fully exercise every profile's live-persisted shape.

## Sources

- Server-side validation run, 2026-07-24 (the deployment server, FHIR Validator CLI against `ig/output/package.tgz`, `Patient/pat-long-001` `$everything`)
- `ig/input/fsh/valuesets/ShoulderObservationCode.fsh`
- `ig/input/fsh/profiles/observations/PatientSatisfactionObservation.fsh` (ADR-0070)
- ADR-0065 (original enumeration + stated intent), ADR-0070 (satisfaction LOINC migration)
