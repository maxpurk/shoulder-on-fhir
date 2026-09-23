# ADR-0038: Soft alignment with HL7 Europe Base + Core (no re-parent)

**Date:** 2026-05-19
**Status:** Accepted
**Amends:** ADR-0022 — specifically the "Adopt a European base IG (e.g. IPS) as parent" alternative

## Context

HL7 Europe Base and Core FHIR IG v2.0.0 (package `hl7.fhir.eu.base`, FHIR R4, STU2) was published 2026-04-27, eight days before ADR-0022 was authored. ADR-0022 rejected adopting any European base IG on grounds that no common European clinical registry base IG existed. The infrastructure-level finding is outdated: EU Core publishes Patient / Condition / Procedure / Observation / DiagnosticReport profiles aligned with EHDS logical models (Xt-EHR). The registry-level finding remains correct — no European clinical *registry* base IG exists.

ADR-0001 commits the IG to EHDS readiness. The SECEC consensus (Hurley et al. 2024) motivates its data-element standardization with cross-border registry comparability — the same interoperability goal EU Core exists to serve. A declared, artifact-backed alignment with EU Core makes both claims concrete.

The companion analysis at the EU Base/Core alignment analysis (rev. 4) catalogues four options. This ADR encodes Option B.

## Decision

- Continue parenting all profiles from FHIR R4 base resource types. No mechanical inheritance from EU Core.
- Add `hl7.fhir.eu.base: 2.0.0` to `ig/sushi-config.yaml` as a non-parenting dependency.
- Constrain `ShoulderPatient.address` to the EU `Address` datatype: `http://hl7.eu/fhir/base/StructureDefinition/Address-eu`. The datatype is backward-compatible — existing addresses validate; the ISO 21090 ADXP extensions (street name, house number, postal box, country code) are optional.
- Add `condition-assertedDate` (`http://hl7.org/fhir/StructureDefinition/condition-assertedDate`, dateTime, 0..1, MS) as a named extension slice on `RotatorCuffCondition`. EU Core uses this extension on its Condition profile.
- Add `Procedure.recorded` (`http://hl7.org/fhir/5.0/StructureDefinition/extension-Procedure.recorded`, R5 backport, dateTime, 0..1, MS) as a named extension slice on `ShoulderProcedure`. EU Core uses this extension on its Procedure profile.
- Declare alignment in `sushi-config.yaml` `description:` and in `ig/input/pagecontent/index.md`.

### bodySite handling — Path A explicitly selected

EU Core's `Condition.bodySite` and `Procedure.bodySite` bind to `SNOMEDCTBodyStructures` (`http://hl7.org/fhir/ValueSet/body-site`) with strength **`preferred`**. Invariant `eu-bodysite-1` states: *"Either a body site code or a reference to a BodyStructure resource SHALL be used, but not both."* — i.e., EU Core defines two valid paths.

This IG selects **Path A**: precoordinated SNOMED shoulder body-structure codes (`91775009` "Structure of left shoulder region", `91774008` "Structure of right shoulder region") on `bodySite.coding`, per ADR-0014b. Both codes are members of SNOMEDCTBodyStructures; the binding is satisfied. The `siteLaterality-eu` value set is bound only on `BodyStructure.includedStructure.laterality` (Path B) and is not used here.

Path A is a deliberate design choice for a single-anatomy IG: precoordination collapses the constant-anatomy axis, preserves validator-enforceable single-code semantics, and aligns with LOINC ROM codes that bake the body region into the test code. Adopting Path B (a local `ShoulderBodyStructure` profile referenced from `bodySite.extension[bodySite]`) remains an open architectural option — *not* a correction of any non-conformance.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Option A — comparator only (no IG changes) | Forfeits the artifact-level alignment available at low cost; the EHDS-alignment claim in ADR-0001 stays rhetorical |
| Option C — Hurley-tied Patient demographic extensions and/or DiagnosticReport performer slicing | Patient extensions require frontend form changes; DiagnosticReport slicing requires a decision on local Practitioner/Organization profiling. Deferred for thesis-defence timeline; forward-compatible from Option B |
| Option D — full re-parent of the 5 feasible profiles | Mixed parentage with 6 profiles that have no EU counterpart; STU2 churn risk; relocates load-bearing constraints from parent to derived; "Observation: Medical Test Result" naming awkward for ROM/MMT/PROM |
| Swap `ShoulderLaterality` to `siteLaterality-eu` | Category error: `siteLaterality-eu` is bound on `BodyStructure.includedStructure.laterality`, not on `Condition.bodySite` or `Procedure.bodySite`. The two value sets never compete for the same slot. |
| Migrate `bodySite` to `Reference(BodyStructure)` (Path B) | Not required for EU conformance — Path A satisfies the preferred binding. Path B would supersede ADR-0014b, require a new `ShoulderBodyStructure` profile, refactor `bodySite` on Condition + Procedure + 35 derived Observation profiles, regenerate every example bundle, and coordinate frontend submissions. Out of scope for thesis defence; tracked as future architectural option |

## Consequences

- ✅ EHDS-alignment claim in ADR-0001 becomes concrete: cited dependency plus three artifact adoptions matching EU Core's modeling on Patient, Condition, and Procedure.
- ✅ Thesis §EHDS and §rw-eu-base gain a citable, verified posture statement.
- ✅ Zero validator pass/fail risk: existing example bundles continue to validate without edits. The new extensions are 0..1 optional; the `Address (EU)` datatype adds only optional ISO 21090 extensions.
- ✅ Zero frontend code changes: all three frontends already construct `bodySite` as SNOMED CT CodeableConcept (verified during planning), and `Patient.address` already populates the base FHIR fields.
- ✅ Forward-compatible with Options C and D if EU Core matures past STU2 and the IG grows in scope.
- ⚠️ The IG pins `hl7.fhir.eu.base: 2.0.0` exactly; future minor releases require manual review.
- ⚠️ Path B for bodySite remains an open architectural option, deliberately not adopted; documented for future revisitation.

## Sources

- the EU Base/Core alignment analysis (2026-05-19, rev. 4)
- HL7 Europe Base and Core FHIR IG v2.0.0 — https://hl7.eu/fhir/base/
- EU Core Condition profile — https://hl7.eu/fhir/base/StructureDefinition-condition-eu-core.html
- EU Core Procedure profile — https://hl7.eu/fhir/base/StructureDefinition-procedure-eu-core.html
- Hurley et al. — SECEC rotator cuff consensus (the consensus paper)
- ADR-0001 — FHIR R4 specification version
- ADR-0014b — Precoordinated SNOMED body site
- ADR-0022 — Remove de.basisprofil.r4 dependency
