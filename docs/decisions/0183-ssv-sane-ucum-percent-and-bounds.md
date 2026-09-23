# ADR-0183: SSV and SANE carry UCUM `%` and a 0–100 bound

**Date:** 2026-09-08
**Status:** Accepted

## Context

`SsvScoreObservation` and `SaneScoreObservation` were the only two quantitative
PROM/exam profiles in the guide that set `valueQuantity.system`/`.code` by hand
instead of inserting the shared `BoundedQuantity` RuleSet. Two problems followed
from that.

First, a unit error. Both fixed `valueQuantity.code = #{score}`. In UCUM, `{score}`
is an *annotation* — an arbitrary, non-convertible unit whose defined semantics are
"ignore this in comparisons". But `SsvScoreObservation`'s own `Description` already
described the value as "a percentage of a normal shoulder (0–100)", so the profile
contradicted itself in the same file: it declared a percentage and then typed it as
an arbitrary score. The FHIR Validator flags `{score}` with a best-practice warning
about depending on annotations.

Second, a missing guard. Roughly fifty sibling profiles constrain their value with
`minValueQuantity`/`maxValueQuantity` via `BoundedQuantity`, which the validator
enforces as a hard error even fully offline. SSV and SANE did not, so an SSV of 150
was structurally conformant.

A clinical review confirmed that both instruments are percentage-of-normal ratings.
The SSV (Gilbart & Chalmers) is self-evidently one. SANE was additionally described
in this guide as "a 0–100 visual analogue scale", which is wrong: SANE is a
single-item numeric self-rating of function as a percentage of a normal shoulder,
not a drawn VAS. Both descriptions were inaccurate in the same direction.

## Decision

Both profiles now use the shared RuleSet with a true UCUM percent unit:

```
* insert BoundedQuantity(#%, 0, 100)
```

This replaces the three hand-written `value[x]`/`system`/`code` lines and
simultaneously fixes the unit and adds the bound. Both `Description` texts were
rewritten to state the percentage-of-normal semantics and, for SANE, to drop the
incorrect visual-analogue-scale characterisation. Both profiles are bumped to
`^version = "0.3.0"`.

The sixteen SSV/SANE Observations across the two example patients' seed bundles, the
`AnnaFu6wSsv` IG example, and the unified frontend's two observation-metadata maps
were migrated from `{score}`/`points` to `%`. The SDC frontend needed no change: it
resolves the UCUM code from the StructureDefinition at runtime
(`sdc-frontend/src/lib/profileMetadataResolver.ts` → `extractor.ts`), so it inherits
the corrected unit automatically — a property of the definition-driven paradigm.

Both descriptions also now cite the mapping element as `Q12-SSV-SANE`, the ID the
mapping CSV actually declares. They previously cited `Q12-SSV` and `Q12-SANE`, which
exist nowhere in the mapping and could not be looked up.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep `{score}`, add only the bound | Leaves the profile contradicting its own Description, and forfeits the machine-actionable cross-system comparison a coded percent unit buys. `{score}` explicitly means "not comparable". |
| Keep `{score}` on SANE only, `%` on SSV | Rests on SANE being a visual analogue scale. It is not; it is a percentage-of-normal numeric rating, so the two instruments take the same unit. |
| Change the Descriptions to say "arbitrary score" | Would make the documentation agree with the code by making the documentation wrong. Both instruments are defined by their authors as percentages of a normal shoulder. |

## Consequences

✅ An out-of-range SSV or SANE is now a hard validator error, matching every sibling profile.
✅ The unit is semantically correct and comparable across systems, not an opaque annotation.
✅ Removes the validator's `{score}` best-practice warning from both profiles.
✅ The SDC frontend picked the change up with no code edit, demonstrating the definition-driven paradigm's intended benefit.
⚠️ Breaking change for any consumer that stored these values as `{score}`. Confined to this project: the seed bundles, the IG example, and the unified frontend were migrated in the same change.
⚠️ Previously-persisted demo data on a running HAPI still carries `{score}` until re-seeded (`build-and-deploy.sh --clean`).

## Sources

- `ig/input/fsh/profiles/observations/SsvScoreObservation.fsh`
- `ig/input/fsh/profiles/observations/SaneScoreObservation.fsh`
- `ig/input/fsh/rulesets/BoundedQuantityRuleSet.fsh` — the shared bound pattern
- `sdc-frontend/src/lib/extractor.ts` line ~226 — UCUM code resolved from the profile
- Gilbart MK, Gerber C. Comparison of the subjective shoulder value and the Constant score. *J Shoulder Elbow Surg* (2007) — SSV as percentage of a normal shoulder
- ADR-0090 — Constant-Murley component capture, the sibling PROM precedent for bounded components
