// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SmokingPackYearsObservation Profile                                       │
// │  Cumulative smoking exposure in pack-years, sibling to smoking status      │
// │  (expert consensus Q1.d)                                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: SmokingPackYearsObservation
Parent: ShoulderObservation
Id: smoking-pack-years-observation
Title: "Smoking Pack-Years Observation"
Description: """
Observation quantifying cumulative lifetime tobacco exposure in pack-years
(packs per day × years smoked), an elaboration of the unanimous-consensus
Q1.d "Smoking," which names no mechanism beyond current status. Sibling to
`SmokingStatusObservation`, not a replacement, status captures the current
category (current/former/never smoker), this profile captures cumulative
dose. Only meaningful for current/former smokers; omitted for never-smokers.

`Observation.code` is SNOMED CT `782516008` "Number of calculated smoking
pack years" (observable entity), no LOINC concept exists for cumulative
pack-years as a single reportable value (verified July 2026; LOINC's closest
matches, `8663-7`/`74011-8`/`88029-4`, capture current daily rate or generic
lifetime-use-per-period, not the packs-per-day × years product). `value[x]`
is `Quantity`, UCUM annotation `{pack-years}` (dimensionless product, same
annotation convention as this IG's `{score}` PROM/MMT axes).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/smoking-pack-years-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = http://snomed.info/sct#782516008 "Number of calculated smoking pack years"
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only Quantity
* valueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity.code = #{pack-years}

* valueQuantity ^minValueQuantity.value = 0
* valueQuantity ^minValueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity ^minValueQuantity.code = #{pack-years}
