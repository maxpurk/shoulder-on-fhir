# ADR-0070: Migrate Patient Satisfaction Observation Code to LOINC 77218-6

Date: 2026-07-11  
Status: Accepted

## Context

`PatientSatisfactionObservation` addressed SECEC Hurley consensus elements Q8.e (patient satisfaction with treatment) and Q12.g (PROM — satisfaction). Both elements state only "patient satisfaction" — Hurley specifies no instrument or scale format, leaving full design freedom.

At authoring time a local `SatisfactionScaleCodes` CodeSystem was created with five Likert concepts (Very Satisfied / Satisfied / Neutral / Dissatisfied / Very Dissatisfied). The `Observation.code` was bound to a local `ShoulderObservationCodes#patient-satisfaction` code for the same reason — no LOINC equivalent was found at the time.

On 2026-07-11, a targeted search of `fhir.loinc.org` found:

- **`77218-6`** "Patient satisfaction with healthcare delivery" — LOINC panel code, TRIAL publication status. $lookup confirmed displayName, property panel, and valid use as `Observation.code`.
- **Answer list `LL4543-6`** — 5-item ordinal satisfaction scale with the following LA codes:
  - `LA27750-1` "Not at all satisfied"
  - `LA24976-5` "Mostly dissatisfied"
  - `LA27752-7` "Somewhat satisfied"
  - `LA24974-0` "Mostly satisfied"
  - `LA27754-3` "Completely satisfied"

LOINC TRIAL status is acceptable for FHIR IG use (comparable to FHIR `#draft`; see ADR-0045 precedent). Hurley's silence on scale format means the LOINC five-point ordinal satisfies the consensus requirement as well as the former local five-point Likert.

ADR-0045 (ROM LOINC migration) established the structural precedent for replacing local codes with verified LOINC codes.

## Decision

Migrate patient satisfaction terminology from local codes to LOINC:

1. **`Observation.code`**: `ShoulderObservationCodes#patient-satisfaction` → `http://loinc.org#77218-6`
2. **ValueSet `SatisfactionScale`**: rebind from local `SatisfactionScaleCodes` to the five LA codes of `LL4543-6`
3. **`SatisfactionScaleCodes` CodeSystem**: retire — remove from IG
4. **`ShoulderObservationCodes`**: remove the now-unused `#patient-satisfaction` concept; decrement `^count` from 20 to 19

The local `SatisfactionScale` ValueSet canonical (`…/ValueSet/satisfaction-scale`) is preserved; questionnaire `answerValueSet` references and frontend bindings that point to the canonical URL require no change.

Code wording changes (old → new):
- Very Satisfied → Completely satisfied (LA27754-3)
- Satisfied → Mostly satisfied (LA24974-0)
- Neutral → Somewhat satisfied (LA27752-7)
- Dissatisfied → Mostly dissatisfied (LA24976-5)
- Very Dissatisfied → Not at all satisfied (LA27750-1)

## Consequences

- Removes one local CodeSystem from the IG, improving alignment with FHIR best practice (standard terminologies first)
- `PatientSatisfactionObservation.code` is now a verifiable LOINC concept; any LOINC-aware FHIR validator will resolve it
- Historical data stored with old local codes will need a concept-map migration if the registry is deployed — acceptable given current pre-production status
- LOINC TRIAL status: if `77218-6` is promoted or deprecated, the observation code binding must be revisited
