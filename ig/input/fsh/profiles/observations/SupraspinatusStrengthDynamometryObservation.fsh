Profile: SupraspinatusStrengthDynamometryObservation
Parent: ShoulderObservation
Id: supraspinatus-strength-dynamometry-observation
Title: "Supraspinatus Strength Dynamometry Observation"
Description: """
Observation documenting supraspinatus muscle strength as a continuous
force measurement (kg) via handheld/spring dynamometry, tested at 90°
scapular-plane abduction (empty-can/Jobe position), the same test
position as SupraspinatusStrengthObservation's ordinal grade, different
instrument. Covers expert consensus Q2.d (strength testing, pre-treatment) and Q9.d
(post-treatment).

This profile complements the ordinal MMT/Janda 0–5 grade; both are recorded.
Ordinal manual muscle testing is well documented as insensitive to partial
supraspinatus weakness (grades 4–5 span a wide force range and are
examiner-dependent), while dynamometry at this single reproducible position
gives a reliable, continuous kg reading. The dual encoding mirrors this IG's
tear-size cm plus Cofield-bucket pattern. The ordinal grade is the faster,
no-equipment-needed default for cross-site comparability; dynamometry
supplements it when available. No LOINC or SNOMED CT code exists for shoulder dynamometry or
for a "Janda" grading eponym (verified July 2026), a local code is used.

Named "Supraspinatus Strength (Dynamometry)" (not "Abduction Strength"), "abduction strength" unqualified is ambiguous with deltoid-dominant gross
abduction testing, biomechanically distinct from this test's isolated,
internally-rotated empty-can/Jobe position.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/supraspinatus-strength-dynamometry-observation"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"
* code = ShoulderObservationCodes#supraspinatus-strength-dynamometry
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#kg, 0, 50)
