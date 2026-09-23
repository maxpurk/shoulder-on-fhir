Profile: ExternalRotationStrengthObservation
Parent: ShoulderObservation
Id: external-rotation-strength-observation
Title: "External Rotation Strength Observation"
Description: "Observation documenting composite external-rotation strength on the 0–5 manual muscle testing scale (Janda grading; equivalent to MRC / Daniels-Worthingham 0–5). Tested at 0° abduction with elbow flexed at 90°; resisted external rotation. Reflects combined infraspinatus + teres minor function, these two muscles are not isolated by manual muscle testing in clinical practice (isolated teres minor involvement flagged separately via the Hornblower test, #hornblower-test). Covers expert consensus Q2.d (strength testing, pre-treatment) and Q9.d (post-treatment). Structural mirror of InternalRotationStrengthObservation, which tests the same position for the opposite rotation direction."
// Structural mirror of InternalRotationStrengthObservation (added per ADR-0089).
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/external-rotation-strength-observation"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#external-rotation-strength
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 5)
