# ADR-0028: ShoulderEncounter profile for routine follow-up (supersedes the scope claim in ADR-0016)

**Date:** 2026-05-11
**Status:** Accepted
**Supersedes (partially):** ADR-0016 — specifically its "Encounter out of scope" decision

> **Update 2026-06-07 (ADR-0066):** `ShoulderEncounter` keeps its name (it is anatomy-region, reusable by sibling shoulder IGs). The `reasonReference` type was relaxed from `Reference(RotatorCuffCondition)` to `Reference(Condition)`; the RC pathology guarantee is now enforced one layer up by the bundle Condition slice (`only RotatorCuffCondition`). The Encounter-as-anchor pattern this ADR introduced is unchanged.

## Context

ADR-0016 (April 2026) scoped the IG to **9 base profiles** and explicitly excluded `Encounter` and `Appointment`, reasoning that visit scheduling and routine follow-up metadata were outside the research-registry use case. This left SECEC Q10 (routine follow-up duration and completion) at **0% coverage** — a documented limitation flagged in ADR-0016 itself as future work.

Re-examining the consensus in May 2026 for the push to 100% addressability (ADR-0027):

- **Q10 reached consensus (84% agreement)** in Hurley et al. (2024). The recommendation was "patients should be followed up for 6 months to 1 year depending on treatment and symptoms."
- A research registry that omits the very encounter at which post-operative data is collected has a structural blind spot: the timepoints captured by `ShoulderResearchCarePlan` (ADR — Q11) describe the _schedule_, not _what actually happened_ at a follow-up visit.
- The cost of profiling a minimal `Encounter` proved low — FHIR `Encounter` is already well-shaped for this purpose; the IG only needs to constrain `subject`, `type`, `period`, and `reasonReference`.

## Decision

Add **`ShoulderEncounter`** profile (`profiles/ShoulderEncounter.fsh`) for routine post-operative follow-up encounters.

| Element | Constraint | Purpose |
|---------|------------|---------|
| `status` | 1..1 MS | `planned` → `arrived` → `in-progress` → `finished` lifecycle |
| `class` | 1..1 MS | Typically outpatient ambulatory |
| `type` | 1..* MS, extensible to `FollowUpEncounterType` | SNOMED `390906007` (Follow-up encounter) |
| `subject` | 1..1, only `Reference(ShoulderPatient)` | Required patient link |
| `period.start` | MS | Scheduled or actual start (Q10.1 — interval) |
| `period.end` | MS | Completion timestamp (Q10.2 — completion) |
| `reasonReference` | MS, only `Reference(RotatorCuffCondition)` | Links visit to the indexed condition |

`FollowUpEncounterType` includes SNOMED `390906007` (Follow-up encounter), `185349003` (Encounter for check up), `308335008` (Patient encounter procedure).

`ShoulderEncounter` is **not** added to `ShoulderRegistrationBundle.entry` slicing — the bundle remains the index-surgery submission. Follow-up Encounter resources are written as separate FHIR transactions over the course of registry-driven follow-up.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep ADR-0016's scope and leave Q10 at 0% | Q10 reached consensus; leaving it uncovered when the cost is low contradicts the May 2026 goal of complete SECEC addressability (ADR-0027) |
| Profile `Appointment` instead of `Encounter` | `Appointment` represents a _scheduled_ visit; `Encounter` represents an _actual_ visit. Both Q10.1 (scheduled) and Q10.2 (completed) collapse into `Encounter.status` + `period.start/end` cleanly. `Appointment` would still need an `Encounter` for completion. |
| Add a `FollowUpVisitObservation` profile under `ShoulderObservation` | Misuses Observation; loses lifecycle semantics; encounters are not observations |
| Extend `ShoulderResearchCarePlan` to record realised visits | `CarePlan` models a plan, not its execution. The CarePlan + Encounter pair is the standard FHIR composition. |
| Add the new Encounter to `ShoulderRegistrationBundle.entry` slicing | The bundle is defined as one-patient-one-submission for the index surgery; follow-up Encounters arrive later, asynchronously |

## Consequences

✅ SECEC Q10.1 + Q10.2 now Full — closes the only structural blind spot from ADR-0016  
✅ Reuses standard FHIR `Encounter` lifecycle; HAPI validation is well-tested for this resource  
✅ Composition `ShoulderResearchCarePlan` (the schedule) + `ShoulderEncounter` (each realised visit) is the natural FHIR pattern for a research registry  
✅ Reason linkage to `RotatorCuffCondition` preserves the registry's case-centric structure  
⚠️ The IG's base profile count rises from 10 to 12 (counting `ShoulderEncounter` + `ShoulderServiceRequest` from ADR-0029); ADR-0016 scope claim of "9 base profiles" is retired  
⚠️ Routine follow-up Encounters are submitted as separate transactions — operators authoring registry tooling must accept this lifecycle complexity

## Sources

- `ig/input/fsh/profiles/ShoulderEncounter.fsh`
- `ig/input/fsh/valuesets/FollowUpEncounterType.fsh`
- ADR-0016 — "SECEC scope; Encounter out of scope" — superseded for Q10 by this ADR
- ADR-0027 — "Complete SECEC element coverage via standard terminologies" — context for the May 2026 push to 100% addressability
- Hurley et al. (2024), SECEC consensus paper, Q10: "Patients should be followed up for 6 months to 1 year"
