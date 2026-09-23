# ADR-0010: Custom CodeSystems for specialized orthopedic terminology

**Date:** 2026-04-16 (refined 2026-05-11 — see ADR-0027)
**Status:** Accepted

## Context

Several concepts required by this IG have no verified equivalent in standard international terminologies (SNOMED CT, LOINC, ICD-10-GM, OPS, UCUM):

| Concept | Standard searched | Finding |
|---------|------------------|---------|
| Goutallier fatty infiltration grades 0–4 | SNOMED CT | No pre-coordinated code for graded fatty infiltration scale |
| Patte tendon retraction stages I–III | SNOMED CT | No pre-coordinated staging codes |
| 5-point patient satisfaction scale | LOINC, SNOMED CT | Generic satisfaction codes exist but none for the specific 5-point post-surgical scale used in SECEC |
| Return-to-activity status (full / modified / not returned) | SNOMED CT | Generic return-to-activity concepts exist but not as a discrete 3-value coded set |
| 23 shoulder-specific observation type codes (ROM, provocation tests, PROMs) | LOINC | LOINC has generic observation categories but not codes for the specific shoulder tests (Jobe, Bear Hug, Belly Press, Hornblower, Lift-Off) |
| Hand dominance (right / left / ambidextrous) | SNOMED CT | Pre-coordinated codes exist and are used directly: `46669005`, `87683000`, `23088002` — no custom CodeSystem needed |

SNOMED CT was queried via the `mcp-snomed-ct` MCP server (CSIRO Ontoserver, FHIR R4) during IG authoring.

## Decision

Create **5 custom CodeSystems** for terminology gaps where no verified standard code exists:

| CodeSystem | File | Content |
|------------|------|---------|
| `ShoulderObservationCodes` | `codesystems/ShoulderObservation.fsh` | 30 observation type codes (originally 23; grew with hand dominance, then `#inspection` and `#sports-participation` added May 2026) |
| `GoutallierClassificationCodes` | `codesystems/GoutallierClassification.fsh` | Grades 0–4 |
| `PatteClassificationCodes` | `codesystems/PatteClassification.fsh` | Stages I–III |
| `SatisfactionScaleCodes` | `codesystems/SatisfactionScale.fsh` | 5-point scale |
| `ReturnToActivityCodes` | `codesystems/ReturnToActivity.fsh` | 3-value coded set |

Hand dominance uses SNOMED CT codes directly in `HandDominance` (`46669005`, `87683000`, `23088002`) — no custom CodeSystem.

All custom CodeSystems are marked `experimental: true` and have `status: draft`. Canonical URLs are under `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/`.

**Standard-terminology-first rule:** Standard terminologies are used wherever possible: SNOMED CT for anatomical body sites (laterality, tendons involved) and clinical findings; LOINC for measurements where a verified code exists; UCUM for measurement units; ICD-10-GM for diagnosis codes; DICOM for imaging modalities. A new local code is added to `ShoulderObservationCodes` **only when**:

1. The concept has no verified equivalent in any standard system, AND
2. The local code is bounded to a domain-specific clinical use (shoulder examination, classification, registry workflow).

The May 2026 batch (ADR-0027) added seven new Observation profiles but only two new local codes — `#inspection` and `#sports-participation`. The other five (`smoking-status`, `pain-severity`, `occupation`, `sleep-disturbance`, `functional-limitations`) fix their `Observation.code` to a verified LOINC or SNOMED CT concept directly, without adding to `ShoulderObservationCodes`. This is the rule going forward.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Use generic SNOMED CT concepts (e.g., "fatty degeneration" without grade) | Loses clinically critical grade/stage information; not comparable across registries |
| Map to LOINC panel codes | LOINC has observation panels but the individual LOINC codes for these specific shoulder tests were not found verified during authoring |
| Leave terminology undefined (free-text) | Eliminates semantic interoperability — contradicts the research objective |
| Use post-coordinated SNOMED CT expressions | Complex to author and validate; HAPI does not validate post-coordination at ingestion time; pre-coordinated preferred per SNOMED CT editorial guidance |

## Consequences

✅ Clinically precise graded/staged values preserved in machine-readable form  
✅ Custom codes are clearly namespaced under the HPI canonical URL — no collision with standard systems  
✅ All 5 CodeSystems documented in the published HTML IG with concept definitions  
⚠️ Custom codes are not interoperable with systems that do not import this IG  
⚠️ Goutallier, Patte terminology gaps are a documented thesis limitation  
⚠️ If a standard code is later identified (e.g., a future LOINC panel for shoulder tests), a migration/deprecation step would be needed  

## Sources

- `ig/input/fsh/codesystems/` — all 5 CodeSystem FSH files (hand dominance removed; uses SNOMED CT directly)
- the FHIR landscape analysis — terminology strategy section
- Authoring-time terminology tooling — a SNOMED CT terminology server used for lookups while authoring
- LOINC FHIR Terminology Server (`https://fhir.loinc.org`) — used to verify LOINC codes added in May 2026
- The project guide — "Prefer standard terminologies. Before creating a custom CodeSystem, check SNOMED CT, LOINC, ICD-10-GM, and UCUM."
- ADR-0027 — Codifies the standard-terminology-first rule applied to the May 2026 SECEC additions

---

**Update (2026-05-19, ADR-0045):** The 8 shoulder range-of-motion codes (`#forward-flexion`, `#external-rotation`, `#internal-rotation`, `#abduction`, and the four `#passive-*` variants) were migrated to verified LOINC codes (41389-8 / 41390-6 / 41381-5 / 41382-3 / 41387-2 / 41388-0 / 41391-4 / 41392-2). A broader LOINC sweep across the remaining `ShoulderObservationCodes` concepts (PROMs, provocation tests, strength, tear size, hand dominance, satisfaction, inspection, sports participation, return-to-activity) was performed in the same change and confirmed no further migrations are possible at the granularity the IG requires. See ADR-0045 for the full audit table.

**Update (2026-05-19, ADR-0046):** New local CodeSystem `ShoulderEtiology` with one code (`mixed` for acute-on-chronic etiology); the other three etiology codes used by `RotatorCuffEtiology` come from SNOMED CT directly (`773760007`, `362975008`, `54690008`). The local code exists only because SNOMED `255212004 Acute-on-chronic` is a qualifier-value concept, semantically wrong in the `condition-dueTo` cause slot.

**Update (2026-05-19, ADR-0047):** New local CodeSystem `CofieldTearSizeClassificationCodes` (4 buckets: small/medium/large/massive) for the Cofield tear-size categorical scale. No SNOMED CT or LOINC precoordinated concept exists at the bucket granularity (verified May 2026). Local CS follows the per-classification CodeSystem pattern established by Goutallier and Patte. `ShoulderObservationCodes` also gains `#tear-size-classification` to fix `Observation.code` on the new `TearSizeClassificationObservation` profile.
