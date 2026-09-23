# ADR-0030: ShoulderFollowUpBundle profile for per-visit incremental registry submissions

**Date:** 2026-05-11
**Status:** Accepted — clarified by ADR-0034 (2026-05-13); profile renamed by ADR-0066 (2026-06-07)

> **Rename update (2026-06-07, ADR-0066):** This profile was renamed `ShoulderFollowUpBundle` → `RotatorCuffFollowUpBundle` (kebab id `shoulder-follow-up-bundle` → `rotator-cuff-follow-up-bundle`). The per-visit bundle architecture and Q11 timepoint design below are unchanged; only the profile name moved.

> **Clarification (2026-05-13, ADR-0034):** The "7 submissions per patient" cadence described below is now realised by **three** distinct named bundle profiles instead of two-and-a-gap: T0 → `ShoulderRegistrationBundle` (pre-op), T1 → `ShoulderSurgeryBundle` (new), and 5 × `ShoulderFollowUpBundle` (this profile, unchanged). The bundle profile structure defined in this ADR is preserved as-is; only the surrounding workflow narrative is now backed by a complete set of artifacts. See ADR-0034.
**Builds on:** ADR-0017 (`ShoulderRegistrationBundle` for the index submission), ADR-0028 (`ShoulderEncounter` for follow-up visits)

## Context

The process diagram in the process_diagram.drawio architecture diagram documents that a single registry case is the sum of **up to 7 FHIR submissions** spread over 24 months: an index `ShoulderRegistrationBundle` at T0 (pre-op), a surgery update at T1, and a per-visit increment at 6 weeks / 3 months / 6 months / 12 months / 24 months (SECEC Q11 research follow-up schedule, Hurley et al. 2024).

ADR-0028 introduced `ShoulderEncounter` but stated the follow-up resources "are written as separate FHIR transactions over the course of registry-driven follow-up" without defining a named bundle profile to wrap each visit. In practice that left two gaps:

1. **No atomic validation per visit.** A follow-up visit produces 1 Encounter + N Observations + 0..1 QuestionnaireResponse. Without a named bundle profile, each resource is validated individually; nothing enforces "every follow-up submission must contain at least one Encounter and at least one Observation, all linked via `Observation.encounter`." Half-submitted visits could pass per-resource validation.
2. **No reference architecture for client tooling.** *(Historical note — superseded by ADR-0035 and ADR-0040.)* At the time of authoring, three frontends (`frontend/`, `sdc-frontend/`, `lhcforms-frontend/`) all targeted `ShoulderRegistrationBundle`. A fourth demonstration frontend at port 3003 (`followup-frontend/`) was added in May 2026 to demonstrate the longitudinal paradigm; it needed a profile it could `$validate` against, in the same way the Wizard validates against `ShoulderRegistrationBundle`. Subsequent restructures merged the follow-up app into the unified frontend at port 3000 (ADR-0035) and replaced the LHC-Forms frontend with an SDC-conformant per-bundle Questionnaire set (ADR-0040 + ADR-0041).

The open question (c) flagged at the bottom of `process_diagram.drawio` — "wrap each follow-up increment in its own bundle profile, or post resources individually?" — is what this ADR resolves.

## Decision

Add **`ShoulderFollowUpBundle`** profile (`ig/input/fsh/profiles/ShoulderFollowUpBundle.fsh`) as the named transaction bundle for a single follow-up visit submission. It is the sibling of `ShoulderRegistrationBundle` and follows the same IPS-style two-discriminator slicing (resource type + profile).

| Slice | Cardinality | Resource constraint | Purpose |
|-------|-------------|---------------------|---------|
| `encounter` | 1..1 | `ShoulderEncounter` | The realised visit (Q10.1 / Q10.2) |
| `observation` | 1..* | `ShoulderObservation` | Q9 post-op exam + Q12 PROMs |
| `questionnaireResponse` | 0..1 | `ShoulderQuestionnaireResponse` | Optional PROM form payload |
| `imagingStudy` | 0..1 | `ShoulderImagingStudy` | Only at research re-imaging timepoints (Q13 exception) |

The profile **deliberately excludes** `Patient`, `RotatorCuffCondition`, and `ShoulderProcedure`. These are established by the prior `ShoulderRegistrationBundle` and are referenced via persisted IDs:
- `Encounter.subject` → `Patient/{id}`
- `Encounter.reasonReference` → `Condition/{id}`
- `Observation.subject` → `Patient/{id}`
- `Observation.encounter` → urn:uuid of this bundle's encounter entry (resolved server-side during transaction processing)

A concrete example (`examples/ShoulderFollowUpBundle.fsh`, `ExampleFollowUpBundle6Weeks`) demonstrates a 6-week post-op submission with 6 Observations (Q9 + Q12) for the existing `ExamplePatientComplete` case.

The `followup-frontend/` (port 3003) calls `Bundle/$validate?profile=shoulder-follow-up-bundle` before persistence, in the same `$validate → render OperationOutcome → submitBundle` pattern as `RegistrationWizard.tsx` (frontend/, lines 58–87).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Post each Encounter / Observation as an individual REST `POST` | Loses transaction atomicity (HAPI commits or rolls back the whole bundle); also loses urn:uuid cross-references for `Observation.encounter` → the new Encounter must already be persisted before any Observation can reference it; multi-round-trip submissions cannot guarantee a coherent per-visit dataset |
| Reuse `ShoulderRegistrationBundle` for follow-up visits | The registration bundle requires `Patient 1..1`, `Condition 1..1`, `Procedure 1..*` — none of which should be re-posted at follow-up. Forcing the client to include them would mean either re-creating duplicates or fetching-then-resending the originals, both wasteful. The two use cases are genuinely distinct. |
| Use the FHIR base `Bundle` profile without a named subtype | No machine-readable enforcement that the bundle is a follow-up visit. The frontend would still need profile-aware validation logic somewhere; making it a named IG artifact moves that logic into the IG, which is the right place for an interoperability contract. |
| Use a generic FHIR `MessageHeader`/messaging pattern | Adds an envelope layer (`MessageHeader` resource + event code) without a clear benefit at registry scale; the transaction bundle is sufficient and is already the project's chosen primitive |
| Add `Encounter` and per-visit Observation slices to `ShoulderRegistrationBundle` | Breaks ADR-0017's "one-patient-one-submission for the index surgery" framing; would also require either making those slices optional (defeating per-visit enforcement) or distinguishing index vs. follow-up bundles by some other discriminator |

## Consequences

✅ Atomic per-visit validation — HAPI rejects an incomplete follow-up submission as a unit, not piecemeal  
✅ `Observation.encounter` urn:uuid cross-references work because all resources are in one transaction  
✅ The thesis story closes the open question (c) from `process_diagram.drawio` and gives the 4th demonstration frontend a concrete validation target  
✅ Reuses every existing artifact — `ShoulderEncounter`, `ShoulderObservation`, `ShoulderQuestionnaireResponse`, `ShoulderImagingStudy` — without adding new profiles for the resources themselves  
✅ The IG's base profile count rises from 12 to 13 (adding `ShoulderFollowUpBundle`); the new total is **13 base profiles + 34 derived Observation profiles**  
⚠️ Client tooling now has two bundle profiles to choose between (`ShoulderRegistrationBundle` for index, `ShoulderFollowUpBundle` for each visit) — adds a small selection step to the submission code path; mitigated by parameterising `fhirClient.validateBundle(entries, bundleProfile)` on the new frontend  
⚠️ The `imagingStudy 0..1` slice is included for the research re-MRI exception (Q13); if no re-imaging is performed (the common case) it remains absent — no impact, but documented explicitly so the profile is self-explanatory

## Sources

- `ig/input/fsh/profiles/ShoulderFollowUpBundle.fsh` — the new profile
- `ig/input/fsh/examples/ShoulderFollowUpBundle.fsh` — `ExampleFollowUpBundle6Weeks` instance demonstrating the 6-week submission
- `followup-frontend/` — 4th demonstration frontend (port 3003) consuming this profile
- the process_diagram.drawio architecture diagram — open question (c) which this ADR closes
- ADR-0017 — `ShoulderRegistrationBundle` (sibling for index submissions)
- ADR-0028 — `ShoulderEncounter` (the resource this bundle wraps)
- Hurley et al. (2024) — SECEC consensus Q10 / Q11 / Q12 / Q13 for the follow-up schedule and contents
