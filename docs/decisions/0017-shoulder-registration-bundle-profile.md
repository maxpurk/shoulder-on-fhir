# ADR-0017: ShoulderRegistrationBundle profile added to the IG

**Date:** 2026-04-16
**Status:** Accepted — scope narrowed by ADR-0034 (2026-05-13); profile renamed by ADR-0066 (2026-06-07)

> **Rename update (2026-06-07, ADR-0066):** This profile was renamed `ShoulderRegistrationBundle` → `RotatorCuffRegistrationBundle` (kebab id `shoulder-registration-bundle` → `rotator-cuff-registration-bundle`). The bundle architecture and rationale below are unchanged; only the name moved.

> **Scope update (2026-05-13, ADR-0034):** The `procedure 1..*` slice has been removed from this profile. The surgical procedure now lives in a sibling profile `ShoulderSurgeryBundle`. Prior non-surgical treatments (Q1.6 PT, Q1.7 injection) remain in this bundle under a new `priorTreatment 0..*` slice with required category binding. New `serviceRequest` and `carePlan` slices have been added. The architectural rationale (bundle profile + `$validate` + IPS slicing pattern) described below is unchanged; only the entry composition has been narrowed. See ADR-0034 for the three-bundle architecture.

## Context

The IG defines nine resource profiles covering all clinical data elements for a rotator cuff registry submission. However, there was no artifact that defined what a *complete* registry submission looks like as a unit — which profiles are required, which are optional, and how they relate. Any conformant client could submit the nine resources individually or in any combination without violating the IG.

FHIR provides `Bundle` as the standard mechanism for grouping related resources into a single exchange unit. The IPS IG defines `BundleUvIps` using this pattern: a Bundle profile that slices `entry[]` and constrains each slice to a specific resource profile. This makes the expected composition machine-readable and validatable.

For a registry IG, the semantically appropriate bundle type is `#transaction` (atomic all-or-nothing submission), not `#document` (which requires a Composition and is designed for patient summary exchange, not registry writes).

## Decision

Add a `ShoulderRegistrationBundle` profile to the IG (`ig/input/fsh/profiles/ShoulderRegistrationBundle.fsh`):

- Type `#transaction` (exactly)
- Entry slicing by resource type + resource profile (IPS two-discriminator pattern)
- **Required entries:** `ShoulderPatient 1..1`, `RotatorCuffCondition 1..1`, `ShoulderProcedure 1..1`
- **Optional entries:** `ShoulderObservation 0..*`, `ShoulderImagingStudy 0..1`, `ShoulderDiagnosticReport 0..1`, `ShoulderCoverage 0..1`, `ShoulderQuestionnaireResponse 0..*`
- `entry.fullUrl 1..` (required for `urn:uuid` cross-references within the transaction)
- `entry ^slicing.rules = #open` (allows additional entries beyond the defined slices)

This profile is a **conformance specification artifact**, not a runtime constraint enforced by HAPI during transaction processing. HAPI validates each individual entry resource against its `meta.profile` claim; the bundle profile is validated two ways:

1. **Pre-submission via `$validate`** — the wizard calls `POST /Bundle/$validate?profile=<bundle-url>` before the actual transaction. HAPI evaluates the bundle structure (required slices, cardinality) and returns an `OperationOutcome`. Any `error` or `fatal` issues block submission and are surfaced to the user in `StepSummary`. Warnings are non-blocking.
2. **Out-of-band via FHIR validator CLI** — `java -jar validator.jar` for offline / CI validation against the full IG.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| `type: #document` bundle with Composition | Document bundles are designed for patient summary exchange (IPS use case), not registry writes. They require a Composition resource (table of contents) which adds overhead without registry value. |
| `type: #collection` bundle | No transaction semantics; semantically misleading for a registry submission. |
| No bundle profile — leave submission mechanism unspecified | Leaves the IG incomplete: implementers have no machine-readable definition of a conformant submission. Weakens the interoperability claim of the thesis. |
| Batch bundle (`type: #batch`) | No atomic semantics — individual entries can fail independently, leaving partial data in the registry. |

## Consequences

✅ The IG now answers "what does a complete conformant submission look like?" in machine-readable form  
✅ Ties all nine profiles together into a single named exchange artifact  
✅ Follows the established IPS bundle pattern (same two-discriminator slicing)  
✅ Directly supports the thesis research question on semantic interoperability  
✅ Validatable with `java -jar validator.jar` — demonstrable in the DSRM evaluation  
✅ `$validate` pre-submission catches missing required entries (patient/condition/procedure) before any data is written — bundle-level conformance is now interactive, not just offline  
⚠️ `$validate` does not resolve cross-entry references (resources don't exist yet); reference integrity is still only checked during the actual transaction  
⚠️ `#open` slicing means additional resources beyond the nine profiles are allowed — consistent with extensibility expectations for a research registry  
⚠️ **HAPI discards the bundle envelope after transaction processing.** Only individual resources are stored; `GET /Bundle` returns `total: 0`. There is no server-side record of which resources were submitted together. Post-hoc bundle-level validation requires reconstructing the bundle from stored resources. See ADR-0020 for detail.  
⚠️ No FHIRPath invariants are defined for observation categories. The SECEC paper (Hurley et al. 2024) treats all Q2-Q13 items as equally recommended — not ranked or mandatory individually — so no observation category can be justified as more required than another at the bundle level. See ADR-0020 for the full analysis.  

## Sources

- IPS's `BundleUvIps.fsh` source — IPS two-discriminator slicing pattern
- HL7 FHIR R4 Bundle specification — transaction semantics
- CREDS IG (Clinical Registry Extraction and Data Submission) — transaction bundle pattern for registries
- ADR-0008 — observation base + derived pattern (same IPS-aligned design philosophy)
