# ADR-0102: SDC version-label accuracy + STU4 extraction-mechanism transparency

**Date:** 2026-07-26
**Status:** Accepted
**Amends:** ADR-0040 (SDC IG conformance — version-label update), ADR-0095 (server-side `$extract` — adds an interoperability caveat)
**Builds on:** ADR-0100, ADR-0101 (same-session SDC prefill work that prompted this check)

## Context

A teaching conversation about "are we using SDC in the best-practice sense" prompted a check of
`ig/sushi-config.yaml`, which turned up a real, live claim/reality mismatch — the same class of bug
this project has repeatedly hunted down elsewhere (ADR-0036, ADR-0039, ADR-0097):

- `sushi-config.yaml` pins `hl7.fhir.uv.sdc: version: 4.0.0` — but its own `reason:` comment two
  lines above, its top-level `description:` field, and the project guide (multiple places) all still said
  "v3.0.0".
- `git log` traced this to commit `e425f1c` ("batch: SDC 4.0 upgrade, sidecar proxy, thesis +
  defense edits", 2026-05-19) — a genuine, intentional upgrade, not a typo. That commit's own
  message records a real accompanying code change: *"Questionnaire item.definition URLs now include
  element path (#Patient.name.given etc.) for SDC 4.0 definition-driven $extract"* — which this
  project's FSH already reflects consistently. The bump was real and correct; it just never got its
  own ADR, and the surrounding prose was never updated to match, for over two months.
- the project guide also claimed the Questionnaires declare `meta.profile = sdc-questionnaire-extract` —
  checked against the actual FSH (`ig/input/fsh/instances/Shoulder*Questionnaire.fsh`), all three
  declare `sdc-questionnaire-extr-defn` instead. Live web research (`build.fhir.org/ig/HL7/sdc`,
  `changes.html`) confirms why: STU4 **replaced** the single `sdc-questionnaire-extract` profile
  with three separate profiles, one per extraction mechanism — `sdc-questionnaire-extr-defn` for
  definition-based extraction (this IG's mechanism) is one of the three replacements. the project guide
  had simply never been updated past the STU3-era name.
- Digging one level deeper: the STU4 `sdc-questionnaire-extr-defn` profile page itself documents
  `definitionExtract` / `definitionExtractValue` / `extractAllocateId` as its supported extraction
  extensions — not `itemExtractionContext`, which is what this project's FSH actually uses
  throughout (`$SDC_EXTRACT_CTX` alias, every Questionnaire group). Web research indicates
  `itemExtractionContext` is retained for backward compatibility in STU4 but was superseded because
  it "did not support defining a profile to create and the expression was not deemed sufficiently
  implementable." So this IG is SDC-4.0.0-declared but STU3-idiom in its actual extraction
  extension choice — working, backward-compatible, but not what a from-scratch STU4 implementation
  would reach for today.

## Decision

1. **Fix the stale version-label prose** everywhere it disagreed with the actual pinned dependency:
   `ig/sushi-config.yaml`'s top-level `description:` and the SDC `reason:` comment, and the project guide
   (component table, Data Flow section, ADR-0040 bullet). All now say v4.0.0, matching what's
   actually declared and built.
2. **Fix the wrong profile-ID name** in the project guide (`sdc-questionnaire-extract` →
   `sdc-questionnaire-extr-defn`, matching the actual FSH).
3. **While already editing `sushi-config.yaml`'s published `description:`/`reason:` text, also
   remove the ADR-number citations baked into it** (`(ADRs 0057-0059)`, `ADR-0038 records...`,
   `(ADR-0034); see ADR-0040`, and one `reason:` field's `(ADR-0040)`). These compile into the
   published `ImplementationGuide` resource's `description` and `dependsOn[].extension` (verified:
   `grep` on the SUSHI-generated `ImplementationGuide-*.json` shows `reason` maps to a real
   published FHIR extension, `.../extension-ImplementationGuide.dependsOn.reason`) — the same
   "no ADR numbers in published IG output" rule this project already enforces for FSH `Description:`
   blocks applies here identically; this was a pre-existing, unrelated violation of that rule,
   fixed opportunistically since the exact same lines needed editing anyway. The other three
   dependency `reason:` fields (EU Core, xver-r5, IPS) have the same issue and were **not** touched
   here — unrelated to this ADR's scope, left as a separate future cleanup.
4. **Do not migrate `itemExtractionContext` → `definitionExtract` in this pass.** That is a
   substantive change (every Questionnaire group's extension declaration, plus `extractor.ts`'s
   `extractionContextOf()` parsing logic), not a documentation fix, and nothing currently consumes
   these Questionnaires except this project's own frontend — there is no concrete caller forcing the
   migration today. Scoped and recorded in `docs/future_work_items/0003-sdc-stu4-definitionextract-migration/`
   so the finding isn't lost.
5. **Add the sharper interoperability caveat explicitly**, in both the project guide and as an amendment
   to ADR-0095: even a fully independent, off-the-shelf SDC engine (not just "no server operation
   exists") would not correctly extract from these Questionnaires as they stand, because fixed
   `Observation.code`/`category`/`unit` per profile live in `extractor.ts`'s hardcoded
   `PROFILE_METADATA` table rather than being resolved from the target StructureDefinition's own
   fixed values at runtime. This is a limitation of this implementation's shortcut, not of the SDC
   spec or of definition-based extraction as a mechanism — but it was previously only implicit in
   one code comment (`extractor.ts`'s `PROFILE_METADATA` docblock), never stated where a reader
   assessing "is this genuinely interoperable SDC" would look.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Fix the version label only, say nothing about the extension-mechanism or interoperability findings | Would repeat exactly the pattern this ADR exists to correct — a true fact stated, a sharper adjacent truth left implicit. |
| Migrate to `definitionExtract`/`definitionExtractValue` now, in the same pass | Real, substantive work (every FSH group + `extractor.ts` parsing logic) with no current caller demanding it — recorded as a scoped future item instead, matching this project's established pattern (ADR-0097's plan-then-defer-then-implement precedent). |
| Also resolve target StructureDefinitions dynamically instead of the `PROFILE_METADATA` table, to close the interoperability gap for real | Bigger architectural change than a documentation-accuracy pass warrants; the goal here is honest disclosure of the limitation, not fixing it outright. |
| Clean up all four dependency `reason:` fields' ADR citations, not just the SDC one | Three of the four are unrelated to this ADR's actual scope (EU Core, xver-r5, IPS); fixing only the one already being edited avoids unbounded scope creep. |

## Consequences

✅ `sushi-config.yaml` and the project guide now accurately describe what's actually pinned and built.
✅ The published `ImplementationGuide.description`/`dependsOn[].reason` no longer leak internal ADR
numbers — closes a real, pre-existing violation of this project's own "no ADR references in
published IG output" rule.
✅ The STU4 legacy-extension finding and the extraction-portability caveat are now stated explicitly
in the two places (the project guide, ADR-0095) a reader assessing SDC conformance would actually look,
not just implied by one code comment.
✅ `sushi .` (0 errors/warnings), `tsc --noEmit`, `npm run build`, `npm run lint` all pass.
⚠️ The STU4 extension-mechanism migration itself remains undone — `docs/future_work_items/0003/` exists
so it isn't lost, but the IG still uses the STU3-era `itemExtractionContext` idiom today.

## Sources

- `git log -p --follow -- ig/sushi-config.yaml` — traced the version-label history to commit `e425f1c`
- `git show e425f1c` — the original, undocumented 3.0.0→4.0.0 upgrade commit
- `ig/input/fsh/instances/Shoulder{Surgery,FollowUp,Registration}Questionnaire.fsh` — confirmed actual `meta.profile` value
- https://build.fhir.org/ig/HL7/sdc/en/StructureDefinition-sdc-questionnaire-extr-defn.html — STU4 profile's documented supported extensions
- https://build.fhir.org/ig/HL7/sdc/changes.html — STU3→STU4 change summary (`sdc-questionnaire-extract` replaced by three per-mechanism profiles)
- `sdc-frontend/src/lib/extractor.ts` — `PROFILE_METADATA` table and its existing docblock (the implicit version of this ADR's interoperability caveat)
- ADR-0040 — original SDC adoption ADR, amended by this one
- ADR-0095 — server-side `$extract` evaluation, amended by this one
- `docs/future_work_items/0003-sdc-stu4-definitionextract-migration/plan.md` — the deferred migration this ADR scopes but does not implement
