# ADR-0004: SUSHI/FSH + IG Publisher as authoring toolchain

**Date:** 2026-04-16
**Status:** Accepted

## Context

The IG must produce:
1. Machine-readable FHIR JSON artifacts (StructureDefinitions, CodeSystems, ValueSets) for upload to HAPI
2. A human-readable HTML IG for thesis publication and peer review

The toolchain must be compatible with FHIR R4 and the German base profile ecosystem.

## Decision

Use **FHIR Shorthand (FSH)** as the IG authoring language, compiled by **SUSHI** (FHIR Shorthand Implementation) to FHIR JSON, then processed by the **HL7 FHIR IG Publisher** to produce the HTML IG.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Hand-authored FHIR JSON | Verbose; error-prone; no diff-friendly source of truth; impractical for 9 base + 27 derived profiles |
| Forge (GUI profile editor) | Produces JSON directly; no text-based source for version control; poor support for derived profile hierarchies |
| Simplifier.net (cloud authoring) | External service dependency; requires account; not self-hosted; less suitable for a local thesis workflow |
| Custom FHIR Profile Generator | Unnecessary complexity; FSH/SUSHI is the HL7-endorsed standard |

## Consequences

✅ FSH is the HL7-endorsed authoring language; SUSHI is the reference compiler  
✅ Human-readable, diff-friendly FSH source under version control  
✅ IG Publisher produces a standards-conformant HTML IG (same toolchain used by HL7 official IGs)  
✅ SUSHI enforces FSH syntax and cross-reference integrity at compile time  
✅ Tab-separated snapshot view enabled via `sushi-config.yaml` (`tabbed-snapshots: true`)  
⚠️ IG Publisher (`_genonce.sh`) is slow (several minutes per run); `--skip-genonce` flag exists for iteration  
⚠️ IG Publisher requires Java on the host; Docker-based build preferred to avoid path/dependency issues  
⚠️ SUSHI compiles FSH → JSON but does not validate against HAPI; a separate `load-profiles.sh` step is required  

## Sources

- `ig/sushi-config.yaml` — full IG metadata and SUSHI configuration
- `ig/_genonce.sh` — IG Publisher invocation script
- `ig/input/fsh/` — all FSH source files
- `build-and-deploy.sh` — Step 0 (clean) → sushi compile → IG Publisher → Docker
- Local toolchain configuration — `sushi .` and `_genonce.sh` as the sanctioned build commands
