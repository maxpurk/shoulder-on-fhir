// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderObservationCode                                                    │
// │  Hybrid: all local ShoulderObservationCodes concepts + the enumerated       │
// │  LOINC / SNOMED CT codes that derived Observation profiles fix on           │
// │  Observation.code. Mirrors the enumerated-hybrid style already established  │
// │  by RotatorCuffEtiology (local + SNOMED) and ShoulderLaterality             │
// │  (SNOMED-only). See ADR-0065.                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ShoulderObservationCode
Id: shoulder-observation-code
Title: "Shoulder Observation Code ValueSet"
Description: "Codes for shoulder-related observations: all local ShoulderObservationCodes concepts plus the LOINC and SNOMED CT codes fixed by derived Observation profiles (ROM, PROMs, and patient-history items)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-observation-code"
* ^version = "0.1.9"
* ^status = #draft
* ^experimental = true
* ^date = "2026-08-03"
* ^publisher = "Hasso Plattner Institute"

* include codes from system ShoulderObservationCodes

// LOINC — shoulder ROM, active and passive (ADR-0045). Flexion, abduction and
// external rotation only: internal rotation is recorded on a vertebral-level
// ordinal rather than in degrees, so it uses a local code (ADR-0088).
* http://loinc.org#41389-8 "Shoulder Flexion Active Range of Motion Quantitative"
* http://loinc.org#41390-6 "Shoulder Flexion Passive Range of Motion Quantitative"
* http://loinc.org#41381-5 "Shoulder Abduction Active Range of Motion Quantitative"
* http://loinc.org#41382-3 "Shoulder Abduction Passive Range of Motion Quantitative"
* http://loinc.org#41387-2 "Shoulder External rotation Active Range of Motion Quantitative"
* http://loinc.org#41388-0 "Shoulder External rotation Passive Range of Motion Quantitative"

// LOINC — patient history and PROM concepts. Three items deliberately use local
// codes instead, because no standard concept fits: pain is split across four
// context axes — average, active movement, passive movement, rest — and no
// LOINC or SNOMED concept distinguishes pain context (ADR-0087);
// functional-limitation severity is an ordinal, which LOINC 10158-4's narrative
// scale type cannot carry (ADR-0105); and occupation is split into employment
// status (LOINC 67875-5, below) plus a local occupational-physical-demand axis
// that has no standard concept (ADR-0082).
* http://loinc.org#72166-2 "Tobacco smoking status"
* http://loinc.org#67875-5 "Employment status - current"
* http://loinc.org#77218-6 "Patient satisfaction with healthcare delivery"

// SNOMED CT — PROM concepts. Sleep disturbance is not here: it pairs a local
// code with a SleepDisturbanceSeverity value binding (ADR-0081).
* http://snomed.info/sct#273383002 "Constant and Murley shoulder assessment score"

// SNOMED CT — physical examination. Each is a laterality-neutral finding or
// procedure concept used as Observation.code, paired with the profile's
// PresentAbsent/PositiveNegative value binding; laterality rides on
// Observation.bodySite rather than being post-coordinated into the code.
// Atrophy uses a local code: SNOMED 1119438000 is a real concept but does not
// resolve against tx.fhir.org's served edition (ADR-0116).
* http://snomed.info/sct#111263009 "Acquired deformity of shoulder"
* http://snomed.info/sct#57427004 "Handedness"
* http://snomed.info/sct#1231437004 "Empty can test"
* http://snomed.info/sct#1231510004 "Lift-off test"

// SNOMED CT — patient history. Fixed by SmokingPackYearsObservation.
* http://snomed.info/sct#782516008 "Number of calculated smoking pack years"
