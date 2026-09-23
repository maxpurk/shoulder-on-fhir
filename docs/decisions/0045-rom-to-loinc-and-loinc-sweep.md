# ADR-0045: Migrate shoulder ROM observations to LOINC; document LOINC sweep for remaining `ShoulderObservationCodes` concepts

**Date:** 2026-05-19
**Status:** Accepted
**Builds on:** ADR-0008 (one profile per Observation type), ADR-0010 (custom CodeSystems for orthopedic terminology), ADR-0027 (complete SECEC coverage via standard terminologies), ADR-0043 (tendon-codes replace muscle-codes)

## Context

The May 2026 line-by-line audit of `mapping/SECEC_FHIR_Mapping.csv` against the Hurley (2024) consensus paper surfaced a terminology regression: eight shoulder range-of-motion (ROM) `Observation.code` bindings are pinned to local concepts in `ShoulderObservationCodes` (`#forward-flexion`, `#external-rotation`, `#internal-rotation`, `#abduction`, and the four matching `#passive-*` variants), even though the LOINC FHIR Terminology Server has verified, shoulder-specific, active-vs-passive ROM codes that match the IG's observation semantics exactly.

ADR-0010 documented why local codes were originally created — at IG-authoring time, no shoulder-specific LOINC was found for "23 shoulder-specific observation type codes (ROM, provocation tests, PROMs)" and the placeholder `ShoulderObservationCodes` was used. The "standard terminologies first" rule was codified in ADR-0010 and reaffirmed in ADR-0027 (May 2026), which closed every previously-Missing SECEC element by binding to verified LOINC/SNOMED codes wherever they existed. The ROM bindings were missed at that time.

Verification against the LOINC FHIR Terminology Server (`https://fhir.loinc.org`) returned the following:

| IG concept (movement, active/passive) | LOINC code | LOINC display |
|---|---|---|
| Flexion, active (Hurley "Forward Flexion") | `41389-8` | Shoulder Flexion Active Range of Motion Quantitative |
| Flexion, passive | `41390-6` | Shoulder Flexion Passive Range of Motion Quantitative |
| Abduction, active | `41381-5` | Shoulder Abduction Active Range of Motion Quantitative |
| Abduction, passive | `41382-3` | Shoulder Abduction Passive Range of Motion Quantitative |
| External rotation, active | `41387-2` | Shoulder External rotation Active Range of Motion Quantitative |
| External rotation, passive | `41388-0` | Shoulder External rotation Passive Range of Motion Quantitative |
| Internal rotation, active | `41391-4` | Shoulder Internal rotation Active Range of Motion Quantitative |
| Internal rotation, passive | `41392-2` | Shoulder Internal rotation Passive Range of Motion Quantitative |

(LOINC also defines `41385-6` / `41386-4` for shoulder extension ROM, active/passive. Hurley Q2.b/c does not call for extension and the IG does not currently record it; no profile is added.)

To prevent a third instance of "we missed a standard code," a broader LOINC sweep was performed across every other concept in `ShoulderObservationCodes`. Result: ROM is the only category with verified shoulder-specific LOINC codes. The remaining concepts (PROMs, provocation tests, strength, tear size, hand dominance, satisfaction, inspection, sports participation, return-to-activity, imaging classifications) have no LOINC at the granularity the IG requires.

ADR-0043 (also May 2026) corrected an analogous SNOMED muscle-vs-tendon code mistake in `TendonsInvolved`. This ADR is the second instance of the same class of fix — local placeholders displaced by standard codes verified after the fact.

## Decision

1. **Migrate the eight ROM `Observation.code` bindings to LOINC.** Each of the eight ROM Observation profiles fixes `Observation.code` to the LOINC code in the table above, dropping the local `ShoulderObservationCodes#…` binding.

2. **Rename the eight profiles to a `Shoulder…Observation` convention** so the canonical URLs match LOINC's labels. The Hurley term "Forward Flexion" becomes "Flexion" in profile IDs (matching LOINC); a profile-level comment retains the Hurley naming for traceability.

   | Old profile ID | New profile ID | LOINC code |
   |---|---|---|
   | `ForwardFlexionObservation` | `ShoulderFlexionObservation` | `41389-8` |
   | `AbductionObservation` | `ShoulderAbductionObservation` | `41381-5` |
   | `ExternalRotationObservation` | `ShoulderExternalRotationObservation` | `41387-2` |
   | `InternalRotationObservation` | `ShoulderInternalRotationObservation` | `41391-4` |
   | `PassiveForwardFlexionObservation` | `ShoulderPassiveFlexionObservation` | `41390-6` |
   | `PassiveAbductionObservation` | `ShoulderPassiveAbductionObservation` | `41382-3` |
   | `PassiveExternalRotationObservation` | `ShoulderPassiveExternalRotationObservation` | `41388-0` |
   | `PassiveInternalRotationObservation` | `ShoulderPassiveInternalRotationObservation` | `41392-2` |

   `Parent: ShoulderObservation`, `valueQuantity` (UCUM `deg`), `bodySite` (laterality), and `effectiveDateTime` constraints are unchanged.

3. **Remove the eight ROM concepts from `ShoulderObservationCodes`.** The CodeSystem shrinks from 29 to 21 concepts. `ShoulderObservationCode` is `include codes from system ShoulderObservationCodes` and updates automatically.

4. **Document the LOINC sweep across the remaining `ShoulderObservationCodes` concepts.** The sweep is the deliverable that closes the audit — future re-audits can read this ADR and avoid re-checking what was already checked.

   | `ShoulderObservationCodes` concept | LOINC query performed | Outcome |
   |---|---|---|
   | ASES, WORC, DASH, QuickDASH, Constant | `$expand` filter with each instrument name | No shoulder-specific PROM codes returned. Constant remains bound via SNOMED `273383002`; DASH via SNOMED `444875003`. |
   | `#patient-satisfaction` | `patient satisfaction` | Only generic healthcare-delivery satisfaction codes (`77218-6`, `81893-0`); no shoulder-surgery 5-point scale. Local code with `SatisfactionScale` binding retained. |
   | `#hand-dominance` | `handedness`, `hand dominance` | Only task-specific developmental sub-codes (drawing, throwing, 12-year-old EHI/ALSPAC instruments). No simple hand-dominance code. Local code retained per ADR-0026. |
   | `#jobe-test`, `#lift-off-test`, `#belly-press-test`, `#bear-hug-test`, `#hornblower-test` | each test name | No hits (a `hawkins` query returned the amino-acid `Hawkinsin` only). Local codes retained. |
   | `#tear-size` | `rotator cuff tear` | No quantitative measurement code. Local code retained. |
   | `#supraspinatus-strength`, `#external-rotation-strength` | `supraspinatus` | No shoulder-specific MMT code. Generic `80322-1` "Muscle strength" exists but loses muscle specificity. Local codes retained. |
   | `#inspection`, `#sports-participation`, `#return-to-sport-work` | each concept name | No suitable LOINC equivalent. Local codes retained. |
   | `#patte-classification`, `#goutallier-classification` | each | Already documented in ADR-0010 as having no SNOMED/LOINC pre-coordinated graded codes. Unchanged. |

   This audit was performed once, in May 2026; it should be repeated whenever LOINC issues a major release (currently biannual).

5. **Add forward-pointers in ADR-0008, ADR-0010, and ADR-0027.** Historical content of those ADRs is preserved; a single line / paragraph at the bottom references this ADR. ADR-0010's claim "23 shoulder-specific observation type codes (ROM, provocation tests, PROMs)" remains historically accurate; the forward-pointer notes that ROM (8 of the 23) was migrated under ADR-0045 and the residual non-LOINC concepts were re-audited and confirmed unchanged.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Rebind code to LOINC but keep the old profile IDs (`ForwardFlexionObservation`, etc.) | The IDs were chosen as nicknames for the local CS concepts; LOINC's labels are slightly different (e.g., "Flexion" vs "Forward Flexion"). Keeping legacy IDs while rebinding to LOINC creates a permanent naming inconsistency that future readers must reconcile. Renaming once, atomically, is cleaner than carrying mismatched names forward. |
| Merge active/passive into one profile and slice on `Observation.method` | Loses the per-profile validation that ADR-0008 was designed for. The current 1:1 (profile ↔ LOINC code) model is the simplest correct shape: each profile's `code` is `MS` and the SUSHI/HAPI gate enforces it. |
| Skip the broader LOINC sweep and re-audit only ROM | Would leave the audit incomplete and invite another "we missed code X" finding next year. The sweep is cheap (one TX-server pass), and documenting the negative cases is high-value because it prevents repeat queries. |
| Use LOINC panel codes (e.g., a generic "Joint range of motion" panel) instead of the shoulder-specific axis codes | LOINC's `41389-8` (Shoulder Flexion Active ROM Quantitative) is more specific than any panel code and matches the IG's per-axis profile shape exactly. Going through a panel would lose specificity at the profile level. |
| Add an Extension ROM profile while we're touching this area | Out of scope: Hurley Q2.b/c does not enumerate extension; the IG has never recorded it; adding it now would mix unrelated concerns. Tracked here for completeness — a future ADR can add `ShoulderExtensionObservation` (`41385-6` / `41386-4`) if the IG decides to broaden ROM coverage. |

## Consequences

✅ Closes the ADR-0027 standard-terminology-first regression for ROM observations. Eight `Observation.code` values now reference internationally recognized LOINC concepts at the exact shoulder-axis granularity the IG records.

✅ The LOINC sweep is documented once, so future audits (whether by the thesis author, an examiner, or a downstream implementer) can verify the audit trail without re-running the queries.

✅ `ShoulderObservationCodes` shrinks to 21 truly orthopedic-specific concepts (provocation tests, classifications, satisfaction, return-to-activity, PROMs without standard codes, inspection, sports participation, hand dominance, strength, tear size). The CodeSystem's role becomes clearer: it carries only what no standard system carries.

✅ The Hurley → LOINC display rename ("Forward Flexion" → "Flexion") is captured at the profile-comment level so a reader of the FSH can map between the consensus paper's wording and the FHIR/LOINC convention.

⚠️ Canonical URLs change for the eight renamed profiles. This is a pre-1.0 IG breaking change; all in-repo examples and documentation are updated atomically in the same change, so no external consumer is affected at this stage. Implementers that pinned earlier canonical URLs will need to re-pin.

⚠️ The SECEC mapping rows for Q2.b (Active ROM), Q2.c (Passive ROM), Q9.b, Q9.c, Q8.b (reuses Q2.b), and Q12.d (PROM ROM component) move from local-CS bindings to LOINC. `Coverage Status` may be promotable from Partial to Full for Q2.b/c now that ROM uses a verified shoulder-specific LOINC at the required granularity; promotion is evaluated against the original Partial-rationale notes during execution.

❌ The eight ROM concepts (`#forward-flexion`, `#external-rotation`, `#internal-rotation`, `#abduction`, and the four `#passive-*` variants) lose any IG-visible historical record once removed. Git history preserves them; this ADR preserves the rationale.

## Sources

- LOINC FHIR Terminology Server (`https://fhir.loinc.org`) — `$lookup` and `$expand` queries verified the eight ROM codes and the sweep negative cases (May 2026)
- `ig/input/fsh/codesystems/ShoulderObservation.fsh` — eight concept entries removed (lines 28–54 in the prior version), count `^count = 29 → 21`
- `ig/input/fsh/profiles/observations/` — eight ROM profile FSH files renamed and rebound
- `ig/input/fsh/examples/ShoulderObservation.fsh`, `ig/input/fsh/examples/ShoulderFollowUpBundle.fsh` — example references updated
- `example_data/anna_mueller_*.json` — longitudinal example bundles updated to new profile URLs and LOINC code blocks
- `mapping/SECEC_FHIR_Mapping.csv`, `.md` — Q2.b/c, Q9.b/c, Q8.b, Q12.d `IG Implementation` column updated
- ADR-0010 — `docs/decisions/0010-custom-codesystems-orthopedic-terminology.md` — forward-pointer paragraph appended
- ADR-0027 — `docs/decisions/0027-complete-secec-coverage-standard-terminologies.md` — forward-pointer line appended
- ADR-0008 — `docs/decisions/0008-abstract-base-27-derived-observation-profiles.md` — forward-pointer line appended
- ADR-0043 — `docs/decisions/0043-tendon-codes-replace-muscle-codes.md` — same class of fix; structural precedent for this ADR
- ADR-0065 — `docs/decisions/0065-shoulderobservationcodevs-enumerate-derived-profile-codes.md` — closes the inverse-direction VS update that §Decision §3 above did not cover (adding the eight new LOINC ROM codes — plus six earlier ADR-0027 / ADR-0056 PROM / history bindings — to `ShoulderObservationCode` so the parent binding accurately describes the codes the profile family emits).
- The project guide — already lists the 10 verified LOINC ROM codes under "Common verified codes"
