// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SportsParticipationObservation Profile                                    │
// │  Pre-treatment sports participation level (expert consensus Q1.j)          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: SportsParticipationObservation
Parent: ShoulderObservation
Id: sports-participation-observation
Title: "Sports Participation Observation"
Description: """
Observation documenting the patient's pre-treatment level of sports
participation. Four-tier ordinal (none / recreational / competitive /
professional), the sports-medicine return-to-sport stratification,
strictly more informative than the plain yes/no participation flag used by
some peer registries (the `none` grade already subsumes that distinction),
and coarsely comparable to DART's `DEM-08` "Activity level (pre-injury)"
enum and to the Tegner Activity Scale.

The expert consensus names only "Sports" without specifying a mechanism. A
coded ordinal is used rather than a free-text description of sport, frequency,
and competitive level, which would not be comparable across patients.

No suitable LOINC or SNOMED CT code exists for level/type of pre-treatment
sport participation, so a local code (ShoulderObservationCodes#sports-participation)
is used. The existing ReturnToActivityObservation (#return-to-sport-work) covers
the post-treatment return outcome only, these are clinically distinct and use
different scales.

Expert consensus Q1.j (unanimous consensus), required patient-history element.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sports-participation-observation"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"

* code = ShoulderObservationCodes#sports-participation
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from SportsParticipationLevel (required)
