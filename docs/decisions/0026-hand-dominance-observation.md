# ADR-0026: Hand Dominance as Observation (not Patient extension)

**Date:** 2026-05-11
**Status:** Accepted

## Context

Hand dominance was originally captured as a custom `hand-dominance` extension on the `ShoulderPatient` resource (cardinality 0..1, value CodeableConcept bound to HandDominance with SNOMED CT codes). The rationale at the time was that hand dominance is a stable characteristic of the patient, making the Patient resource a natural home.

On review, this design has two weaknesses:

1. **Wrong FHIR model**: Hand dominance is a clinical/functional finding, not a permanent demographic attribute. Characteristics that can change over time (e.g. after neurological injury) and that are clinically assessed belong in `Observation`, not in `Patient.extension`. HL7 FHIR guidance explicitly recommends Observations for findings and measurements.

2. **Unnecessary custom extension**: The project's own design principle ("avoid unnecessary extensions") is violated. FHIR R4 Patient has no standard extension for handedness; custom extensions should be a last resort. An Observation with a standard code has better interoperability.

The IG already has a well-established pattern for coded Observations (27 derived child profiles of `ShoulderObservation`). No LOINC code exists for handedness — a local `ShoulderObservationCodes#hand-dominance` code is therefore the most defensible choice.

## Decision

Replace the `hand-dominance` Patient extension with a new **`HandDominanceObservation`** derived profile (28th child of `ShoulderObservation`).

- **Code**: `ShoulderObservationCodes#hand-dominance` (local code, consistent with project convention; no LOINC code exists for handedness)
- **Value**: CodeableConcept from `HandDominance` (SNOMED CT codes unchanged: 46669005 / 87683000 / 23088002)
- **Category**: `social-history` (most accurate FHIR category for a stable patient characteristic)
- **Cardinality in bundle**: 0..1 (optional, captured in existing `entry[observation]` slice)

The `HandDominance` extension StructureDefinition is deleted. `HandDominance` is retained (now bound by the Observation profile instead).

In all three frontends:
- **Wizard**: `StepPatient` builds a `HandDominanceObservation` alongside the Patient entry (not an extension on Patient).
- **SDC**: `extractor.ts` moves extraction from `buildPatient()` to `buildObservations()` via the `obs.hand-dominance` linkId.
- **LHC-Forms**: No code change — the Questionnaire artifact is reloaded into HAPI.

`PatientForm` (standalone patient create/edit) no longer captures hand dominance; it is only collected in the full registration bundle flow.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep as Patient extension | Violates FHIR semantics (extension on Patient for a clinical finding); requires custom Extension StructureDefinition; less interoperable |
| Use a LOINC code for handedness | No LOINC code exists for handedness; the previously-cited `72097-2` was not a valid LOINC concept on verification against fhir.loinc.org |
| Keep as extension but add an Observation as well | Redundant data; violates single-source-of-truth; more complex frontends |
| Use `social-history` category defined inline without a constant | Less readable; project pattern defines category constants |

## Consequences

✅ Correct FHIR semantics — clinical finding in Observation, demographics in Patient  
✅ Removes the only custom Extension from the IG (cleaner, simpler artifact set)  
✅ Consistent with the 27-derived-profile pattern (ADR-0008)  
✅ `ShoulderPatient` profile is now purely demographic  
✅ Hand dominance participates in standard Observation queries (e.g. `GET /Observation?code=...`)  
⚠️ `PatientForm` no longer captures hand dominance — it is only collected via the full registration wizard  
⚠️ Existing data in HAPI (if any) uses the old extension format and would need migration  

## Sources

- ADR-0008 — abstract base + 27 derived Observation profiles (pattern being extended)
- ADR-0010 — custom CodeSystems for orthopedic terminology (convention: local codes with LOINC submission pending)
- No LOINC code exists for handedness (verified against fhir.loinc.org 2026-05-13)
- `ig/input/fsh/profiles/observations/HandDominanceObservation.fsh` — new profile
- `ig/input/fsh/codesystems/ShoulderObservation.fsh` — `#hand-dominance` code added (count: 28)

## Implementation status (2026-05-19)

Dual-path cleanup completed: the `hand-dominance` Patient extension `StructureDefinition` was never committed to FSH (only narrative and mapping text referenced it). The following stale references have been removed so that Observation is now the single declared path:

- `mapping/SECEC_FHIR_Mapping.csv` Q1.m — FHIR Resource and Path collapsed to `Observation` / `Observation (HandDominanceObservation)`; terminology corrected (`ShoulderObservationCodes#hand-dominance + HandDominance`; `HandDominanceCS` never existed).  <!-- check-artifact-names:allow -->
- `ig/input/pagecontent/profiles.md` — `ShoulderPatient` paragraph rewritten to describe the actual demographic constraints (identifier, name, birthDate, gender, EU `Address`); dropped both hand-dominance mentions.
- `ig/input/pagecontent/terminology.md` — `HandDominance` is now described as bound by `HandDominanceObservation.valueCodeableConcept`.
- `ig/input/fsh/profiles/observations/HandDominanceObservation.fsh` — description rewritten in past tense; "authors may choose either representation" removed.
- `docs/decisions/0009-fsh-file-organization-by-artifact-type.md` — `extensions/` directory comment updated.
- `fhir-requests/fhir-requests-profiles.http` — dead `GET /StructureDefinition/hand-dominance` removed (the extension was never published).
- `fhir-requests/fhir-requests-validate.http` — negative test retained as a regression guard, with its section header now explicitly tagged `NEGATIVE TEST` and referencing this ADR.
- `README.md` — overview bullet and FSH directory comment updated.
- the thesis appendix chapter(s) — Q1.m row simplified to `Observation`.
- the implementation_guide_diagram.drawio architecture diagram — HandDominance extension relabeled / repositioned as a derived Observation.

ADR status remains **Accepted** — the decision itself is unchanged; this section only records the documentation alignment.
