// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderObservationCodes                                                  │
// │  Local CodeSystem for shoulder observation types that have no standard     │
// │  LOINC or SNOMED CT equivalent. The ValueSet that includes it is           │
// │  ShoulderObservationCode, in valuesets/ShoulderObservationCode.fsh.        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: ShoulderObservationCodes
Id: shoulder-observation
Title: "Shoulder Observation CodeSystem"
Description: "CodeSystem for shoulder-specific observation types."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/shoulder-observation"
* ^version = "0.1.7"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-30"
* ^caseSensitive = true
* ^content = #complete
* ^count = 44

// ── Imaging classifications ───────────────────────────────────────────────────

* #patte-classification "Patte Classification"
    "Tendon retraction classification according to Patte"

* #goutallier-classification "Goutallier Classification"
    "Fatty infiltration classification according to Goutallier"

* #tendons-involved "Tendons Involved"
    "Rotator cuff tendon involvement: which tendon(s) are affected by the tear, derived from imaging or intra-operative findings. Value bound to TendonsInvolved (SNOMED CT anatomy codes for the four rotator cuff tendons). One Observation per affected tendon; multi-tendon involvement is captured as multiple Observations linked from the index Condition via evidence.detail. No SNOMED CT observable_entity or LOINC concept exists for tendon involvement as of authoring (verified May 2026)."

* #tear-location "Tear Location"
    "Location of the rotator cuff tear along the affected tendon's course: near the insertion, at the musculotendinous junction, or intratendinous. Value bound to TearLocation. Distinct from Patte classification, which grades how far the torn stump has retracted, not where the tear originates. No SNOMED CT or LOINC concept exists for this axis as of authoring (verified July 2026)."

* #tear-thickness "Tear Thickness"
    "Whether the rotator cuff tear is full-thickness or partial-thickness (expert consensus Q4.c), decoupled from Condition.code. Value bound to TearThickness (SNOMED CT 202843000/202842005, reused as Observation values)."

// ── Range of motion ───────────────────────────────────────────────────────────
// Flexion, Abduction, and at-side External Rotation stay coded directly via
// LOINC (flexion 41389-8/41390-6, abduction 41381-5/41382-3, external
// rotation 41387-2/41388-0). See ADR-0045.
//
// At-side Internal Rotation uses the local codes below: it is recorded on a
// vertebral-level ordinal rather than in degrees, because degrees are
// confounded by scapulothoracic substitution. Rotation measured at 90°
// abduction is also local — no LOINC or SNOMED code exists for a
// position-specific rotation measurement. See ADR-0088.

* #internal-rotation "Internal Rotation (at side, active)"
    "Active shoulder internal rotation at the side (adducted), recorded on the InternalRotationVertebralLevel 'hand behind back' ordinal. No precoordinated SNOMED CT or LOINC ordinal value codes exist for this axis (verified July 2026)."

* #passive-internal-rotation "Internal Rotation (at side, passive)"
    "Passive shoulder internal rotation at the side (adducted), recorded on the InternalRotationVertebralLevel 'hand behind back' ordinal. No precoordinated SNOMED CT or LOINC ordinal value codes exist for this axis (verified July 2026)."

* #external-rotation-90-abduction "External Rotation at 90° Abduction (active)"
    "Active shoulder external rotation measured with the arm abducted to 90°, in degrees. Distinct from at-side ER (LOINC 41387-2). No precoordinated LOINC or SNOMED CT code exists for a position-specific rotation measurement (verified July 2026)."

* #passive-external-rotation-90-abduction "External Rotation at 90° Abduction (passive)"
    "Passive shoulder external rotation measured with the arm abducted to 90°, in degrees. Distinct from at-side ER (LOINC 41388-0). No precoordinated LOINC or SNOMED CT code exists for a position-specific rotation measurement (verified July 2026)."

* #internal-rotation-90-abduction "Internal Rotation at 90° Abduction (active)"
    "Active shoulder internal rotation measured with the arm abducted to 90°, in degrees, a controlled, goniometer-reliable position distinct from at-side IR (vertebral-level ordinal, #internal-rotation). No precoordinated LOINC or SNOMED CT code exists for a position-specific rotation measurement (verified July 2026)."

* #passive-internal-rotation-90-abduction "Internal Rotation at 90° Abduction (passive)"
    "Passive shoulder internal rotation measured with the arm abducted to 90°, in degrees, a controlled, goniometer-reliable position distinct from at-side IR (vertebral-level ordinal, #passive-internal-rotation). No precoordinated LOINC or SNOMED CT code exists for a position-specific rotation measurement (verified July 2026)."

// ── Strength testing ──────────────────────────────────────────────────────────

* #supraspinatus-strength "Supraspinatus Strength"
    "Supraspinatus muscle strength grading (MMT 0–5 scale, Janda grading). Tested with the empty-can / Jobe position. Use valueQuantity with UCUM unit {score} (0–5 ordinal). No SNOMED CT observable entity or LOINC concept exists for a supraspinatus-specific or 'Janda' strength axis (verified July 2026; only the generic, non-muscle-specific SNOMED#249956007 'MRC grade - muscle power' and LOINC#80322-1 'Muscle strength' exist)."

* #external-rotation-strength "External Rotation Strength (Composite: Infraspinatus + Teres Minor)"
    "Composite external-rotation strength grading on the MMT 0–5 scale. Tested at 0° abduction with elbow flexed at 90°; resisted external rotation. Reflects combined infraspinatus + teres minor function, these two muscles are not isolated by manual muscle testing in clinical practice (Patte / Hornblower tests are used to flag isolated teres minor involvement, recorded separately as #hornblower-test). Use valueQuantity with UCUM unit {score} (0–5 ordinal)."

* #subscapularis-strength "Subscapularis Strength"
    "Subscapularis muscle strength grading on the MMT 0–5 scale. Tested via lift-off (Gerber) or belly-press position, graded for force. Use valueQuantity with UCUM unit {score} (0–5 ordinal). Clinically distinct from the binary lift-off / belly-press / bear-hug provocation tests (#lift-off-test, #belly-press-test, #bear-hug-test), which record positive/negative function rather than graded strength."

// ADR-0089: surgeon feedback — Supraspinatus is unreliable to grade ordinally
// (dynamometry supplements it) and Internal Rotation lacked a composite
// mirror-position strength axis (only the subscapularis-specific isolation
// test existed). Both new, both local — no LOINC/SNOMED code exists for
// shoulder dynamometry or a "Janda" grading eponym (verified July 2026).

* #supraspinatus-strength-dynamometry "Supraspinatus Strength (Dynamometry)"
    "Supraspinatus muscle strength as a continuous kg force reading via handheld/spring dynamometry, tested at 90° scapular-plane abduction (same position as #supraspinatus-strength's ordinal grade). Use valueQuantity with UCUM unit kg. Sibling to #supraspinatus-strength (dual encoding, mirrors the tear-size cm + Cofield-bucket pattern), not a replacement. No SNOMED CT or LOINC concept exists for shoulder dynamometry (verified July 2026)."

* #internal-rotation-strength "Internal Rotation Strength (Composite)"
    "Composite internal-rotation strength grading on the MMT 0–5 scale. Tested at 0° abduction with elbow flexed at 90°; resisted internal rotation, the mirror position of #external-rotation-strength. Reflects combined subscapularis + secondary internal rotator (pectoralis major / latissimus dorsi / teres major) function. Use valueQuantity with UCUM unit {score} (0–5 ordinal). Clinically distinct from #subscapularis-strength (lift-off/belly-press isolation testing)."

// ── Provocation tests ─────────────────────────────────────────────────────────
// Jobe and lift-off are not here: SNOMED CT has precoordinated procedure
// concepts for both (Empty can test 1231437004, syn. "Jobe test"; Lift-off
// test 1231510004, syn. "Gerber test"), fixed directly on JobeTestObservation
// and LiftOffTestObservation. Belly-press, bear-hug and hornblower have no
// equivalent procedure concept and stay local (verified July 2026).

* #belly-press-test "Belly Press Test"
    "Subscapularis function test: patient presses hand into abdomen while maintaining wrist extension. Result recorded as positive/negative."

* #bear-hug-test "Bear Hug Test"
    "Subscapularis function test: patient resists removal of hand placed on opposite shoulder with elbow elevated. Result recorded as positive/negative."

* #hornblower-test "Hornblower Test (Signe du Clairon)"
    "Teres minor function test: examiner raises arm to 90° abduction and 90° external rotation; patient cannot actively maintain external rotation (positive = arm drops into internal rotation). Result recorded as positive/negative."

// ── Tear morphology ───────────────────────────────────────────────────────────

* #tear-size "Tear Size"
    "Maximum tear diameter in centimetres, measured on MRI or intra-operatively (UCUM unit: cm). Linear measurement; paired with #tear-size-classification when the categorical Cofield bucket is also captured."

* #tear-size-classification "Tear Size Classification (Cofield)"
    "Categorical Cofield bucket for rotator cuff tear size: small (<1 cm), medium (1–3 cm), large (3–5 cm), massive (>5 cm). Value bound to CofieldTearSizeClassification. Sibling to #tear-size (linear cm), both expert consensus Q4.a sub-elements; capture both when known so downstream consumers do not need to re-bucket."

// ── Patient-reported outcome measures (PROMs) ─────────────────────────────────

// Constant-Murley score TOTAL is coded via SNOMED CT 273383002 (assessment
// scale); see ConstantScoreObservation.fsh. The four sub-component codes
// below (ADR-0090) are local — no LOINC/SNOMED concept exists for any of
// them (verified July 2026) — fixed on Observation.component[x].code, not
// Observation.code (which stays SNOMED#273383002 on the total).
//
// Only the expert consensus Q12 preferred instruments are carried as IG PROMs:
// Constant-Murley (SNOMED 273383002) and the SSV/SANE pair the answer statement names.
// ASES, WORC, DASH, and QuickDASH were removed per ADR-0054 — they did not
// pass Hurley's 80% Delphi consensus threshold.

* #constant-score-pain "Constant-Murley: Pain (0-15)"
    "Pain sub-score of the Constant-Murley composite (original 1987 breakdown: 0-15 of 100). Patient-reported. Captured as Observation.component[Pain] on ConstantScoreObservation, present only in component-derived entry mode. No LOINC/SNOMED concept exists for this sub-component (verified July 2026)."

* #constant-score-adl "Constant-Murley: Activities of Daily Living (0-20)"
    "ADL sub-score of the Constant-Murley composite (original 1987 breakdown: 0-20 of 100). Patient-reported. Captured as Observation.component[ADL] on ConstantScoreObservation, present only in component-derived entry mode. No LOINC/SNOMED concept exists for this sub-component (verified July 2026)."

* #constant-score-rom "Constant-Murley: Range of Motion (0-40)"
    "Range-of-motion sub-score of the Constant-Murley composite (original 1987 breakdown: 0-40 of 100). Examiner-graded via banded functional milestones for the four movements (flexion/abduction/external rotation/internal rotation) scored on active, painless motion, clinically distinct from, and not derived from, this IG's degree-valued and vertebral-level ROM Observations captured elsewhere. Captured as Observation.component[ROM] on ConstantScoreObservation, present only in component-derived entry mode. No LOINC/SNOMED concept exists for this sub-component (verified July 2026)."

* #constant-score-strength "Constant-Murley: Strength (0-25)"
    "Strength sub-score of the Constant-Murley composite (original 1987 breakdown: 0-25 of 100), a single spring-balance/dynamometer-derived point value, clinically distinct from #supraspinatus-strength-dynamometry, which is a different clinical test. Captured as Observation.component[Strength] on ConstantScoreObservation, present only in component-derived entry mode. No LOINC/SNOMED concept exists for this sub-component (verified July 2026)."

* #ssv-score "Subjective Shoulder Value"
    "Subjective Shoulder Value (SSV): patient self-rates the shoulder as a percentage of an entirely normal shoulder, which would score 100% (Gilbart and Gerber 2007). A separately published instrument from the Single Assessment Numeric Evaluation, asking for the same kind of single rating. No equivalent code exists in SNOMED CT International Edition or LOINC at the time of authoring; local code used."

* #sane-score "SANE Score"
    "Single Assessment Numeric Evaluation (SANE): patient rates the shoulder today as a percentage of normal, on a 0–100% scale with 100% being normal (Williams et al. 1999). A separately published instrument from the Subjective Shoulder Value, asking for the same kind of single rating. No equivalent code exists in SNOMED CT International Edition or LOINC at the time of authoring; local code used."

// ── Patient characteristics ───────────────────────────────────────────────────
// Hand dominance is not here: SNOMED CT has a precoordinated observable entity
// (Handedness 57427004), fixed directly on HandDominanceObservation.

// ── Physical examination — visual inspection ──────────────────────────────────
// Visual inspection is three structured present/absent findings rather than one
// free-text item (ADR-0086). Deformity is not here: DeformityObservation fixes
// the laterality-neutral SNOMED concept 111263009 "Acquired deformity of
// shoulder" as Observation.code, with a standard present/absent value — the
// accepted FHIR pattern when no observable-entity concept exists.
//
// The other two stay local. #normal-shoulder-contour has no finding-hierarchy
// concept beyond the over-generic "Finding of shoulder region" 116308004.
// #atrophy has one — SNOMED 1119438000 "Atrophy of muscle of shoulder" — but
// it does not resolve against tx.fhir.org's served SNOMED CT International
// Edition snapshot (20250201), this IG's pinned terminology server, so the
// local code stands until that edition catches up (ADR-0116).

* #atrophy "Atrophy"
    "Whether visible muscle atrophy (e.g. supraspinatus or infraspinatus fossa hollowing) is present on visual inspection. SNOMED CT 1119438000 'Atrophy of muscle of shoulder' exists as a real concept but does not resolve against tx.fhir.org's currently-served SNOMED edition (verified July 2026), local code used pending re-verification. Value bound to standard SNOMED present/absent qualifiers."

* #normal-shoulder-contour "Normal Shoulder Contour"
    "Overall gestalt assessment of whether the shoulder contour is normal on visual inspection, distinct from and complementary to the specific atrophy and deformity findings. No laterality-neutral SNOMED CT concept, observable-entity or finding/disorder, exists for this axis (verified July 2026); value bound to standard SNOMED present/absent qualifiers."

// ── Physical examination — pain severity ───────────────────────────────────────
// Pain is four context-specific 0-10 measurements rather than one generic score
// (LOINC 72514-3), which cannot distinguish the contexts. See ADR-0087.

* #pain-average "Pain Severity — On Average"
    "Patient-reported shoulder pain severity on average, 0-10 numeric rating. No precoordinated LOINC or SNOMED CT concept exists for 'average pain' as a distinct question-level variable (verified July 2026)."

* #pain-active-movement "Pain Severity — With Active Movement"
    "Patient-reported shoulder pain severity during patient-generated active movement, 0-10 numeric rating. No precoordinated LOINC or SNOMED CT concept exists for this axis (verified July 2026)."

* #pain-passive-movement "Pain Severity — With Passive Movement"
    "Patient-reported shoulder pain severity during examiner-generated passive movement, 0-10 numeric rating. No precoordinated LOINC or SNOMED CT concept exists for this axis (verified July 2026)."

* #pain-rest "Pain Severity — At Rest"
    "Patient-reported shoulder pain severity at rest (no movement or loading), 0-10 numeric rating. No precoordinated LOINC or SNOMED CT concept exists for this axis (verified July 2026)."

// ── Patient history — sports participation ────────────────────────────────────

* #sports-participation "Sports Participation"
    "Patient's pre-treatment level of sports participation. Value bound to SportsParticipationLevel, a 4-tier ordinal (none / recreational / competitive / professional). No suitable LOINC or SNOMED CT ordinal value codes exist for level of pre-treatment sport participation as of authoring (verified July 2026); the existing #return-to-sport-work covers post-treatment status only."

// ── Patient history — sleep disturbance ───────────────────────────────────────

* #sleep-disturbance "Sleep Disturbance"
    "Degree to which the patient's sleep is disturbed specifically by the shoulder pathology being registered (expert consensus Q1.i). Value bound to SleepDisturbanceSeverity, a 3-tier ordinal (unaffected / occasionally disturbed / nightly disturbed) matching the Constant-Murley score's own ADL sleep sub-item. No SNOMED CT or LOINC concept exists for a graded, shoulder-attributed sleep-disturbance axis as of authoring (verified July 2026)."

// ── Patient history — occupation ────────────────────────────────────────────

* #occupational-physical-demand "Occupational Physical Demand"
    "Physical demand intensity category of the patient's occupation (sedentary / light manual / heavy manual), part of expert consensus Q1.k 'Occupation'. Value bound to OccupationalPhysicalDemand. No SNOMED CT or LOINC concept exists for this axis (verified July 2026)."

* #occupational-overhead-exposure "Occupational Overhead Exposure"
    "Whether the patient's occupation regularly involves overhead reaching or repetitive shoulder-loading tasks, part of expert consensus Q1.k 'Occupation', an axis independent of physical-demand intensity. Value bound to OccupationalOverheadExposure. No SNOMED CT or LOINC concept exists for this axis (verified July 2026)."

// ── Patient history — functional limitations ──────────────────────────────────

* #functional-limitation-severity "Functional Limitation Severity"
    "Five-tier functional-ceiling ordinal (no limitation / overhead-limited / shoulder-level-limited / below-shoulder-limited / unable to use the arm) for expert consensus Q1.n 'Functional limitations'. Value bound to FunctionalLimitationSeverity. Replaces a prior valueString free-text realisation, no SNOMED CT or LOINC concept exists for this axis (verified July 2026)."

// ── Patient history — prior treatment (bucketed counts) ───────────────────────

* #prior-physical-therapy-session-count "Prior Physical Therapy Session Count"
    "Bucketed count of prior physical-therapy sessions for the registered condition (≤10 / 11-20 / >20), part of expert consensus Q1.f 'Prior treatment'. Value bound to PriorPhysicalTherapySessionCount. No SNOMED CT or LOINC concept exists for this axis (verified July 2026)."

* #prior-injection-count "Prior Shoulder Injection Count"
    "Bucketed count of prior shoulder injections for the registered condition (1-3 / >3), part of expert consensus Q1.f 'Prior treatment'. Value bound to PriorInjectionCount. No SNOMED CT or LOINC concept exists for this axis (verified July 2026)."

// ── Patient activity return ───────────────────────────────────────────────────

* #return-to-sport-work "Return to Sport/Work"
    "Patient's ability to return to pre-injury sport or occupational activities. Value bound to ReturnToActivity."

// ── Procedure technique (postcoordination, ADR-0108) ──────────────────────────
// Decoupled from Procedure.code, mirroring the diagnosis-side "one axis, one
// element" pattern (ADR-0105/ADR-0106). Each linked to its RotatorCuffProcedure
// via Observation.partOf.

* #procedure-approach "Procedure Approach"
    "Surgical approach for the procedure (arthroscopic / open / mini-open). Value bound to ProcedureApproach (fully local, no SNOMED concept exists for a standalone 'arthroscopic approach' qualifier, verified July 2026)."

* #reconstruction-extent "Reconstruction Extent"
    "Extent of the rotator cuff procedure (partial repair / complete repair / prosthesis). Value bound to ReconstructionExtent (SNOMED CT concepts reused as Observation values)."

* #fixation-technique "Fixation Technique"
    "Suture-anchor fixation construct (single-row / double-row / suture-bridge / transosseous-no-anchor / not-applicable). Value bound to FixationTechnique (fully local, no SNOMED concept exists for this axis, verified July 2026)."


