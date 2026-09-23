# ADR-0014b: Pre-coordinated SNOMED CT for body site

**Date:** 2026-04-16
**Status:** Accepted; the dual-content `bodySite` convention is superseded by [ADR-0064](0064-tendons-involved-observation-pattern.md)
**Supersedes:** [ADR-0014a](0014a-bodysite-slicing-abandoned.md)
**Amended:** 2026-09-07 — supersession back-pointer added, and the rejection of post-coordination re-argued on terminology-provenance grounds (see *Why not post-coordination* below)

## Context

`RotatorCuffCondition` must encode both the laterality (left/right shoulder) and the anatomy (specific tendons involved) in a machine-readable, validatable way.

The previous approach — FSH slicing on `Condition.bodySite` — caused IG Publisher HTTP 422 snapshot generation failures (see [ADR-0014a](0014a-bodysite-slicing-abandoned.md)).

SNOMED CT provides **pre-coordinated laterality concepts** that combine anatomy + side into a single code, eliminating the need for slicing:

| SNOMED CT code | Display |
|----------------|---------|
| `91774008` | Structure of right shoulder region |
| `91775009` | Structure of left shoulder region |

For tendon-level anatomy, the `TendonsInvolved` ValueSet uses SNOMED CT codes for individual tendon structures (supraspinatus, infraspinatus, subscapularis, teres minor, biceps long head), verified via the `mcp-snomed-ct` MCP tool against the CSIRO Ontoserver.

## Decision

Replace `bodySite` slicing with an **extensible binding** on `Condition.bodySite`:

- Laterality is expressed via a pre-coordinated SNOMED CT shoulder region code (`ShoulderLaterality`, extensible)
- Tendon anatomy is expressed via additional `bodySite` entries from `TendonsInvolved` (extensible)
- No FSH slicing — `bodySite` remains `0..*` with extensible bindings only

> **Amended by [ADR-0064](0064-tendons-involved-observation-pattern.md) (2026-05-24).** The second and third bullets no longer describe the IG. Tendon anatomy moved to `TendonsInvolvedObservation.value[x]`, linked from the Condition via `evidence.detail`, and `RotatorCuffCondition.bodySite` tightened to `1..1` with a **required** binding to `ShoulderLaterality`. The first bullet, the pre-coordinated SNOMED region code as the laterality carrier, is the part of this ADR that still stands.

IG Publisher `-tx na` flag added to `_genonce.sh` to skip online SNOMED terminology validation during offline builds.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| bodySite slicing (pattern discriminator) | Caused IG Publisher HTTP 422 snapshot failures — see ADR-0014a |
| Post-coordinated SNOMED CT (laterality + anatomy as expression) | Complex to author and validate; HAPI does not validate SNOMED post-coordination expressions at R4 ingestion time. See *Why not post-coordination* below for the terminology-provenance argument, which is the stronger reason |
| Custom extension for laterality | Unnecessary — `Condition.bodySite` already serves this purpose; extensions should only be added when no standard element exists |
| laterality as `Condition.code` modifier | `Condition.code` represents the diagnosis, not the body location — semantically incorrect |

## Consequences

✅ IG Publisher snapshot generation succeeds — 0 errors after this change  
✅ Uses standard SNOMED CT pre-coordinated concepts — no post-coordination or slicing complexity  
✅ Pre-coordinated codes are resolvable without a terminology server at validation time  
✅ Extensible bindings allow registries to add site-specific SNOMED codes  
⚠️ Laterality is no longer machine-enforced as 1..1 required (was enforced by slicing) — implementers must follow IG guidance  
⚠️ `bodySite` entries for laterality vs. tendon anatomy are not formally distinguished — relies on implementer convention  

## Why not post-coordination

*Added 2026-09-07. The original rejection of post-coordination rested on a tooling limitation (HAPI does not process Compositional Grammar expressions). That reason is real but weak, since tooling changes. Three stronger reasons were established afterwards and are recorded here.*

### 1. The relevant standards bodies point away from it

- **HL7 FHIR R4** defines the structural split as the default. `Condition.bodySite` is to be "[o]nly used if not implicit in code found in `Condition.code`" ([Condition definitions, R4](https://hl7.org/fhir/R4/condition-definitions.html)). `RotatorCuffCondition.code` is fixed to the laterality-neutral `926335004`, so laterality is not implicit in the code and `bodySite` is the correct home for it. Compositional Grammar expressions *are* legal in `Coding.code` ([Using SNOMED CT with FHIR](https://hl7.org/fhir/R4/snomedct.html)), but support by any given terminology server is optional, not required.
- **The SNOMED CT FHIR Implementation Guide** ([IHTSDO/snomed-ig](https://github.com/IHTSDO/snomed-ig)) states that many uses of post-coordination "should instead be a function of the wider information model in which the SNOMED CT concept is recorded", and warns that post-coordination overlapping the information model risks "duplication, complexity and inconsistency".
- **The SNOMED CT Postcoordination Guide** scopes post-coordination to cases where "no precoordinated concept is available" or where "an information model or implementation strategy requires a certain representation" ([Precoordination and Postcoordination](https://docs.snomed.org/snomed-ct-practical-guides/snomed-ct-postcoordination-guide/snomed-ct-expressions/precoordination-and-postcoordination)). Neither applies here.

### 2. Laterality cannot be attached to the diagnosis anyway

`272741003 |Laterality|` is a **body structure** attribute. The SNOMED CT Editorial Guide states that "[t]he laterality attribute should be the only attribute for the representation of laterality" and applies it to lateralisable anatomy, enumerated in the *Lateralisable body structure reference set* (`723264001`) ([Editorial Guide: Laterality](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/anatomical-concept-model/laterality)). So this is malformed:

```
399346004 |Supraspinatus tear| : 272741003 |Laterality| = 24028007 |Right|     ← invalid
```

The conformant form nests laterality inside the finding site:

```
399346004 |Supraspinatus tear| :
  363698007 |Finding site| = ( 5580002 |Structure of tendon of supraspinatus muscle| :
                               272741003 |Laterality| = 24028007 |Right| )
```

Getting this right at every data-entry point, in a registry filled in by surgeons, is not a realistic requirement.

### 3. Pre-coordinated laterality is not portable; the split is

A SNOMED CT identifier encodes its own provenance. The two digits before the final check digit are the partition identifier: `00` marks a concept in the International Edition, `10` marks a concept from a national extension. Checking the concepts a terminology-server search returns for rotator cuff tear and for supraspinatus tear (verified 2026-09-07):

| Concept | SCTID | Partition | Edition |
|---|---|---|---|
| Rupture of rotator cuff of shoulder | `926335004` | 00 | **International** |
| Rupture of rotator cuff of **right** shoulder | `11892371000119103` | 10 | national extension |
| Traumatic **right** rotator cuff tear | `11778121000119108` | 10 | national extension |
| Nontraumatic rupture of rotator cuff of **right** shoulder | `1076451000119107` | 10 | national extension |
| Rupture of tendon of **right** supraspinatus muscle | `52571000087105` | 10 | national extension |
| Structure of **right** shoulder region | `91774008` | 00 | **International** |
| Structure of tendon of supraspinatus muscle | `5580002` | 00 | **International** |
| Structure of tendon of **right** supraspinatus muscle | `1208437008` | 00 | **International** |

Every laterality-bearing rotator cuff **diagnosis** concept returned came from a national extension. Every laterality-bearing **body structure** returned came from the International Edition. A registry intended for multi-centre European use therefore cannot rely on pre-coordinated laterality in `Condition.code`, but can rely on the pre-coordinated shoulder-region code in `bodySite`. This is the decisive argument for the split this ADR chose.

*Scope note: this is what a terminology-server search returned for these two diagnoses, not an exhaustive traversal of the SNOMED CT disorder hierarchy.*

## Sources

- git commit `4ea7aa9` — "fix(ig): resolve all IG Publisher errors; pipeline builds clean (0 errors)" — removed slicing, added pre-coordinated SNOMED codes, added `-tx na` to `_genonce.sh`
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh` — current `bodySite` binding without slicing
- `ig/input/fsh/valuesets/ShoulderLaterality.fsh` — `ShoulderLaterality` with SNOMED CT codes 91774008, 91775009
- `ig/input/fsh/valuesets/TendonsInvolved.fsh` — `TendonsInvolved` with SNOMED CT tendon codes
- `ig/_genonce.sh` — `-tx na` flag for offline terminology validation

- [HL7 FHIR R4, Condition element definitions](https://hl7.org/fhir/R4/condition-definitions.html) — `bodySite` "[o]nly used if not implicit in code found in `Condition.code`".
- [HL7 FHIR R4, Using SNOMED CT with FHIR](https://hl7.org/fhir/R4/snomedct.html) — Compositional Grammar expressions permitted in `Coding.code`; server support optional.
- [SNOMED CT FHIR Implementation Guide](https://github.com/IHTSDO/snomed-ig) — post-coordination overlapping the information model risks duplication, complexity and inconsistency.
- [SNOMED CT Postcoordination Guide: Precoordination and Postcoordination](https://docs.snomed.org/snomed-ct-practical-guides/snomed-ct-postcoordination-guide/snomed-ct-expressions/precoordination-and-postcoordination).
- [SNOMED CT Editorial Guide: Laterality](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/anatomical-concept-model/laterality).
