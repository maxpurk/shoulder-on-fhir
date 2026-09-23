# ADR-0048: FHIR Validator CLI runs with `-tx n/a` by default; HAPI is no longer used as the validator's TX server

**Date:** 2026-05-19
**Status:** Accepted (§Context diagnosis stands); §Decision §1 default amended by ADR-0049
**Builds on:** ADR-0019 (terminology server strategy — no public TX, codes verified at authoring time), ADR-0024 (FHIR Validator CLI as authoritative offline gate), ADR-0031 (HAPI loads `hl7.fhir.r4.core@4.0.1`), ADR-0044 (HAPI as pure storage; validator CLI is the authoritative conformance gate)
**Supersedes:** the validator-uses-HAPI-as-TX arrangement introduced by ADR-0031 / ADR-0044
**Amended by:** ADR-0049 (default flipped from `n/a` to `https://tx.fhir.org/r4`; HAPI-as-TX bug diagnosis in §Context retained)

## Context

The FHIR Validator CLI (`validator_cli.jar`) is the authoritative conformance gate per ADR-0024 and ADR-0044. `tools/validate.sh` ran it against the locally built `ig/output/package.tgz`, with `-tx http://localhost:8080/fhir/DEFAULT` pointing at the in-stack HAPI server. HAPI carries a SNOMED fragment CodeSystem (54 codes) loaded by `seed/load-snomed-fragment.sh` and the IG-bound ValueSets, so the validator could resolve required-bound SNOMED concepts without a public TX dependency. This satisfied ADR-0019's offline-first stance.

Validator CLI version **6.9.7** (released 2026-04-23) introduced a stricter startup check on its configured TX server: at `initializeValidator` it queries the server's CapabilityStatement, verifies a specific set of advertised features (the precise feature flags are not documented in the validator's user-facing output), and throws `TerminologyServiceException: "not approved for use with this software (it does not pass the required tests)"` if any are absent. HAPI FHIR JPA Server 8.8.0-1 (pinned by ADR-0042) does not advertise the required feature set. The validator now refuses to start whenever `-tx` points at HAPI — every `validate_file()` call crashes at engine init before reading a single resource.

The regression was masked for several hours because:
- `tools/validate.sh` writes validator output to `validation-output/<name>-result.json` and reports per-file status by checking whether that file exists.
- When the validator crashes before writing, the result file is **not** updated.
- Pre-existing result files from an earlier (working-validator) run remained on disk.
- The script's check `[ -f "$result_file" ]` succeeded against those stale files and reported their stale "OK" verdicts.
- Only resources added since the regression (e.g. `Observation-ExampleIntraOpTearSizeClassification` introduced in ADR-0047) had no stale result file and surfaced as `CRASH`.

Clearing `validation-output/` and re-running the validator made the actual state visible: **23 of 23 examples crashed**.

## Decision

1. **Change `tools/validate.sh` default to `TX_SERVER=n/a`.** The validator is invoked with `-tx n/a`. It resolves required-bound ValueSet membership from the IG package's enumerated members; SNOMED/LOINC concept-existence is not live-checked.

2. **Skip the TX reachability check when `TX_SERVER=n/a`.** The script no longer requires a running HAPI to validate.

3. **Allow override.** `TX_SERVER=https://tx.fhir.org/r4 ./tools/validate.sh` re-enables live terminology when desired (e.g. to verify a new SNOMED code that was added without authoring-time verification). The reachability check still applies for non-`n/a` values.

4. **Retain HAPI's SNOMED fragment + IG ValueSet loading.** Those serve the runtime frontends (`ValueSet/$expand` per ADR-0011) and any `Bundle/$validate` advisory pre-flight from the frontends — they are not removed.

5. **Update the project guide and the script header comment block** to reflect the new default and document the upstream regression.

This is consistent with ADR-0019's premise — "SNOMED CT codes are used by reference … the canonical system URL is declared in ValueSet resources, and specific codes are enumerated explicitly. HAPI validates those codes from the loaded ValueSet content, not from a SNOMED CT release." With `-tx n/a` the validator does the same thing the validator-via-HAPI did: validate against the enumerated VS members. Nothing meaningful is lost.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Pin validator_cli.jar to a pre-strict-TX-check version (e.g. 6.6.x) | Locks the project out of newer conformance rules. The download URL in `tools/validate.sh` fetches `latest`; pinning to a specific release adds a maintenance task. Doesn't fix the underlying API mismatch with HAPI. |
| Switch TX target to `https://tx.fhir.org/r4` | Adds a network dependency at every CI run; conflicts with ADR-0019's offline-first stance; slower; tx.fhir.org has rate limits. Reasonable as an optional override (point 3) but not as the default. |
| Bring up a Snowstorm or Ontoserver as TX | Out of scope for a thesis prototype: ~4–8 GB RAM, RF2 import, SNOMED license. Documented as the production path in ADR-0019. |
| Patch HAPI to advertise the features the validator requires | The validator's required feature set isn't publicly documented as a stable contract. Brittle. Out of scope. |
| File an issue / wait for upstream fix | The two parties have different opinions on what TX servers should advertise; resolution timeline unknown. Doesn't unblock current work. |
| Leave the regression in place | All 23 examples currently `CRASH`. The conformance gate is non-functional. Unacceptable. |

## Consequences

✅ `tools/validate.sh` runs again without any TX server up. CI-suitable, fast, offline.
✅ Aligns the default with ADR-0019's explicit stance ("No public TX, fully offline").
✅ Same membership-against-enumerated-VS semantics the validator-via-HAPI path provided.
✅ Recovers from validator version drift without pinning a JAR.
✅ Override remains for any future deployment that wants live TX (point 3).
⚠️ SNOMED/LOINC concept-existence is not live-checked at validate time. The compensating control is authoring-time verification per ADR-0010 / ADR-0019 / ADR-0027 (the official LOINC terminology server, using local credentials; SNOMED via a terminology server). Anyone adding new codes must verify at authoring; the validator will not catch a typo that points at a non-existent SNOMED concept the way a TX-connected run would.
⚠️ Validator warning output changes: each resource now emits "Unable to validate code 'X' in system 'Y' because the validator is running without terminology services" warnings for codes whose system is a real terminology (SNOMED, LOINC, UCUM). Expected; not actionable per resource.
⚠️ `seed/load-snomed-fragment.sh` and the per-ValueSet load remain in place because the **frontends** still rely on HAPI for `$expand` (ADR-0011). The TX role is split: HAPI for runtime UI expansion, `-tx n/a` for validator design-time checks.
❌ None — additive change to the default, fully backward-compatible via the `TX_SERVER` env var.

## Sources

- `tools/validate.sh` — `TX_SERVER="${TX_SERVER:-n/a}"`; reachability check gated by `[ "$TX_SERVER" != "n/a" ]`
- the project guide — section "FHIR Validation (standalone)" updated
- Validator stack trace observed today: `TerminologyClientContext.checkFeature` → `TerminologyServiceException` → `Unable to load validationEngine`
- Validator version: `FHIR Validation tool Version 6.9.7 (Git# 1ab4fece6bbe). Built 2026-04-23T18:56:07.101Z`
- ADR-0019 — "SNOMED CT codes are used by reference … HAPI validates those codes from the loaded ValueSet content, not from a SNOMED CT release"
- ADR-0044 — "FHIR Validator CLI (`tools/validate.sh`) is the authoritative conformance gate"
