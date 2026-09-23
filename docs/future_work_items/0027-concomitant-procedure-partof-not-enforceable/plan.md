# `Procedure.partOf` on a concomitant procedure is not enforceable by the profile alone

> **Status:** Future work — deliberately deferred. Logged 2026-09-12 alongside ADR-0186, which
> introduced the element.

## Gap

ADR-0186 made `Procedure.partOf` the mechanism that distinguishes the index rotator cuff repair
from a concomitant procedure in the same surgical event, replacing a bundle entry-order convention
that did not survive persistence. Both frontends emit it, and `RotatorCuffProcedure` constrains it
`0..1 MS only Reference(RotatorCuffProcedure)`.

`0..1` cannot express the rule that actually holds: *in a surgical event with more than one
procedure, every procedure but one carries `partOf`*. A third-party submission that posts two
`RotatorCuffProcedure` entries with no `partOf` on either still validates, and its data is as
ambiguous as pre-ADR-0186 data was.

## Why it matters

The registry's own two frontends produce unambiguous data, so the demonstrator is unaffected. The
exposure is to any second implementer: the profile documents the convention but does not make a
conformant-yet-ambiguous submission impossible, so an integrator can comply with the letter of the
IG and still deliver surgical events whose index procedure cannot be identified.

## Note

Expressing it needs an invariant scoped to the bundle rather than to one Procedure, since the rule
is about the set of procedures in an event. `RotatorCuffSurgeryBundle` is the natural carrier: a
FHIRPath invariant over `entry.resource.ofType(Procedure)` asserting that exactly one has no
`partOf`, and that every `partOf` present resolves to that one. Deferred because bundle-level
invariants over sliced entries are awkward to write against `Bundle.entry` and easy to get subtly
wrong, and the failure mode it guards against is a third-party integration this project does not
have yet.
