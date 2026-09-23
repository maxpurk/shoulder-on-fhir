# Add a dedicated element for Q12.f "Impact on daily activities"

> **Status:** Future work item — explicit go/no-go sought, deferred.

## Gap

Hurley Q12.f is currently covered only indirectly, via `ConstantScoreObservation.component[ADL]`
(0–20 points, ADR-0090) — a real, captured, structured value in both frontends and both seed
patients, but not a first-class Q12.f-only element with its own semantics.

## Classification

(d)-adjacent — not a new data-collection burden (the ADL sub-score is already captured), but
adding a dedicated element is a real modeling decision, not a quick fix.

## Note

Two options if picked up: (a) leave as documented indirect coverage via Constant-ADL, formalizing
the proxy relationship in the mapping notes; or (b) add a small dedicated
`DailyActivitiesImpactObservation` sibling, mirroring Q4.a's continuous+categorical dual-encoding
pattern.

## Related limitations

- `limitations_items/0002-expert-consensus-prom-set-narrower-than-practice/` — as with Q8.d, the
  consensus names a component without naming an instrument for it; this is the second of the two
  concrete cases behind that broader gap.
- `limitations_items/0016-functional-limitations-not-recaptured-at-followup/` — adjacent rather than
  the same gap, but they meet at the follow-up timepoint: option (b) here would add a second
  follow-up-scoped functional element, while 0016 records that an existing one is never re-asked
  there. Deciding both together avoids adding a new element beside an unfixed one.
