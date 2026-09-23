// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  AtrophyObservation Profile                                                │
// │  Visual atrophy finding on shoulder inspection (consensus Q2.a, Q9.a)      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: AtrophyObservation
Parent: ShoulderObservation
Id: atrophy-observation
Title: "Atrophy Observation"
Description: """
Observation documenting whether visible muscle atrophy (e.g. supraspinatus or
infraspinatus fossa hollowing) is present on visual inspection of the
shoulder. Visual inspection is captured as three structured findings
(alongside DeformityObservation and NormalShoulderContourObservation) rather
than as free text, which could not be analysed across the registry.

SNOMED CT 1119438000 "Atrophy of muscle of shoulder" is a laterality-neutral
disorder/finding-hierarchy concept for this axis, but it does not resolve
against the SNOMED CT International Edition snapshot (version 20250201)
served by this IG's pinned terminology server, tx.fhir.org: `$lookup` returns
"Unable to find code '1119438000'". The concept was introduced in a later
SNOMED release than the edition currently served. A local code
(ShoulderObservationCodes#atrophy) is therefore used pending re-verification
once the served edition catches up; the value is bound to the standard SNOMED
present/absent qualifiers either way. Laterality is carried separately via
Observation.bodySite, not folded into the code. Pre-treatment and
post-treatment inspection are distinguished by effectiveDateTime relative to
the index procedure, so a single profile covers both expert consensus Q2.a
and Q9.a.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/atrophy-observation"
* ^version = "0.3.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-30"

* code = ShoulderObservationCodes#atrophy
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from PresentAbsent (required)
