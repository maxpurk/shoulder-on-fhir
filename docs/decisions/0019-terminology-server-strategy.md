# ADR-0019: Terminology server strategy — HAPI as local term server, no dedicated SNOMED CT server

**Date:** 2026-05-04
**Status:** Accepted

## Context

The IG uses two categories of coded terminology:

1. **Custom CodeSystems** (5 total — Goutallier, Patte, ShoulderObservationCodes, SatisfactionScale, ReturnToActivity) hosted under the HPI canonical URL. These exist because no verified standard code was found during authoring (see ADR-0010).

2. **Standard SNOMED CT codes** referenced by the canonical system URL `http://snomed.info/sct` for: laterality (`ShoulderLaterality`), rotator cuff diagnoses (`RotatorCuffDiagnosis`), tendon anatomy (`TendonsInvolved`), surgical procedures (`ShoulderProcedureType`), provocation test results (`PositiveNegative`), and hand dominance (`HandDominance` — codes `46669005`, `87683000`, `23088002`). These codes were verified during authoring via the `mcp-snomed-ct` MCP tool against the CSIRO Ontoserver (FHIR R4, `https://r4.ontoserver.csiro.au/fhir`).

The frontend uses HAPI's `ValueSet/$expand` operation to populate dropdowns dynamically (ADR-0011). The question is what serves as the terminology authority at runtime: a dedicated terminology server, or HAPI itself.

At IG Publisher build time, SNOMED CT validation is skipped via the `-tx na` flag in `_genonce.sh` (ADR-0014b) to allow offline builds.

At HAPI runtime, the SNOMED CT CodeSystem is **not loaded**. HAPI validates `required`-bound ValueSets by checking that submitted codes appear in the explicitly enumerated ValueSet members — not by traversing SNOMED CT hierarchy. For the custom CodeSystems, HAPI is the authoritative source (they are loaded via `load-profiles.sh`). For SNOMED codes, HAPI passes validation because the codes are explicitly listed in the ValueSet resources loaded from the IG.

## Decision

**Use HAPI FHIR as the sole runtime terminology server for this prototype.** Do not run a dedicated SNOMED CT terminology server (e.g., Snowstorm + Elasticsearch) alongside the existing infrastructure.

SNOMED CT codes are used **by reference** — the canonical system URL `http://snomed.info/sct` is declared in ValueSet resources, and specific codes are enumerated explicitly. HAPI validates those codes from the loaded ValueSet content, not from a SNOMED CT release. This is consistent with standard IG convention: IGs reference SNOMED CT by URL; they do not bundle the release files.

For production deployments (e.g., DVSE or SECEC registries), HAPI supports plugging in an external terminology server via:

```yaml
hapi:
  fhir:
    implementationguides:
      custom-terminology-server-url: https://r4.ontoserver.csiro.au/fhir
```

The CSIRO Ontoserver or a Snowstorm instance would be the appropriate backends. This is a one-line configuration change — no structural change to the IG or profiles is required.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Snowstorm (SNOMED International, open source) | Requires Elasticsearch, ~4–8 GB RAM, SNOMED CT RF2 import (~800 MB compressed, 30–60 min), and a SNOMED CT license. Operational overhead far exceeds the validation benefit for a thesis prototype where SNOMED codes are already verified at authoring time. |
| HAPI with full SNOMED CT RF2 import | HAPI supports `$upload-external-code-system` with RF2 files, but the index size, RAM requirements, and import time are impractical for a development docker-compose setup. `defer_indexing_for_codesystems_of_size: 101` would need to be removed or raised. |
| tx.fhir.org (HL7 public terminology server) | Available as an external service but introduces a network dependency on an external system not under project control — unsuitable for offline development and thesis demos. |
| Post-coordinated SNOMED expressions | Rejected in ADR-0014b: complex to author, HAPI does not validate post-coordination at R4 ingestion time, and SNOMED CT editorial guidance prefers pre-coordination. |

## Consequences

✅ No additional infrastructure — HAPI already runs; custom CodeSystems load in seconds via `load-profiles.sh`  
✅ SNOMED CT codes are correct at authoring time (verified via CSIRO Ontoserver MCP tool)  
✅ Architecture is terminology-server ready: a single HAPI config line connects a national SNOMED server for production  
✅ Consistent with how standard IGs (IPS, US Core, mCODE) handle SNOMED CT — by reference, not bundled  
⚠️ HAPI does not validate that SNOMED codes exist in the international release at ingestion time — only that they appear in the loaded ValueSet members  
⚠️ If a submitted resource uses a SNOMED code outside the enumerated ValueSet, HAPI will reject it (correct behavior) but cannot suggest valid alternatives from the SNOMED hierarchy  
⚠️ A production registry deployment must configure an external terminology server; this is documented here but not enforced by the prototype  

## Sources

- `hapi/application.yaml` — `defer_indexing_for_codesystems_of_size: 101`; no `custom-terminology-server-url` configured
- `ig/_genonce.sh` — `-tx na` flag (skip online terminology validation at IG Publisher build time)
- ADR-0010 — Custom CodeSystems for orthopedic terminology gaps; SNOMED queried via `mcp-snomed-ct` during authoring
- ADR-0011 — HAPI as runtime terminology server for `ValueSet/$expand`
- ADR-0014b — Pre-coordinated SNOMED CT body site codes; `-tx na` rationale
- `ig/input/fsh/valuesets/` — all ValueSet FSH files enumerating SNOMED codes explicitly

---

## 2026-05-20 amendment for the demonstrator's design-time gate (ADR-0049)

The §Alternatives row that listed `tx.fhir.org` as rejected reads "introduces a network dependency on an external system not under project control — unsuitable for offline development and thesis demos." That rejection is **amended** for **one specific role**: the FHIR Validator CLI invoked by `tools/validate.sh` (the design-time / CI conformance gate per ADR-0024 / ADR-0044) now defaults to `TX_SERVER=https://tx.fhir.org/r4` per ADR-0049. The motivating discovery was that the validator special-cases `http://snomed.info/sct` and refuses to bind-check SNOMED codes in `Questionnaire.answer.valueCoding` against the `-ig snomed_fragment.json` workaround — a case ADR-0048 did not anticipate (added by ADRs 0046 / 0047 in the same session). HL7 explicitly markets `tx.fhir.org` for IG-authoring / validation / development, which is the role being filled here. Offline mode is retained as an explicit fallback (`TX_SERVER=n/a`) and the SNOMED-in-QR limitation it produces is documented in ADR-0049 §Consequences.

**Unchanged by this amendment:**
- **Runtime / frontend `$expand`** — HAPI continues to serve IG ValueSets to both frontends (`ValueSet/$expand` per ADR-0011). The frontends do not call `tx.fhir.org`. HAPI does not need a SNOMED CT release loaded to enumerate the IG ValueSets, because every member is explicitly listed in the FSH ValueSet sources.
- **Production deployments** — Snowstorm and Ontoserver remain the production TX paths; the "no public TX as default" stance still applies to production. `tx.fhir.org` is a demonstrator / development convenience, not a production endpoint.
- **`seed/load-snomed-fragment.sh`** — retired in ADR-0050. The runtime SNOMED path for HAPI's `$expand` is now `hapi.fhir.remote_terminology_service.snomed → https://tx.fhir.org/r4/` (configured in `hapi/application.yaml`); HAPI forwards SNOMED-system code lookups to the public TX server and returns the real SNOMED concepts to the frontends. The local fragment workaround retained briefly in ADR-0049 §Decision §4 is no longer needed. Production deployments would swap the URL for a national / institutional TX server — one config line.

---

## 2026-05-20 amendment for IG Publisher build-time HTML rendering (ADR-0052)

The §Alternatives row that listed `tx.fhir.org` as rejected — already qualified by ADR-0049 for the validator CLI's design-time gate — is **further** qualified for a second role: the IG Publisher invocation in `build-and-deploy.sh` (`--genonce` stage) now defaults to `-tx https://tx.fhir.org/r4` per ADR-0052. The motivating symptom was a stream of `Expanding {ValueSet} : No server available` lines during every `--genonce` run, leaving the published IG site's SNOMED-bound ValueSet pages without their concept tables / display strings. The fix mirrors ADR-0049 in shape (env-var with `${VAR:-default}`, offline override via `IG_TX_SERVER=n/a`). The mention of `ig/_genonce.sh` and its `-tx na` flag (lines 16 and 59 above) remains accurate: the upstream HL7 template script is refreshed from upstream by `_updatePublisher.sh` and is intentionally untouched — `build-and-deploy.sh` controls the canonical invocation by bypassing `_genonce.sh` and running `publisher.jar` directly in Docker.

**Unchanged by this amendment:**
- **Runtime / frontend `$expand`** — same as ADR-0049: HAPI still serves IG ValueSets to the frontends (now with SNOMED delegated to `tx.fhir.org` per ADR-0050).
- **Production deployments** — Snowstorm / Ontoserver / national TX server remain the production path. `tx.fhir.org` is a demonstrator / development convenience.
- **`ig/_genonce.sh`** — the upstream HL7 template script's own adaptive online/offline detection (`curl -sSf tx.fhir.org`) continues to be correct for users invoking it directly outside of `build-and-deploy.sh`.
