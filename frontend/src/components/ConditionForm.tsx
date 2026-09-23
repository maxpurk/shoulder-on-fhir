import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type { Condition, Patient } from '../types/fhir'
import { SHOULDER_LATERALITY, ROTATOR_CUFF_TEAR_DIAGNOSIS, PROFILE_URLS, VALUESET_URLS, IPS_ABSENT_UNKNOWN, CONDITION_CLINICAL_DISPLAY } from '../types/fhir'
import { useValueSet } from '../hooks/useValueSet'
import SnomedTypeahead, { type CodedValue } from './shared/SnomedTypeahead'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

const CONDITION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-category'
const CONDITION_CLINICAL_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-clinical'
const CONDITION_VER_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-ver-status'

/**
 * ConditionForm Component
 *
 * Edits either a RotatorCuffCondition (diagnosis + laterality + etiology)
 * or a ShoulderComorbidityCondition (single SNOMED Clinical-finding code).
 * Variant is chosen from `condition.meta.profile` when editing; new conditions
 * default to the rotator-cuff variant (comorbidities are created via the
 * registration wizard, not this form).
 */

function ConditionForm() {
  const { patientId, conditionId } = useParams<{
    patientId: string
    conditionId?: string
  }>()
  const navigate = useNavigate()
  const isEditing = Boolean(conditionId)

  const { options: etiologies, loading: etiologiesLoading, error: etiologiesError } = useValueSet(VALUESET_URLS.ROTATOR_CUFF_ETIOLOGY)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState<string>('')
  const [versionId, setVersionId] = useState<string | undefined>()

  // Variant: which profile the condition follows. Drives field set + submit shape.
  const [variant, setVariant] = useState<'rotator-cuff' | 'comorbidity'>('rotator-cuff')
  // True when the comorbidity record carries an IPS absent/unknown sentinel
  // (no-known-problems / no-problem-info) rather than a real SNOMED code.
  // These are not meaningfully editable from this form — show read-only.
  const [isAbsentSentinel, setIsAbsentSentinel] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    diagnosisCode: '',
    laterality: '',
    onsetDate: '',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    etiologyCode: '',
  })
  const [comorbidityCodings, setComorbidityCodings] = useState<CodedValue[]>([])

  // Load patient info and existing condition if editing
  useEffect(() => {
    const loadData = async () => {
      if (!patientId) return

      try {
        // Load patient name
        const patient = await fhirClient.read<Patient>('Patient', patientId)
        const name = patient.name?.[0]
        setPatientName(
          `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim()
        )

        // Load existing condition if editing
        if (conditionId) {
          const condition = await fhirClient.read<Condition>(
            'Condition',
            conditionId
          )
          setVersionId(condition.meta?.versionId)

          const profiles = condition.meta?.profile ?? []
          const isComorbidity = profiles.includes(PROFILE_URLS.COMORBIDITY_CONDITION)
          setVariant(isComorbidity ? 'comorbidity' : 'rotator-cuff')

          if (isComorbidity) {
            const coding = condition.code?.coding?.[0]
            const code = coding?.code ?? ''
            const system = coding?.system ?? ''
            setIsAbsentSentinel(system === IPS_ABSENT_UNKNOWN.SYSTEM)
            if (code && system && !(system === IPS_ABSENT_UNKNOWN.SYSTEM)) {
              setComorbidityCodings([{ code, system, display: coding?.display ?? code }])
            }
            setFormData((prev) => ({
              ...prev,
              clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
              verificationStatus: condition.verificationStatus?.coding?.[0]?.code || 'confirmed',
            }))
          } else {
            const diagCode = condition.code?.coding?.[0]?.code || ''
            const bodySiteCode = condition.bodySite?.[0]?.coding?.[0]?.code

            const dueToExt = condition.extension?.find(
              (e) => e.url === 'http://hl7.org/fhir/StructureDefinition/condition-dueTo'
            )
            const etiologyCode = dueToExt?.valueCodeableConcept?.coding?.[0]?.code || ''

            setFormData({
              diagnosisCode: diagCode,
              laterality:
                bodySiteCode === SHOULDER_LATERALITY.LEFT ? 'left' : bodySiteCode === SHOULDER_LATERALITY.RIGHT ? 'right' : '',
              onsetDate: condition.onsetDateTime?.split('T')[0] || '',
              clinicalStatus:
                condition.clinicalStatus?.coding?.[0]?.code || 'active',
              verificationStatus:
                condition.verificationStatus?.coding?.[0]?.code || 'confirmed',
              etiologyCode,
            })
          }
        }
      } catch (err) {
        if (err instanceof FhirError) {
          setError(`Failed to load data: ${err.message}`)
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId, conditionId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (variant === 'comorbidity') {
        if (isAbsentSentinel) {
          setError('Absent/unknown comorbidity records are not editable here. Delete and re-record via the registration wizard if the status changes.')
          setSaving(false)
          return
        }
        const picked = comorbidityCodings[0]
        if (!picked) {
          setError('Select a SNOMED comorbidity code.')
          setSaving(false)
          return
        }
        const comorbidity: Condition = {
          resourceType: 'Condition',
          ...(conditionId && { id: conditionId }),
          meta: { profile: [PROFILE_URLS.COMORBIDITY_CONDITION], ...(versionId && { versionId }) },
          clinicalStatus: { coding: [{ system: CONDITION_CLINICAL_SYSTEM, code: formData.clinicalStatus, display: CONDITION_CLINICAL_DISPLAY[formData.clinicalStatus] }] },
          verificationStatus: { coding: [{ system: CONDITION_VER_STATUS_SYSTEM, code: formData.verificationStatus }] },
          category: [{ coding: [{ system: CONDITION_CATEGORY_SYSTEM, code: 'problem-list-item', display: 'Problem List Item' }] }],
          code: { coding: [{ system: picked.system, code: picked.code, display: picked.display }], text: picked.display },
          subject: { reference: `Patient/${patientId}` },
          recordedDate: new Date().toISOString().split('T')[0],
        }
        if (isEditing) {
          await fhirClient.update(comorbidity, versionId)
        } else {
          await fhirClient.create(comorbidity)
        }
        navigate(`/patient/${patientId}`)
        return
      }

      const selectedEtiology = etiologies.find(
        (e) => e.code === formData.etiologyCode
      )
      if (!selectedEtiology) {
        setError('Etiology must be selected.')
        setSaving(false)
        return
      }

      const condition: Condition = {
        resourceType: 'Condition',
        ...(conditionId && { id: conditionId }),
        meta: { profile: [PROFILE_URLS.CONDITION], ...(versionId && { versionId }) },
        clinicalStatus: {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: formData.clinicalStatus,
              display: CONDITION_CLINICAL_DISPLAY[formData.clinicalStatus],
            },
          ],
        },
        // No longer user-editable here (surgeon feedback, ADR-0105) — every
        // registered rotator-cuff diagnosis is clinically confirmed.
        // Condition.verificationStatus stays 1..1 MS (FHIR-required, L3.B.2).
        verificationStatus: {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'confirmed',
              display: 'Confirmed',
            },
          ],
        },
        category: [
          {
            coding: [
              {
                system:
                  'http://terminology.hl7.org/CodeSystem/condition-category',
                code: 'encounter-diagnosis',
              },
            ],
          },
        ],
        // Fixed inclusion diagnosis (ADR-0111) — not a clinician choice.
        // Hurley names no disease-entity element; tendon/thickness/location/
        // etiology carry all the character (captured via the registration
        // wizard, not this generic edit form).
        code: {
          coding: [
            {
              system: ROTATOR_CUFF_TEAR_DIAGNOSIS.SYSTEM,
              code: ROTATOR_CUFF_TEAR_DIAGNOSIS.CODE,
              display: ROTATOR_CUFF_TEAR_DIAGNOSIS.DISPLAY,
            },
          ],
          text: ROTATOR_CUFF_TEAR_DIAGNOSIS.LABEL,
        },
        bodySite: [
          {
            coding: [{
              system: SHOULDER_LATERALITY.SYSTEM,
              code: formData.laterality === 'left' ? SHOULDER_LATERALITY.LEFT : formData.laterality === 'right' ? SHOULDER_LATERALITY.RIGHT : undefined,
              display: formData.laterality === 'left' ? SHOULDER_LATERALITY.LEFT_DISPLAY : formData.laterality === 'right' ? SHOULDER_LATERALITY.RIGHT_DISPLAY : undefined,
            }],
          },
        ],
        subject: {
          reference: `Patient/${patientId}`,
        },
        ...(formData.onsetDate && { onsetDateTime: formData.onsetDate }),
        recordedDate: new Date().toISOString().split('T')[0],
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
      }

      if (isEditing) {
        await fhirClient.update(condition, versionId)
      } else {
        await fhirClient.create(condition)
      }

      navigate(`/patient/${patientId}`)
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to save condition: ${err.message}`)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  const headerTitle = variant === 'comorbidity'
    ? (isEditing ? 'Edit Comorbidity' : 'New Comorbidity')
    : (isEditing ? 'Edit Condition' : 'New Condition')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{headerTitle}</h2>
          <p className="text-slate-600">Patient: {patientName}</p>
        </div>
        <Link to={patientId ? `/patient/${patientId}` : '/patients'} className="text-slate-600 hover:text-slate-900">
          &larr; Back to patient
        </Link>
      </div>

      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      {variant === 'comorbidity' ? (
        <form onSubmit={handleSubmit} className="card">
          <h3 className="card-header">Comorbidity</h3>
          {isAbsentSentinel ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm">
              This row records an IPS absent/unknown comorbidity status (no-known-problems / no-problem-info).
              It cannot be edited here. Delete it and re-record via the registration wizard if the status changes.
            </div>
          ) : (
            <div className="form-group">
              <SnomedTypeahead
                label="SNOMED Clinical-finding code *"
                valueSetUrl={VALUESET_URLS.COMORBIDITY_TYPEAHEAD}
                value={comorbidityCodings}
                onChange={setComorbidityCodings}
                placeholder="Type at least 2 characters (e.g. hypertension, diabetes)…"
                helpText="One code per comorbidity. Remove the chip and pick a new one to replace it."
              />
            </div>
          )}

          <h3 className="card-header mt-6">Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="clinicalStatus" className="form-label">Clinical Status *</label>
              <p className="text-xs text-slate-500 mb-1">
                Active — condition currently present and clinically relevant. Recurrence — condition has
                returned at a site/system previously marked Resolved. Inactive — stable or asymptomatic
                despite a persistent, unresolved condition. Resolved — condition treated and no longer
                present.
              </p>
              <select
                id="clinicalStatus"
                name="clinicalStatus"
                value={formData.clinicalStatus}
                onChange={handleChange}
                required
                disabled={isAbsentSentinel}
                className="form-input"
              >
                <option value="active">Active</option>
                <option value="recurrence">Recurrence</option>
                <option value="inactive">Inactive</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="verificationStatus" className="form-label">Verification Status *</label>
              <select
                id="verificationStatus"
                name="verificationStatus"
                value={formData.verificationStatus}
                onChange={handleChange}
                required
                disabled={isAbsentSentinel}
                className="form-input"
              >
                <option value="unconfirmed">Unconfirmed</option>
                <option value="provisional">Provisional</option>
                <option value="differential">Differential</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <Link to={patientId ? `/patient/${patientId}` : '/patients'} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={saving || isAbsentSentinel} className="btn btn-primary">
              {saving ? 'Saving...' : isEditing ? 'Update Comorbidity' : 'Create Comorbidity'}
            </button>
          </div>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="card">
        <h3 className="card-header">Diagnosis</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label className="form-label">Diagnosis</label>
            <p className="form-input bg-gray-50 text-gray-700">{ROTATOR_CUFF_TEAR_DIAGNOSIS.LABEL}</p>
          </div>

          <div className="form-group">
            <label htmlFor="laterality" className="form-label">
              Shoulder *
            </label>
            <select
              id="laterality"
              name="laterality"
              value={formData.laterality}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="">-- Select shoulder --</option>
              <option value="right">Right Shoulder</option>
              <option value="left">Left Shoulder</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="onsetDate" className="form-label">
              Onset Date
            </label>
            <input
              type="date"
              id="onsetDate"
              name="onsetDate"
              value={formData.onsetDate}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          <div className="form-group sm:col-span-2">
            <label htmlFor="etiologyCode" className="form-label">
              Etiology *
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Required. Select "Unknown (origin)" if causation is not determinable.
            </p>
            {etiologiesError && (
              <p className="text-xs text-red-600 mb-1">Could not load etiologies: {etiologiesError}</p>
            )}
            <select
              id="etiologyCode"
              name="etiologyCode"
              value={formData.etiologyCode}
              onChange={handleChange}
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

        <h3 className="card-header mt-6">Status</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="clinicalStatus" className="form-label">
              Clinical Status *
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Active — tear present and clinically relevant now (usual choice at registration). Recurrence —
              re-tear at a site previously marked Resolved. Inactive — asymptomatic despite a persistent or
              unrepaired tear (e.g. compensated conservatively); imaging may still show the defect. Resolved —
              repair confirmed intact and healed, no symptoms expected to recur.
            </p>
            <select
              id="clinicalStatus"
              name="clinicalStatus"
              value={formData.clinicalStatus}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="active">Active</option>
              <option value="recurrence">Recurrence</option>
              <option value="inactive">Inactive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Link to={patientId ? `/patient/${patientId}` : '/patients'} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving
              ? 'Saving...'
              : isEditing
              ? 'Update Condition'
              : 'Create Condition'}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}

export default ConditionForm
