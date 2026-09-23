# ADR-0103: Runtime-derived Observation code/category — closes the `PROFILE_METADATA` interoperability gap

**Date:** 2026-07-26
**Status:** Accepted
**Amends:** ADR-0102 (Consequence #5 named this exact gap as an explicit, stated limitation — this ADR closes it)
**Builds on:** ADR-0008 (base + derived Observation profile pattern), ADR-0063 (prefer a direct resource read over a search-index-backed operation)

## Context

A teaching conversation about SDC conformance led to actually exercising the SDC frontend's extraction pipeline end-to-end against a live Questionnaire and a live HAPI instance (not a hand-crafted example): fetch the real `shoulder-registration` Questionnaire, drive the real `extractor.ts`/`bundleAssembler.ts` code with a synthetic form submission, submit the resulting bundle through the real `validator-service` sidecar and the exact `tools/validate.sh` invocation.

This surfaced a real, reproducible FHIR Validator CLI **error**: `Wrong Display Name 'Jobe test result' for .../CodeSystem/shoulder-observation#jobe-test. Valid display is 'Jobe Test (Empty Can)'`. The root cause: `extractor.ts`'s hand-typed `PROFILE_METADATA` table (~47 entries, supplying each derived Observation profile's fixed `code`/`category`/unit, since SDC's `item.definition` only names *which* profile a leaf targets, not that profile's *other* fixed values) had drifted from the authoritative FSH `CodeSystem`. A systematic diff of every local-CodeSystem-backed entry against `ShoulderObservationCodes` found **18 of 39 displays had drifted**.

This is the exact gap ADR-0102 (Consequence #5) already named explicitly: *"an independent SDC processor couldn't correctly extract from these Questionnaires without also knowing this project's private lookup table"* — stated there as a disclosed limitation, not yet fixed. Investigating further this session:

- **`Observation.code`'s system+code+display is always recoverable from the compiled `StructureDefinition`** — confirmed by reading the actual compiled JSON. LOINC-coded profiles that inline a display in FSH (`* code = http://loinc.org#41381-5 "..."`) get the full triple baked into `patternCodeableConcept` for free. Local-CodeSystem-coded profiles that don't inline a display (`* code = ShoulderObservationCodes#jobe-test`, no display) compile with only `{system, code}` — the display has to come from the `CodeSystem` resource itself (`concept[].display`), not the profile. One profile (`constant-score-observation`, SNOMED `273383002`) has neither an inlined display nor a local CodeSystem to read — it needs a live `CodeSystem/$lookup`, which HAPI already proxies to `tx.fhir.org` transparently (`remote_terminology_service.snomed`, ADR-0050).
- **`Observation.category`, by contrast, was not recoverable from any profile** — `ShoulderObservation.fsh` sets only `* category 1..* MS` with a `preferred` binding to the standard `observation-category` ValueSet; no derived profile fixed a value. The question "why is category required at all, could we just drop the requirement" was raised directly. Answer: dropping it doesn't remove the underlying "what class of clinical activity is this" fact, it relocates the burden downstream to every future consumer of the registry (reports, queries, other frontends), each reconstructing its own private code→category mapping — worse than one table in one place. The real fix mirrors how `code` is already closed: **strengthen** `category` to a fixed value per derived profile, the same base+derived pattern this IG already uses for `code` (ADR-0008).
- **`Quantity.unit`** (the human-readable string, e.g. `'°'`, `'{score}'`) has no IG source at all — not present anywhere in the compiled `StructureDefinition`. Confirmed it doesn't even match what the IG's own example bundles emit (`"degrees"`, `"score"`) — further evidence it was never grounded in anything authoritative.

## Decision

1. **Fix `Observation.category` on 45 of the 47 derived Observation profiles** in FSH (`* category = <system>#<code> "<display>"`, using the one consistent value each profile's `PROFILE_METADATA` entry already assigned: `exam`/`survey`/`social-history`/`imaging`, all `http://terminology.hl7.org/CodeSystem/observation-category`). Compiles to a `patternCodeableConcept` on `Observation.category`, structurally identical to how `Observation.code` already compiles.

2. **Exception: `TearSizeObservation` and `TearSizeClassificationObservation` are excluded from the category fix.** Discovered live during rollout — `sushi .` flagged a real conflict against this IG's own pre-existing `RotatorCuffSurgeryBundle` example, not just the expected redundant-duplicate case. Both profiles' own FSH description text says the underlying measurement can come from "MRI **or intra-operative** measurement," and the Surgery-bundle example demonstrates exactly that (`ExampleIntraOpTearSize`/`ExampleIntraOpTearSizeClassification` use `category = exam` for a genuinely intra-operative direct measurement, where a Registration-flow, pre-op-MRI-derived instance of the same profile would legitimately need `category = imaging`). For these two profiles alone, category is a property of *how the value was acquired*, not a constant property of the concept — hard-fixing it would incorrectly foreclose a real, already-demonstrated use case. They remain at the inherited `1..* MS` preferred binding; the frontend continues to supply `category` for these two from flow context, same as it implicitly does today.

3. **Replace `sdc-frontend/src/lib/extractor.ts`'s static `PROFILE_METADATA` with a runtime resolver** (`profileMetadataParse.ts` + `profileMetadataResolver.ts`) that reads `code`/`category`/`ucumCode` directly from the compiled `StructureDefinition` HAPI already serves, falling back to a direct `CodeSystem` resource read (not `$lookup` — ADR-0063 precedent: HAPI's Lucene search index is wiped every restart, so a search-index-backed operation can return empty post-restart; these local CodeSystems are `content: complete` and fully enumerated, so a plain resource read is both simpler and more robust) for local-CS displays not inlined in the profile, and a live `CodeSystem/$lookup` only for the one SNOMED-coded exception (`constant-score-observation`). Resolution is prefetched once when the Questionnaire loads (mirroring the existing ValueSet-prefetch lifecycle), not performed mid-submission — `extractResources()` stays synchronous, gaining one parameter (the resolved map). Full design in the accompanying implementation.

4. **Drop the `Quantity.unit` human-string field entirely**; keep only `ucumCode` (also read from the compiled `StructureDefinition`'s `Observation.value[x].code` pattern). `ucumCode`+`system` already fully identifies the measurement; `unit` had no authoritative source and didn't even match this IG's own example bundles.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Drop `Observation.category`'s `1..* MS` requirement instead of fixing it | Doesn't eliminate the underlying classification fact, just relocates it to every future consumer's own private mapping — worse than one table in one place. Category is a genuinely useful, standard FHIR query/filter axis (`GET /Observation?category=exam&patient=X`) that a research registry should keep. |
| Force one category value for `TearSizeObservation`/`TearSizeClassificationObservation` and edit the conflicting example to match | Would have papered over a real, already-demonstrated dual acquisition context (imaging pre-op vs. intra-operative exam) that this IG's own example bundle deliberately encodes. The conflict was signal, not noise. |
| StructureMap-based extraction (SDC's heaviest mechanism) | Bakes fixed values into a FHIR Mapping Language script instead of a TS table — genuinely more principled, but a substantially larger engineering lift (FML authoring + execution engine) than this fix, for a single-anatomy thesis IG. Considered and rejected for the same reasons ADR-0021 originally rejected it. |
| Keep a static fallback string for the one SNOMED display instead of a live `$lookup` | Considered; the more thorough option (live `$lookup`, already transparently proxied by HAPI to `tx.fhir.org` per ADR-0050) was chosen instead, since it's still just one more call to HAPI with no new external dependency shape, and fully closes the gap rather than leaving one documented exception. |

## Consequences

✅ Closes the exact interoperability gap ADR-0102 named explicitly — `Observation.code` and (for 45/47 profiles) `Observation.category` are now genuinely derivable from the published IG artifacts, not a private, hand-maintained table.
✅ The confirmed drift bug (18/39 local-CS displays wrong) is structurally impossible going forward — there is only one place a display string can live.
✅ `Observation.category` is strengthened using the same base+derived pattern already established for `code` (ADR-0008) — closing a real modeling looseness where two independently-conformant clients could previously disagree about category for the same concept.
✅ Surfaced and correctly handled a genuine exception (`TearSizeObservation`/`TearSizeClassificationObservation`) rather than forcing a false uniformity — caught only by actually running `sushi .` against the IG's own existing example data, not by design review alone.
⚠️ `sdc-frontend` extraction now depends on HAPI being reachable for `StructureDefinition`/`CodeSystem` reads at Questionnaire-load time (prefetched, not mid-submission) — a new failure mode a static table never had. Handled via a visible, submit-blocking banner (mirroring the existing Questionnaire-fetch failure treatment), not a silent drop.
⚠️ The unified frontend (`../frontend/`)'s parallel, independent instance of the same duplication (`OBSERVATION_CODINGS`/`OBSERVATION_PROFILE_URLS` in `frontend/src/types/fhir.ts`) is untouched — a known, separate gap, out of scope here.
⚠️ `TearSizeObservation`/`TearSizeClassificationObservation` remain the two profiles where category must still be supplied by the frontend from flow context — not a regression, since this is exactly what real usage already required; just not closed by this change.

## Sources

- Live session trace: real Questionnaire fetched from the deployment server HAPI, real `extractor.ts`/`bundleAssembler.ts` driven via a standalone `npx tsx` script, real bundle submitted through `validator-service` (port 3500) and the exact `tools/validate.sh` invocation — both independently reproduced the `jobe-test` `Wrong Display Name` error.
- `ig/input/fsh/codesystems/ShoulderObservation.fsh:89` — authoritative display (`"Jobe Test (Empty Can)"`) vs. `sdc-frontend/src/lib/extractor.ts`'s then-hardcoded `'Jobe test result'`.
- `ig/input/fsh/profiles/ShoulderObservation.fsh:35-36` — the abstract parent's `category 1..* MS` / preferred binding.
- `ig/input/fsh/profiles/observations/TearSizeObservation.fsh`, `TearSizeClassificationObservation.fsh` — description text naming both acquisition contexts.
- `ig/input/fsh/examples/RotatorCuffSurgeryBundle.fsh` (`ExampleIntraOpTearSize`, `ExampleIntraOpTearSizeClassification`) — the live example that surfaced the category exception.
- ADR-0008 — base + derived Observation profile pattern, mirrored here for `category`.
- ADR-0050 — HAPI's SNOMED `remote_terminology_service` delegation, reused for the one live `$lookup` case.
- ADR-0063 — direct-resource-read-over-operation precedent, reused for local-CodeSystem display resolution.
- ADR-0102 — named this exact gap as Consequence #5; closed by this ADR.
