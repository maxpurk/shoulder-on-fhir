Profile: InternalRotationStrengthObservation
Parent: ShoulderObservation
Id: internal-rotation-strength-observation
Title: "Internal Rotation Strength Observation"
Description: """
Observation documenting composite internal-rotation strength on the 0–5
manual muscle testing scale (Janda grading; equivalent to MRC /
Daniels-Worthingham 0–5). Tested at 0° abduction with elbow flexed at 90°;
resisted internal rotation, the structural mirror of
ExternalRotationStrengthObservation's tested position. Reflects combined
subscapularis + secondary internal rotator (pectoralis major / latissimus
dorsi / teres major) function.

Clinically distinct from subscapularis-specific isolation testing
(#subscapularis-strength, lift-off/belly-press), which uses
an internally-rotated/behind-the-back position to unload the secondary
internal rotators and isolate subscapularis tendon integrity specifically.
Composite resisted-IR-at-neutral strength is sensitive to global
internal-rotator weakness; lift-off/belly-press is sensitive to
subscapularis-tendon-specific competence, a positive lift-off/belly-press
with normal composite IR strength points specifically at the subscapularis.
Both are captured as independent sibling profiles; neither is redundant with
the other.

Covers expert consensus Q2.d (strength testing, pre-treatment) and Q9.d
(post-treatment). No LOINC or SNOMED CT code exists
for a "Janda" grading eponym (verified July 2026; nearest standard concept
is the generic SNOMED CT observable entity `249956007` "MRC grade - muscle
power", not bound here since this IG's local axis-per-muscle codes are more
clinically specific), a local code is used.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/internal-rotation-strength-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"
* code = ShoulderObservationCodes#internal-rotation-strength
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 5)
