// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  DeformityObservation Profile                                              │
// │  Visible shoulder deformity finding on inspection (consensus Q2.a, Q9.a)   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: DeformityObservation
Parent: ShoulderObservation
Id: deformity-observation
Title: "Deformity Observation"
Description: """
Observation documenting whether a visible shoulder deformity (e.g. superior
humeral head prominence, asymmetry) is present on visual inspection of the
shoulder. Visual inspection is captured as three structured findings
(alongside AtrophyObservation and NormalShoulderContourObservation) rather
than as free text, which could not be analysed across the registry.

Coded via SNOMED CT 111263009 "Acquired deformity of shoulder", a
laterality-neutral disorder/finding-hierarchy concept, used as
Observation.code paired with the standard SNOMED present/absent value
qualifiers, a recognised FHIR pattern when no observable-entity concept
exists for an axis. Laterality is carried separately via
Observation.bodySite, not folded into the code. Pre-treatment and
post-treatment inspection are distinguished by effectiveDateTime relative to
the index procedure, so a single profile covers both expert consensus Q2.a
and Q9.a.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/deformity-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"

* code = http://snomed.info/sct#111263009 "Acquired deformity of shoulder"
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PresentAbsent (required)
