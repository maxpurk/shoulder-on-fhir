# ADR-0178: Replace the Full/Partial coverage status with a two-facet code/value terminology-provenance classification

**Date:** 2026-08-25
**Status:** Accepted — supersedes the Full/Partial/Missing *classification semantics* established by ADR-0027 and carried through ADR-0036 / ADR-0039 / ADR-0054. The representability result (0 Missing) and the two-layer (Consensus / IG-Operational) accounting those ADRs also carry are **unchanged**; only the per-element status column is replaced.

## Context

The SECEC→FHIR mapping classified every element with a single `Coverage Status` column: `Full` / `Partial` (with `Missing` defined but never used; 49 Full + 9 Partial + 0 Missing of 58 consensus elements). This label had three problems.

1. **It was a residue of an abandoned benchmark framing.** The thesis reporting posture (ADR-0166) already reports coverage qualitatively, as structural completeness (every element representable, 0 Missing) plus a residual terminology gap, explicitly *not* as a percentage compared against any external benchmark. A per-element `Full`/`Partial` split still invited the reader to compute the `% Full` the prose refuses to state.
2. **Its definition was loose and defined only in the appendix legend.** `Partial` meant "structure implemented but terminology local or unverified" — a single verdict on a fact that has two independent halves.
3. **It did not cleanly measure the terminology frontier.** The thesis had to concede that the frontier is "broader than these Partial rows" because several `Full`-status elements *also* resolve to local codes (ROM's internal-rotation ladder, the Constant sub-scores, sleep/sports/occupational-demand ordinals). So `Partial` under-counted the exact thing the second research question is about.

The root cause is that terminology provenance is a property of a **binding**, not of a consensus element. Every coded Observation carries two bindings that matter: the concept **identity** (`Observation.code` / `Condition.code`) and the **result value** (`value[x]`). A single column is forced to merge them, and the two hardest elements are exactly where that merge misleads: the belly-press test has a *bespoke* identity (no SNOMED procedure concept) but a *standard* SNOMED positive/negative result; the Constant-Murley score has a *standard* SNOMED identity but a locally-decomposed set of sub-scores. A single verdict hides one half of each.

## Decision

Replace the single `Coverage Status` column with **two** columns — `Code Provenance` (identity) and `Value Provenance` (result) — in `mapping/SECEC_FHIR_Mapping.csv`, and re-derive both mechanically from the FSH bindings. The classification is orthogonal to the existing `Layer` axis (Consensus / IG-Operational) and applies to both layers.

States:
- **Reused** — the code on the wire is an external concept code (SNOMED CT / LOINC / ICD / DICOM / HL7). Judged by the **code system transmitted, not by who authored the ValueSet**: a locally-authored ValueSet that enumerates only external codes (e.g. `PositiveNegative` → SNOMED `10828004`/`260385009`) is `Reused`.
- **Local** — the code is from this IG's own published CodeSystem (single-steward, open, citable — not proprietary).
- **Numeric** — a `Quantity`/number with a UCUM unit and no concept vocabulary (deg, `{score}`, cm). UCUM is deliberately not counted as `Reused`; it annotates a magnitude, it does not identify a concept. Value column only.
- **—** — no concept code (a structural FHIR element) or no result value.

An element whose sub-measurements differ within one facet carries both, written `Reused + Local` or `Numeric + Local` (e.g. ROM = `Reused + Local` code / `Numeric + Local` value; Constant = `Reused` code / `Numeric + Local` value). Binding strength stays in the existing `Binding Strength` column as a further nuance (a `Local` code under a `required` binding is a harder interoperability constraint than under `extensible`).

The **terminology frontier**, and the exact upstream-submission worklist, is every element with a `Local` cell in either facet.

Resulting distribution (mechanically derived, verified 2026-08-25):
- **Consensus (58):** Code — 16 Reused / 27 Local / 9 mixed / 6 none; Value — 18 Reused / 7 Local / 9 Numeric / 10 mixed / 14 none. **20 elements are fully standard (no `Local`); 38 draw on at least one project-defined code.**
- **IG-Operational (44):** Code — 4 Reused / 5 Local / 35 none; Value — 13 Reused / 5 Local / 26 none; 7 touch a `Local` code.

Representability (0 Missing — every consensus element modellable in FHIR) is unchanged and stays a prose verification statement; it never depended on the Full/Partial split. The two-layer accounting (58 / 44) is unchanged.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep Full/Partial | The loose definition and the "frontier broader than the Partial rows" caveat are the problem being fixed. |
| Single column, "any-local-wins" (Standard / Project-defined) | Lumps a *fully* local element (SSV/SANE) with a *mostly* standard one (ROM: half its axes are LOINC) — destroys the interoperability distinction. |
| Single column, three-value (Standard / Hybrid / Project-defined) | The honest single-column fallback, but still forces one verdict onto two independent facets; "Hybrid" re-introduces a fuzzy middle for exactly the Constant / belly-press rows. |
| Re-base the whole mapping to per-binding rows | Truest FHIR unit, but would break the "58 consensus elements" denominator that the consensus story rests on. The two facets recover almost all of the binding-level precision at element grain. |

## Consequences

✅ The classification is a **mechanical read of the FSH** (`code =` for identity, `value[x]` / bound ValueSet for result), not a per-row judgement — "clearly defined" in the strongest sense.

✅ The two hard rows are stated truthfully: belly-press reads `Local | Reused`, Constant reads `Reused | Numeric + Local`. Neither half is hidden.

✅ The terminology frontier is now exact and countable (38 of 58 consensus elements; the distinct project-defined concepts are the submission worklist), so the second research question's "residual barrier is terminology governance" rests on a reproducible artifact, and the "frontier broader than the Partial rows" caveat is deleted rather than explained.

⚠️ Downstream references to the old counts were updated in the same pass: `mapping/SECEC_FHIR_Mapping.md`, `README.md`, both the project guides, the thesis (Methods §4.5, Results §5.3, Discussion §6.1, Appendix mapping tables and legend), and the thesis structure map.

❌ No FHIR profile / ValueSet / CodeSystem changed — provenance is read *from* the existing FSH. `sushi .` and `tools/validate.sh` are unaffected.

## Sources

- `mapping/SECEC_FHIR_Mapping.csv` — `Coverage Status` replaced by `Code Provenance` + `Value Provenance`
- `ig/input/fsh/valuesets/PositiveNegative.fsh` lines 17–18 — SNOMED `10828004`/`260385009` (verifies the "on the wire" rule)
- ADR-0167 — terminology-selection rule (LOINC code / SNOMED entities+answers / local at the frontier): the provenance basis
- ADR-0032, ADR-0128 — value-set provenance and direct-binding decisions
- ADR-0166 — two-paradigm honest reporting posture (non-benchmark framing this classification honours)
- ADR-0027 / ADR-0036 / ADR-0039 / ADR-0054 — the superseded Full/Partial classification lineage (representability + layer accounting retained)
