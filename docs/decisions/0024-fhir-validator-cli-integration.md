# ADR-0024: FHIR Validator CLI for Offline Profile Validation

**Date:** 2026-05-06
**Status:** Accepted

## Context

Profile validation during development relied exclusively on HAPI FHIR's runtime validation: resources are rejected with `422 OperationOutcome` if they violate a loaded `StructureDefinition`. This approach has two weaknesses:

1. **Requires a running Docker stack.** Validation can only happen after `docker compose up`, HAPI startup (~60–90 s), and profile loading via `./seed/load-profiles.sh`. Catching a broken FSH example requires going through the full build loop.
2. **No validation of the IG package itself.** HAPI validates incoming resources; it does not validate that the IG's example instances conform to their declared profiles as part of the build.

The HL7 FHIR Validator CLI (`validator_cli.jar`) is the official HL7 reference validator. It can be pointed at an IG package (`ig/output/package.tgz`) or at the raw FSH-generated resources, and run against any FHIR instance without a running server.

## Decision

Add `tools/validate.sh` — a wrapper around `validator_cli.jar` — that:

- Downloads `validator_cli.jar` (~250 MB) from the official HL7 FHIR Core release on first use; caches it in `tools/`.
- Validates all example instances (`ig/fsh-generated/resources/`) and the seed bundle (`seed/bundles/example-patients.json`) against the IG profiles.
- Uses `ig/output/package.tgz` as the IG source when present (full build); falls back to `ig/fsh-generated/resources/` (fast/sushi-only build).
- Accepts flags: `--seed-only`, `--deep` (also validate StructureDefinitions), `--update-validator`.

Additionally, integrate `--validate` into `build-and-deploy.sh` as an optional flag that runs `tools/validate.sh` after the FSH compilation step (Stage 1.5), before Docker.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Rely solely on HAPI runtime validation | Requires running Docker; only catches violations on `POST`, not on FSH compilation |
| Use `sushi --check` | Sushi performs FSH → JSON compilation checks, not profile conformance validation |
| CI/CD pipeline validation (GitHub Actions) | Useful as a complement but not available offline; the local tool provides immediate feedback during development |
| HAPI Validator as a standalone server (`hapi-fhir-standalone-validator`) | Much heavier to set up than a single JAR; the CLI is the standard approach for IG development |

## Consequences

✅ Profile conformance errors caught at FSH compilation time, before any Docker interaction  
✅ Validates the seed bundle — the data actually loaded into HAPI during demos — against the `ShoulderRegistrationBundle` profile  
✅ `--deep` mode also validates the StructureDefinitions themselves, catching structural FSH mistakes  
⚠️ `validator_cli.jar` is ~250 MB; excluded from git via `.gitignore`; re-downloaded on a clean checkout  
⚠️ Requires Java 11+ on the developer machine  
⚠️ Validator output can be verbose; `validation-output/` directory (also gitignored) accumulates run logs  

## Sources

- `tools/validate.sh` — new validation wrapper
- `build-and-deploy.sh` — `--validate` flag integration
- The project guide — updated command reference
- HL7 FHIR Validator CLI: `https://confluence.hl7.org/display/FHIR/Using+the+FHIR+Validator`
