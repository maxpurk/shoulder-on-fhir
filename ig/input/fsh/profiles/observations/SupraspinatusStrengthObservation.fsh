Profile: SupraspinatusStrengthObservation
Parent: ShoulderObservation
Id: supraspinatus-strength-observation
Title: "Supraspinatus Strength Observation"
// Named "Supraspinatus Strength" (not "Abduction Strength") deliberately, // "abduction strength" unqualified is ambiguous with deltoid-dominant gross
// abduction testing, biomechanically distinct from this test's isolated,
// internally-rotated empty-can/Jobe position. See ADR-0114.
Description: "Observation documenting supraspinatus muscle strength on the 0–5 manual muscle testing scale (Janda grading; equivalent to MRC / Daniels-Worthingham 0–5). Tested with the empty-can / Jobe position, a scapular-plane abduction position with the arm internally rotated. Covers expert consensus Q2.d (strength testing, pre-treatment) and Q9.d (post-treatment). Sibling to SupraspinatusStrengthDynamometryObservation (continuous kg force at the same position), this ordinal grade remains the faster, no-equipment-needed default."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-observation"
* ^version = "0.1.3"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"
* code = ShoulderObservationCodes#supraspinatus-strength
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 5)
