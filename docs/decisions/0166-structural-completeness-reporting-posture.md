# ADR-0166: Report coverage as structural completeness, and the two paradigms as a benefit

**Date:** 2026-08-15
**Status:** Accepted (§Decision §3 amended in body 2026-09-13: "identical resources" narrowed to conformance to the same profiles) — the posture stands (qualitative, no percentage, no external benchmark); the term itself is retired in the thesis, where the outcome is called representability and is stated as verification that the build met its requirements. "Coverage audit" and "completeness assessment" never named a real activity and are retired with it.

## Context

This project reports two things that are easy to overstate, and both needed a settled posture.

**Coverage.** Every expert consensus element is representable in the IG — 0 Missing. It is tempting to compress that into a percentage and compare it against a published figure for FHIR coverage of surgical registries. That comparison would not mean anything: the denominators differ, the element decompositions differ, and a per-element `Full`/`Partial` split invites a reader to compute a `% Full` that no methodology behind it supports.

**The two paradigms.** The demonstration system deliberately carries two frontends over one IG — the typed-builder *unified* frontend (port 3000, Observation-native) and the *definition-driven SDC* frontend (port 3001, Questionnaire-native, client-side `$extract`). What that demonstrates needs stating precisely, because two adjacent claims are stronger than the evidence:

- that the two frontends together *add* coverage — they do not; they cover the same elements by different means; and
- that the `$extract` engine is *demonstrated* reusable across registries. Reuse here is a **design** property (ADR-0122 made extraction spec-generic), not an empirical cross-tool result: the Questionnaires still use STU3 `itemExtractionContext` (ADR-0102, `docs/future_work_items/0003`), and no off-the-shelf SDC renderer has been tested against them (LHC-Forms archived, ADR-0041).

## Decision

Adopt a single reporting posture across the IG narrative, the mapping, and any write-up derived from them.

1. **Report coverage qualitatively, as structural completeness** — every consensus element is representable, 0 Missing, plus the residual terminology gaps stated explicitly. Do **not** state a coverage percentage and do **not** compare against an external benchmark.
2. **Do not carry a per-element `Full`/`Partial` classification**, which exists only to be totalled into the percentage this posture declines to state. (ADR-0178 later replaced it with the two-facet code/value terminology-provenance axis, which honours this posture.)
3. **State the two-paradigm result as a benefit, precisely bounded.** The profiles — not any one application — are the interoperable artefact, and that is evidenced by two independently architected frontends producing identical resources against them (DSRM Activity 4, "one or more instances"). The benefit is paradigm-independence and mutual validation, not added coverage. Each paradigm affords something the other does not: SDC exercises the standard capture-to-`$extract` pattern and checks the IG's ValueSets and profiles as SDC bindings and targets; the typed-builder exercises in-code derivation and input guarding. The two are complementary, suited to different settings.

   > **Amended (2026-09-13).** "Producing identical resources" overstates what the two frontends do,
   > and the claim is narrowed here to conformance to the same profiles, which is what this decision
   > rests on. An element-level comparison of what each frontend emits for the same clinical facts
   > found five kinds of divergence: optional scaffolding such as the use codes on a name or an
   > address; the human-readable label attached to a quantity, where both still carry the same unit
   > code; the precision of the temporal anchor, which is not uniform within either application; whether
   > a registration visit carries an end time at all, and where one is supplied it is a synthetic
   > default; and whether a coded element is fixed by the application or left to the person entering
   > the data. "Independently architected" is likewise partial: `shared/` holds three modules that are
   > generated into both applications at build time (the Constant-Murley sub-score derivation, the
   > instance-level IPS claims, and the Q11 follow-up timepoint definitions, ADR-0157), so agreement on
   > those three points comes from shared code and not from independent convergence. Everything else,
   > including bundle assembly and the resolution of an element to a value type, is written separately
   > in each.
4. **Claim reuse in principle, with its caveats attached** — spec-generic by design, but STU3-bound and untested against an off-the-shelf renderer. Never as a substantiated empirical result.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Report a coverage percentage against the published surgical-registry benchmark | The denominators and decompositions are not comparable, so the number would be precise and meaningless. Structural completeness is the claim the evidence actually supports |
| Keep the per-element `Full`/`Partial` split as descriptive only | It cannot be descriptive only — a reader totals it. Retaining it reintroduces the benchmark framing through the back door |
| Claim the `$extract` engine is demonstrated reusable | Overstates the project's own state: STU3 extension, no off-the-shelf renderer tested. "Reusable in principle" is accurate and still worth saying |
| Present the two frontends as broadening coverage | They cover the same elements by different mechanisms. The result is paradigm-independence, which is the more interesting claim anyway |

## Consequences

✅ Every coverage statement the project makes is one the artefacts can substantiate; there is no number to defend that the method does not support.
✅ The two-paradigm claim is bounded to what two frontends over one IG actually prove.
✅ Gives later audits a fixed reference point — ADR-0178 (terminology provenance) and ADR-0179 (published-narrative audit) both enforce this posture against the compiled artefacts.
⚠️ "Structural completeness" is a weaker-sounding headline than a percentage, and has to be explained rather than quoted.
❌ Does not change the demonstrator or the IG. Open parity items in `docs/limitations_items/` remain open and are unaffected by how coverage is reported.

## Sources

- `mapping/SECEC_FHIR_Mapping.md` — structural-completeness framing, 0 Missing, residual terminology gaps stated
- ADR-0122 (spec-generic extraction), ADR-0102 (STU3 `itemExtractionContext` vs STU4 `definitionExtract`), ADR-0041 (LHC-Forms archived)
- ADR-0178 (terminology provenance replaces `Full`/`Partial`), ADR-0179 (published IG narrative audited against this posture)
