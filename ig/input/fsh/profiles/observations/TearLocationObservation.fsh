Profile: TearLocationObservation
Parent: ShoulderObservation
Id: tear-location-observation
Title: "Tear Location Observation"
Description: """
Observation documenting where a rotator cuff tear is located along the
affected tendon's course: near the insertion (footprint), at the
musculotendinous junction, or intratendinous. Treated as an in-scope
refinement of expert consensus Q4 (tear classification). The consensus names
tear classification without fixing which axes it decomposes into; this IG
decomposes it into location, alongside Patte (retraction) and Goutallier
(fatty infiltration).

Distinct from PatteObservation, which grades how far the torn stump has
retracted after the tear occurred, not where the tear originates. Linked to
the index RotatorCuffCondition via Condition.evidence.detail (same pattern as
TendonsInvolvedObservation), one Observation per diagnosis, not per tendon,
since tear location is assessed for the tear as a whole.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-location-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-13"
* code = ShoulderObservationCodes#tear-location
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from TearLocation (required)
