import type { Condition, Observation, WizardEntry } from '../../types/fhir'
import { SHOULDER_LATERALITY, ROTATOR_CUFF_TEAR_DIAGNOSIS, OBSERVATION_CODES, OBSERVATION_PROFILE_URLS, PROFILE_URLS, VALUESET_URLS, CONDITION_CLINICAL_DISPLAY } from '../../types/fhir'
import { useValueSet } from '../../hooks/useValueSet'
import { createDiagnosisEntry, type ConditionFormData, type DiagnosisEntry } from './stepFormData'

/** One {uuid, rank} pair per submitted diagnosis, in principal-first order. */
export interface DiagnosisRank {
  uuid: string
  rank: number
}

interface StepConditionProps {
  patientUuid: string
  /** Stable UUID for the PRINCIPAL (diagnoses[0]) Condition, pre-allocated by
   * RegistrationWizard so StepPatient's prior-treatment Procedures — built
   * before this step runs — can already set `reasonReference` at it. */
  conditionUuid: string
  encounterUuid: string
  value: ConditionFormData
  onChange: (next: ConditionFormData) => void
  onComplete: (entries: WizardEntry[], laterality: string, diagnosisRanks: DiagnosisRank[]) => void
  onBack: () => void
}

const LATERALITY_CODING = (laterality: string) => ({
  system: SHOULDER_LATERALITY.SYSTEM,
  code: laterality === 'left' ? SHOULDER_LATERALITY.LEFT : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT : undefined,
  display: laterality === 'left' ? SHOULDER_LATERALITY.LEFT_DISPLAY : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT_DISPLAY : undefined,
})

function StepCondition({ patientUuid, conditionUuid, encounterUuid, value: formData, onChange, onComplete, onBack }: StepConditionProps) {
  const { options: otherDiagnoses, loading: otherDiagnosesLoading, error: otherDiagnosesError } = useValueSet(VALUESET_URLS.SHOULDER_DIAGNOSIS)
  const { options: etiologies, loading: etiologiesLoading, error: etiologiesError } = useValueSet(VALUESET_URLS.ROTATOR_CUFF_ETIOLOGY)
  const { options: tendonOptions, loading: tendonsLoading, error: tendonsError } = useValueSet(VALUESET_URLS.TENDONS_INVOLVED)
  const { options: tearLocationOptions, loading: tearLocationLoading, error: tearLocationError } = useValueSet(VALUESET_URLS.TEAR_LOCATION)
  const { options: tearThicknessOptions, loading: tearThicknessLoading, error: tearThicknessError } = useValueSet(VALUESET_URLS.TEAR_THICKNESS)

  const handleSharedChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value: fieldValue } = e.target
    onChange({ ...formData, [name]: fieldValue })
  }

  const updateDiagnosis = (key: string, patch: Partial<DiagnosisEntry>) => {
    onChange({
      ...formData,
      diagnoses: formData.diagnoses.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    })
  }

  const addDiagnosis = () => {
    onChange({ ...formData, diagnoses: [...formData.diagnoses, createDiagnosisEntry('other')] })
  }

  const removeDiagnosis = (key: string) => {
    onChange({ ...formData, diagnoses: formData.diagnoses.filter((d) => d.key !== key) })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const effectiveDate = new Date().toISOString().split('T')[0]
    const recordedDate = effectiveDate
    const bodySite = [{ coding: [LATERALITY_CODING(formData.laterality)] }]

    const allEntries: WizardEntry[] = []
    const diagnosisRanks: DiagnosisRank[] = []

    formData.diagnoses.forEach((diag, index) => {
      const rank = index + 1
      // Principal diagnosis reuses the pre-allocated conditionUuid so
      // StepPatient's already-built prior-treatment Procedures resolve;
      // every other diagnosis gets a fresh uuid here.
      const uuid = index === 0 ? conditionUuid : crypto.randomUUID()
      diagnosisRanks.push({ uuid, rank })

      if (diag.kind === 'rotator-cuff') {
        const selectedEtiology = etiologies.find((e) => e.code === diag.etiologyCode)
        if (!selectedEtiology) return // HTML required + 1..1 profile cardinality guarantee this in practice

        const tendonEntries: WizardEntry[] = diag.selectedTendons.map((tendonCode) => {
          const tendonOption = tendonOptions.find((o) => o.code === tendonCode)
          const obs: Observation = {
            resourceType: 'Observation',
            meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.TENDONS_INVOLVED] ?? PROFILE_URLS.OBSERVATION] },
            status: 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
            code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TENDONS_INVOLVED, display: 'Tendons Involved' }] },
            subject: { reference: `urn:uuid:${patientUuid}` },
            encounter: { reference: `urn:uuid:${encounterUuid}` },
            effectiveDateTime: effectiveDate,
            bodySite: { coding: [LATERALITY_CODING(formData.laterality)] },
            valueCodeableConcept: {
              coding: [{ system: 'http://snomed.info/sct', code: tendonCode, display: tendonOption?.display }],
            },
          }
          return { uuid: crypto.randomUUID(), resource: obs }
        })

        let tearLocationEntry: WizardEntry | null = null
        if (diag.tearLocation) {
          const tearLocationOption = tearLocationOptions.find((o) => o.code === diag.tearLocation)
          const obs: Observation = {
            resourceType: 'Observation',
            meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.TEAR_LOCATION] ?? PROFILE_URLS.OBSERVATION] },
            status: 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
            code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_LOCATION, display: 'Tear Location' }] },
            subject: { reference: `urn:uuid:${patientUuid}` },
            encounter: { reference: `urn:uuid:${encounterUuid}` },
            effectiveDateTime: effectiveDate,
            bodySite: { coding: [LATERALITY_CODING(formData.laterality)] },
            valueCodeableConcept: {
              coding: [{ system: tearLocationOption?.system ?? '', code: diag.tearLocation, display: tearLocationOption?.display }],
            },
          }
          tearLocationEntry = { uuid: crypto.randomUUID(), resource: obs }
        }

        // Partial vs. full thickness (expert consensus Q4.c) — decoupled from
        // diagnosisCode. See ADR-0105.
        let tearThicknessEntry: WizardEntry | null = null
        if (diag.tearThickness) {
          const tearThicknessOption = tearThicknessOptions.find((o) => o.code === diag.tearThickness)
          const obs: Observation = {
            resourceType: 'Observation',
            meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.TEAR_THICKNESS] ?? PROFILE_URLS.OBSERVATION] },
            status: 'final',
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
            code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_THICKNESS, display: 'Tear Thickness' }] },
            subject: { reference: `urn:uuid:${patientUuid}` },
            encounter: { reference: `urn:uuid:${encounterUuid}` },
            effectiveDateTime: effectiveDate,
            bodySite: { coding: [LATERALITY_CODING(formData.laterality)] },
            valueCodeableConcept: {
              coding: [{ system: 'http://snomed.info/sct', code: diag.tearThickness, display: tearThicknessOption?.display }],
            },
          }
          tearThicknessEntry = { uuid: crypto.randomUUID(), resource: obs }
        }

        const evidenceRefs = [
          ...tendonEntries.map((t) => ({ reference: `urn:uuid:${t.uuid}` })),
          ...(tearLocationEntry ? [{ reference: `urn:uuid:${tearLocationEntry.uuid}` }] : []),
          ...(tearThicknessEntry ? [{ reference: `urn:uuid:${tearThicknessEntry.uuid}` }] : []),
        ]

        const condition: Condition = {
          resourceType: 'Condition',
          meta: { profile: [PROFILE_URLS.CONDITION] },
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: formData.clinicalStatus, display: CONDITION_CLINICAL_DISPLAY[formData.clinicalStatus] }],
          },
          // No longer asked in the UI (surgeon feedback, ADR-0105) — every
          // diagnosis registered through this workflow is clinically
          // confirmed at this point. Condition.verificationStatus stays
          // 1..1 MS (FHIR-required, L3.B.2).
          verificationStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }],
          },
          category: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] },
          ],
          // Fixed inclusion diagnosis (ADR-0111) — not a clinician choice.
          // Hurley names no disease-entity element; tendon/thickness/
          // location/etiology below carry all the character.
          code: {
            coding: [{
              system: ROTATOR_CUFF_TEAR_DIAGNOSIS.SYSTEM,
              code: ROTATOR_CUFF_TEAR_DIAGNOSIS.CODE,
              display: ROTATOR_CUFF_TEAR_DIAGNOSIS.DISPLAY,
            }],
            text: ROTATOR_CUFF_TEAR_DIAGNOSIS.LABEL,
          },
          // bodySite carries laterality only (ADR-0064). Which tendon(s) are
          // involved and where along the tendon the tear is located are
          // captured by TendonsInvolvedObservation / TearLocationObservation
          // above and wired into evidence.detail directly, right here.
          bodySite,
          subject: { reference: `urn:uuid:${patientUuid}` },
          encounter: { reference: `urn:uuid:${encounterUuid}` },
          ...(formData.onsetDate && { onsetDateTime: formData.onsetDate }),
          recordedDate,
          extension: [
            {
              url: 'http://hl7.org/fhir/StructureDefinition/condition-dueTo',
              valueCodeableConcept: {
                coding: [{
                  system: selectedEtiology.system,
                  code: selectedEtiology.code,
                  display: selectedEtiology.display,
                }],
              },
            },
          ],
          ...(evidenceRefs.length > 0 && { evidence: [{ detail: evidenceRefs }] }),
        }

        allEntries.push(
          { uuid, resource: condition },
          ...tendonEntries,
          ...(tearLocationEntry ? [tearLocationEntry] : []),
          ...(tearThicknessEntry ? [tearThicknessEntry] : []),
        )
      } else {
        const selectedDiagnosis = otherDiagnoses.find((d) => d.code === diag.diagnosisCode)
        const condition: Condition = {
          resourceType: 'Condition',
          meta: { profile: [PROFILE_URLS.OTHER_DIAGNOSIS_CONDITION] },
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: formData.clinicalStatus, display: CONDITION_CLINICAL_DISPLAY[formData.clinicalStatus] }],
          },
          // No longer asked in the UI (surgeon feedback, ADR-0105) — every
          // diagnosis registered through this workflow is clinically
          // confirmed at this point. Condition.verificationStatus stays
          // 1..1 MS (FHIR-required, L3.B.2).
          verificationStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }],
          },
          category: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] },
          ],
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: diag.diagnosisCode, display: selectedDiagnosis?.display }],
            text: selectedDiagnosis?.display,
          },
          bodySite,
          subject: { reference: `urn:uuid:${patientUuid}` },
          encounter: { reference: `urn:uuid:${encounterUuid}` },
          ...(formData.onsetDate && { onsetDateTime: formData.onsetDate }),
          recordedDate,
        }
        allEntries.push({ uuid, resource: condition })
      }
    })

    onComplete(allEntries, formData.laterality, diagnosisRanks)
  }

  const principal = formData.diagnoses[0]

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Shoulder &amp; Onset</h3>
        <p className="text-xs text-gray-500 mb-2">
          Applies to every diagnosis below — one registration entry always covers one patient and one
          shoulder side; a bilateral case is submitted as two separate registrations.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Affected Shoulder *</label>
            <select name="laterality" value={formData.laterality} onChange={handleSharedChange} required className="form-input">
              <option value="">Select shoulder…</option>
              <option value="right">Right Shoulder</option>
              <option value="left">Left Shoulder</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Onset Date</label>
            <input type="date" name="onsetDate" value={formData.onsetDate} onChange={handleSharedChange} className="form-input" />
          </div>
          <div className="form-group sm:col-span-2">
            <label className="form-label">Clinical Status *</label>
            <p className="text-xs text-gray-500 mb-1">
              Active — tear present and clinically relevant now (usual choice at registration). Recurrence —
              re-tear at a site previously marked Resolved. Inactive — asymptomatic despite a persistent or
              unrepaired tear (e.g. compensated conservatively); imaging may still show the defect. Resolved —
              repair confirmed intact and healed, no symptoms expected to recur.
            </p>
            <select name="clinicalStatus" value={formData.clinicalStatus} onChange={handleSharedChange} required className="form-input">
              <option value="active">Active</option>
              <option value="recurrence">Recurrence</option>
              <option value="inactive">Inactive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {formData.diagnoses.length > 1 && principal && (
        <p className="text-xs text-gray-500 mb-4">
          The principal diagnosis (rank 1, <em>Hauptdiagnose</em>) is "{ROTATOR_CUFF_TEAR_DIAGNOSIS.LABEL}".
        </p>
      )}

      {formData.diagnoses.map((diag, index) => (
        <div className="card mb-6" key={diag.key}>
          <div className="flex items-center justify-between">
            <h3 className="card-header">
              {index === 0 ? 'Principal Diagnosis' : `Additional Diagnosis ${index + 1}`}
            </h3>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeDiagnosis(diag.key)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>

          {diag.kind === 'rotator-cuff' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group sm:col-span-2">
                <label className="form-label">Tendons Involved</label>
                <p className="text-xs text-gray-500 mb-2">
                  Select all affected rotator cuff tendons.
                </p>
                {tendonsError && <p className="text-xs text-red-600 mb-1">Could not load tendons: {tendonsError}</p>}
                {tendonsLoading && <p className="text-xs text-gray-500">Loading tendons…</p>}
                <div className="flex flex-wrap gap-2">
                  {tendonOptions.map((opt) => (
                    <label
                      key={opt.code}
                      className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={diag.selectedTendons.includes(opt.code)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...diag.selectedTendons, opt.code]
                            : diag.selectedTendons.filter((c) => c !== opt.code)
                          updateDiagnosis(diag.key, { selectedTendons: next })
                        }}
                        className="rounded border-gray-300"
                      />
                      {opt.display}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">Diagnosis</label>
                <p className="form-input bg-gray-50 text-gray-700">{ROTATOR_CUFF_TEAR_DIAGNOSIS.LABEL}</p>
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">Tear Thickness</label>
                <p className="text-xs text-gray-500 mb-1">
                  Partial vs. full thickness — a separate axis from the disease entity above.
                </p>
                {tearThicknessError && (
                  <p className="text-xs text-red-600 mb-1">Could not load tear thickness options: {tearThicknessError}</p>
                )}
                <select
                  value={diag.tearThickness}
                  onChange={(e) => updateDiagnosis(diag.key, { tearThickness: e.target.value })}
                  disabled={tearThicknessLoading}
                  className="form-input"
                >
                  {tearThicknessLoading && <option value="">Loading…</option>}
                  {!tearThicknessLoading && <option value="">Not assessed / not applicable</option>}
                  {tearThicknessOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">Tear Location</label>
                <p className="text-xs text-gray-500 mb-1">
                  Where along the tendon the tear is located, alongside Patte (retraction) and
                  Goutallier (fatty infiltration).
                </p>
                {tearLocationError && (
                  <p className="text-xs text-red-600 mb-1">Could not load tear locations: {tearLocationError}</p>
                )}
                <select
                  value={diag.tearLocation}
                  onChange={(e) => updateDiagnosis(diag.key, { tearLocation: e.target.value })}
                  disabled={tearLocationLoading}
                  className="form-input"
                >
                  {tearLocationLoading && <option value="">Loading…</option>}
                  {!tearLocationLoading && <option value="">Not assessed / not applicable</option>}
                  {tearLocationOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </div>
              <div className="form-group sm:col-span-2">
                <label className="form-label">Etiology *</label>
                <p className="text-xs text-gray-500 mb-1">
                  Required. Select "Unknown (origin)" if causation is not determinable.
                </p>
                {etiologiesError && (
                  <p className="text-xs text-red-600 mb-1">Could not load etiologies: {etiologiesError}</p>
                )}
                <select
                  value={diag.etiologyCode}
                  onChange={(e) => updateDiagnosis(diag.key, { etiologyCode: e.target.value })}
                  required
                  disabled={etiologiesLoading}
                  className="form-input"
                >
                  {etiologiesLoading && <option value="">Loading etiologies…</option>}
                  {!etiologiesLoading && <option value="">Select etiology…</option>}
                  {etiologies.map((e) => (
                    <option key={e.code} value={e.code}>{e.display}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group sm:col-span-2">
                <label className="form-label">Diagnosis *</label>
                <p className="text-xs text-gray-500 mb-1">
                  Coexisting shoulder pathology, distinct from the rotator cuff tear (e.g. AC joint
                  osteoarthritis, biceps tendinopathy).
                </p>
                {otherDiagnosesError && (
                  <p className="text-xs text-red-600 mb-1">Could not load diagnoses: {otherDiagnosesError}</p>
                )}
                <select
                  value={diag.diagnosisCode}
                  onChange={(e) => updateDiagnosis(diag.key, { diagnosisCode: e.target.value })}
                  required
                  disabled={otherDiagnosesLoading}
                  className="form-input"
                >
                  {otherDiagnosesLoading && <option value="">Loading diagnoses…</option>}
                  {!otherDiagnosesLoading && <option value="">Select diagnosis…</option>}
                  {otherDiagnoses.map((d) => (
                    <option key={d.code} value={d.code}>{d.display}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={addDiagnosis} className="btn btn-secondary mb-6">
        + Add another diagnosis
      </button>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <button type="submit" className="btn btn-primary">
          Next: Imaging →
        </button>
      </div>
    </form>
  )
}

export default StepCondition
