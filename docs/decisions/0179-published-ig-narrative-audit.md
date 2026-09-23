# ADR-0179: Audit the published IG narrative against the compiled artifacts

**Date:** 2026-09-07
**Status:** Accepted — enforces ADR-0166 (reporting posture), ADR-0178 (terminology provenance), and ADR-0104 (code + category discriminator) in the IG's own published output. No modeling decision is changed.

## Context

Everything a reader of the published IG sees is authored in two places: the four narrative pages in `ig/input/pagecontent/` and the `Title:` / `Description:` / `^short` / concept-definition strings in `ig/input/fsh/`. Neither is checked by SUSHI or the IG Publisher, so both drift silently away from the profiles they describe. A pass over the rendered HTML output (built on the server, commit `e97f23f`) found three separate classes of drift.

**1. Claims contradicted by the compiled artifacts.** The home page still reported consensus coverage as "49 of the 58 elements are Full and 9 are Partial … (84.5% Full) … above the 80% benchmark reported for FHIR coverage of surgical registries" — a classification ADR-0178 retired and a benchmark framing ADR-0166 abandoned. Nine further claims were simply wrong against the FSH: `Observation.code` bound `required` (it is `extensible`); `RotatorCuffProcedureType` described as "OPS and SNOMED CT codes" with a `required` binding (SNOMED-only, `extensible`) and an enumeration listing two procedure types the ValueSet does not contain; `RotatorCuffDiagnosis` given a binding strength although `RotatorCuffCondition.code` pattern-pins the concept and binds nothing; `Encounter.status` described as recording a four-value lifecycle although the profile fixes it to `finished`; `Observation.category` listed as two values although the IG uses five; "eight active and passive LOINC-coded ROM movements" where there are six; the `ReturnToActivityCodes` and Constant sub-component display strings not matching the CodeSystem; and the claim that "each code in `ShoulderObservationCodes` maps to exactly one derived profile", which ADR-0104 made false when `tear-size` and `tear-size-classification` each gained an intra-operative sibling discriminated by `category`.

**2. Project history published as IG documentation.** Twenty-odd descriptions narrated the artifact's own evolution rather than its end state: four "Renamed from `Shoulder*`" lines, "an earlier draft used a `hand-dominance` extension", "an earlier version of this profile read it as free-text", "replaced a single free-text 'Visual Inspection' field on surgeon feedback", "`maxValueQuantity` widened from 90° to 360°", "matching the retired `InspectionObservation`'s scope", "replacing the retired `OccupationObservation`", and "after re-reading Hurley et al. 2024 … in full". Three descriptions named internal tooling and process — the `shoulder-surgeon` subagent, the `snomed_lookup` tool, "on explicit surgeon request and user go/no-go", "per clinical review". Two referenced profiles that no longer exist in the IG, so the reference was dangling as well as historical. Commit `0a008e4` had cleared eleven such descriptions; this is the remainder.

**3. "Hurley" as a generic noun.** Commit `0a008e4` standardised "SECEC" but explicitly left "Hurley"; 113 occurrences across 52 artifacts remained in rendered content.

**4. The same three classes in the published mapping.** `mapping/SECEC_FHIR_Mapping.{csv,md}` ships in the deploy mirror alongside the IG. It carried 50 "Hurley"-as-noun occurrences, internal tooling and approval language (the `shoulder-surgeon` subagent, "explicit user go/no-go"), internal review dates, and — in the `.md` — a 10,499-character `**Date:**` header that was a raw ADR-by-ADR changelog of the artifact's entire development.

## Decision

Correct all three classes in the authored sources, and adopt the rule as standing practice for the published IG.

1. **Every cardinality, binding strength, fixed value, code, display, and count stated in `pagecontent/` or in an FSH description must match the compiled `fsh-generated/` output.** Where the two disagree, the compiled artifact wins and the prose is corrected — never the reverse.
2. **Published descriptions state the artifact's end state.** No "renamed from", "replaced", "retired", "earlier draft/version", "widened from", and no reference to an artifact the IG no longer defines. Clinical rationale and terminology-gap findings are kept; the sequence that produced them is not. A dated verification of an external terminology claim ("no SNOMED CT concept exists for this axis, verified July 2026") is external fact, not project history, and stays.
3. **No internal process or tooling in published output.** No subagent names, MCP tool names, review-round references, or approval language. This extends the existing ban on ADR numbers in IG output.
4. **"Expert consensus" is the generic noun; "Hurley et al. 2024" is reserved for direct citation.** Six citation occurrences remain and are correct.
5. **The coverage statement on the home page mirrors the thesis:** every one of the 58 consensus elements is representable (0 Missing), with the residual constraint stated as terminology provenance — 20 elements carried entirely by reused external terminology, 38 drawing on at least one local code — and the 44 IG-operational rows counted separately.

6. **The mapping is held to the same wording and process rules, but not the same history rule.** Its Notes column is the audit trail the thesis rests on, and the ADR chain is deliberately its provenance record, so ADR citations and design rationale (including why a superseded realisation was replaced) stay. What is removed is what the IG rule removes for the same reason: internal tooling names, internal approval language, and bare project dates not attached to an ADR. The `.md` header states the end state and points at `docs/decisions/` instead of reproducing it.

The checks behind (1) are mechanical and were run against the regenerated output: cited codes exist, internal links resolve, documented CodeSystem tables match their concepts, and documented binding strengths match the differentials.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave the narrative pages and fix only the coverage paragraph | The retired Full/Partial metric was the most visible error but not the only one; nine further claims contradicted the profiles a reader can open in the next tab. |
| Keep the "renamed from" and "replaced" notes as migration aid for early adopters | The IG has never been published outside this project, so there is no adopter holding the old names. The notes only leak development history and, in two cases, point at artifacts that no longer exist. |
| Keep "Hurley" as the generic noun for brevity | Inconsistent with the wording already applied to "SECEC", and it reads as a coverage metric owned by one author rather than as a published expert consensus. |
| Add an automated conformance check to the build | Worth doing, but it is a build-tooling change with its own scope; logged as future work rather than folded into a documentation audit. |

## Consequences

✅ Every stated cardinality, binding, fixed value, code, display, and count in the published IG now matches the compiled artifacts; verified mechanically after regeneration.
✅ The home page's coverage claim agrees with the thesis and with `mapping/SECEC_FHIR_Mapping.csv`; the retired Full/Partial metric and the benchmark comparison are gone from the artifact as well as from the thesis.
✅ The published IG no longer narrates its own development, name changes, review rounds, or tooling.
✅ Consensus wording is now uniform across IG output and the published mapping; "Hurley" appears only in citations.
✅ The mapping `.md` header is an end-state status line (665 characters) rather than a development changelog; the per-element decision history is still reachable through the ADR citations in each row.
⚠️ The four narrative pages remain hand-maintained against the FSH. Nothing in the build fails when they drift again.
⚠️ Per-artifact `^version` values still range from 0.1.0 to 0.9.0 in the FSH. They do not reach the output — `apply-version: true` normalises every published artifact to the IG version — so they were left alone.

## Sources

- `ig/output/en/` on the server, commit `e97f23f` — the rendered HTML this audit read
- `ig/input/pagecontent/{index,profiles,terminology,examples}.md`
- `ig/input/fsh/` — 50 profile, CodeSystem, and ValueSet descriptions
- ADR-0104 — `tear-size` / `tear-size-classification` discriminated by `code` + `category`
- ADR-0166 — structural-completeness reporting posture, no benchmark comparison
- ADR-0178 — two-facet code/value terminology provenance replacing Full/Partial
- `mapping/SECEC_FHIR_Mapping.csv` (63 cells) and `SECEC_FHIR_Mapping.md`
- git commit `0a008e4` — the preceding pass: bodySite docs, eleven changelog descriptions, "SECEC" wording
