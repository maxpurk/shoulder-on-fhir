// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffQuestionnaireResponse Profile                                  │
// │  Structured capture of multi-item PROM instruments                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: RotatorCuffQuestionnaireResponse
Parent: QuestionnaireResponse
Id: rotator-cuff-questionnaire-response
Title: "Rotator Cuff Questionnaire Response"
Description: """
Profile for capturing responses to multi-item Patient-Reported Outcome Measure
(PROM) instruments used in rotator cuff surgery registries. The IG carries only
the expert consensus Q12 preferred instruments: the Constant-Murley score and the
SSV/SANE pair the answer statement names. Each instrument is represented as a FHIR
Questionnaire; this profile constrains the corresponding QuestionnaireResponse
to link it to a ShoulderPatient subject.

For single-value composite scores (Constant-Murley total, SSV, SANE), use
ShoulderObservation with the corresponding code (SNOMED CT 273383002 for
Constant-Murley; local ShoulderObservationCodes #ssv-score / #sane-score)
instead of a full QuestionnaireResponse.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-questionnaire-response"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-06-07"

// ── Questionnaire reference ───────────────────────────────────────────────────
* questionnaire 1..1 MS

// ── Status ────────────────────────────────────────────────────────────────────
* status 1..1 MS

// ── Subject (Patient Reference) ───────────────────────────────────────────────
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ── Authored date ─────────────────────────────────────────────────────────────
* authored MS

// ── Items ─────────────────────────────────────────────────────────────────────
* item MS
