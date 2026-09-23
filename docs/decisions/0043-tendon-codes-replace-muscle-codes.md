# ADR-0043: Correct `TendonsInvolved` to use SNOMED tendon codes, not muscle codes

**Date:** 2026-05-19
**Status:** Accepted
**Builds on:** ADR-0014b (precoordinated SNOMED CT for `bodySite`), ADR-0027 (complete SECEC element coverage via standard terminologies)

## Context

`TendonsInvolved` (`ig/input/fsh/valuesets/TendonsInvolved.fsh`) is the source of truth for the second slot of `RotatorCuffCondition.bodySite` — the entry that identifies *which rotator cuff structure(s) are torn* on a given side. Per the IG's `bodySite` convention (ADR-0014b), the first `bodySite` entry carries laterality (`ShoulderLaterality`: `91774008` right / `91775009` left), and additional entries carry the specific tendon(s) from `TendonsInvolved`.

The ValueSet was named "TendonsInvolved" and its description said "SNOMED CT anatomical concepts for individual rotator cuff tendons", but the four SNOMED codes it actually carried referred to **muscle structures**, not tendons:

| Old code | Old display |
|---|---|
| `6423006`  | Supraspinatus muscle structure |
| `72573008` | Infraspinatus muscle structure |
| `90588001` | Structure of subscapularis muscle |
| `51159009` | Structure of teres minor muscle |

This is clinically wrong for rotator cuff disease. Rotator cuff tears are tendon tears — almost always at or near the footprint insertion on the greater (supraspinatus, infraspinatus, teres minor) or lesser (subscapularis) tuberosity. The muscle belly is rarely the lesion. Coding the body site as the muscle belly when the lesion is the tendon misrepresents the affected anatomical structure to any downstream consumer (registry analytics, terminology browser, secondary use).

The mistake was also internally inconsistent with `RotatorCuffDiagnosis`, which already uses tendon-named diagnosis codes (`209754000` "Rupture of infraspinatus tendon", `209755004` "Rupture subscapularis tendon", `399346004` "Supraspinatus tear", `789754007` "Tendinitis of rotator cuff tendon"). The condition therefore said "tendon" while the body site said "muscle" — the kind of inconsistency a careful reader catches and a sloppy reader silently propagates.

The error had also propagated into `seed/bundles/example-patients.json` (8 occurrences across three patient bundles' `Condition.bodySite` and corresponding `QuestionnaireResponse` `condition.tendons` answers). Frontend code (`ConditionForm.tsx` etc.) fetches `TendonsInvolved` dynamically via `$expand`, so no frontend changes are needed once the ValueSet is corrected.

The codes were re-verified against SNOMED CT International (May 2025 edition) via the project's SNOMED MCP server (`mcp__snomed-ct__snomed_lookup`, domain `body_structure`).

## Decision

1. **Replace the four codes in `TendonsInvolved`** with the laterality-neutral "Structure of tendon of X muscle" concepts. Laterality continues to live in `bodySite.coding[0]` per ADR-0014b — these tendon codes deliberately do *not* carry left/right qualifiers.

   | New code | New display |
   |---|---|
   | `5580002`   | Structure of tendon of supraspinatus muscle |
   | `59713001`  | Structure of tendon of infraspinatus muscle |
   | `80108009`  | Structure of tendon of subscapularis muscle |
   | `700027005` | Structure of tendon of teres minor |

2. **Update `seed/bundles/example-patients.json`** to use the new codes in every `Condition.bodySite` entry and every `QuestionnaireResponse.item[linkId=condition.tendons].answer.valueCoding`. Eight occurrences across three patient bundles (PAT-001 supraspinatus tear, PAT-002 articular-sided supraspinatus tear, PAT-003 massive supraspinatus + infraspinatus tear).

3. **Leave `RotatorCuffDiagnosis` unchanged** — its codes already say "tendon" and were never the problem.

4. **No frontend changes.** `frontend/src/components/ConditionForm.tsx` and its SDC counterpart fetch the ValueSet via `$expand` and re-render checkboxes from whatever the server returns; the swap is invisible at the code level.

5. **No `% Full` change in the SECEC mapping.** Q4.2 ("tendons involved") remains Full — the coverage classification was not affected by the underlying SNOMED concept error. The mapping file does not enumerate the four codes inline, so no edit there.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `6423006` / `72573008` / `90588001` / `51159009` and rename the ValueSet to `RotatorCuffMusclesInvolved` | Would make the IG honest but clinically wrong. Tears are tendon lesions; coding them at the muscle-belly level is a worse model for orthopedic registry use. |
| Use "X muscle and/or tendon" combined concepts (`700024003` / `700023009` / `700025002` / `700026001`) | Anatomically defensible (the myotendinous junction is a real region and some tears extend proximally), but contradicts the ValueSet's explicit name and description, and reintroduces the same "is this a muscle or a tendon?" ambiguity the rename was meant to remove. |
| Use laterality-specific tendon codes (e.g. `1208437008` "Structure of tendon of right supraspinatus muscle", `1208436004` left) | Duplicates laterality already carried by `bodySite.coding[0]`. Breaks the IG's slot convention (ADR-0014b) and would force every tendon entry to come in a left/right pair. The international (laterality-neutral) concepts are the right level for `TendonsInvolved`. |
| Add an `Observation` profile to record the tear's anatomical sub-component instead of expressing it via `Condition.bodySite` | Over-engineered for the level of detail the SECEC consensus actually asks for (Q4.2 is a list of involved tendons, not a per-component finding). `Condition.bodySite` with two `coding[]` slots already carries the information cleanly. |

## Consequences

✅ `RotatorCuffCondition.bodySite` is now internally consistent with `RotatorCuffCondition.code` — both speak of tendons. A terminology browser opened against `tendons-involved` returns concepts whose display strings match the ValueSet's name.

✅ Demo patient bundles correctly say "Structure of tendon of supraspinatus muscle" rather than "Supraspinatus muscle structure" in the body-site coding, which is what a reviewing clinician expects to see when reading a rotator-cuff-tear example.

✅ Frontend rendering improves with zero code change. The tendon-selection checkboxes will read "Structure of tendon of supraspinatus muscle" etc. after `$invalidate-expansion` runs (build-and-deploy.sh TERM stage).

⚠️ Any external resource posted against earlier versions of the IG and bound to the old muscle codes will fail `required`-binding validation under v0.2.0+. Pre-1.0 IG breaking change is acceptable; documented here.

⚠️ The SNOMED fragment loaded by `seed/load-snomed-fragment.sh` must include the four new tendon codes (and may drop the four old muscle codes if they are no longer referenced anywhere). Verify with a grep over the IG sources after the change; update the fragment listing if HAPI's terminology service rejects `$expand` with "code not in CodeSystem".

❌ The four old muscle codes (`6423006` / `72573008` / `90588001` / `51159009`) lose any historical record in the IG once removed. Git history preserves them; this ADR preserves the rationale.

## Sources

- `ig/input/fsh/valuesets/TendonsInvolved.fsh` — four-line replacement, lines 22–26
- `seed/bundles/example-patients.json` — eight occurrences of `6423006` and `72573008` swapped via `replace_all`
- `mcp__snomed-ct__snomed_lookup` (May 2025 SNOMED CT International) — verified target codes in domain `body_structure`:
  - `5580002` Structure of tendon of supraspinatus muscle
  - `59713001` Structure of tendon of infraspinatus muscle
  - `80108009` Structure of tendon of subscapularis muscle
  - `700027005` Structure of tendon of teres minor
- ADR-0014b (`docs/decisions/0014b-precoordinated-snomed-bodysite.md`) — the `bodySite` slot convention (first entry laterality, additional entries specific anatomy)
- `ig/input/fsh/valuesets/RotatorCuffDiagnosis.fsh` — the pre-existing tendon-named diagnosis codes that made the inconsistency visible
