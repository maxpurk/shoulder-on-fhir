Profile: IntraopTearSizeClassificationObservation
Parent: ShoulderObservation
Id: intraop-tear-size-classification-observation
Title: "Intra-operative Tear Size Classification Observation (Cofield)"
Description: "Observation documenting the categorical Cofield bucket (small / medium / large / massive) of rotator cuff tear size determined directly during surgery (intra-operative exam). Covers expert consensus Q4.a (size, categorical decomposition, surgical context). Sibling to TearSizeClassificationObservation, which captures the pre-operative imaging-derived bucket of the same concept; paired with IntraopTearSizeObservation for the continuous cm measurement in the same surgical context."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-classification-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-26"
* code = ShoulderObservationCodes#tear-size-classification
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only CodeableConcept
* valueCodeableConcept from CofieldTearSizeClassification (required)
