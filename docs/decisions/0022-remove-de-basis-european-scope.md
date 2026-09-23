# ADR-0022: Remove de.basisprofil.r4 dependency — European scope

**Date:** 2026-05-05
**Status:** Accepted
**Supersedes:** ADR-0005

## Context

ADR-0005 justified depending on `de.basisprofil.r4 1.5.0` as the minimal German base layer that remained compatible with international use. The rationale was that it kept German-relevant identifier types and address formats available for DVSE deployments without imposing MII's Germany-only mandatory elements.

On closer inspection, even `de.basisprofil.r4` is a German national package. The IG's target audience is European: the primary registry scope is SECEC (participating institutions in France, Belgium, the Netherlands, Spain, the UK, and others), with EHDS compliance as a secondary horizon. A national base package as a dependency — even as a non-mandatory one — signals the wrong conformance level and creates an unnecessary coupling for non-German implementations.

Concretely:
- None of the IG's profiles actually inherit from a DE Basis profile type. The dependency was declared but unused in the inheritance chain.
- `de.basisprofil.r4` identifier system URLs (e.g. `http://fhir.de/sid/gkv/kvid-10`) are not referenced in any profile constraint.
- The `jurisdiction` field was set to `urn:iso:std:iso:3166#DE "Germany"`, contradicting the stated European scope.

## Decision

- Remove `de.basisprofil.r4: 1.5.0` from `sushi-config.yaml` dependencies.
- Change `jurisdiction` from `DE` to `http://unstats.un.org/unsd/methods/m49/m49.htm#150 "Europe"` (UN M49 code for Europe).
- All profiles continue to parent directly from FHIR R4 base resource types (`Patient`, `Observation`, `Condition`, etc.), which is the correct starting point for a pan-European IG without a common European base profile layer.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep `de.basisprofil.r4` as optional/unused dependency | Misleading: signals German conformance to tooling and implementers; adds a download dependency with no functional value |
| Inherit from DE Basis profile types (e.g. `patient-de-basis`) | Binds the IG structurally to German national identifiers and address patterns; non-German SECEC members cannot conform without extensions |
| Adopt a European base IG (e.g. IPS) as parent | IPS is a patient summary format, not a clinical registry base; wrong abstraction. No common European clinical registry base IG exists at this time |
| Remove jurisdiction entirely | UN M49 `#150` (Europe) is a recognized code for pan-European IGs and more informative than omitting the field |

## Consequences

✅ Dependency graph reflects actual conformance scope: plain FHIR R4, usable by any European institution  
✅ Jurisdiction metadata now consistent with SECEC/EHDS target audience  
✅ No functional change to any profile — the dependency was unused in the inheritance chain  
⚠️ German-specific identifier system URLs (GKV/PKV) are no longer available via an imported package; a future German deployment layer would need to re-add `de.basisprofil.r4` as a dependency if DE-specific identifier constraints are required  

## Sources

- `ig/sushi-config.yaml` — dependency and jurisdiction fields
- ADR-0005 — original rationale for `de.basisprofil.r4`; superseded by this decision
- ADR-0001 — FHIR R4 as the base specification
