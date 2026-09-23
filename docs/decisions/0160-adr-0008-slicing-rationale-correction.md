# ADR-0160: Correct ADR-0008's slicing rationale — per-slice `value[x]` type constraints are legal FHIR; the real limitation is cross-element code↔type correlation

**Date:** 2026-08-05
**Status:** Accepted
**Amends:** ADR-0008 (§Alternatives Considered, one row; §Status)
**Builds on:** ADR-0008 (the ADR whose stated rationale this corrects — its decision, 57 derived Observation profiles, is unaffected)

## Context

While explaining ADR-0008's design, its stated reason for rejecting "FSH slicing on `code` within a single profile" as an alternative to the abstract-base-plus-derived-profiles pattern was challenged: *"Slicing does not allow per-slice `value[x]` type constraints in R4."* That claim was checked two independent ways and found to be false as a general statement:

1. **Empirical test.** A minimal FSH profile slicing `Observation.component` by a `pattern` discriminator on `code`, with two named slices given *different* `value[x]` type constraints (`Quantity` vs `CodeableConcept`), compiled with SUSHI 3.19.0 with 0 errors:
   ```fsh
   * component[NumberSlice].value[x] only Quantity
   * component[CodedSlice].value[x] only CodeableConcept
   ```
2. **Spec citation.** The FHIR R4 specification's own worked example of the `type` discriminator is `Observation.value[x] | type | $this` — HL7 uses this exact element as its textbook illustration that a polymorphic choice element can itself be sliced by type, with independent constraints per resulting type-slice. Confirmed via Firely's documentation on type slicing: "A profile can limit the list of allowed datatypes by introducing a constraint on the original `[x]` choice type element" and apply "specific constraints for each of the allowed data types."

So slicing genuinely can carry different `value[x]` type constraints per slice — both by slicing a repeating parent (`component`) and by type-slicing a 0..1 polymorphic element (`value[x]` itself). ADR-0008's stated reason for rejecting the alternative was inaccurate.

**What slicing actually cannot do**, confirmed via the same Firely documentation: correlate a *sibling* element's value with which type is required. Type slicing on `value[x]` differentiates by whichever type was actually chosen at instance time (`$this`) — it has no discriminator path that reaches over to `Observation.code` and says "if code = X, this type is mandatory; if code = Y, that other type is mandatory." That specific code→type correlation — exactly what this IG needs (57 distinct codes, each requiring one specific value type) — is outside what any slicing discriminator (`value`, `pattern`, `exists`, `type`, `profile`) can express. It requires either separate profiles fixing `code` + `value[x]` together (ADR-0008's chosen design) or a FHIRPath invariant per code (technically legal, but 57 branches of conditional logic crammed into one profile, with no per-measurement IG documentation page — worse by every practical measure).

## Decision

Correct ADR-0008's "Alternatives Considered" table. The original row:

> | FSH slicing on `code` within a single profile | Slicing does not allow per-slice `value[x]` type constraints in R4 |

is superseded by:

> | FSH slicing on `code` within a single profile | Slicing *can* apply different `value[x]` type constraints per slice (verified: both component-slicing and `value[x]` type-slicing are spec-legal; HL7's own `type`/`$this` discriminator example is `Observation.value[x]`) — but no slicing discriminator can correlate a *sibling* element (`code`) with which type is required. That correlation is the actual requirement here; only separate profiles or a 57-branch FHIRPath invariant can express it, and the former is the more maintainable, better-documented choice. |

The underlying decision — abstract base profile + 57 derived child profiles, one per measurement code — is **unchanged and unaffected**. Only the stated justification for rejecting the slicing alternative is corrected. ADR-0008's original text is left in place (per this project's ADR-correction convention, e.g. ADR-0080 on ADR-0071/0079) with a pointer to this ADR, rather than being silently rewritten.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave ADR-0008 as originally written | The claim is checkably false against the FHIR spec (SUSHI compile + spec citation + Firely docs all confirm per-slice type constraints are legal); leaving it risks misstating a FHIR capability to any thesis reader who verifies the claim. |
| Silently edit ADR-0008's table row in place, no trace of the correction | Against this project's established ADR convention — corrections are recorded as a new dated ADR that amends the old one, so the history of what was believed and when stays intact (precedent: ADR-0080, ADR-0049, ADR-0079). |

## Consequences

✅ ADR-0008's technical claim now matches the FHIR R4 specification and independent documentation (Firely)
✅ The actual limitation (cross-element code↔type correlation, not per-slice typing) is a more precise, more defensible argument — it survives scrutiny from a reader who knows FHIR profiling well
✅ The underlying architecture (57 derived Observation profiles) is fully unaffected — this ADR only fixes *why*, not *what*
⚠️ Any thesis text (Methods §4 / Results §5, if it repeats ADR-0008's original "slicing can't do per-type value constraints" framing verbatim) should be checked against the corrected reasoning — not verified as part of this ADR

## Sources

- HL7 FHIR R4 spec, Profiling — Slicing: https://hl7.org/fhir/R4/profiling.html (discriminator types; `type`/`$this` example on `Observation.value[x]`)
- Firely, "Type Slicing in FHIR R4": https://fire.ly/blog/type-slicing-in-fhir-r4/
- Firely Forge documentation, "Define Slices": https://docs.fire.ly/projects/Forge/features/DefineSlices.html
- Empirical SUSHI compile test (2026-08-05, SUSHI 3.19.0): minimal `Observation.component` slice profile with mixed `Quantity`/`CodeableConcept` `value[x]` types per slice — 0 errors, 1 unrelated warning (FSHOnly config note)
- `docs/decisions/0008-abstract-base-27-derived-observation-profiles.md` (ADR-0008) — the ADR being corrected
- `ig/input/fsh/profiles/observations/ConstantScoreObservation.fsh` — this IG's own working example of per-slice `value[x]` constraints (uniform type across its 4 slices, but structurally the same mechanism)
