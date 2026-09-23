# ADR-0056: Smoking VS rebound to IPS CurrentSmokingStatusUvIps (LOINC-encoded) + IPS package loader

**Date:** 2026-05-22
**Status:** Accepted

## Context

`SmokingStatusObservation` (SECEC Hurley Q1.d, unanimous consensus) was introduced by ADR-0027 (May 2026) with:

- `Observation.code = LOINC#72166-2` (Tobacco smoking status) — correct, matches IPS `Observation-tobaccouse-uv-ips`
- `valueCodeableConcept from SmokingStatus (required)` — local 4-code SNOMED ValueSet (`266919005`, `77176002`, `8517006`, `266927001`)

Three problems with that state, surfaced during the 2026-05-22 element-by-element CSV walkthrough:

1. **Inconsistency with Q1.c.** ADR-0055 (same day) bound `ShoulderComorbidityCondition.code` `extensible` to an IPS canonical (`ProblemsSnomedAbsentUnknownUvIps`). Keeping smoking on a 4-code local VS at `required` strength meant two patient-history elements with the same Hurley unanimous-consensus pedigree had inconsistent VS-governance patterns. The thesis Discussion would have to explain why one element gets IPS alignment and the next does not.

2. **`required` is the wrong strength for a small SNOMED list.** US Core 5.0.1 ships 8 codes for smoking status (the 4 we had plus daily/occasional/heavy/light); IPS 1.1.0 also ships 8 codes. A `required` binding to our 4 codes excludes valid finer-grained encodings — for example, a clinician who wants to record "heavy tobacco smoker" would fail validation despite the concept being clinically meaningful and present in both IPS and US Core.

3. **The "captured per the US Core Smoking Status pattern" claim in the FSH description was overstated.** The IG used 4 codes; US Core has 8 and uses LOINC LA-codes, not SNOMED. The description still referenced the old `SECEC Q1.4` numeric notation (Hurley uses letter notation `Q1.a` … `Q1.l` per the current mapping).

The straightforward fix on the walkthrough was "mirror Q1.c — extensible-bind to an IPS canonical and drop the local VS." Implementing this surfaced a **second, larger issue**.

### The HAPI runtime-resolution discovery

ADR-0055 stated (§Consequences):

> Typeahead works against `tx.fhir.org` with **zero** new seed-loader plumbing. The frontend hits `$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips&filter=hyper&count=20`; HAPI proxies to `tx.fhir.org` (per ADR-0050) which serves the IPS VS by SNOMED expansion.

Empirical test against the running HAPI on 2026-05-22, after ADR-0055 was accepted:

```
$ curl ".../ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips&filter=hypertension"
{ "resourceType": "OperationOutcome",
  "issue": [{ "severity": "error",
              "diagnostics": "HAPI-2788: Unknown ValueSet: ..." }] }
```

Both IPS VSs (the Q1.c comorbidity VS and the Q1.d smoking VS) returned `HAPI-2788: Unknown ValueSet`. **The Q1.c comorbidity typeahead was already broken at runtime** — the implementation passed CI (because `tools/validate.sh` uses `tx.fhir.org` directly and resolves the canonical there) but no one tested the live frontend after deploying.

Two corrections to ADR-0055's reasoning:

- `remote_terminology_service.snomed` in `hapi/application.yaml` delegates *terminology operations on a specific CodeSystem* (`http://snomed.info/sct` — `$validate-code`, `$lookup`, expansion member resolution). It does **not** resolve external *ValueSet resources* by canonical URL. HAPI looks for the VS in local storage first; if absent, the request fails with `HAPI-2788`. The remote service is consulted later — once the VS is found and HAPI needs to validate / look up specific SNOMED codes referenced by `compose.include`.
- `tx.fhir.org/r4` does not host the IPS VSs at their canonical URL anyway. Direct `curl https://tx.fhir.org/r4/ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/...` returns `"ValueSet not found: ..."`. So even if HAPI did transparently proxy `$expand`, the underlying tx server wouldn't help.

So IPS VSs must be loaded as resources into HAPI's storage. With them loaded, HAPI expands `compose.include[].concept` locally and uses the existing `remote_terminology_service.snomed` delegation only for SNOMED *displays* when needed — the path that's actually inside `remote_terminology_service`'s contract.

### The published-VS-is-LOINC discovery

The third surprise. The IPS FSH source in IPS's `CurrentSmokingStatusUvIps.fsh` source enumerates **SNOMED** codes (`8517006`, `266919005`, etc.). The published IPS@1.1.0 package at `https://packages.fhir.org/hl7.fhir.uv.ips/1.1.0` ships the same VS with **LOINC LA-codes** instead (`LA18976-3` Current every day smoker, `LA15920-4` Former smoker, `LA18978-9` Never smoker, etc., 8 total). The package also ships a `loinc-smoking-status-to-snomed-ct-uv-ips` ConceptMap — the IPS authoring path is "publish in LOINC; provide a downstream ConceptMap for exporters that need SNOMED."

Under an `extensible` binding to the published VS, the `valueCodeableConcept` MUST include at least one coding from the bound VS. A SNOMED-only Observation (which is what `SmokingStatusObservation` produced before this ADR) would fail extensible binding. The choice: switch to LOINC, dual-code (LOINC primary satisfies binding + SNOMED secondary), or downgrade binding strength.

This IG adopts the published IPS encoding directly (LOINC LA-codes). Dual-coding would replicate IPS's ConceptMap inline for no FHIR-conformance benefit — exporters that need SNOMED can run the ConceptMap at export time. US Core 5.0.1 takes the same LOINC-LA-only stance. The thesis-defense story is symmetric across Q1.c and Q1.d:

| Element | IPS VS | IPS-published encoding | IG encoding |
|---|---|---|---|
| Q1.c Comorbidities | `ProblemsSnomedAbsentUnknownUvIps` | SNOMED (ECL `< 404684003 \|Clinical finding\|`) | SNOMED |
| Q1.d Smoking | `CurrentSmokingStatusUvIps` | LOINC (8 `LA*` codes) | LOINC |

Different terminologies fall out of different IPS authoring choices — the meta-principle ("use the IPS-published encoding") is consistent.

## Decision

1. **Add `seed/load-ips-package.sh`** as a new step in the seed pipeline (between `load-uv-extensions.sh` and `load-profiles.sh`). Downloads `hl7.fhir.uv.ips@1.1.0` (~80 KB) to `seed/.fhir-ips-cache/`, extracts, and PUT-by-id uploads CodeSystem (1) → ValueSets (60) → StructureDefinitions (36), 97 resources total. Skips ConceptMaps / CapabilityStatement / OperationDefinition / ImplementationGuide (not load-bearing). Idempotence canary: `ValueSet/current-smoking-status-uv-ips`. Post-load verify: the canary VS must resolve **and** `$expand` must return ≥ 1 concept (catches the failure mode where the VS is loaded but the SNOMED-system codes in `compose.include` aren't resolvable through `remote_terminology_service`).

2. **Wire `load-ips-package.sh` into `build-and-deploy.sh`** as the new stage-2 step 4. Update the file-level commentary in `seed/load-base-profiles.sh` / `load-eu-base-profiles.sh` / `load-uv-extensions.sh` / `load-profiles.sh` to list the new step in run-order documentation. Add the idempotence canary line to the master the project guide (the four-script list becomes five).

3. **Rebind `SmokingStatusObservation.valueCodeableConcept`** in `ig/input/fsh/profiles/observations/SmokingStatusObservation.fsh`:
   - From: `from SmokingStatus (required)`
   - To: `from http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips (extensible)`
   - Strength tightened from IPS's `preferred` to `extensible` for the same registry-comparability reason documented in ADR-0055 §"Why extensible, not preferred". `extensible` means a SNOMED concept can still appear as `coding[1]` (additional sibling) — only `coding[0]` (or any one entry) must be from the IPS VS.

4. **Delete `ig/input/fsh/valuesets/SmokingStatus.fsh`**. The local 4-code SNOMED VS is no longer referenced by any profile or Questionnaire. Its `$expand` was returning the 4 codes via HAPI's local resolution; nothing now relies on it.

5. **Update `ShoulderRegistrationQuestionnaire.fsh`** `item[5].item[0].answerValueSet` from the local canonical to `http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips`. SDC-conformant Questionnaire item now uses the same VS the underlying profile binds to.

6. **Frontend rewiring** (unified, port 3000):
   - `frontend/src/types/fhir.ts` `VALUESET_URLS.SMOKING_STATUS` → IPS canonical
   - `frontend/src/config/observationMetadata.ts` `smoking-status.valueSetUrl` → IPS canonical, `codeSystem` → `http://loinc.org`
   - `frontend/src/components/wizard/StepPatient.tsx` line 159 — replace hard-coded `system: 'http://snomed.info/sct'` with `system: smokingOption?.system` (now resolves to LOINC via VS expansion)

7. **Example-data migration** (4 locations, SNOMED → LOINC, semantically equivalent):
   - `example_data/anna_mueller_01_registration.json`: SNOMED `8517006` "Former smoker" → LOINC `LA15920-4` "Former smoker"
   - `seed/bundles/example-patients.json` Patient-1 smoking Observation: SNOMED `77176002` "Smoker" → LOINC `LA18976-3` "Current every day smoker" (text already said "Current daily smoker")
   - Patient-1 QuestionnaireResponse answer: same migration
   - Patient-2 smoking Observation + QR answer: SNOMED `266919005` "Never smoked tobacco" → LOINC `LA18978-9` "Never smoker"
   - Patient-3 smoking Observation + QR answer: SNOMED `8517006` "Ex-smoker" → LOINC `LA15920-4` "Former smoker"

8. **CSV row Q1.d updated**: `Terminology Binding` → IPS canonical; `Binding Strength` → `extensible`; `Notes` rewritten to capture the 8 LOINC LA codes and the IPS-published-encoding rationale; `IG Implementation` rewritten to reference the IPS canonical and the new seed loader; `Coverage Status` remains `Full` (the encoding switch tightens the conformance claim, doesn't change it).

9. **Retroactive fix for Q1.c.** The new `load-ips-package.sh` script also installs `problems-snomed-absent-unknown-uv-ips` — closing the latent runtime bug in ADR-0055's comorbidity typeahead. Empirically verified post-load: `$expand?url=...&filter=hypertension` now returns SNOMED concepts via the existing `remote_terminology_service.snomed` delegation. **ADR-0055's "zero plumbing" claim in §Consequences is superseded by this ADR; the operational requirement is the IPS package loader.**

## Why LOINC-only, not dual-coding

The user explicitly considered dual-coding (LOINC primary satisfies binding + SNOMED secondary preserves clinical-finding semantics) and rejected it for v1:

- **The IPS ConceptMap exists for exactly this.** `loinc-smoking-status-to-snomed-ct-uv-ips` is shipped in the IPS package precisely so exporters that need SNOMED downstream can apply the mapping at export time. Replicating that map inline as `coding[1]` is duplicate authoring effort with no FHIR-conformance benefit.
- **US Core takes the LOINC-only stance.** US Core 5.0.1's `Observation.valueCodeableConcept` "SHALL include a code from the Smoking Status value set" — the answer-list is LOINC-LA. Dual-coding is permitted but not encouraged.
- **8 concepts is too small a list to justify dual-coding infrastructure.** A LOINC→SNOMED frontend lookup table for 8 codes is overengineering; the concept map is a runtime translation layer, not a structural pattern for the registry.
- **Honest claim.** "We adopt IPS's published smoking encoding" is the cleanest defensible position. Saying "we extend IPS with inline SNOMED" weakens the alignment narrative.

The trade-off: the IG no longer encodes smoking in SNOMED at all. Downstream consumers (a German national tumor-registry export, say, where SNOMED is preferred) must apply the IPS ConceptMap at their boundary. Documented here so it's explicit.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the local SmokingStatus VS, expand from 4 → 8 SNOMED codes, relax `required` → `extensible` | Doesn't solve the inconsistency-with-Q1.c problem. The IG would maintain its own SNOMED VS in parallel with the IPS-published VS, the conformance claim would be "IPS-inspired" rather than IPS-aligned, and any future IPS change requires manual sync. The local VS adds an artifact for no contribution the IG uniquely makes. |
| Bind to IPS VS but keep SNOMED encoding in example data + frontend | Fails `extensible` binding. The validator (whether `tools/validate.sh` against `tx.fhir.org` or the runtime sidecar) would flag every smoking Observation as warning: "None of the codings provided are in the value set." Could downgrade to `preferred` to make the warnings go away, but that re-introduces the Q1.c-inconsistency objection that motivated this ADR. |
| Dual-code LOINC + SNOMED inline | Best-of-both-worlds aesthetically; over-engineering structurally (see §Why LOINC-only above). |
| Stay on US Core's `us-core-smoking-status` ValueSet | US Core 5.0.1's VS canonical is `http://hl7.org/fhir/us/core/ValueSet/us-core-smoking-status`. Loading the US Core package into HAPI for one VS would parallel the IPS loader but add a US-jurisdiction dependency to a European-EHDS-scoped IG (ADR-0022). IPS is the international neutral choice and is already a sushi-config dependency (ADR-0055). |
| Load only the smoking VS JSON file as a one-off (skip the full IPS package) | Diverges from how every other reference IG is loaded (whole package). Brittle if a future profile needs another IPS resource — would require touching the loader each time. The full IPS package is ~80 KB and uploads in < 5 s; the cost of "loading everything" is negligible. |

## Consequences

✅ Q1.d remains `Full`, now with a profile binding that's actually validator-enforceable and consistent with Q1.c's IPS-alignment pattern.

✅ ADR-0055's broken comorbidity typeahead is retroactively fixed by the same seed loader — no separate change needed. Q1.c becomes genuinely operational at runtime, not just in CI.

✅ Five-step seed pipeline (was four). New canary: `ValueSet/current-smoking-status-uv-ips`. Each loader's run-order commentary is updated; `seed/load-ips-package.sh` follows the EU-base / UV-extensions pattern (download + extract + PUT-by-id + post-load verify). Cold-start cost: ~3 s added (97 PUT calls over keep-alive connection).

✅ HAPI's `remote_terminology_service.snomed` delegation continues to work as designed — it fills in SNOMED *concept* metadata for the SNOMED codes referenced in IPS's `ProblemsSnomedAbsentUnknownUvIps` compose. The loader and the remote service play complementary roles: the loader resolves *VS canonicals* via local storage; the remote service resolves *SNOMED-system code lookups*.

⚠️ Existing data in HAPI that encoded smoking in SNOMED (pre-`--clean` runs) becomes nonconformant under the new binding. The example data is migrated. Real registries running this IG would need to apply the IPS ConceptMap during a one-time data migration; documented but not scripted here (out of scope for v1 of the IG).

⚠️ SDC frontend extractor (`sdc-frontend/src/lib/extractor.ts`) already encodes `Observation.code` as LOINC `72166-2`; no extractor changes needed. The SDC Questionnaire's `answerValueSet` now points at the IPS canonical (this ADR); SDC client `$expand` against the unified-frontend HAPI works identically.

⚠️ ADR-0055 §Consequences ("zero new seed-loader plumbing") is now factually wrong. Not a structural error — the binding decision in ADR-0055 stands — but the operational footprint is one seed-loader script larger than ADR-0055 promised. Future re-readers of ADR-0055 should cross-reference this ADR's §Context "HAPI runtime-resolution discovery" before quoting that line.

❌ The IG no longer carries any local SNOMED-coded smoking encoding. Downstream exporters that need SNOMED apply IPS's `loinc-smoking-status-to-snomed-ct-uv-ips` ConceptMap at their boundary. This is the standard FHIR pattern but worth flagging — a German national-registry integration project would need to run the map.

## Sources

- IPS@1.1.0 package: `https://packages.fhir.org/hl7.fhir.uv.ips/1.1.0` (~80 KB tgz)
- IPS canonical: `http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips` (8 LOINC LA codes)
- LOINC codes verified against `https://fhir.loinc.org/CodeSystem/$lookup` on 2026-05-22
- ADR-0027 (introduced SmokingStatusObservation with local 4-code SNOMED VS), ADR-0050 (HAPI delegates SNOMED to tx.fhir.org), ADR-0055 (Q1.c IPS extensible pattern + the runtime-resolution claim this ADR contradicts)
- HAPI runtime-resolution test transcripts: `HAPI-2788: Unknown ValueSet` for both IPS VSs prior to loading; `8 concepts returned` for `current-smoking-status-uv-ips/$expand` after loading
- The IPS FSH source for `CurrentSmokingStatusUvIps` — note this FSH source shows SNOMED codes; the **published** package JSON ships LOINC. The divergence is the trigger for §Context "The published-VS-is-LOINC discovery".
