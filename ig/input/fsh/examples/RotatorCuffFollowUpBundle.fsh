// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Follow-up example — Anna Müller, 6-week post-operative visit               │
// │  Per-visit submission for the already-registered patient.                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// The 6-week visit on 2024-05-27 is the first research follow-up timepoint (Q11).
// The bundle adds one Encounter and the visit Observations; Patient, Condition,
// and Procedure already exist from the earlier submissions.

Instance: AnnaFu6wEncounter
InstanceOf: ShoulderEncounter
Title: "Anna Müller: 6-week follow-up encounter"
Description: "The 6-week post-operative follow-up visit on 2024-05-27."
Usage: #example
* status = #finished
* class = http://terminology.hl7.org/CodeSystem/v3-ActCode#AMB "ambulatory"
* type = http://snomed.info/sct#390906007 "Follow-up encounter"
* subject = Reference(AnnaMueller)
* period.start = "2024-05-27T10:00:00+02:00"
* period.end = "2024-05-27T10:25:00+02:00"
* reasonReference = Reference(AnnaRotatorCuffTear)


Instance: AnnaFu6wFlexion
InstanceOf: ShoulderFlexionObservation
Title: "Anna Müller: 6-week active shoulder flexion"
Description: "Active shoulder flexion of 80° at 6 weeks; active motion is limited during the early sling-protected phase."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = http://loinc.org#41389-8 "Shoulder Flexion Active Range of Motion Quantitative"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaFu6wEncounter)
* effectiveDateTime = "2024-05-27"
* valueQuantity = 80 'deg' "degrees"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"


Instance: AnnaFu6wPassiveFlexion
InstanceOf: ShoulderPassiveFlexionObservation
Title: "Anna Müller: 6-week passive shoulder flexion"
Description: "Passive shoulder flexion of 120° at 6 weeks, ahead of active motion under the early protocol."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = http://loinc.org#41390-6 "Shoulder Flexion Passive Range of Motion Quantitative"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaFu6wEncounter)
* effectiveDateTime = "2024-05-27"
* valueQuantity = 120 'deg' "degrees"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"


Instance: AnnaFu6wPain
InstanceOf: PainAverageObservation
Title: "Anna Müller: 6-week average pain"
Description: "Average pain of 5 out of 10 at 6 weeks."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = ShoulderObservationCodes#pain-average "Pain Severity — On Average"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaFu6wEncounter)
* effectiveDateTime = "2024-05-27"
* valueQuantity = 5 '{score}' "pain score"


Instance: AnnaFu6wConstant
InstanceOf: ConstantScoreObservation
Title: "Anna Müller: 6-week Constant-Murley score"
Description: "Constant-Murley total of 44 at 6 weeks, up from the pre-operative 38. Entered directly as a total."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
* code = http://snomed.info/sct#273383002 "Constant and Murley shoulder assessment score"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaFu6wEncounter)
* effectiveDateTime = "2024-05-27"
* focus = Reference(AnnaRotatorCuffTear)
* valueQuantity = 44 '{score}' "points"


Instance: AnnaFu6wSsv
InstanceOf: SsvScoreObservation
Title: "Anna Müller: 6-week Subjective Shoulder Value"
Description: "Subjective Shoulder Value of 45 out of 100 at 6 weeks."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
* code = ShoulderObservationCodes#ssv-score "Subjective Shoulder Value"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaFu6wEncounter)
* effectiveDateTime = "2024-05-27"
* focus = Reference(AnnaRotatorCuffTear)
* valueQuantity = 45 '%' "%"


Instance: AnnaFollowUpBundle
InstanceOf: RotatorCuffFollowUpBundle
Title: "Anna Müller: follow-up bundle (6 weeks)"
Description: "Transaction bundle for the 6-week post-operative visit: one Encounter and the visit Observations (range of motion, average pain, and the Constant-Murley and SSV scores). Patient, Condition, and Procedure are referenced by persisted ID."
Usage: #example
* type = #transaction

* entry[encounter].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Encounter/AnnaFu6wEncounter"
* entry[encounter].resource = AnnaFu6wEncounter
* entry[encounter].request.method = #POST
* entry[encounter].request.url = "Encounter"

* entry[observation][0].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFu6wFlexion"
* entry[observation][0].resource = AnnaFu6wFlexion
* entry[observation][0].request.method = #POST
* entry[observation][0].request.url = "Observation"

* entry[observation][1].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFu6wPassiveFlexion"
* entry[observation][1].resource = AnnaFu6wPassiveFlexion
* entry[observation][1].request.method = #POST
* entry[observation][1].request.url = "Observation"

* entry[observation][2].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFu6wPain"
* entry[observation][2].resource = AnnaFu6wPain
* entry[observation][2].request.method = #POST
* entry[observation][2].request.url = "Observation"

* entry[observation][3].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFu6wConstant"
* entry[observation][3].resource = AnnaFu6wConstant
* entry[observation][3].request.method = #POST
* entry[observation][3].request.url = "Observation"

* entry[observation][4].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFu6wSsv"
* entry[observation][4].resource = AnnaFu6wSsv
* entry[observation][4].request.method = #POST
* entry[observation][4].request.url = "Observation"
