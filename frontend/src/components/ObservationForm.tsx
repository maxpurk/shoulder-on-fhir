import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type { Observation, Patient } from '../types/fhir'
import {
  SHOULDER_LATERALITY,
  OBSERVATION_CODES,
  OBSERVATION_CODINGS,
  PROVOCATION_TEST_RESULT,
  PROFILE_URLS,
  OBSERVATION_PROFILE_URLS,
  VALUESET_URLS,
} from '../types/fhir'
import { useValueSet } from '../hooks/useValueSet'
import type { TermOption } from '../hooks/useValueSet'
import {
  OBSERVATION_METADATA,
  OBSERVATION_GROUP_LABELS,
} from '../config/observationMetadata'
import type { ObservationGroup } from '../config/observationMetadata'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

/**
 * ObservationForm Component
 *
 * Form for creating or editing shoulder-related clinical observations.
 * All dropdown options (observation types, coded values) are fetched
 * dynamically from the FHIR server via ValueSet $expand.
 */

// Provocation test codes — value options come from SNOMED (not a custom ValueSet)
const PROVOCATION_CODES = new Set([
  'jobe-test', 'lift-off-test', 'belly-press-test', 'bear-hug-test', 'hornblower-test',
])

// Static SNOMED positive/negative options for provocation tests
const PROVOCATION_OPTIONS: TermOption[] = [
  { code: PROVOCATION_TEST_RESULT.POSITIVE.code, display: PROVOCATION_TEST_RESULT.POSITIVE.display, system: PROVOCATION_TEST_RESULT.SYSTEM },
  { code: PROVOCATION_TEST_RESULT.NEGATIVE.code, display: PROVOCATION_TEST_RESULT.NEGATIVE.display, system: PROVOCATION_TEST_RESULT.SYSTEM },
]

const CATEGORY_DISPLAY: Record<string, string> = {
  imaging: 'Imaging',
  exam: 'Exam',
  survey: 'Survey',
}

// Ordered list of groups for the select optgroups
const GROUP_ORDER: ObservationGroup[] = ['imaging', 'rom', 'strength', 'provocation', 'prom']

function ObservationForm() {
  const { patientId, observationId } = useParams<{
    patientId: string
    observationId?: string
  }>()
  const navigate = useNavigate()
  const isEditing = Boolean(observationId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState<string>('')
  const [versionId, setVersionId] = useState<string | undefined>()

  // Form state
  const [formData, setFormData] = useState({
    observationType: '',
    valueCodeable: '',
    valueQuantity: '',
    laterality: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  // Fetch observation type list from server
  const { options: obsTypeOptions, loading: obsTypesLoading, error: obsTypesError } = useValueSet(VALUESET_URLS.SHOULDER_OBSERVATION_CODE)

  // Metadata for the currently selected observation type
  const selectedMeta = formData.observationType ? OBSERVATION_METADATA[formData.observationType] : undefined

  // Fetch coded value options for the selected observation type (if applicable)
  const valueSetUrl = selectedMeta?.valueSetUrl ?? null
  const { options: fetchedValueOptions, loading: valueOptionsLoading } = useValueSet(valueSetUrl)

  // Effective value options: server-fetched for custom CodeSystems, hardcoded for provocation tests
  const valueOptions: TermOption[] = PROVOCATION_CODES.has(formData.observationType)
    ? PROVOCATION_OPTIONS
    : fetchedValueOptions

  // Load patient info and existing observation if editing
  useEffect(() => {
    const loadData = async () => {
      if (!patientId) return

      try {
        const patient = await fhirClient.read<Patient>('Patient', patientId)
        const name = patient.name?.[0]
        setPatientName(
          `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim()
        )

        if (observationId) {
          const observation = await fhirClient.read<Observation>(
            'Observation',
            observationId
          )
          setVersionId(observation.meta?.versionId)

          const obsCode = observation.code?.coding?.[0]?.code || ''
          const bodySiteCode = observation.bodySite?.coding?.[0]?.code

          setFormData({
            observationType: obsCode,
            valueCodeable: observation.valueCodeableConcept?.coding?.[0]?.code || '',
            valueQuantity: observation.valueQuantity?.value?.toString() || '',
            laterality:
              bodySiteCode === SHOULDER_LATERALITY.LEFT
                ? 'left'
                : bodySiteCode === SHOULDER_LATERALITY.RIGHT
                ? 'right'
                : '',
            effectiveDate: observation.effectiveDateTime?.split('T')[0] || '',
            notes: observation.note?.[0]?.text || '',
          })
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
  }, [patientId, observationId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleObservationTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFormData((prev) => ({
      ...prev,
      observationType: value,
      valueCodeable: '',
      valueQuantity: '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!selectedMeta) {
        setError('Please select an observation type')
        setSaving(false)
        return
      }

      const categoryCode = selectedMeta.category
      const obsTypeDisplay = obsTypeOptions.find((o) => o.code === formData.observationType)?.display ?? formData.observationType
      const coding = OBSERVATION_CODINGS[formData.observationType] ?? {
        system: OBSERVATION_CODES.SYSTEM,
        code: formData.observationType,
        display: obsTypeDisplay,
      }

      const observation: Observation = {
        resourceType: 'Observation',
        ...(observationId && { id: observationId }),
        meta: { profile: [OBSERVATION_PROFILE_URLS[formData.observationType] ?? PROFILE_URLS.OBSERVATION], ...(versionId && { versionId }) },
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: categoryCode,
                display: CATEGORY_DISPLAY[categoryCode] ?? categoryCode,
              },
            ],
          },
        ],
        code: {
          coding: [coding],
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        effectiveDateTime: formData.effectiveDate,
      }

      // Add value based on type
      if (selectedMeta.valueType === 'codeable') {
        // Look up the selected option's own system rather than the field-level
        // codeSystem default — required for hybrid ValueSets (e.g. EmploymentStatus,
        // ADR-0082) where different options come from different code systems.
        const selectedOption = valueOptions.find((o) => o.code === formData.valueCodeable)
        const codeSystem = selectedOption?.system ?? selectedMeta.codeSystem ?? ''
        observation.valueCodeableConcept = {
          coding: [{ system: codeSystem, code: formData.valueCodeable, display: selectedOption?.display }],
        }
      } else if (selectedMeta.valueType === 'quantity') {
        observation.valueQuantity = {
          value: parseFloat(formData.valueQuantity),
          unit: selectedMeta.unitDisplay ?? selectedMeta.unit ?? '',
          system: 'http://unitsofmeasure.org',
          code: selectedMeta.unit ?? '',
        }
      }

      // Add body site if selected
      if (formData.laterality) {
        observation.bodySite = {
          coding: [
            {
              system: SHOULDER_LATERALITY.SYSTEM,
              code:
                formData.laterality === 'left'
                  ? SHOULDER_LATERALITY.LEFT
                  : SHOULDER_LATERALITY.RIGHT,
              display:
                formData.laterality === 'left'
                  ? SHOULDER_LATERALITY.LEFT_DISPLAY
                  : SHOULDER_LATERALITY.RIGHT_DISPLAY,
            },
          ],
        }
      }

      if (formData.notes) {
        observation.note = [{ text: formData.notes }]
      }

      if (isEditing) {
        await fhirClient.update(observation, versionId)
      } else {
        await fhirClient.create(observation)
      }

      navigate(`/patient/${patientId}`)
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to save observation: ${err.message}`)
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Edit Observation' : 'New Observation'}
          </h2>
          <p className="text-slate-600">Patient: {patientName}</p>
        </div>
        <Link
          to={`/patient/${patientId}`}
          className="text-slate-600 hover:text-slate-900"
        >
          &larr; Back to patient
        </Link>
      </div>

      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="card">
        <h3 className="card-header">Observation Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label htmlFor="observationType" className="form-label">
              Observation Type *
            </label>
            {obsTypesError && (
              <p className="text-xs text-red-600 mb-1">Could not load observation types: {obsTypesError}</p>
            )}
            <select
              id="observationType"
              name="observationType"
              value={formData.observationType}
              onChange={handleObservationTypeChange}
              required
              disabled={obsTypesLoading}
              className="form-input"
            >
              <option value="">{obsTypesLoading ? 'Loading…' : '-- Select observation type --'}</option>
              {GROUP_ORDER.map((group) => {
                const groupOptions = obsTypeOptions.filter(
                  (o) => (OBSERVATION_METADATA[o.code]?.group ?? 'prom') === group
                )
                if (groupOptions.length === 0) return null
                return (
                  <optgroup key={group} label={OBSERVATION_GROUP_LABELS[group]}>
                    {groupOptions.map((o) => (
                      <option key={o.code} value={o.code}>{o.display}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>

          {/* Value input — dynamic based on observation type */}
          {selectedMeta?.valueType === 'codeable' && (
            <div className="form-group sm:col-span-2">
              <label htmlFor="valueCodeable" className="form-label">
                Value *
              </label>
              <select
                id="valueCodeable"
                name="valueCodeable"
                value={formData.valueCodeable}
                onChange={handleChange}
                required
                disabled={valueOptionsLoading}
                className="form-input"
              >
                <option value="">{valueOptionsLoading ? 'Loading…' : '-- Select value --'}</option>
                {valueOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.display}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedMeta?.valueType === 'quantity' && (
            <div className="form-group sm:col-span-2">
              <label htmlFor="valueQuantity" className="form-label">
                Value {selectedMeta.unitDisplay ? `(${selectedMeta.unitDisplay})` : ''} *
              </label>
              <input
                type="number"
                inputMode="decimal"
                id="valueQuantity"
                name="valueQuantity"
                value={formData.valueQuantity}
                onChange={handleChange}
                required
                min={selectedMeta.min ?? 0}
                max={selectedMeta.max}
                step={selectedMeta.unit === 'cm' ? '0.1' : '1'}
                className="form-input"
                placeholder={selectedMeta.unit === 'cm' ? 'e.g., 2.5' : 'e.g., 120'}
              />
            </div>
          )}

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
            <label htmlFor="effectiveDate" className="form-label">
              Date *
            </label>
            <input
              type="date"
              id="effectiveDate"
              name="effectiveDate"
              value={formData.effectiveDate}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
        </div>

        <h3 className="card-header mt-6">Notes</h3>

        <div className="form-group">
          <label htmlFor="notes" className="form-label">
            Additional Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="form-input"
            placeholder="Enter any additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Link to={`/patient/${patientId}`} className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !formData.observationType}
            className="btn btn-primary"
          >
            {saving
              ? 'Saving...'
              : isEditing
              ? 'Update Observation'
              : 'Create Observation'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ObservationForm
