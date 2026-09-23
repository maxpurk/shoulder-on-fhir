# ADR-0014a: bodySite slicing on RotatorCuffCondition (abandoned)

**Date:** 2026-04-16
**Status:** Superseded by [ADR-0014b](0014b-precoordinated-snomed-bodysite.md)

## Context

`RotatorCuffCondition` needs to capture two distinct aspects of body site:

1. **Laterality** (left / right shoulder) — 1..1 required
2. **Tendons involved** (supraspinatus, infraspinatus, subscapularis, etc.) — 0..* extensible

The base FHIR R4 `Condition.bodySite` is a `0..*` CodeableConcept — it accepts any mix of laterality and anatomy codes without enforcement.

## Decision (Attempted)

Add explicit FSH slicing to `RotatorCuffCondition.bodySite`:

```fsh
* bodySite ^slicing.discriminator.type = #pattern
* bodySite ^slicing.discriminator.path = "$this"
* bodySite ^slicing.rules = #open
* bodySite contains laterality 1..1 and tendons 0..*
* bodySite[laterality] from ShoulderLaterality (required)
* bodySite[tendons] from TendonsInvolved (extensible)
```

This was intended to machine-enforce that laterality is always present and distinct from tendon anatomy codes.

## Why This Was Abandoned

When HAPI and IG Publisher tried to generate the snapshot for `RotatorCuffCondition` with this slicing, both returned HTTP 422 errors. The snapshot generation failed because the slicing discriminator configuration caused the IG Publisher to reject the constraint — likely due to an incompatibility between open pattern-based slicing on a CodeableConcept element and the IG Publisher's snapshot generator at the time.

Additionally, maintaining laterality as a separate slice adds authoring complexity without improving interoperability: the clinically meaningful patterns (left/right + tendon anatomy) can be expressed more simply using pre-coordinated SNOMED CT codes.

## Consequences of Abandonment

See [ADR-0014b](0014b-precoordinated-snomed-bodysite.md) for the replacement approach.

## Sources

- git commit `09a3256` — "refactor(ig): add bodySite slicing to RotatorCuffCondition and extract ShoulderObservationCodes to codesystems/" — introduced this slicing
- git commit `4ea7aa9` — "fix(ig): resolve all IG Publisher errors; pipeline builds clean (0 errors)" — removed the slicing
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh` — current state (no slicing)
