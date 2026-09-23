# ADR-0205: The registration form emits the canonical patient identifier system

**Date:** 2026-09-18
**Status:** Accepted

## Context

A patient registered through the generic form filler could not be found again by the unified
frontend's patient lookup, which searches `Patient?identifier=<system>|<value>`. The patient was
on the server: the value matched, the system did not.

`ShoulderRegistrationQuestionnaire` declared `Patient.identifier.system` as a `fixed-value` of
`https://maxpurk.github.io/shoulder-on-fhir/sid/registry-patient-id`. That URI appears nowhere else —
not in a profile, not in an example, not in either frontend, not in the mapping. Every other
surface uses `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient`, the system ADR-0025
established as canonical: the unified frontend's `PATIENT_IDENTIFIER_SYSTEM`, the contained
template in `ShoulderRegistrationFullTemplateQuestionnaire`, and the worked examples.

Identifier search is an exact match on system and value together, so the two spellings are two
non-overlapping namespaces on one server. A patient registered through the definition-based form
is invisible to a lookup by identifier, and the Surgery and Follow-Up flows begin with that
lookup, so the longitudinal path is broken at its first step for those patients. `ShoulderPatient`
constrains `identifier.system` to `1..1 MS` without pinning a value, so both spellings validate
and neither `tools/validate.sh` nor the validator sidecar reports anything.

ADR-0161 corrected the same class of defect in the SDC frontend, where the system differed only
by the casing of one letter. This one differs in the whole path and reached the guide itself
rather than a form filler.

## Decision

Change the `fixed-value` on `item[0]` of `ShoulderRegistrationQuestionnaire` to
`https://maxpurk.github.io/shoulder-on-fhir/identifier/patient`. One literal, no other file: the
generic filler holds no identifier system of its own, it writes what the form declares.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Adopt `sid/registry-patient-id` everywhere instead | ADR-0025 settled the canonical system, and it is already in storage on both worked examples, in the examples the guide publishes, and in the frontend that reads it back; the form was the single outlier |
| Pin `Patient.identifier.system` in `ShoulderPatient` so a wrong value fails validation | Considered and left open: the profile is reused for patients whose identifier comes from a hospital's own namespace, and fixing the system would refuse them |
| Make the lookup search by value alone | Drops the namespace that makes an identifier unambiguous, and would match a hospital MRN that happens to collide with a registry number |

## Consequences

✅ A patient registered through either extraction mechanism, or through the unified frontend, lands
in one identifier namespace and is found by the same lookup.
⚠️ Three placeholder patients created on the demo server before this fix carry the old system in
storage; their `identifier.system` was rewritten in place rather than left to split the namespace,
the demo store holding no data worth migrating carefully.
⚠️ Nothing automated would have caught it. A literal pinned in an extraction declaration is checked
against the profile only where the profile pins the same element, and this one does not, so the
form was free to invent a URI. Recorded as limitations item 0036.

## Sources

- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` line 1190 (fixed)
- `frontend/src/types/fhir.ts` line 811, `frontend/src/components/shared/PatientLookup.tsx` line 57
- `ig/input/fsh/instances/ShoulderRegistrationFullTemplateQuestionnaire.fsh` line 165 (reference)
- ADR-0025 — canonical HPI-namespaced patient identifier system
- ADR-0161 — the same defect, one letter wide, in the SDC frontend
