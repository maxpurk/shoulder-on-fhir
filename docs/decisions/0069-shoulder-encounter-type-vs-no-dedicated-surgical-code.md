# ADR-0069: Do not add a dedicated surgical encounter code to ShoulderEncounterType

**Date:** 2026-07-11
**Status:** Accepted

## Context

`ShoulderEncounterType` is bound (extensible, `type 1..*`) to the single shared
`ShoulderEncounter` profile, which covers all three bundle contexts:

| Bundle | Context | Current `Encounter.type` code |
|---|---|---|
| `RotatorCuffRegistrationBundle` | T0 pre-op consultation | `185349003` "Encounter for check up" |
| `RotatorCuffSurgeryBundle` | T1 surgical admission | `308335008` "Patient encounter procedure" |
| `RotatorCuffFollowUpBundle` | Tn post-op follow-up | `390906007` "Follow-up encounter" |

During IG review, the T1 code was questioned: T0 and Tn have semantically precise
codes while T1 uses a code that could be read as a generic fallback. The question was
whether a dedicated surgical encounter code (e.g., SNOMED `305408004` "Admission to
surgical ward") should be added.

## Decision

Keep `308335008 "Patient encounter procedure"` as the T1 type code. Do not add a
dedicated surgical encounter or surgical admission code to the ValueSet.

## Rationale

**1. The bundle profile is the structural discriminator for surgical context.**
A consumer parsing a `RotatorCuffSurgeryBundle` already knows they are in the surgical
context from the bundle profile itself. `Encounter.type` is a secondary queryability
label — it is not the mechanism by which the IG expresses "this is a surgery."

**2. `RotatorCuffProcedure` entries with `category=Surgical` make the surgical
nature explicit.** Every `RotatorCuffSurgeryBundle` carries one or more
`RotatorCuffProcedure` resources constrained to `category = Surgical`. The surgical
nature of the encounter is fully expressed by these resources without any change to
`Encounter.type`.

**3. `308335008` is semantically accurate, not a fallback.**
"Patient encounter procedure" correctly describes an encounter that frames the
performance of a procedure. The original VS description called it "a generic patient
encounter," which understated its fitness for the T1 context.

**4. The obvious specific alternative is factually wrong for this use case.**
SNOMED `305408004` "Admission to surgical ward" implies inpatient ward admission.
Rotator cuff repair is commonly performed as ambulatory day surgery without a ward
stay. Using this code would be semantically incorrect for the majority of cases this
IG targets.

## Consequences

✅ No SNOMED code verification required; no profile changes.
✅ `308335008` remains accurate for both inpatient and day-surgery cases.
✅ The extensible binding on `type 1..*` allows deploying registries to add a
   site-specific surgical encounter code (e.g., a national day-surgery code) without
   a VS change.
⚠️ The T1 type code is less encounter-flavor-specific than the T0 and Tn codes —
   this asymmetry is intentional and documented here rather than silently accepted.
