# ADR-0184: The Encounter visit anchor is a profile constraint, not prose

**Date:** 2026-09-08
**Status:** Accepted

## Context

All three bundle profiles assert, in their `Description` text, that every
Observation and every Procedure in a submission anchors to that bundle's
Encounter — for example `RotatorCuffRegistrationBundle`'s "every Observation
sets `Observation.encounter → Encounter`". This anchor is what ties a
measurement to the visit at which it was taken, and it is what makes the
longitudinal series across registration → surgery → follow-up reconstructable
per visit rather than only per patient.

The contract existed only as prose. Neither `ShoulderObservation` nor
`RotatorCuffProcedure` constrained `.encounter` at all — not `1..1`, not even
`MS`. A submission could therefore omit every visit link and still pass
validation against the profiles the guide publishes. In practice the anchor
held only because both frontends and the seed data happen to populate it; any
other conformant client could silently break the cross-resource graph.

A review of the published profiles surfaced this, together with the observation
that the guide's own FSH examples were themselves inconsistent with the prose:
eight example Observations (`AnnaTendonSupraspinatus`, `AnnaTearLocation`,
`AnnaTearThickness`, `AnnaPatte`, `AnnaGoutallier`, `AnnaApproach`,
`AnnaReconstructionExtent`, `AnnaFixation`) carried no `encounter`, while the
seed bundles set it on all 241 Observations and all 5 Procedures.

## Decision

Constrain the anchor on both abstract-ish parents so it is machine-checked:

```
* encounter 1..1 MS
* encounter only Reference(ShoulderEncounter)
```

on `ShoulderObservation` (cascading to all 57 derived Observation profiles) and
on `RotatorCuffProcedure`. The reference is typed to `ShoulderEncounter`, which
is consistent with the three bundle profiles' existing `entry[encounter]` slice,
which already admits only `ShoulderEncounter`.

The eight FSH example instances above were given the encounter they were missing
(`AnnaRegistrationEncounter` / `AnnaSurgeryEncounter` as appropriate), so the
guide's own examples now satisfy the contract the guide states. `ShoulderObservation`
is bumped to `^version = "0.2.0"` and `RotatorCuffProcedure` to `"0.4.0"`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave it as prose | The entire justification for three named bundle profiles over ad-hoc resource submission is that the *profile*, not a particular frontend's code, is the guarantee. A contract only the authors' own clients honour is not a contract. |
| `0..1 MS` instead of `1..1 MS` | `MS` is not enforced by anything (the guide carries 112 `mustSupport` flags and the validator enforces none of them by design), so this would have changed nothing operationally. |
| A FHIRPath invariant on each bundle profile instead | Would express the stronger property — that the encounter resolves to *this* bundle's Encounter — but it is a larger change carrying real risk for no gain in what the constraint expresses. Cardinality plus a target-profile type covers the omission case, which is the one that actually occurred. Left as a candidate refinement. |
| Constrain only `ShoulderObservation` | `RotatorCuffProcedure` carries the same prose contract in the surgery bundle; leaving it unconstrained would keep half the gap open. |

## Consequences

✅ Omitting the visit anchor is now a validation error rather than a silent gap.
✅ The guide's examples and its seed data now agree with its own stated contract.
✅ Cascades to all 57 derived Observation profiles with a single constraint on the shared parent.
⚠️ Breaking for external submitters that emit Observations with no encounter. This is intentional — it is the contract the bundle profiles already stated — but it narrows what the guide accepts, and belongs in the interoperability discussion alongside the existing profile-discriminated bundle slices.
⚠️ The stronger property — that the referenced Encounter is the *same* Encounter carried in the bundle — is still unenforced; only the presence and target type are.

## Sources

- `ig/input/fsh/profiles/ShoulderObservation.fsh` — Encounter (Visit Anchor) section
- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` — Encounter (Visit Anchor) section
- `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh`, `RotatorCuffSurgeryBundle.fsh`, `RotatorCuffFollowUpBundle.fsh` — the Description prose this change makes checkable
- `ig/input/fsh/examples/RotatorCuffRegistrationBundle.fsh`, `RotatorCuffSurgeryBundle.fsh` — the eight examples corrected
- ADR-0034 — the three-bundle submission workflow this anchor serves
