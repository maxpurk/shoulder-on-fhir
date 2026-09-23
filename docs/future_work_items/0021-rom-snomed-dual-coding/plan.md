# 0021 — Optional SNOMED CT dual-coding of shoulder ROM Observations

> **Status:** Open — future work (optional, additive; category (a) refinement). Not a coverage gap.

## Gap

The six degree-valued shoulder ROM Observation profiles carry a valid **LOINC** `Observation.code` but no SNOMED coding, even though SNOMED CT publishes a complete, shoulder-specific active/passive ROM observable family for exactly these measurements (verified against the SNOMED terminology server, Aug 2026):

| ROM profile | Current LOINC code | Available SNOMED observable (unused) |
|---|---|---|
| `shoulder-flexion-observation` (active) | `41389-8` | `298775004` Active range of shoulder flexion |
| `shoulder-passive-flexion-observation` | `41390-6` | `298780008` Passive range of shoulder flexion |
| `shoulder-abduction-observation` (active) | `41381-5` | `298797002` Active range of shoulder abduction |
| `shoulder-passive-abduction-observation` | `41382-3` | `298803003` Passive range of shoulder abduction |
| `shoulder-external-rotation-observation` (active) | `41387-2` | `298832000` Active range of shoulder external rotation |
| `shoulder-passive-external-rotation-observation` | `41388-0` | `298837006` Passive range of shoulder external rotation |

`Observation.code` is a `CodeableConcept` supporting multiple codings, so the SNOMED observable could be **added alongside** the existing LOINC coding — pure cross-terminology dual-coding, no value type, cardinality, or structural change.

## Why it matters

Dual LOINC+SNOMED coding on ROM would let consumers that key on either terminology resolve the same measurement, improving cross-system interoperability. LOINC and SNOMED CT are treated as equally valid here — this is additive redundancy, **not** a switch or an upgrade, and the datapoints are already fully interoperable via their LOINC codes. Hence future work, not a limitation.

## Note / scope boundary

- **Exclude at-side internal rotation** (`shoulder-internal-rotation-observation` / `-passive-`). SNOMED's `298820004`/`298826005` (active/passive range of shoulder internal rotation) imply a *degrees* measurement, but this IG deliberately models at-side IR as a **vertebral-reach ordinal** (hand-behind-back, ADR-0088), not degrees — so those SNOMED codes are a semantic mismatch with the value and must not be applied.
- **Exclude the four 90°-abduction rotation profiles** (ADR-0088). SNOMED has only generic active/passive rotation observables, no "at 90° abduction" position-specific variant, so there is no clean SNOMED match; the local codes stay.
- Surfaced while comparing the IG's coding against the MDM-Portal shoulder forms in an element-by-element code comparison. Note this is a direct-SNOMED discovery, **not** something MDM exposed — MDM itself uses only generic ROM fragments (`9964006` "Flexion function", `264730003` "Lateral rotation – action"), not these shoulder-specific observables.
- If implemented: add the SNOMED coding in each profile's FSH `* code`, keep LOINC as-is, then `sushi .` + `seed/load-profiles.sh` + `tools/validate.sh`; propagate to both frontends' observation builders if they assert `Observation.code` explicitly.
