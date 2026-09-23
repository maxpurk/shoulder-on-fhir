# ADR-0123: Fix stale `functional-limitations` Questionnaire path + resolver type-narrowing bug

**Date:** 2026-08-01
**Status:** Accepted
**Found via:** ADR-0122's own end-to-end verification (live bundle assembled and POSTed to `validator-service`, no persistence — the same close-the-loop methodology ADR-0103 used)

## Context

Running ADR-0122's generic extractor through a genuine end-to-end check — not just the old-vs-new parity diff, but an actual assembled `RotatorCuffRegistrationBundle` validated against `validator-service` — surfaced 2 real `error`-severity issues (of 107 total issues; the other 105 were pre-existing, expected warnings: `dom-6` narrative best-practice, missing `Observation.performer`, two external IPS/EHDSI ValueSets `tx.fhir.org` doesn't resolve):

```
The Profile '.../functional-limitations-observation|0.1.0' definition allows for the type
CodeableConcept but found type string
No code provided, and a code is required from the value set 'Functional Limitation Severity ValueSet'
```

Two independent root causes, both worth fixing:

**1. A genuine, pre-existing Questionnaire-authoring bug, five days old, unrelated to ADR-0122.** ADR-0105 (2026-07-27) migrated `FunctionalLimitationsObservation` from free-text `valueString` to a coded `valueCodeableConcept` bound to `FunctionalLimitationSeverity` — but `ShoulderRegistrationQuestionnaire.fsh`'s `item[5].item[5]` (linkId `obs.functional-limitations`) was never updated to match: it still declared `type = #string` and `definition = "...#Observation.valueString"`, with no `answerValueSet` at all. The old, pre-ADR-0122 extractor would have produced the exact same invalid output for this field (its `setObservationField` switch has a literal, profile-blind `case 'Observation.valueString'` branch) — this bug simply had never been exercised end-to-end against the validator before, for either extractor.

**2. A real bug in ADR-0122's own resolver.** When the leaf profile's own differential explicitly narrows `value[x]`'s type list (e.g. down to `CodeableConcept` only) but the requested path segment doesn't match any allowed type, `resolveElementType`'s base-walk did not distinguish "this choice element is declared here, narrowed, and doesn't include what was asked" from "nothing declared here, keep walking up." It kept walking — all the way to unconstrained base FHIR `Observation.value[x]` (which allows ~11 types, including `string`) — and incorrectly resolved a match there, silently resurrecting a type the actual target profile disallows. This is exactly backwards: a derived profile's narrowing must be authoritative, not bypassable by falling through to a laxer ancestor.

## Decision

**Fix 1 — Questionnaire.** `item[5].item[5]` in `ShoulderRegistrationQuestionnaire.fsh` corrected to match its neighboring coded items (e.g. `obs.sports-participation`): `type = #choice`, `definition = "...#Observation.valueCodeableConcept"`, `answerValueSet = ".../ValueSet/functional-limitation-severity"`. Swept every other Questionnaire instance for the same class of bug (a `Observation.valueString` `item.definition` pointing at a profile whose `value[x]` is actually constrained to something else) — this was the only occurrence.

**Fix 2 — Resolver.** `profileMetadataParse.ts`'s `readElementType` now returns a three-way `ElementTypeLookup` (`found` / `declared` / `absent`) instead of `T | undefined`: `declared` means an explicit, non-empty type list was found for the target choice element but doesn't include the requested suffix — authoritative, must not be treated the same as `absent` (nothing declared, safe to check an ancestor). `profileMetadataResolver.ts`'s base-walk (`resolveTypeWithNarrowing`, replacing the previous `direct ?? walkBaseChain(...)` pattern at all three call sites that resolve a type) stops immediately on `declared`, returning no match rather than continuing upward.

With both fixes in place, the assembled bundle validates with **0 errors** (105 pre-existing, unrelated warnings remain, matching what the live UI's own pre-flight already tolerates per ADR-0051).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Fix only the Questionnaire, leave the resolver bug in place | Would still leave a latent correctness gap: ANY future profile redesign that narrows a choice element's type, without perfectly synchronizing every Questionnaire reference at the same time, would silently produce wrong-but-validator-passing-until-checked output instead of a clean, surfaced "could not resolve" warning. The resolver should fail safely (drop the answer, warn) on a stale/mismatched `item.definition`, not silently paper over it by finding a stale, looser type upstream. |
| Fix only the resolver, leave the Questionnaire bug in place | Would make the field silently disappear from every Registration submission (the resolver correctly refuses to resolve it, `hasObservationValue` then drops the empty Observation) rather than actually working — closes the wrong-type bug but not the underlying "this field can never be captured via SDC" bug it was masking. |

## Consequences

✅ Registration bundle assembled by the ADR-0122 generic extractor now validates end-to-end with 0 errors via `validator-service` — the actual close-the-loop check ADR-0122's own verification section describes as still pending at the time it was written.
✅ `Q1.n` functional limitations is now genuinely capturable through the SDC Registration flow (it silently produced invalid, never-actually-submittable data before this fix, on both the old and new extractor).
✅ The resolver's type-narrowing behavior is now correct for any future profile redesign that narrows a choice element's allowed types without a perfectly synchronized Questionnaire update — it fails safely (drop + warn) instead of silently resurrecting a stale broader type from an unconstrained ancestor.
⚠️ No other occurrence of this bug class was found in a full sweep of all three Questionnaires, but the sweep was pattern-based (`grep` for `Observation.valueString`) — a narrowing mismatch involving a different FHIR type pair (e.g. a stale `valueQuantity` reference against a since-narrowed `valueCodeableConcept`-only profile) would not have matched that specific grep; the resolver fix (2) is the actual structural safeguard against that broader class, not the sweep.

## Sources

- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — the corrected `item[5].item[5]`.
- `ig/input/fsh/profiles/observations/FunctionalLimitationsObservation.fsh` — the profile's own `History:` note documenting the ADR-0105 migration this Questionnaire item never caught up to.
- `sdc-frontend/src/lib/profileMetadataParse.ts` / `profileMetadataResolver.ts` — the `ElementTypeLookup`/`resolveTypeWithNarrowing` fix.
- Live verification: assembled `RotatorCuffRegistrationBundle` POSTed to `validator-service` (port 3500) on the deployment server, before and after both fixes.
- ADR-0105 — the profile migration whose Questionnaire-side propagation this ADR completes.
- ADR-0122 — the refactor whose own end-to-end verification step surfaced both bugs.
