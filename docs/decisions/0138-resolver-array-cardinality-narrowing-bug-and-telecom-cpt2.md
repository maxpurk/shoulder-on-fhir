# ADR-0138: Fix generic resolver's array-cardinality loss on type-narrowed elements; fix `Patient.telecom` cpt-2 invariant

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** live pre-flight testing of ADR-0136's address/phone fields on the deployment server, using ADR-0134's fixed banner (which, for the first time, actually surfaced the blocking `[error]` lines instead of hiding them behind unsorted warnings).

## Context

Submitting a Registration with a street/postal/city address produced a genuine, non-cosmetic validator error:

```
[error] The property address must be a JSON Array, not an Object (at Bundle.entry[0].resource)
```

Root cause, traced through `profileMetadataResolver.ts`'s `resolveTypeWithNarrowing`: this function walks a profile's `baseDefinition` chain looking up an element's type, and — by design (ADR-0122's own doc comment) — **stops at the first ancestor that explicitly declares the element**, so a profile narrowing `value[x]` to one type doesn't silently fall back to a laxer ancestor's wider type list. The bug: it returns that first-found level's `max` *together with* its `type`, as one inseparable unit. For `Patient.address`, the chain is `ShoulderPatient` (no differential entry for `address` beyond `MS`) → `patient-eu-core` (no entry either — inherited untouched) → `patient-eu` (differential narrows `type` to `Address-eu`, but — confirmed by reading the live compiled StructureDefinition off HAPI — **does not repeat `max`**, since the FSH edit that produced it only ever touched `type`). `resolveTypeWithNarrowing` found `type` at the `patient-eu` level and returned immediately with `max: undefined`, never continuing to base FHIR `Patient` (`max: "*"`, confirmed via HAPI's own snapshot) to recover the real cardinality. `isRepeating(undefined)` is `false`, so `containerIsArray` came out `false`, and `assignByPath` built `address` as a bare object instead of `[object]`.

This is a **generic, pre-existing bug**, not something ADR-0136 introduced — it would misfire for *any* array-typed element on *any* profile where a narrowing ancestor sets `type` without restating `max` (a very common FSH pattern, since `* element only SomeType` doesn't touch cardinality). It happened to surface now only because `Patient.address` is the first such element this codebase's SDC port ever tried to write a 2-segment (`container.leaf`) path into.

A second, unrelated but same-testing-pass finding: `Patient.telecom.value` alone — no sibling `system` — violates FHIR base's `cpt-2` invariant ("a system is required if a value is provided"). ADR-0136 had explicitly accepted this as a "minor imprecision," reasoning the generic resolver has no sibling-fixing mechanism (correctly identified) but underestimating the consequence (a validation *error*, not just missing metadata).

## Decision

1. **`profileMetadataResolver.ts`, `resolveTypeWithNarrowing`**: decouple `type` resolution from `max` resolution. Once a level yields a `found` type, keep walking the base chain — using that already-locked-in `type` — until some level supplies a `max`, or the chain is exhausted. This is spec-correct, not a workaround: FHIR profiling only ever narrows-or-keeps an inherited cardinality, never widens it, so backfilling `max` from a laxer, unnarrowed ancestor can never contradict the narrowest `type` already found. The `declared` (choice-exclusion) short-circuit is unchanged — it still stops the walk immediately, preserving ADR-0122's original protection against resurrecting an excluded choice-type option.
2. **`ShoulderRegistrationQuestionnaire.fsh`**: `patient.phone` changed from an `item.definition`-based leaf (`Patient.telecom.value`) to a loose leaf (no `item.definition`), same pattern as Coverage/RSG.
3. **`extractor.ts`**: `patient.phone`'s answer is now read via `findAnswerByLinkId` and merged onto the already-extracted `Patient` as a full `ContactPoint` (`system: 'phone'`, `use: 'home'`, matching the unified frontend's fixed values) — same in-place-modification pattern the RSG extension already established.

`Questionnaire.version` bumped `0.7.0` → `0.7.1`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave the resolver bug and hand-build `Patient.address` as a fourth hardcoded loose-leaf case (like Coverage/RSG/phone) | Would have fixed only this one symptom, leaving the underlying resolver defect to silently miscount cardinality for the next array-typed, type-narrowed element anyone adds to any profile — a much larger blast radius than one field. |
| Also always continue past a `found` level even when it *does* supply `max` (fully decouple type and max resolution in every case) | Unnecessary — once both `type` and `max` are available from the same narrowest level, that's already the most specific answer available; no reason to keep walking. |

## Consequences

✅ `Patient.address` now correctly serializes as a JSON array; the `cpt-2` telecom error is gone. Both confirmed by re-running the exact submission that originally failed (see live verification in the follow-up commit).
✅ The resolver fix is generic — protects every future array-typed, type-only-narrowed element in any profile the SDC extractor touches, not just `address`.
✅ `sushi .`: 0 errors / 0 warnings. `sdc-frontend`: `npm run build` and `npm run lint` both clean.
⚠️ This is the clearest evidence yet that ADR-0134's banner-sorting fix was load-bearing, not cosmetic — both bugs in this ADR were sitting silently behind the old unsorted-slice banner bug until that fix let them surface.

## Sources

- the cross-frontend parity audit, item #2 — the feature work that exposed both bugs.
- ADR-0134 — the pre-flight banner fix that made these errors visible in the first place.
- ADR-0122 — original design intent for `resolveTypeWithNarrowing`'s stop-on-narrowing behavior, preserved unchanged by this fix.
- `sdc-frontend/src/lib/profileMetadataResolver.ts` (`resolveTypeWithNarrowing`), `sdc-frontend/src/lib/extractor.ts` (`patient.phone` handling).
- Live HAPI StructureDefinition reads (`patient-eu`, `patient-eu-core`) confirming the exact differential-vs-snapshot `max` gap that caused this.
