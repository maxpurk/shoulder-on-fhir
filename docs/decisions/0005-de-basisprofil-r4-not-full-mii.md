# ADR-0005: de.basisprofil.r4 only (not full MII stack)

**Date:** 2026-04-16
**Status:** Superseded by ADR-0022

## Context

The German FHIR ecosystem has a layered dependency structure:

```
hl7.fhir.r4.core (4.0.1)
    └── de.basisprofil.r4 (1.5.0)           ← German base profiles
            └── de.medizininformatik-initiative.kerndatensatz  ← MII KDS (hospital use case)
                    └── [Shoulder on FHIR — this IG]
```

This IG targets two registries: DVSE (Germany) and SECEC (European). SECEC is a multi-national registry with participating institutions in France, Belgium, the Netherlands, Spain, and the UK, among others. The IG's broader interoperability horizon is the EU European Health Data Space (EHDS), whose implementing acts are due March 2027 with primary use mandatory by March 2029.

MII (Medizininformatik Initiative) Kerndatensatz and ISiK (gematik's Interoperabilitätsstandard im Krankenhaus) are German hospital infrastructure standards. They mandate elements that are undefined or inapplicable outside the German statutory health insurance system — most critically, a GKV/PKV Versicherungsnummer (`Patient.identifier` sliced `1..1` for German insurance identifiers), OPS procedure codes (German procedure classification, not used outside Germany), and ICD-10-GM (the German modification of ICD-10, diverging from ICD-10-WHO used elsewhere in Europe). Adopting these as parent profiles would make the IG structurally non-conformant for any non-German institution submitting to SECEC.

`de.basisprofil.r4` is the last layer in the German stack that remains compatible with international use: it adds German-relevant identifier types and address formats as optional elements without mandating German-only identifiers as required.

During early development, MII profile URLs were also tested as parent profiles for `ShoulderPatient`, `RotatorCuffCondition`, and `ShoulderProcedure`. This confirmed the scope mismatch: HAPI returned HTTP 422 errors because MII name slicing rules on `Patient.name` and `Patient.identifier` could not be satisfied by research registry data lacking German insurance identifiers.

## Decision

Depend on **`de.basisprofil.r4 1.5.0`** only (not the full MII Kerndatensatz). All profiles use R4 base resource types or `de.basisprofil.r4` types as parents.

MII alignment is documented as a future step in the thesis.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Full MII Kerndatensatz dependency | MII mandates German-only identifiers (GKV/PKV Versicherungsnummer `1..1`), OPS procedure codes, and ICD-10-GM — structurally inapplicable to non-German SECEC members and wrong abstraction level for a European research registry. Additionally confirmed by HAPI HTTP 422 snapshot errors when MII parent profile URLs were tested (commit e61c2ac) |
| ISiK (gematik) dependency | ISiK is German hospital infrastructure; even more narrowly scoped than MII (German statutory hospital interoperability mandate). Explicitly not applicable to research registries or cross-border use |
| No base profile dependency (plain R4) | Loses German-relevant alignment (identifier system URLs, address formats) useful for DVSE and future EHDS compatibility |
| Partial MII dependency (single module only) | Inconsistent; MII modules share slicing assumptions — adopting one without others produces an incoherent dependency graph |

## Consequences

✅ HAPI snapshot generation succeeds; `$validate` passes for all profiles  
✅ Simpler dependency graph (one package, not five MII modules)  
✅ Correct abstraction level for a European research registry — conformant for DVSE (DE) and SECEC (EU) members alike  
✅ Compatible with EHDS interoperability horizon (EU-wide, not DE-hospital-specific)  
✅ German identifier types and address formats still available via `de.basisprofil.r4` for DVSE use  
⚠️ Not directly deployable as a hospital EHR integration profile in German university hospitals that enforce MII KDS — this is an intentional trade-off, not a deficiency. A Germany-specific conformance layer on top of this IG (reparenting to MII profiles) is a documented future step for German hospital deployments specifically  

## Sources

- git commit `e61c2ac` — "fix: resolve IG/frontend contradictions and wire up end-to-end HAPI validation" — changed parent from MII profile URLs to base R4 types to resolve HTTP 422 failures
- `ig/sushi-config.yaml` — `dependencies: de.basisprofil.r4: 1.5.0`
- the FHIR landscape analysis — German FHIR dependency stack analysis and MII scope discussion
