# Examples

One patient, Anna Müller, is followed through the three stages of the registry workflow. She is a 52-year-old schoolteacher with a degenerative full-thickness supraspinatus tear of the right shoulder. Each stage is a transaction bundle that conforms to the bundle profile for that stage. The surgery and follow-up bundles reference the Patient and Condition created at registration by their persisted IDs.

## Registration (T0, 2024-01-08)

- [Bundle/AnnaRegistrationBundle](Bundle-AnnaRegistrationBundle.html): the transaction bundle wrapping the resources below
- [Patient/AnnaMueller](Patient-AnnaMueller.html)
- [Encounter/AnnaRegistrationEncounter](Encounter-AnnaRegistrationEncounter.html): the consultation, ranking the two diagnoses
- [Condition/AnnaRotatorCuffTear](Condition-AnnaRotatorCuffTear.html): the principal diagnosis
- [Condition/AnnaAcJointOa](Condition-AnnaAcJointOa.html): a coexisting AC-joint diagnosis
- [ImagingStudy/AnnaShoulderMri](ImagingStudy-AnnaShoulderMri.html): the pre-operative MRI (modality only)
- [Observation/AnnaTendonSupraspinatus](Observation-AnnaTendonSupraspinatus.html): tendon involved
- [Observation/AnnaTearLocation](Observation-AnnaTearLocation.html): tear location
- [Observation/AnnaTearThickness](Observation-AnnaTearThickness.html): tear thickness
- [Observation/AnnaPatte](Observation-AnnaPatte.html): Patte classification
- [Observation/AnnaGoutallier](Observation-AnnaGoutallier.html): Goutallier classification
- [Observation/AnnaFlexionBaseline](Observation-AnnaFlexionBaseline.html): baseline range of motion
- [Observation/AnnaHandDominance](Observation-AnnaHandDominance.html): hand dominance
- [Observation/AnnaConstantBaseline](Observation-AnnaConstantBaseline.html): baseline Constant-Murley score with sub-scores

## Surgery (T1, 2024-04-15)

- [Bundle/AnnaSurgeryBundle](Bundle-AnnaSurgeryBundle.html): the transaction bundle wrapping the resources below
- [Encounter/AnnaSurgeryEncounter](Encounter-AnnaSurgeryEncounter.html)
- [Procedure/AnnaIndexRepair](Procedure-AnnaIndexRepair.html): arthroscopic rotator cuff repair
- [Procedure/AnnaConcomitantMumford](Procedure-AnnaConcomitantMumford.html): concomitant distal clavicle excision
- [Observation/AnnaApproach](Observation-AnnaApproach.html): procedure approach
- [Observation/AnnaReconstructionExtent](Observation-AnnaReconstructionExtent.html): reconstruction extent
- [Observation/AnnaFixation](Observation-AnnaFixation.html): fixation technique
- [Observation/AnnaIntraopTearSize](Observation-AnnaIntraopTearSize.html): intra-operative tear size
- [Observation/AnnaIntraopCofield](Observation-AnnaIntraopCofield.html): intra-operative tear size class (Cofield)

## Follow-up (6-week visit, 2024-05-27)

- [Bundle/AnnaFollowUpBundle](Bundle-AnnaFollowUpBundle.html): the transaction bundle wrapping the resources below
- [Encounter/AnnaFu6wEncounter](Encounter-AnnaFu6wEncounter.html)
- [Observation/AnnaFu6wFlexion](Observation-AnnaFu6wFlexion.html): active shoulder flexion
- [Observation/AnnaFu6wPassiveFlexion](Observation-AnnaFu6wPassiveFlexion.html): passive shoulder flexion
- [Observation/AnnaFu6wPain](Observation-AnnaFu6wPain.html): average pain
- [Observation/AnnaFu6wConstant](Observation-AnnaFu6wConstant.html): Constant-Murley score
- [Observation/AnnaFu6wSsv](Observation-AnnaFu6wSsv.html): Subjective Shoulder Value
