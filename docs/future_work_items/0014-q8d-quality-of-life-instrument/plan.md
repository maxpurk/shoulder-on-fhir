# Add a dedicated instrument for Q8.d "Improved quality of life"

> **Status:** Future work item — explicit go/no-go sought, deferred.

## Gap

Hurley Q8.d names quality of life as one of five treatment-success components (Q8.a–e, otherwise
all Full). No QoL instrument (e.g. EQ-5D-5L, PROMIS Global-10) is defined as a Questionnaire
resource anywhere in the IG, so neither frontend nor either seed patient captures anything for it.

## Classification

(d) out-of-consensus-shaped addition — Hurley names the concept but not a mechanism, and adopting
a whole external instrument (new Questionnaire + Observation profiles, both frontends, seed data,
an ADR, a mapping update, plus a licensing decision) is a substantial scope increase.

## Note

PROMIS Global-10 (public domain, NIH-maintained) is the lower-friction candidate vs. EQ-5D-5L's
licensing/attribution requirements, if this is picked up.

## Related limitations

- `limitations_items/0002-expert-consensus-prom-set-narrower-than-practice/` — the same boundary
  from the other side. The consensus names a quality-of-life component without naming an instrument
  to measure it, which is one of the two concrete cases behind that broader gap; adopting an
  instrument here would narrow it.
