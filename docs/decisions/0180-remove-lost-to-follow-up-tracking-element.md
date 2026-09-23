# ADR-0180: Remove the lost-to-follow-up tracking element from the mapping

**Date:** 2026-09-07
**Status:** Accepted — removes `L3.H.4` from the IG-Operational layer, superseding the relocation decided in ADR-0054. Layer 2 goes from 44 to 43 rows. The consensus layer (58 elements, 0 Missing) is untouched.

## Context

`L3.H.4` "Lost-to-follow-up tracking" specified a convention: when a scheduled follow-up Observation cannot be collected because the patient is lost to follow-up, the resource is still created with `Observation.status = #unknown` as a sentinel, reusing the base FHIR `observation-status` ValueSet so no new code is needed.

The element entered the accounting sideways. ADR-0039 put it in the since-retired Supplementary layer alongside four non-consensus PROMs. ADR-0054 removed those four PROMs from the IG entirely, on the grounds that none passed the 80% Delphi threshold and carrying them broke the consensus-only discipline, but kept this one row and relocated it to Layer 2 as an "operational data-quality pattern, not a PROM". That relocation was never re-examined against the Layer 2 admission criterion.

Checking it now against all three grounds on which a row can earn its place:

1. **The consensus does not ask for it.** Its `Question` column is `—`. The thirteen consensus questions cover patient history, examination, imaging, classification, treatment success, follow-up duration and research timepoints, PROMs, and follow-up imaging. None asks that attrition be recorded.
2. **The IG does not require it to function.** This is what Layer 2 is for: elements the guide *must* carry to work as a data model. Its three siblings in category H are real declared elements (`Procedure.performer.actor`, `Procedure.outcome`, `Procedure.note`). `L3.H.4` is not an element the guide declares at all; it is a usage convention over a base FHIR field that every Observation already has. The guide is complete and functional without it.
3. **Nothing realises it.** No FSH profile constrains or documents the sentinel. Neither the unified nor the SDC frontend offers any way to mark a timepoint as not collected. Neither seed patient carries an Observation with `status = unknown` at any timepoint, so the pattern has no worked example anywhere in the artifact.

A row that fails all three is an aspiration recorded in a completeness table. That is the specific failure mode the two-layer accounting exists to prevent, since the whole point of separating Layer 2 is to be honest about what the guide carries beyond the consensus.

## Decision

Delete `L3.H.4` from `mapping/SECEC_FHIR_Mapping.csv` and every derived surface.

- Layer 2: **44 → 43** rows. Category H: 4 → 3.
- Layer 2 facet counts: Code `4 / 5 / 0 / 34`, Value `12 / 5 / 0 / 0 / 26`. The row was Code `—` / Value `Reused`, so the terminology frontier is unchanged at **7**.
- The consensus layer is not affected: still 58 elements, 0 Missing.
- No IG artifact changes, because none referenced it.

Recording attrition remains a reasonable thing for a registry to do. It is not something this guide specifies, and the guide should not claim it does. If it is wanted later, it should be introduced as a declared element with a profile constraint and a worked example, not as a convention in a table.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the row and implement the pattern (profile constraint, frontend control, seed example) | Adds scope for a capability the consensus never asks for and no reviewed registry requires. The admission test is whether the guide needs it to function, and it does not. |
| Keep the row and document it as aspirational | A completeness table that mixes what the guide carries with what it might carry stops being an audit. Layer 2's value is that every row is something the guide actually needs. |
| Keep the row, log the non-implementation as a limitation | Was done briefly and then reverted. A limitation entry is the right instrument for a gap in something the artifact set out to do; here the artifact never needed it, so the honest fix is removal, not a standing caveat. |

## Consequences

- The thesis drops the element from the Methods Layer 2 enumeration, the Results category H list, and the appendix operational table, and updates the count in six places.
- The Related Work passage citing the PRULO pilot's sub-20% follow-up response keeps the evidence about attrition, which stands on its own, and no longer points forward to a pattern this guide defines.
- `docs/limitations_items/0023-...`, created while sourcing the thesis description, is deleted; there is no longer a gap to track.
- ADR-0054's relocation of the pattern is superseded. Its removal of the four Supplementary PROMs stands.
- ADR-0179's home-page coverage statement is updated from 44 to 43 operational rows.
