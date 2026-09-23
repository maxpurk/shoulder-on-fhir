# Retiring the guide-aware SDC frontend

> **Status:** Ready on the capability side. Not approved, and nothing deleted.

## What changed

The guide-aware SDC frontend was the only client that could render and extract
the guide's Questionnaires. That is no longer true. The guide-agnostic filler now
reads every declaration the older one reads, and two it never did.

| | guide-aware | guide-agnostic |
|---|---|---|
| Extraction mechanisms | definition-based | definition-based and template-based |
| `calculatedExpression` | yes | yes |
| `launchContext`, `itemPopulationContext`, `initialExpression` | yes | yes |
| `sourceQueries` | **no** | yes |
| `questionnaire-hidden`, `readOnly` | yes | yes |
| Value set search for a binding too large to list | yes | yes |
| `enableWhen` | **no** | yes |
| `minValue` and `maxValue` | **no** | yes |
| Required answers enforced before submission | no | yes |
| Server address | build time only | runtime, per call |
| Exercised against the SDC specification's own examples | **no** | yes |
| Lines of source | 6020 | 2719 |
| References to this guide in its own source | 148 | 0 |
| Modules borrowed from the typed builder | 3 | **0** |

The last three rows arrived after this comparison was first written. The
guide-agnostic filler now holds no server address of its own, so it can be pointed
at any R4 server serving Questionnaires without a rebuild, and both its engines
have been run against the examples HL7 ships with the SDC specification rather than
only against this guide's forms. Neither is a capability the guide-aware frontend
could gain cheaply: it reaches this guide's profiles by name throughout its own
source.

The borrowed modules are the substantive point. The guide-aware frontend shares
`constantScore`, `ipsProfiles` and `q11Timepoints` with the typed builder, so the
two are not independent implementations and their agreement is worth less as
evidence. The guide-agnostic filler shares nothing and depends on `fhirpath` and
the framework alone.

## What is genuinely lost

One thing, and losing it is the point. The guide-aware frontend can mark a
measurement not performed, from a list of twenty linkIds written into its own
source. No Questionnaire declares that marker, so a filler reading only the
published artifacts cannot know which fields it applies to. It is a capability
that does not travel with the guide, which is exactly what the comparison exists
to show.

## Before retiring it

- No documentation has to move first: the guide-agnostic filler is the one described.
- Whatever `future_work_items/0032` decides about provenance should be settled while two
  clients still exist to check the answer against.
- Retiring it means one `docker-compose.yml` service, one `Caddyfile` route, and a
  decision record superseding the parity rule that requires both.
