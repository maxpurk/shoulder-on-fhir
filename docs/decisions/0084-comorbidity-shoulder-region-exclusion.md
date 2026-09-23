# ADR-0084: Exclude shoulder-region disorders from the Comorbidity picker

**Date:** 2026-07-18
**Status:** Accepted

## Context

Next point in the same surgeon review as ADR-0081/0082/0083:

> Comorbidities: Can you add here, wherever it fits best, that we do not want to capture the shoulder related diagnosis.

`ShoulderComorbidityCondition` (SECEC Q1.c) is bound to the IPS Problems VS (`problems-snomed-absent-unknown-uv-ips`, ADR-0055) — a broad SNOMED `Clinical finding` subset with no anatomical-region exclusion. Nothing today prevents a clinician from typing "rotator cuff tear" into the Comorbidities typeahead and creating a `ShoulderComorbidityCondition` that duplicates — or worse, silently diverges from — the actual index diagnosis already captured on `RotatorCuffCondition`, or a coexisting shoulder finding that belongs on `ShoulderDiagnosisCondition` (ADR-0077's `otherDiagnosis` slice, e.g. incidental AC joint osteoarthritis).

**Classification against Hurley**: Q1.c "Comorbidities" is already `Full` — the SNOMED/IPS binding mechanism is not in question. This is a **Structural gap fix** (category (b) in this project's clinical-feedback workflow): closing an overlap between two already-existing FHIR mechanisms (`ShoulderComorbidityCondition` vs. `RotatorCuffCondition`/`ShoulderDiagnosisCondition`), not a new consensus element or a decomposition-mechanism reinterpretation. `Q1.c` status and the denominator are unaffected.

**Checked example/seed data first**: none of the three seed patients or Anna Müller's comorbidities (hypertension, type 2 diabetes) are shoulder-region conditions, so this fix requires no exclude data rewrite — a genuine, not just theoretical, latent gap.

## Terminology verification

`118944007 |Disorder of shoulder region|` is the SNOMED umbrella grouper for shoulder-region pathology. Verified directly against `tx.fhir.org`'s `CodeSystem/$subsumes` operation (not just one-hop parent/child lookups, which under-report multi-parent SNOMED concepts):

- `202843000` (Full thickness rotator cuff tear, used by `RotatorCuffDiagnosis`) → `subsumed-by` `118944007`. ✅
- `399114005` (Adhesive capsulitis of shoulder / frozen shoulder) → `subsumed-by` `118944007`. ✅
- `417076003` (Dislocation of shoulder joint) → `subsumed-by` `118944007`. ✅
- `38341003` (Hypertensive disorder, a representative non-shoulder comorbidity) → `not-subsumed`. ✅ (sanity check the exclusion doesn't over-fire)

`<< 118944007` has 1358 descendant concepts — a fetchable, cacheable set, not an unbounded query.

**A live smoke test through the real frontend surfaced a gap this static verification missed**: searching "impingement" still surfaced `359532006 |Rotator cuff impingement syndrome|` as a selectable comorbidity. Re-checked via `$subsumes`: `359532006` → `118944007` is `not-subsumed` — genuinely not in `118944007`'s inferred closure — even though `359532006`'s own stated parent, `239960007 |Impingement syndrome of shoulder region|`, IS `subsumed-by` `118944007`.

The obvious fix — add `239960007` as a second exclusion anchor — was implemented, redeployed, and **re-tested live, and still did not close the gap**. Investigated further: `359532006`'s `isa/239960007` implicit-VS expansion (the actual mechanism the exclusion filter uses) does **not** contain `359532006` either, despite it being listed as a stated child in `snomed_get_related`'s browse view. Checked `359532006`'s *other* stated parent, `414033006 |Disorder of rotator cuff|`: same result — `359532006` is absent from `isa/414033006`'s expansion and `$subsumes(359532006, 414033006)` returns `not-subsumed`. Confirmed via `$lookup` that `359532006` is active (not deprecated) in the edition served (`900000000000207008/version/20250201`). So this one concept is genuinely unreachable via *any* of its stated ancestors' inferred closures on this server — a narrow, concept-specific classification anomaly, not a general pattern (the sibling concepts of `239960007` — subacromial/coracoid/internal impingement, snapping shoulder — all correctly appear in `isa/239960007`'s expansion).

**Final fix**: `359532006` added directly as a third exclusion anchor. Self-inclusion via `isa/<code>` always contains at least the code itself regardless of any hierarchy classification issue above it (confirmed: `isa/359532006` expands to exactly `{359532006}`), so this closes the gap unconditionally rather than depending on further transitive-closure behavior that has now twice proven unreliable for this specific concept.

## Two rejected server-side approaches (both empirically tested, both fail)

1. **`fhir_vs=ecl/<expression>` implicit ValueSet** (the FHIR SNOMED IG's documented way to express "A minus B" as a single GET request): tested directly against `tx.fhir.org` (FHIRsmith 0.10.1) with several syntax variants (`ecl/<<118944007`, with/without spaces, with/without a leading grouping paren). All return `OperationOutcome: ValueSet not found: http://snomed.info/sct?fhir_vs=ecl/...`. Only `isa/<code>` (already used for `COMORBIDITY_TYPEAHEAD`) and presumably `refset/` are supported by this server — `ecl/` is not implemented, despite being part of the HL7 SNOMED CT FHIR IG spec.
2. **POST `ValueSet/$expand` with an inline `compose.include`/`compose.exclude`** (the FHIR-native way to express set difference when the implicit-VS shorthand isn't available): the `include`-only form works correctly (tested, returns plausible counts with and without a text `filter`). Adding `compose.exclude` alongside a text `filter` parameter throws a server-side exception (`"Cannot read properties of undefined (reading 'toLowerCase')"` — a bug in FHIRsmith's expansion engine, not a client error). `exclude` without `filter` works but returns the full ~123,000-concept unfiltered set on every keystroke — useless for a live typeahead.

Both findings are recorded here because they are non-obvious, verified facts about this project's specific terminology-server dependency, in the same spirit as ADR-0062's earlier `tx.fhir.org` empirical findings (duplicate CORS headers, IPS-canonical-not-hosted) — future work touching SNOMED ECL exclusions on this server should not re-discover this.

## Decision

**Client-side exclusion blocklist**, not a server-side ValueSet composition:

1. `SHOULDER_REGION_DISORDERS_EXCLUSION_VS` (`types/fhir.ts`) — a three-element array of SNOMED implicit-VS URLs, `isa/118944007`, `isa/239960007`, and `isa/359532006`, reusing the already-working `isa/` implicit-VS form for all three anchors.
2. `terminologyService.ts` gains `getExclusionSet(valueSetUrl)` — fetches and caches (module-level `Map`, mirrors the existing `expandValueSet` cache) the full code set of a ValueSet as a `Set<string>`. Fetched once per page load per anchor (~1358 + 11 + 1 concepts, three round trips total, `count=2000` to be safely above the known totals).
3. `searchValueSet(valueSetUrl, filter, count, excludeValueSetUrl?)` gains a fourth, optional parameter accepting a single URL **or an array of URLs**: when provided, results are filtered client-side against the union of the exclusion sets after the primary search returns. Generic — not hardcoded to comorbidities or to shoulder-region SNOMED, so any future typeahead needing an exclusion (single- or multi-anchor) can reuse it.
4. `useSnomedTypeahead` / `SnomedTypeahead` thread the new `excludeValueSetUrl` prop (same `string | readonly string[]` type) through to `searchValueSet`. `StepPatient.tsx`'s Comorbidities field passes `SHOULDER_REGION_DISORDERS_EXCLUSION_VS`.
5. `ShoulderComorbidityCondition.fsh` Description gains an explicit "Out of scope" paragraph naming `RotatorCuffCondition`/`ShoulderDiagnosisCondition` as the correct home for shoulder-region findings, and stating plainly that the FHIR binding itself does not technically forbid a shoulder-region code (IPS's Problems VS has no anatomical-region exclusion) — the frontend typeahead is the actual enforcement point. Version bumped 0.1.0 → 0.1.1.

Returning fewer than `count` results after filtering (rather than backfilling to a fixed count) is accepted — a UI typeahead showing slightly fewer suggestions is a non-issue; a backfill loop would add complexity disproportionate to a thesis demonstrator.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Documentation-only note, no technical enforcement | Weaker than what the surgeon's note implies ("we do not want to capture" reads as a real constraint); a clinician typing "rotator" would still see rotator-cuff SNOMED matches in the picker with nothing stopping selection |
| Server-side `ecl/` implicit VS | Confirmed unsupported by the deployed `tx.fhir.org` (FHIRsmith) — not a viable path today |
| Server-side POST `compose.exclude` + `filter` | Confirmed to crash the server when both are combined — not viable |
| Load a local SNOMED subset into HAPI to serve the exclusion | Disproportionate infrastructure for a UX-layer filter; this project already retired the local SNOMED fragment (ADR-0050) specifically to avoid this maintenance burden |
| Hard FHIR-level exclusion (e.g. a `required` binding to a hand-curated non-shoulder ValueSet) | Would require enumerating "everything except shoulder" as a positive list — intractable; SNOMED's own hierarchy is the only practical source of the exclusion set |

## Consequences

✅ `Q1.c` remains `Full` in `mapping/SECEC_FHIR_Mapping.csv` — no denominator or percentage change; Notes column updated to describe the exclusion and cross-reference `RotatorCuffCondition`/`ShoulderDiagnosisCondition`.

✅ Two genuine, previously-undiscovered `tx.fhir.org` server limitations documented for future reference (see §Two rejected server-side approaches).

✅ The exclusion mechanism (`excludeValueSetUrl` on `searchValueSet`/`useSnomedTypeahead`/`SnomedTypeahead`) is generic and reusable — not a one-off hack scoped only to comorbidities.

⚠️ The exclusion is UX-layer only, not enforced by FHIR conformance validation — a bundle constructed outside this frontend (e.g. hand-authored, or via the SDC frontend, which has no comorbidity typeahead at all per the pre-existing "SDC support deferred" note) could still carry a shoulder-region comorbidity code. Documented explicitly in the FSH profile's own Description rather than silently assumed.

⚠️ Even the three-anchor exclusion is not proven exhaustive — the `359532006` finding demonstrates that SNOMED's own inferred hierarchy can be internally inconsistent, and it took two rounds of live testing (adding `239960007` did not close the gap; only adding `359532006` directly did) to fully resolve one specific concept. A further such gap elsewhere in the hierarchy cannot be ruled out without testing every descendant individually, which was judged disproportionate for a UX-layer defense-in-depth filter (not a hard safety guarantee). Live-tested and confirmed working for the cases a clinician is realistically likely to type: rotator cuff tear, AC joint OA, frozen shoulder, shoulder dislocation, and shoulder impingement syndrome (both the broad concept and its `359532006` subtype).

⚠️ Three additional cached HTTP round-trips to `tx.fhir.org` the first time a user opens the Comorbidities field (fetching the three exclusion anchor sets) — negligible latency impact, and only once per page load.

**Deploy-process finding, unrelated to the SNOMED issue above but discovered while chasing it**: `docker compose build frontend` (without `--no-cache`) produced an image whose output JS bundle had the *same* content-hashed filename as the previous build despite genuinely different source — the running container kept serving stale code after a routine rebuild+redeploy, invisible until directly grepping the built asset for a string known to be new. `docker compose build --no-cache frontend` followed by `docker compose up -d frontend` (build alone does not recreate the running container) resolved it. Root cause not fully diagnosed (BuildKit layer-cache or Vite/Rollup chunk-naming determinism); noted here as a real, reproducible gap in this project's deploy verification discipline — future frontend-only redeploys should verify the built asset directly (`docker exec <container> grep -c '<known-new-string>' /usr/share/nginx/html/assets/*.js`) rather than trusting a clean `build-and-deploy.sh` exit alone.

## Sources

- Clinical review by the reviewing shoulder surgeon
- `tx.fhir.org` `CodeSystem/$subsumes` verification (2026-07-18) — `202843000`/`399114005`/`417076003` subsumed-by `118944007`; `38341003` not-subsumed; `359532006` not-subsumed by `118944007`, `239960007`, or `414033006` despite being a stated child of the latter two
- `tx.fhir.org` `CodeSystem/$lookup` (2026-07-18) — confirmed `359532006` active (not deprecated) in edition `900000000000207008/version/20250201`
- `tx.fhir.org` `ValueSet/$expand` empirical testing (2026-07-18) — `ecl/` implicit-VS unsupported; POST `exclude`+`filter` server exception; `isa/239960007` and `isa/414033006` expansions both confirmed to omit `359532006` directly (not just via `$subsumes`)
- Two rounds of live Playwright smoke testing through the real server-hosted frontend (2026-07-18) — first round surfaced the `359532006` gap that static `$subsumes` spot-checks alone had missed; second round (after the `239960007` fix) proved that fix insufficient, leading to the direct third anchor
- `ig/input/fsh/profiles/ShoulderComorbidityCondition.fsh`
- `frontend/src/lib/terminologyService.ts`, `hooks/useSnomedTypeahead.ts`, `components/shared/SnomedTypeahead.tsx`, `components/wizard/StepPatient.tsx`, `types/fhir.ts`
- ADR-0055 (IPS Problems VS binding), ADR-0062 (comorbidity typeahead routing + prior empirical `tx.fhir.org` findings), ADR-0076/ADR-0077 (`RotatorCuffCondition`/`ShoulderDiagnosisCondition` split this exclusion defers to)
- ADR-0080 (server-only TX-dependent testing policy — followed for this ADR's own verification)
