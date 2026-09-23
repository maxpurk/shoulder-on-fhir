Profile: SubscapularisStrengthObservation
Parent: ShoulderObservation
Id: subscapularis-strength-observation
Title: "Subscapularis Strength Observation"
Description: "Observation documenting subscapularis muscle strength on the 0–5 manual muscle testing scale (Janda grading; equivalent to MRC / Daniels-Worthingham 0–5), tested via lift-off or belly-press position, a subscapularis-specific isolation test, positioned to unload the secondary internal rotators. Covers expert consensus Q2.d (strength testing, pre-treatment) and Q9.d (post-treatment) for the subscapularis component of the rotator cuff. Clinically distinct from InternalRotationStrengthObservation, which tests composite internal-rotator strength at neutral, a positive lift-off/belly-press with normal composite internal-rotation strength points specifically at the subscapularis."
// Structural mirror of InternalRotationStrengthObservation (added per ADR-0089).
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/subscapularis-strength-observation"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#subscapularis-strength
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 5)
