Profile: TendonsInvolvedObservation
Parent: ShoulderObservation
Id: tendons-involved-observation
Title: "Tendons Involved Observation"
Description: """
Observation recording which rotator cuff tendon is torn, as read from imaging
or seen at operation. Covers expert consensus element Q4.b (tendons involved).

One Observation is recorded per affected tendon. A multi-tendon tear is
therefore several Observations, each linked back to the index
`RotatorCuffCondition` through `Condition.evidence.detail`. This is the same
structured-evidence pattern used by `PatteObservation`,
`GoutallierObservation`, and `TearSizeClassificationObservation`.

The tendon code carries anatomy only. The affected side is carried once, on
`RotatorCuffCondition.bodySite`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tendons-involved-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-24"
* code = ShoulderObservationCodes#tendons-involved
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from TendonsInvolved (extensible)
