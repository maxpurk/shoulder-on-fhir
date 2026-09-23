# ADR-0163: Drop `CodeSystem.valueSet` "all codes" pointer from Goutallier and Cofield CodeSystems

**Date:** 2026-08-15
**Status:** Accepted

## Context

The IG Publisher's `qa.html` reported two hard errors (the only build-mode-independent
errors in the report, distinct from the ~276 documentation cross-link mismatches and
~116 local-dev-build link-resolution items):

> CodeSystem `…/goutallier-classification` has an 'all system' value set of
> `…/ValueSet/goutallier-classification`, but the include has extra details
>
> (identical error for `…/cofield-tear-size-classification`)

Both `GoutallierClassificationCodes` and `CofieldTearSizeClassificationCodes` declared
`^valueSet = <their companion ValueSet>`. FHIR's `CodeSystem.valueSet` element asserts
"this ValueSet is the canonical value set that includes **all** codes of this code
system" — and the publisher requires that target to be a plain *"include all codes from
system X"* composition with no further detail. But both companion ValueSets deliberately
**enumerate their concepts explicitly** (`GoutallierClassificationCodes#0 …#4`,
`CofieldTearSizeClassificationCodes#small …#massive`) rather than using the
include-all-codes shorthand — an intentional choice so HAPI can serve `$expand` from the
inlined concepts instead of walking its Lucene index (the tmpfs-index race after restart,
same rationale as ADR-0063). An enumerated composition counts as "extra details," so the
`^valueSet` claim is structurally invalid.

These two were the only 2 of the IG's 19 local CodeSystems that declared `^valueSet`; the
other 17 do not (all local ValueSets enumerate for the same HAPI reason).

## Decision

Remove the `* ^valueSet = …` line from both `GoutallierClassification.fsh` and
`CofieldTearSizeClassification.fsh`. `CodeSystem.valueSet` is optional informational
metadata (a convenience pointer to "the value set with all my codes"); profiles bind to
the enumerated ValueSet by its own canonical URL, and HAPI `$expand` reads the ValueSet
resource directly — neither depends on the pointer. Removing it both clears the two
errors and aligns these two CodeSystems with the IG's other 17.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Change the ValueSets to `include codes from system X` (all-codes form) and keep `^valueSet` | Reintroduces the HAPI Lucene-on-tmpfs `$expand` race the explicit enumeration was added to avoid (ADR-0063 rationale); fights a deliberate design choice to fix a cosmetic metadata error |
| Suppress the errors via the IG Publisher's expected-warnings file | Hides a real structural inconsistency rather than resolving it; the `^valueSet` claim genuinely did not hold |

## Consequences

✅ The two CodeSystem errors clear from `qa.html` — the only genuine model-level errors in the report are resolved.
✅ These two CodeSystems now match the convention of the other 17 local CodeSystems (no `^valueSet`).
⚠️ Consumers can no longer read the "all codes" value set from `CodeSystem.valueSet` on these two systems — but the enumerated ValueSet (identical membership) remains published and is what every profile binds to, so no binding or expansion behavior changes.

## Sources

- IG Publisher `qa.txt` on the deployed demo server (the two `CodeSystem … has an 'all system' value set … but the include has extra details` errors)
- `ig/input/fsh/codesystems/GoutallierClassification.fsh` (removed `^valueSet`)
- `ig/input/fsh/codesystems/CofieldTearSizeClassification.fsh` (removed `^valueSet`)
- ADR-0063 — HAPI `$expand` empty-result resilience / ValueSet concept inlining rationale
