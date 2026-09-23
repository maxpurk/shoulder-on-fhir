Profile: IntraopTearSizeObservation
Parent: ShoulderObservation
Id: intraop-tear-size-observation
Title: "Intra-operative Tear Size Observation"
Description: "Observation documenting maximum rotator cuff tear diameter in centimetres measured directly during surgery (intra-operative exam). Covers expert consensus Q4.a (size, continuous decomposition, surgical context). Sibling to TearSizeObservation, which captures the pre-operative imaging-derived measurement of the same concept; discrepancies between the pre-operative imaging estimate and the intra-operative direct measurement are clinically expected and meaningful, which is why both are modelled as distinct Observations differing only by acquisition context (category)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/intraop-tear-size-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-26"
* code = ShoulderObservationCodes#tear-size
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* value[x] only Quantity
* valueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity.code = #cm
