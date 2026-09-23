// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Surgery example (T1) — Anna Müller                                        │
// │  Surgical-event submission for the already-registered patient.             │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// On 2024-04-15 Anna has an arthroscopic single-row suture-anchor repair of the
// right supraspinatus, with a concomitant distal clavicle excision (Mumford) for
// the AC-joint osteoarthritis. Patient and Condition were established by the
// registration bundle and are referenced by their persisted IDs.

Instance: AnnaSurgeryEncounter
InstanceOf: ShoulderEncounter
Title: "Anna Müller: surgical encounter"
Description: "Inpatient encounter for the index rotator cuff repair on 2024-04-15."
Usage: #example
* status = #finished
* class = http://terminology.hl7.org/CodeSystem/v3-ActCode#IMP "inpatient encounter"
* type = http://snomed.info/sct#308335008 "Patient encounter procedure"
* subject = Reference(AnnaMueller)
* period.start = "2024-04-15T07:30:00+02:00"
* period.end = "2024-04-15T11:00:00+02:00"
* reasonReference = Reference(AnnaRotatorCuffTear)


Instance: AnnaIndexRepair
InstanceOf: RotatorCuffProcedure
Title: "Anna Müller: index repair (arthroscopic)"
Description: "The index surgical procedure: arthroscopic repair of the right supraspinatus. The instance also claims IPS Procedure-uv-ips conformance."
Usage: #example
* meta.profile[+] = "http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips"
* status = #completed
* category = http://snomed.info/sct#387713003 "Surgical procedure"
* code = http://snomed.info/sct#699120002 "Arthroscopic repair of rotator cuff"
* code.text = "Arthroscopic rotator cuff repair with suture anchors"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* performedDateTime = "2024-04-15T09:00:00+02:00"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* reasonReference = Reference(AnnaRotatorCuffTear)


Instance: AnnaConcomitantMumford
InstanceOf: RotatorCuffProcedure
Title: "Anna Müller: concomitant distal clavicle excision"
Description: "A concomitant distal clavicle excision (Mumford) performed in the same operative session. It treats the AC-joint osteoarthritis, so its reason is the coexisting diagnosis, not the rotator cuff tear. Linked to the index repair through Procedure.partOf."
Usage: #example
* meta.profile[+] = "http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips"
* status = #completed
* category = http://snomed.info/sct#387713003 "Surgical procedure"
* code = http://snomed.info/sct#734057006 "Excision of distal clavicle"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* performedDateTime = "2024-04-15T09:00:00+02:00"
* bodySite = http://snomed.info/sct#91774008 "Structure of right shoulder region"
* reasonReference = Reference(AnnaAcJointOa)
* partOf = Reference(AnnaIndexRepair)


Instance: AnnaApproach
InstanceOf: ProcedureApproachObservation
Title: "Anna Müller: procedure approach (arthroscopic)"
Description: "Surgical approach recorded as a technique axis linked to the index repair."
Usage: #example
* status = #final
* code = ShoulderObservationCodes#procedure-approach "Procedure Approach"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* effectiveDateTime = "2024-04-15"
* valueCodeableConcept = ProcedureApproachCodes#arthroscopic "Arthroscopic"
* partOf = Reference(AnnaIndexRepair)


Instance: AnnaReconstructionExtent
InstanceOf: ReconstructionExtentObservation
Title: "Anna Müller: reconstruction extent (complete repair)"
Description: "A complete repair of the rotator cuff, recorded as a technique axis linked to the index repair."
Usage: #example
* status = #final
* code = ShoulderObservationCodes#reconstruction-extent "Reconstruction Extent"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* effectiveDateTime = "2024-04-15"
* valueCodeableConcept = http://snomed.info/sct#304384006 "Complete repair of rotator cuff"
* partOf = Reference(AnnaIndexRepair)


Instance: AnnaFixation
InstanceOf: FixationTechniqueObservation
Title: "Anna Müller: fixation technique (single-row)"
Description: "Single-row suture-anchor fixation, recorded as a technique axis linked to the index repair."
Usage: #example
* status = #final
* code = ShoulderObservationCodes#fixation-technique "Fixation Technique"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* effectiveDateTime = "2024-04-15"
* valueCodeableConcept = FixationTechniqueCodes#single-row "Single-row fixation"
* partOf = Reference(AnnaIndexRepair)


Instance: AnnaIntraopTearSize
InstanceOf: IntraopTearSizeObservation
Title: "Anna Müller: intra-operative tear size"
Description: "Tear size measured intra-operatively at 3.2 cm, larger than the 2.5 cm pre-operative MRI estimate. The two measurements are kept as distinct Observations, a well-recognised imaging-versus-direct-view pattern."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = ShoulderObservationCodes#tear-size "Tear Size"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* effectiveDateTime = "2024-04-15T09:45:00+02:00"
* valueQuantity = 3.2 'cm' "cm"


Instance: AnnaIntraopCofield
InstanceOf: IntraopTearSizeClassificationObservation
Title: "Anna Müller: intra-operative tear size class (Cofield large)"
Description: "The Cofield bucket for the 3.2 cm intra-operative measurement: a large tear (3–5 cm)."
Usage: #example
* status = #final
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* code = ShoulderObservationCodes#tear-size-classification "Tear Size Classification (Cofield)"
* subject = Reference(AnnaMueller)
* encounter = Reference(AnnaSurgeryEncounter)
* effectiveDateTime = "2024-04-15T09:45:00+02:00"
* valueCodeableConcept = CofieldTearSizeClassificationCodes#large "Large tear (3–5 cm)"


Instance: AnnaSurgeryBundle
InstanceOf: RotatorCuffSurgeryBundle
Title: "Anna Müller: surgery bundle (T1)"
Description: "Transaction bundle for the surgical event: the surgical Encounter, the index repair and a concomitant distal clavicle excision, and the intra-operative Observations (procedure-technique axes and the confirmed tear size). Patient and Condition are referenced by persisted ID."
Usage: #example
* type = #transaction

* entry[encounter].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Encounter/AnnaSurgeryEncounter"
* entry[encounter].resource = AnnaSurgeryEncounter
* entry[encounter].request.method = #POST
* entry[encounter].request.url = "Encounter"

* entry[procedure][0].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Procedure/AnnaIndexRepair"
* entry[procedure][0].resource = AnnaIndexRepair
* entry[procedure][0].request.method = #POST
* entry[procedure][0].request.url = "Procedure"

* entry[procedure][1].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Procedure/AnnaConcomitantMumford"
* entry[procedure][1].resource = AnnaConcomitantMumford
* entry[procedure][1].request.method = #POST
* entry[procedure][1].request.url = "Procedure"

* entry[observation][0].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaApproach"
* entry[observation][0].resource = AnnaApproach
* entry[observation][0].request.method = #POST
* entry[observation][0].request.url = "Observation"

* entry[observation][1].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaReconstructionExtent"
* entry[observation][1].resource = AnnaReconstructionExtent
* entry[observation][1].request.method = #POST
* entry[observation][1].request.url = "Observation"

* entry[observation][2].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaFixation"
* entry[observation][2].resource = AnnaFixation
* entry[observation][2].request.method = #POST
* entry[observation][2].request.url = "Observation"

* entry[observation][3].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaIntraopTearSize"
* entry[observation][3].resource = AnnaIntraopTearSize
* entry[observation][3].request.method = #POST
* entry[observation][3].request.url = "Observation"

* entry[observation][4].fullUrl = "https://maxpurk.github.io/shoulder-on-fhir/Observation/AnnaIntraopCofield"
* entry[observation][4].resource = AnnaIntraopCofield
* entry[observation][4].request.method = #POST
* entry[observation][4].request.url = "Observation"
