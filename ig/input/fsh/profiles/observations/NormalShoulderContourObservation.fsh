// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  NormalShoulderContourObservation Profile                                  │
// │  Shoulder contour gestalt on inspection (consensus Q2.a, Q9.a)             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: NormalShoulderContourObservation
Parent: ShoulderObservation
Id: normal-shoulder-contour-observation
Title: "Normal Shoulder Contour Observation"
Description: """
Observation documenting the examiner's overall gestalt assessment of whether
the shoulder contour is normal on visual inspection, distinct from, and
complementary to, the two specific findings AtrophyObservation and
DeformityObservation. Visual inspection is captured as three structured
findings rather than as free text, which could not be analysed across the
registry.

No laterality-neutral SNOMED CT concept exists for this axis. Both the
observable-entity and the disorder/finding hierarchies were checked (July
2026); they yield usable concepts for the sibling AtrophyObservation and
DeformityObservation profiles, but only the over-generic "Finding of shoulder
region" 116308004 here. A local code
(ShoulderObservationCodes#normal-shoulder-contour) is used, with the value
bound to the standard SNOMED present/absent qualifiers. Pre-treatment and
post-treatment inspection are distinguished by effectiveDateTime relative to
the index procedure, so a single profile covers both expert consensus Q2.a
and Q9.a.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/normal-shoulder-contour-observation"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"

* code = ShoulderObservationCodes#normal-shoulder-contour
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PresentAbsent (required)
