Profile: TearSizeClassificationObservation
Parent: ShoulderObservation
Id: tear-size-classification-observation
Title: "Tear Size Classification Observation (Cofield)"
Description: "Observation documenting the categorical Cofield bucket of rotator cuff tear size (small / medium / large / massive), determined pre-operatively from imaging. Covers expert consensus Q4.a (size, categorical decomposition, imaging context). Sibling to TearSizeObservation, which captures the continuous linear measurement in cm in the same context; the intra-operative direct measurement is captured by IntraopTearSizeClassificationObservation."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-classification-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-26"
* code = ShoulderObservationCodes#tear-size-classification
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from CofieldTearSizeClassification (required)
