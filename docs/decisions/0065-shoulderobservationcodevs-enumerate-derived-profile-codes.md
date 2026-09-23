# ADR-0065: Widen `ShoulderObservationCode` to enumerate the LOINC / SNOMED codes fixed by derived Observation profiles

**Date:** 2026-05-24
**Status:** Accepted
**Builds on:** [ADR-0008](0008-abstract-base-27-derived-observation-profiles.md) (abstract base + derived child profiles), [ADR-0010](0010-custom-codesystems-orthopedic-terminology.md) (custom CodeSystems for orthopedic terminology), [ADR-0027](0027-complete-secec-coverage-standard-terminologies.md) (standard-terminology-first), [ADR-0045](0045-rom-to-loinc-and-loinc-sweep.md) (the principal antecedent — ROM to LOINC migration whose VS-side update this ADR completes)

## Context

The base profile `ShoulderObservation` binds `Observation.code` to `ShoulderObservationCode` with strength `extensible` (see `ig/input/fsh/profiles/ShoulderObservation.fsh`). Until this ADR, the VS was defined as a single bulk import:

```fsh
* include codes from system ShoulderObservationCodes
```

— i.e., local concepts only.

The 38 derived Observation profiles fall into two terminology cohorts:

- **Local-CS-coded (24 profiles):** provocation tests (Jobe, Hawkins, lift-off, belly-press, bear-hug, hornblower), muscle strength (supraspinatus, external-rotation, subscapularis), imaging classifications (Patte, Goutallier, Cofield bucket, tear size cm, tendons-involved per ADR-0064), PROMs without standard codes (SSV, SANE, satisfaction), hand dominance, inspection, sports participation, return-to-activity. All bind to `ShoulderObservationCodes#…` — covered by the bulk import, no problem.

- **Standard-terminology-coded (14 profiles):** the 8 ROM profiles (LOINC, per ADR-0045) plus 6 PROM / patient-history profiles whose codes were bound to standard terminology by ADR-0027 (and ADR-0056 for smoking):

  | Profile | Code |
  |---|---|
  | `ShoulderFlexionObservation` / `ShoulderPassiveFlexionObservation` | LOINC `41389-8` / `41390-6` |
  | `ShoulderAbductionObservation` / `ShoulderPassiveAbductionObservation` | LOINC `41381-5` / `41382-3` |
  | `ShoulderExternalRotationObservation` / `ShoulderPassiveExternalRotationObservation` | LOINC `41387-2` / `41388-0` |
  | `ShoulderInternalRotationObservation` / `ShoulderPassiveInternalRotationObservation` | LOINC `41391-4` / `41392-2` |
  | `PainSeverityObservation` | LOINC `72514-3` |
  | `OccupationObservation` | LOINC `85658-3` |
  | `SmokingStatusObservation` | LOINC `72166-2` |
  | `FunctionalLimitationsObservation` | LOINC `10158-4` |
  | `ConstantScoreObservation` | SNOMED `273383002` |
  | `SleepDisturbanceObservation` | SNOMED `301345002` |

ADR-0045 migrated ROM to LOINC and (correctly) removed the eight ROM concepts from `ShoulderObservationCodes`. Its §Decision §3 assumed that the VS update would "happen automatically" because the VS is `include codes from system`. That logic only addresses the *removal* side. It does not address the inverse: the eight new LOINC codes the derived profiles now fix were never added to the parent VS. The six standard-terminology bindings from ADR-0027 / ADR-0056 had the same shape and the same omission.

The FHIR Validator CLI surfaces 14 warnings on every bundle that exercises any of these profiles, all of the form:

```
http://loinc.org#41389-8  not in  ShoulderObservationCode
```

The `extensible` binding strength means the warning is non-blocking — the derived profile's own fixed `Observation.code` is structurally sound. But the warning is correct: the parent VS no longer accurately describes the codes its profile family emits. ADR-0027 codified "the parent VS is the IG's intent declaration"; the current state contradicts that.

The IG already has the right pattern. `RotatorCuffEtiology` (ADR-0046) and `ShoulderLaterality` mix local + external codes by **enumerating** each `* http://system#code "display"` rather than bulk-importing one CS — this is the established hybrid style.

## Decision

1. **Widen `ShoulderObservationCode`** (`ig/input/fsh/valuesets/ShoulderObservationCode.fsh`) by appending the 14 external codes after the existing `include codes from system ShoulderObservationCodes`. The bulk import is retained so the local CS remains authoritative for the orthopedic-specific concepts it carries; the enumeration adds exactly the 14 codes that derived profiles fix.

   - 12 LOINC codes (8 ROM + Pain / Occupation / Smoking / FunctionalLimitations narrative).
   - 2 SNOMED CT codes (Constant-Murley score, Sleep disturbance).
   - Each entry carries the authoritative display string as verified against `https://fhir.loinc.org` (LOINC) and `https://tx.fhir.org/r4` (SNOMED) on 2026-05-24.

2. **Binding strength on the base profile stays `extensible`.** The widened VS now accurately describes the codes the IG's profile family emits; the binding does not need to tighten to `required`. `extensible` is the safer posture for an in-development IG where a future derived profile might bring a 15th code — the validator will then emit one informative warning rather than a blocking error, and the VS can be updated in the same change.

3. **Forward-pointer added to ADR-0045.** ADR-0045's §Decision §3 (CS removal "updates the VS automatically") is correct but incomplete; the forward-pointer notes that the inverse-direction update (adding LOINC codes used by derived profiles) is handled in this ADR. ADR-0008 / ADR-0010 / ADR-0027 already received their forward-pointers under ADR-0045; no further pointers are added.

4. **Maintenance convention.** Whenever a new derived Observation profile fixes `Observation.code` to a code outside `ShoulderObservationCodes`, the same FSH file must gain a matching enumerated entry. Captured here so the convention is discoverable from the ADR index; no tooling check is added.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Lower the binding strength** from `extensible` to `preferred` (or `example`) on `ShoulderObservation.code` | Silences the warning by erasing the parent's terminology intent. Downstream implementers lose the curated terminology list. ADR-0027 explicitly committed to the parent VS as the IG's intent declaration; reducing strength would contradict that. |
| **Bulk-import each external CodeSystem** (`* include codes from system http://loinc.org` and `… http://snomed.info/sct`) | Pulls in tens of thousands of codes the IG never intends to allow on this element. Loses semantic precision. The validator's "not in VS" check becomes meaningless. |
| **Split into two VSs** — `ShoulderObservationLocalCode` (current shape) plus `ShoulderObservationCode` (union local + enumerated) | Adds a second VS for no semantic gain over the hybrid enumeration. The hybrid pattern is the IG's established convention (`RotatorCuffEtiology`, `ShoulderLaterality`). |
| **Leave the VS unchanged and accept the 14 warnings permanently** | Validator noise that obscures real findings. Anyone reading the next validation report has to mentally re-deduce that 14 of the warnings are "expected by design" — the same trap ADR-0045 walked into. Fixing the VS once is cheaper than re-explaining the noise each run. |
| **Tighten binding strength to `required` after widening** | Locks future derived profiles into the current 14-code enumeration. A new profile bringing a 15th standard code would then fail validation until the VS is updated in the same change — an unforced ergonomic regression on an in-development IG. `extensible` preserves headroom. |

## Consequences

✅ The 14 `http://…#…  not in  ShoulderObservationCode` warnings produced on every IG-conformant bundle that exercises ROM / pain / occupation / smoking / sleep / functional-limitations / Constant-Murley are eliminated at the root. Total validator warning count on the canonical example bundle drops by 14 (from 161 → 147, with the cosmetic patterns unchanged).
✅ `ShoulderObservationCode` now accurately declares the codes the IG's Observation profile family emits — restores the intent that ADR-0027 / ADR-0045 articulated but did not finish wiring up.
✅ Follows the established IG hybrid-enumeration pattern (`RotatorCuffEtiology`, `ShoulderLaterality`) — no new style introduced.
✅ Binding strength stays `extensible`, preserving headroom for future derived profiles to bring new external codes without forcing a coordinated VS bump.
⚠️ Adds a small maintenance touchpoint: when a future derived profile fixes `Observation.code` to a code outside `ShoulderObservationCodes`, the FSH VS file must gain a matching enumerated entry in the same change. The convention is documented in §Decision §4 but is not enforced by tooling.
⚠️ The two SNOMED entries' display strings ("Constant and Murley shoulder assessment score", "Poor sleep") are the canonical SNOMED preferred terms; the underlying profile semantics for `SleepDisturbanceObservation` against the SNOMED concept "Poor sleep" (vs. e.g. a broader "Disturbance of sleep" concept) is out of scope for this ADR — flagged as a follow-up if a re-audit of patient-history bindings is needed.

## Sources

- `ig/input/fsh/valuesets/ShoulderObservationCode.fsh` — `include codes from system ShoulderObservationCodes` retained; 14 enumerated `* http://system#code "display"` lines appended; header comment and `Description` updated to reflect the hybrid shape.
- `ig/input/fsh/profiles/observations/Shoulder{Flexion,Abduction,ExternalRotation,InternalRotation,PassiveFlexion,PassiveAbduction,PassiveExternalRotation,PassiveInternalRotation}Observation.fsh` — the 8 ROM profile FSH files whose fixed LOINC codes are now enumerated in the VS (no edit required on the profiles themselves).
- `ig/input/fsh/profiles/observations/{PainSeverity,Occupation,SmokingStatus,FunctionalLimitations,ConstantScore,SleepDisturbance}Observation.fsh` — the 6 PROM / history profile FSH files whose fixed LOINC / SNOMED codes are now enumerated.
- `docs/decisions/0045-rom-to-loinc-and-loinc-sweep.md` — forward-pointer line appended noting that §Decision §3 (CS removal) is paired with the inverse VS-enumeration update completed under this ADR.
- LOINC FHIR Terminology Server (`https://fhir.loinc.org`) — `$lookup` queries on 2026-05-24 verified the 4 PROM / history LOINC displays (`72514-3`, `85658-3`, `72166-2`, `10158-4`); the 8 ROM displays are already pinned in the project guide per ADR-0045.
- `https://tx.fhir.org/r4` SNOMED — `$lookup` queries on 2026-05-24 verified the 2 SNOMED displays (`273383002` → "Constant and Murley shoulder assessment score", `301345002` → "Poor sleep").
- the validator warning report from that run — the validator run that surfaced the 14 warnings.
