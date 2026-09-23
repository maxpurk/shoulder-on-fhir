# Model tear thickness per-tendon, not per-Condition

> **Status:** Future work item — modeling choice deliberately deferred.

## Gap

`TearThicknessObservation` (Q4.c) links 1:1 to the index Condition, so it can't represent a
multi-tendon tear with mixed partial/full thickness across tendons. Two options were sketched:
(a) reuse `TendonsInvolved` codes on `bodySite` — conflicts with `bodySite`'s committed
laterality-only role (ADR-0074); (b) link each per-tendon instance via `Observation.focus` to its
`TendonsInvolvedObservation`, the same mechanism ADR-0156 used for bilateral PROM disambiguation.

## Why it matters

Any two-or-more-tendon case with genuinely mixed full/partial thickness across tendons loses that
distinction in structured data — a researcher querying "which tendons were partial vs. full
thickness" cannot get a correct per-tendon answer today.

## Note

Deliberately deferred 2026-08-05 rather than picking (a) vs. (b) under time pressure — needs a
`shoulder-surgeon`/architecture review before implementing either.
