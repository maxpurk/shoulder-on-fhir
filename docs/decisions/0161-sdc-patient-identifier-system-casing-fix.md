# ADR-0161: Fix SDC frontend's patient identifier system casing

**Date:** 2026-08-07
**Status:** Accepted

## Context

A live cross-frontend comparison (fetching a freshly created patient from each frontend via
`Patient/$everything` on the deployed demo server and diffing their FHIR shapes) found that the
two frontends emit different `Patient.identifier.system` URIs for what is meant to be the same
canonical identifier namespace:

- Unified frontend (`frontend/src/components/wizard/StepPatient.tsx`, `PatientForm.tsx`,
  `types/fhir.ts`): `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient`
- SDC frontend (`sdc-frontend/src/lib/bundleAssembler.ts`,
  `ensurePatientIdentifier()`): `https://maxpurk.github.io/shoulder-on-fhir/Identifier/patient`
  (capital `I`)
- IG FSH examples (`ig/input/fsh/examples/ShoulderPatient.fsh`,
  `RotatorCuffRegistrationBundle.fsh`): lowercase, matching the unified frontend

ADR-0025 established this identifier system URI in the first place and settled on the lowercase
form (`https://maxpurk.github.io/shoulder-on-fhir/identifier/patient`) precisely because
identifier-based lookups (`Patient?identifier=<system>|<value>`) require an exact string match
between the system stored on the resource and the system used in the query — a casing drift is
not cosmetic, it silently splits patients created by the two frontends into two non-overlapping
identifier namespaces on the same HAPI instance. No FHIR profile constrains `Identifier.system`
casing (it's a plain URI), so nothing in `tools/validate.sh` or the `validator-service` sidecar
catches this; it was only found by direct data comparison.

## Decision

Correct the single hardcoded string in `sdc-frontend/src/lib/bundleAssembler.ts`'s
`ensurePatientIdentifier()` from `.../Identifier/patient` to `.../identifier/patient`, matching
ADR-0025's canonical URI, the unified frontend, and the IG's own FSH examples. No other file in
either frontend or the IG carried the capital-I variant (confirmed via repo-wide grep).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Repoint the unified frontend + IG examples to the capital-`I` form instead | ADR-0025 already settled on lowercase as canonical; the unified frontend and IG examples were correct, SDC was the outlier |
| Leave both forms in use, treat as case-insensitive downstream | `Identifier.system` is a URI; FHIR identifier search (`Patient?identifier=`) is exact-match, not case-insensitive — this would permanently split the identifier space across frontends |

## Consequences

✅ Both frontends now emit patients under the same identifier system URI — `Patient?identifier=`
searches and any future cross-frontend deduplication/lookup logic will see both frontends'
patients as one namespace.
⚠️ Patients already created by the SDC frontend before this fix (on the live deployed demo
instance) still carry the capital-`I` system in storage; no backfill migration is performed — the
demo database is disposable dev/demo data, not a production dataset requiring correction.

## Sources

- `sdc-frontend/src/lib/bundleAssembler.ts` line 82 (fixed)
- `frontend/src/components/wizard/StepPatient.tsx` line 83 (reference)
- `ig/input/fsh/examples/ShoulderPatient.fsh` line 18 (reference)
- ADR-0025 — canonical HPI-namespaced patient identifier system
- Live comparison: `Patient/$everything` for two patients created 2026-08-06 on the deployed demo
  server, one per frontend
