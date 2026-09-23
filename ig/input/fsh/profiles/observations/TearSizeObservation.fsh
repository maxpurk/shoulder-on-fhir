Profile: TearSizeObservation
Parent: ShoulderObservation
Id: tear-size-observation
Title: "Tear Size Observation"
Description: "Observation documenting maximum rotator cuff tear diameter in centimetres, measured pre-operatively from imaging (MRI/ultrasound). Covers expert consensus Q4.a (size, continuous decomposition, imaging context). Sibling to TearSizeClassificationObservation, which captures the categorical Cofield bucket in the same context; the intra-operative direct measurement is captured by IntraopTearSizeObservation."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-size-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-26"
* code = ShoulderObservationCodes#tear-size
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only Quantity
* valueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity.code = #cm
