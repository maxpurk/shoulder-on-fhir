# ADR-0073: Observation-to-Condition Linkage — Three-Bucket Pattern

**Date:** 2026-07-12
**Status:** Accepted

## Context

Every clinical `ShoulderObservation` in this IG records a finding from a specific patient visit. The question is how those observations are linked to the `RotatorCuffCondition` that motivates the visit — and which FHIR mechanism is semantically correct for each observation type.

FHIR R4 offers three structurally distinct candidate linkage mechanisms:

1. **`Observation.encounter → ShoulderEncounter.reasonReference`** — indirect two-hop chain linking any observation to the condition via the encounter. The chain exists in every conformant bundle: `Observation.encounter` is 1..1 MS on `ShoulderObservation`; `ShoulderEncounter.reasonReference` is 1..1 MS pointing to the Condition (ADR-0037).
2. **`Condition.stage.assessment`** — a backward reference from the Condition to Observations that constitute a **formal staging or grading** of the condition's severity or extent. FHIR R4: *"Clinical stage or grade of a condition. May include formal severity assessments."*
3. **`Condition.evidence.detail`** — a backward reference from the Condition to Observations or reports that constitute **diagnostic evidence** supporting or confirming the diagnosis. FHIR R4: *"Supporting evidence / manifestations that are the basis on which this condition is suspected or confirmed."*

The critical distinction between buckets 2 and 3 is temporal and semantic:
- `evidence.detail` references findings that justify saying the condition *exists* — they come before or simultaneously with diagnosis confirmation.
- `stage.assessment` references formal assessments applied *after* the diagnosis is confirmed, to characterize how severe or extensive it is.

## Decision

Apply a **three-bucket linkage policy**:

**Bucket 1 — Encounter chain (all `ShoulderObservation` instances):**
All observations link to the Condition indirectly via `Observation.encounter → ShoulderEncounter.reasonReference → RotatorCuffCondition`. This is the ambient context anchor — the standard FHIR pattern for encounter-contextualised assessments (ROM, PROMs, patient history, strength, provocation tests). No direct Observation→Condition element is added at the observation level.

**Bucket 2 — `Condition.stage.assessment` (formal staging/grading observations):**
Observations that constitute a formal severity grading of the confirmed condition are additionally referenced via `Condition.stage[0].assessment[]`. This applies to:
- **`PatteObservation`** — tendon retraction severity (Stage 0–3); a formal staging system predicting surgical reparability
- **`GoutallierObservation`** — fatty infiltration grading of the rotator cuff muscle (Grades 0–4); a formal prognostic severity classification applied after diagnosis is confirmed
- **`TearSizeClassificationObservation`** (Cofield) — categorical tear-size bucket (small/medium/large/massive); classifies severity for surgical planning

These observations characterize *how bad* the confirmed condition is. They are not diagnostic evidence — they presuppose that a tear exists and grade its extent.

**Bucket 3 — `Condition.evidence.detail` (diagnostic evidence observations):**
Observations that constitute structural or clinical evidence that supports confirming the diagnosis are additionally referenced via `Condition.evidence[0].detail[]`. This applies to:
- **`TendonsInvolvedObservation`** — identifies which specific tendon structures are torn; directly supports and refines the diagnostic code ("supraspinatus tear" vs "infraspinatus tear")
- **Provocation test observations** (`JobeTestObservation`, `LiftOffTestObservation`, `BellyPressTestObservation`, `BearHugTestObservation`, `HornblowerTestObservation`) — clinical exam findings whose positivity supports the suspected diagnosis

**Not adopted:**
- `Observation.focus` — semantically too broad (any resource, not condition-specific); would require a custom constraint and adds nothing not already covered by the encounter chain
- `Condition.evidence.detail` for staging observations — incorrect semantics; staging happens after diagnosis, not as evidence for it
- Per-classification-system separate `stage[]` entries with `stage.type` — more semantically precise but adds implementation complexity without clear query benefit at this IG's scope

## Consequences

- `RotatorCuffCondition` carries both `stage` (for formal grading) and `evidence` (for diagnostic evidence) as Must Support elements, with `only Reference(ShoulderObservation)` type constraints on both `stage.assessment` and `evidence.detail`.
- The `TearSizeObservation` (continuous linear measurement in cm) does not appear in either bucket — it is a raw measurement, not a grading or diagnostic evidence; it is reachable via the encounter chain.
- The registration bundle builder (RegistrationWizard) maintains two separate profile-key lists: one for staging observations → `stage.assessment`, one for diagnostic evidence → `evidence.detail`.
- The FollowUp and Surgery bundle builders are unaffected — conditions are pre-existing and their staging/evidence is not re-wired at follow-up.
- Any FHIR query can reach a Condition from any Observation in two steps (encounter chain). Staging observations are additionally reachable from the Condition via `stage.assessment`; diagnostic evidence observations via `evidence.detail`.
