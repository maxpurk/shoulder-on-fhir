# ADR-0186: `Procedure.partOf` marks a concomitant procedure, replacing the bundle entry-order convention

**Date:** 2026-09-12
**Status:** Accepted
**Found via:** diffing live frontend-produced data against the seeded reference
patients. A throwaway patient was entered through the unified frontend on the
deployment server and compared against Anna Müller with
`Patient/{id}/$everything`, profile by profile and element path by element path.
The frontend-produced surgical event held two procedures that nothing
distinguished; Anna's held the same two, linked.

## Context

A surgical event carries the index rotator cuff repair plus zero or more
concomitant procedures performed through the same incision — a biceps tenodesis,
a distal clavicle excision. ADR-0034 decided not to slice index against
concomitant on `RotatorCuffSurgeryBundle.entry`, because both are
`RotatorCuffProcedure` and a profile discriminator cannot separate them. In place
of a slice the bundle profile stated a convention: the first procedure entry is
the index, later entries are concomitant, and `Procedure.partOf` is available
"if the concomitant relationship needs to be made explicit."

The convention holds only while the submission is a document. `entry` is an
ordered list inside one transaction Bundle, and that order is a property of the
Bundle, not of the resources in it. Once the transaction is POSTed, each entry
becomes an independently addressable resource with its own server-assigned
identity, and the Bundle that carried the order is not retained. A consumer
reading the registry back — `Patient/{id}/$everything`, or any
`Procedure?subject=` search — receives the procedures in whatever order the
server returns them.

For a surgical event that means several `completed` procedures on the same
shoulder, sharing one `encounter`, one `performer`, and one `performedPeriod`
(ADR-0121 gives every procedure in the event the same incision and closure
times). Nothing among those elements says which procedure the operation was for.
The one element that would — `reasonReference` — does not separate them either,
since ADR-0127 deliberately widened it so a concomitant procedure may cite its
own coexisting diagnosis, and ADR-0159 falls back to the index Condition when the
surgeon picks none, so both procedures commonly cite the same Condition.

So the distinction the registry most needs from a surgical event, which operation
was the index, was recoverable only by the submitting client and only before
persistence. This is not a hypothetical: it was found by reading real data back
off the server, and the seeded reference patient did not have the problem
precisely because its bundles were hand-authored with `partOf` already set.

## Decision

`Procedure.partOf` is the mechanism, not a suggestion.

- `RotatorCuffProcedure` constrains `partOf 0..1 MS` and
  `only Reference(RotatorCuffProcedure)`. A concomitant procedure references the
  index procedure of its own surgical event. The index procedure carries no
  `partOf`, and that absence is what identifies it.
- `0..1` rather than `1..1`, because the index procedure and every prior
  non-surgical treatment (Q1.f physical therapy, injections) legitimately have
  nothing to point at. The cardinality is narrower than base R4's `0..*`: a
  procedure accompanies at most one index procedure in this registry, and
  `0..*` would admit a chain or a cycle that means nothing here.
- Both frontends emit it. The unified frontend's `buildProcedureResource` takes
  an optional `partOf` argument, passed for concomitant items only
  (`SurgeryWizard.tsx`). The SDC frontend mints every procedure uuid before the
  assembly loop so entry `i > 0` can reference entry `0`
  (`bundleAssembler.ts`), matching the index-alignment approach it already used
  for the technique Observations.
- `RotatorCuffSurgeryBundle`'s slice note and Description are rewritten: the
  relationship is stated on the resources, and entry order is named for what it
  is, an assembly-time convenience that does not survive the POST.

No new mapping row. The linkage is documented in `L3.G.2`
(`RotatorCuffSurgeryBundle` profile) — the same treatment `Observation.partOf`
already has, documented inside `L3.E.6`–`L3.E.8` rather than as a row of its own.
Layer 2 stays at 43 and the consensus denominator is untouched.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep entry order as the convention and document the limitation | The convention is unimplementable by a consumer. Documenting a rule nobody reading the registry can apply records the gap instead of closing it, for a fix that is one optional reference. |
| Slice `entry` into index and concomitant after all | The reason ADR-0034 declined still holds: both are `RotatorCuffProcedure`, so neither of the two IPS discriminators (resource type, profile) separates them. Introducing a distinguishing profile for the concomitant case would double the procedure profile to encode a relationship the base element already expresses. |
| Mark the index with `Procedure.category` or a flag extension | `category` is already bound to `RotatorCuffProcedureCategory` (ADR-0033) and carries the surgical-vs-conservative axis; overloading it with index-vs-concomitant would entangle two axes in one element, the pattern ADR-0105/ADR-0106 corrected elsewhere. A local extension would invent a mechanism for something base R4 provides. |
| `partOf 0..*`, base cardinality | A procedure accompanies exactly one index procedure per event. `0..*` would leave a chain or a self-reference conformant while meaning nothing in this registry. |
| Infer the index from `Procedure.code` against `RotatorCuffProcedureType` | The binding is `extensible` and the value set contains both repair codes and concomitant-procedure codes; no subset marks "index". Two rotator cuff repairs in one event would also defeat it. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** The expert consensus says nothing about
resource-level relationships between procedures in one operative session; it
names the procedure performed, not the bookkeeping that keeps several of them
apart. Layer 2 scaffolding, no effect on the 58-element denominator or on
representability.

## Verification

- `sushi .` — 0 errors, 0 warnings (71 profiles, 33 instances).
- `npx tsc --noEmit` clean on both frontends.
- The guide's own surgery example already set `partOf` on the concomitant distal
  clavicle excision, so the published example needed no change and now matches a
  constrained element rather than a prose suggestion.
- Anna Müller's seeded surgery bundle likewise already carried it. Kemal Demir's
  surgical event has a single procedure and so has nothing to link.
- End-to-end: re-entered a surgical event with an index repair plus a concomitant
  procedure through both frontends against a rebuilt server, then read it back
  with `Patient/{id}/$everything` and confirmed the concomitant procedure
  resolves to the index one.

## Consequences

✅ Which procedure the operation was for is recoverable from persisted data by
any consumer, not only by the client that submitted the bundle.
✅ A registry query can separate index volume from concomitant-procedure
frequency, which is the form the question is actually asked in.
✅ The bundle profile no longer states a rule that only holds pre-persistence.
⚠️ Data submitted before this change carries no `partOf`, so for those surgical
events the index procedure remains unidentifiable. Nothing can recover it after
the fact; the two seeded reference patients and any re-seeded demo data are
unaffected because they are rebuilt from source bundles.
⚠️ `0..1 MS` does not *force* a submitter to set it. A third-party submission
that omits `partOf` on a concomitant procedure still validates, reproducing the
ambiguity for its own data. Making it conditionally required would need an
invariant over the whole bundle, which is out of scope here.

## Sources

- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` — `partOf 0..1 MS`.
- `ig/input/fsh/profiles/RotatorCuffSurgeryBundle.fsh` — Description and slice
  note rewritten.
- `frontend/src/components/SurgeryWizard.tsx` — unified frontend.
- `sdc-frontend/src/lib/bundleAssembler.ts` — SDC frontend.
- ADR-0034 — the decision not to slice index against concomitant, whose
  entry-order convention this supersedes.
- ADR-0121 — one incision and closure pair shared by every procedure in the
  event, which is why period does not separate them.
- ADR-0127, ADR-0159 — `reasonReference` widened to a coexisting diagnosis with
  a fallback to the index Condition, which is why reason does not separate them
  either.
- ADR-0141 — `Observation.partOf` index-alignment, the pattern this mirrors.
