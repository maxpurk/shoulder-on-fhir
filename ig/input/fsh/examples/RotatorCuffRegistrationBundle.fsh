// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Registration example (T0) — Anna Müller                                   │
// │  Pre-operative registry submission: one Patient, one consultation          │
// │  Encounter, the rotator cuff tear plus a coexisting AC-joint diagnosis,     │
// │  the pre-operative MRI, and the baseline assessment Observations.           │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Anna Müller is a 52-year-old schoolteacher with an insidious, degenerative
// full-thickness supraspinatus tear of the right shoulder. She is seen on
// 2024-01-08; an MRI follows on 2024-01-22. The same Patient and Condition are
// referenced by the Surgery and Follow-Up example bundles.

Instance: AnnaMueller
InstanceOf: ShoulderPatient
Title: "Anna Müller (example patient)"
Description: "Example rotator cuff patient: a 52-year-old woman with a degenerative right supraspinatus tear. The instance also claims IPS Patient-uv-ips conformance."
Usage: #example
* meta.profile[+] = "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips"
* identifier[0].system = "https://maxpurk.github.io/shoulder-on-fhir/identifier/patient"
* identifier[0].value = "PAT-LONG-001"
* name[0].use = #official
* name[0].family = "Müller"
* name[0].given[0] = "Anna"
* gender = #female
* birthDate = "1971-04-12"
* address[0].use = #home
* address[0].line[0] = "Bertha-von-Suttner-Allee 7"
* address[0].city = "Potsdam"
* address[0].postalCode = "14471"
* address[0].country = "DE"


Instance: AnnaRegistrationEncounter
InstanceOf: ShoulderEncounter
Title: "Anna Müller: registration consultation"
Description: "Pre-operative registration consultation on 2024-01-08. It ranks the two diagnoses: the rotator cuff tear as the principal diagnosis (rank 1), the AC-joint osteoarthritis second (rank 2)."
Usage: #example
* status = #finished
* class = http://terminology.hl7.org/CodeSystem/v3-ActCode#AMB "ambulatory"
* type = http://snomed.info/sct#185349003 "Encounter for check up"
* subject = Reference(AnnaMueller)
* period.start = "2024-01-08T09:00:00+01:00"
* period.end = "2024-01-08T09:45:00+01:00"
* reasonReference = Reference(AnnaRotatorCuffTear)
* diagnosis[0].condition = Reference(AnnaRotatorCuffTear)
* diagnosis[0].rank = 1
* diagnosis[1].condition = Reference(AnnaAcJointOa)
* diagnosis[1].rank = 2


Instance: AnnaRotatorCuffTear
InstanceOf: RotatorCuffCondition
Title: "Anna Müller: rotator cuff tear (principal diagnosis)"
Description: "Degenerative full-thickness supraspinatus tendon tear of the right shoulder, the principal registration diagnosis. Tendon involvement, tear location, and tear thickness are linked evidence Observations; Patte and Goutallier grading link as staging assessments."
Usage: #example
* clinicalStatus = http://terminology.hl7.org/CodeSystem/condition-clinical#active
* category = http://terminology.hl7.org/CodeSystem/condition-category#encounter-diagnosis
* code = http://snomed.info/sct#926335004 "Rupture of rotator cuff of shoulder"
* code.text = "Full-thickness supraspinatus tendon tear, right shoulder"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* subject = Reference(AnnaMueller)
* onsetDateTime = "2023-12-22"
* recordedDate = "2024-01-08"
* extension[dueTo].valueCodeableConcept = http://snomed.info/sct#362975008 "Degenerative disorder"
* stage[0].assessment[0] = Reference(AnnaPatte)
* stage[0].assessment[1] = Reference(AnnaGoutallier)
* evidence[0].detail[0] = Reference(AnnaTendonSupraspinatus)
* evidence[0].detail[1] = Reference(AnnaTearLocation)
* evidence[0].detail[2] = Reference(AnnaTearThickness)


Instance: AnnaAcJointOa
InstanceOf: ShoulderDiagnosisCondition
Title: "Anna Müller: AC joint osteoarthritis (coexisting diagnosis)"
Description: "Incidental osteoarthritis of the acromioclavicular joint of the same shoulder, found on MRI. A coexisting non-rotator-cuff diagnosis, carried in the registration bundle's otherDiagnosis slice and ranked below the tear."
Usage: #example
* clinicalStatus = http://terminology.hl7.org/CodeSystem/condition-clinical#active
* verificationStatus = http://terminology.hl7.org/CodeSystem/condition-ver-status#confirmed
* category = http://terminology.hl7.org/CodeSystem/condition-category#encounter-diagnosis
* code = http://snomed.info/sct#239865003 "Osteoarthritis of acromioclavicular joint"
* code.text = "Mild AC joint osteoarthritis, right shoulder"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* subject = Reference(AnnaMueller)
* recordedDate = "2024-01-08"


Instance: AnnaShoulderMri
InstanceOf: ShoulderImagingStudy
Title: "Anna Müller: pre-operative shoulder MRI"
Description: "MRI of the right shoulder on 2024-01-22. The modality, its date, and the visit it belongs to are recorded; the imaging findings are carried as separate classification Observations."
Usage: #example
* status = #available
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* started = "2024-01-22T11:00:00+01:00"
* modality = http://dicom.nema.org/resources/ontology/DCM#MR "Magnetic Resonance"


Instance: AnnaTendonSupraspinatus
InstanceOf: TendonsInvolvedObservation
Title: "Anna Müller: tendon involved (supraspinatus)"
Description: "Supraspinatus tendon involvement, read from MRI. One Observation is emitted per affected tendon; here only the supraspinatus is torn."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* code = ShoulderObservationCodes#tendons-involved "Tendons Involved"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-22"
* valueCodeableConcept = http://snomed.info/sct#5580002 "Structure of tendon of supraspinatus muscle"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* method.text = "MRI assessment"


Instance: AnnaTearLocation
InstanceOf: TearLocationObservation
Title: "Anna Müller: tear location (near insertion)"
Description: "The tear sits near the tendon insertion (footprint), read from MRI."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* code = ShoulderObservationCodes#tear-location "Tear Location"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-22"
* valueCodeableConcept = TearLocationCodes#insertion-near "Near the insertion (footprint)"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* method.text = "MRI assessment"


Instance: AnnaTearThickness
InstanceOf: TearThicknessObservation
Title: "Anna Müller: tear thickness (full thickness)"
Description: "A full-thickness tear, read from MRI. The thickness is captured as its own Observation, separate from the diagnosis code."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* code = ShoulderObservationCodes#tear-thickness "Tear Thickness"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-22"
* valueCodeableConcept = http://snomed.info/sct#202843000 "Full thickness rotator cuff tear"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* method.text = "MRI assessment"


Instance: AnnaPatte
InstanceOf: PatteObservation
Title: "Anna Müller: Patte classification (Stage II)"
Description: "Patte stage II supraspinatus retraction, read from the pre-operative MRI."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* code = ShoulderObservationCodes#patte-classification "Patte Classification"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-22"
* valueCodeableConcept = PatteClassificationCodes#II "Stage II - Retracted tendon end at the humeral head"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* method.text = "MRI assessment"


Instance: AnnaGoutallier
InstanceOf: GoutallierObservation
Title: "Anna Müller: Goutallier classification (Grade 1)"
Description: "Goutallier grade 1 fatty infiltration of the supraspinatus, read from the pre-operative MRI."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* code = ShoulderObservationCodes#goutallier-classification "Goutallier Classification"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-22"
* valueCodeableConcept = GoutallierClassificationCodes#1 "Grade 1 – Some fatty streaks"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* method.text = "MRI assessment - supraspinatus muscle"


Instance: AnnaFlexionBaseline
InstanceOf: ShoulderFlexionObservation
Title: "Anna Müller: baseline active shoulder flexion"
Description: "Active shoulder flexion of 110° at the registration consultation (reduced; normal is about 180°)."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = http://loinc.org#41389-8 "Shoulder Flexion Active Range of Motion Quantitative"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-08"
* valueQuantity = 110 'deg' "degrees"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"


Instance: AnnaHandDominance
InstanceOf: HandDominanceObservation
Title: "Anna Müller: hand dominance (right)"
Description: "Right-hand dominant. The tear is on the dominant side."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* code = http://snomed.info/sct#57427004 "Handedness"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-08"
* valueCodeableConcept = http://snomed.info/sct#46669005 "Right handed"


Instance: AnnaConstantBaseline
InstanceOf: ConstantScoreObservation
Title: "Anna Müller: baseline Constant-Murley score"
Description: "Pre-operative Constant-Murley total of 38, entered from its four sub-scores (Pain 4/15, ADL 4/20, ROM 20/40, Strength 10/25)."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
* code = http://snomed.info/sct#273383002 "Constant and Murley shoulder assessment score"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaRegistrationEncounter)
* effectiveDateTime = "2024-01-08"
* focus = Reference(AnnaRotatorCuffTear)
* valueQuantity = 38 '{score}' "points"
* component[Pain].valueQuantity = 4 '{score}' "points"
* component[ADL].valueQuantity = 4 '{score}' "points"
* component[ROM].valueQuantity = 20 '{score}' "points"
* component[Strength].valueQuantity = 10 '{score}' "points"


Instance: AnnaRegistrationBundle
InstanceOf: RotatorCuffRegistrationBundle
Title: "Anna Müller: registration bundle (T0)"
Description: "Transaction bundle for the pre-operative registration: Patient, consultation Encounter, the rotator cuff tear and the coexisting AC-joint diagnosis, the pre-operative MRI, and the baseline assessment Observations. The surgical procedure is submitted later, in the surgery bundle."
Usage: #example
* type = #transaction

* entry[patient].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Patient/AnnaMueller"
* entry[patient].resource = AnnaMueller
* entry[patient].request.method = #POST
* entry[patient].request.url = "Patient"

* entry[encounter].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Encounter/AnnaRegistrationEncounter"
* entry[encounter].resource = AnnaRegistrationEncounter
* entry[encounter].request.method = #POST
* entry[encounter].request.url = "Encounter"

* entry[condition].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Condition/AnnaRotatorCuffTear"
* entry[condition].resource = AnnaRotatorCuffTear
* entry[condition].request.method = #POST
* entry[condition].request.url = "Condition"

* entry[otherDiagnosis].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Condition/AnnaAcJointOa"
* entry[otherDiagnosis].resource = AnnaAcJointOa
* entry[otherDiagnosis].request.method = #POST
* entry[otherDiagnosis].request.url = "Condition"

* entry[imagingStudy].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/ImagingStudy/AnnaShoulderMri"
* entry[imagingStudy].resource = AnnaShoulderMri
* entry[imagingStudy].request.method = #POST
* entry[imagingStudy].request.url = "ImagingStudy"

* entry[observation][0].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaTendonSupraspinatus"
* entry[observation][0].resource = AnnaTendonSupraspinatus
* entry[observation][0].request.method = #POST
* entry[observation][0].request.url = "Observation"

* entry[observation][1].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaTearLocation"
* entry[observation][1].resource = AnnaTearLocation
* entry[observation][1].request.method = #POST
* entry[observation][1].request.url = "Observation"

* entry[observation][2].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaTearThickness"
* entry[observation][2].resource = AnnaTearThickness
* entry[observation][2].request.method = #POST
* entry[observation][2].request.url = "Observation"

* entry[observation][3].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaPatte"
* entry[observation][3].resource = AnnaPatte
* entry[observation][3].request.method = #POST
* entry[observation][3].request.url = "Observation"

* entry[observation][4].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaGoutallier"
* entry[observation][4].resource = AnnaGoutallier
* entry[observation][4].request.method = #POST
* entry[observation][4].request.url = "Observation"

* entry[observation][5].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFlexionBaseline"
* entry[observation][5].resource = AnnaFlexionBaseline
* entry[observation][5].request.method = #POST
* entry[observation][5].request.url = "Observation"

* entry[observation][6].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaHandDominance"
* entry[observation][6].resource = AnnaHandDominance
* entry[observation][6].request.method = #POST
* entry[observation][6].request.url = "Observation"

* entry[observation][7].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaConstantBaseline"
* entry[observation][7].resource = AnnaConstantBaseline
* entry[observation][7].request.method = #POST
* entry[observation][7].request.url = "Observation"
