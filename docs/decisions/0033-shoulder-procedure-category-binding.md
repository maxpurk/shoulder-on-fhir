# ADR-0033: Relax `ShoulderProcedure.category` from a fixed surgical code to an extensible binding

**Date:** 2026-05-12
**Status:** Accepted — leveraged by ADR-0034 (2026-05-13); profile + VS renamed by ADR-0066 (2026-06-07)

> **Rename update (2026-06-07, ADR-0066):** The profile referenced throughout this ADR was renamed `ShoulderProcedure` → `RotatorCuffProcedure`, and the bound VS `ShoulderProcedureCategory` → `RotatorCuffProcedureCategory`. The category-binding design and the bundle-level filter role described below are unchanged; only the names moved.

> **Use in ADR-0034 (2026-05-13):** The category binding introduced here now also serves as the *bundle-level filter* that separates the two submission paths. `ShoulderRegistrationBundle.entry[priorTreatment].resource.category` is `required`-bound to `PriorTreatmentCategory` (subset: PT + Medication-administration), so a surgical-category Procedure cannot be placed in the Registration bundle — it must go into `ShoulderSurgeryBundle` instead. The flexibility this ADR added (multiple categories on one profile) is what makes the three-bundle architecture validate cleanly without duplicating the procedure profile.

## Context

`ShoulderProcedure` was originally written as the index-surgery profile: `Procedure.category` was hard-fixed to SNOMED CT `387713003` "Surgical procedure". ADR-0027 (May 2026) widened the profile's intended scope by expanding `ShoulderProcedureType` with SECEC Q1.6 prior physical therapy (`91251008`) and Q1.7 shoulder injections (`27813003`, `290035003`), and stated that "the existing `ShoulderProcedure` profile" should carry those prior treatments alongside the index surgery.

That left a contradiction inside a single profile: the `code` slot accepted PT and injection concepts while the `category` slot mandated "Surgical procedure". Any prior-PT or prior-injection `ShoulderProcedure` instance would either fail validation against the profile or carry a semantically wrong category.

The standard FHIR `http://hl7.org/fhir/ValueSet/procedure-category` set only lists seven SNOMED concepts (surgical, diagnostic, counselling, education, psychiatric, chiropractic, social service) — neither physical therapy nor injection appears, so it cannot be reused as-is.

## Decision

1. Replace the fixed value with an **extensible** binding to a new IG-local `ShoulderProcedureCategory`:

   | SNOMED CT code | Display | Applies to |
   |---|---|---|
   | `387713003` | Surgical procedure | Index surgery + concomitant surgical entries in `ShoulderProcedureType` |
   | `91251008` | Physical therapy procedure | SECEC Q1.6 prior PT |
   | `18629005` | Administration of medication | SECEC Q1.7 prior injections (intra-articular and shoulder joint) |

2. Keep `category 1..1 MS`. Every `ShoulderProcedure` instance must still carry a category; the change is which value it may carry.

3. `91251008` and `18629005` are SNOMED CT parent concepts at the category level. `91251008` is also a valid `Procedure.code` value (it already appears in `ShoulderProcedureType` per ADR-0027); the same code at both levels is permissible because SNOMED is hierarchical and the two slots have different semantics (kind-of vs. specific procedure performed).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the fixed surgical code; create separate `ShoulderPhysicalTherapy` and `ShoulderInjection` profiles | Duplicates eight common elements (subject, performed[x], bodySite, reasonReference, performer, outcome, note, status) across three profiles for one differing fixed value; rejected by ADR-0027 §3 which explicitly mandates the single-profile approach |
| Bind to standard `http://hl7.org/fhir/ValueSet/procedure-category` extensibly and document the PT/injection codes in the IG prose | Loses validation traction — implementers would have to read the narrative to know which codes the IG actually expects; extensible binding to a deliberately scoped IG VS conveys intent without forbidding extension |
| Drop the constraint entirely (`category 0..1 MS`, no binding) | Removes the one explicit signal that distinguishes surgical from non-surgical entries when both share the same profile; `Procedure.code` alone is a less reliable filter for downstream consumers |
| Use `277132007` "Therapeutic procedure" as a single broad category for all entries | Strictly correct but loses the surgical-vs-non-surgical distinction that downstream registries care about; sacrifices specificity that the previous fixed value provided |

## Consequences

✅ Prior PT and injection `ShoulderProcedure` instances now validate without lying about their nature.
✅ Single profile maintained — no duplication of common elements across three near-identical profiles.
✅ The SNOMED fragment loader (`seed/load-snomed-fragment.sh`) picks up `18629005` automatically because its ValueSet sweep already covers IG-local ValueSets; no manual code list to maintain.
⚠️ The example bundle and example instance (`ExampleShoulderProcedure`) continue to use `387713003` — correct, since they document the index surgery; prior-treatment seed entries (to be added) will need the matching PT or injection category.
⚠️ Implementers writing transaction-bundle builders must pick the right category per entry rather than copying a fixed value.

## Sources

- `ig/input/fsh/profiles/ShoulderProcedure.fsh` — binding change
- `ig/input/fsh/valuesets/ShoulderProcedureCategory.fsh` — new ValueSet
- `seed/load-snomed-fragment.sh` — comment refresh
- ADR-0027 — original decision to reuse `ShoulderProcedure` for prior PT/injection
- ADR-0032 — value-set scope and provenance principles
- Hurley et al. (2024) SECEC Q1.6 (prior PT) and Q1.7 (prior injection)
- FHIR R4 `http://hl7.org/fhir/ValueSet/procedure-category` (example binding, surgical/diagnostic/etc.)
