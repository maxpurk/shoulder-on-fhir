import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type { Procedure, Patient, Condition, Bundle } from '../types/fhir'
import { SHOULDER_LATERALITY, PROFILE_URLS, VALUESET_URLS } from '../types/fhir'
import { useValueSet } from '../hooks/useValueSet'
import { getProcedureEffectiveDate } from '../lib/patientStage'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

/**
 * ProcedureForm Component
 *
 * Form for creating or editing a shoulder surgical procedure.
 * Captures procedure type, date, body site, and linked conditions.
 */

// Swaps the YYYY-MM-DD prefix of an ISO datetime for a new date, keeping the
// original time-of-day and offset untouched — avoids Date-object timezone
// round-tripping when this date-only form edits a performedPeriod value.
function replaceDatePart(originalIso: string, newDateStr: string): string {
  const tIndex = originalIso.indexOf('T')
  if (tIndex === -1) return newDateStr
  return newDateStr + originalIso.slice(tIndex)
}

function ProcedureForm() {
  const { patientId, procedureId } = useParams<{
    patientId: string
    procedureId?: string
  }>()
  const navigate = useNavigate()
  const isEditing = Boolean(procedureId)

  const { options: procedures, loading: proceduresLoading, error: proceduresError } = useValueSet(VALUESET_URLS.ROTATOR_CUFF_PROCEDURE_TYPE)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientName, setPatientName] = useState<string>('')
  const [patientConditions, setPatientConditions] = useState<Condition[]>([])
  const [versionId, setVersionId] = useState<string | undefined>()
  // Preserves the loaded resource's performedPeriod (start/end, incision/suture
  // times per ADR-0108) so editing through this date-only form doesn't destroy
  // it — only its date portion is replaced on save, per-field time-of-day kept.
  const [performedPeriod, setPerformedPeriod] = useState<Procedure['performedPeriod']>()

  // Form state
  const [formData, setFormData] = useState({
    procedureCode: '',
    procedureText: '',
    laterality: '',
    performedDate: '',
    status: '' as Procedure['status'],
    linkedConditionId: '',
    outcome: '',
    notes: '',
  })

  // Load patient info, conditions, and existing procedure if editing
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

        // Load patient's conditions
        const conditionBundle = await fhirClient.search<Condition>('Condition', {
          subject: `Patient/${patientId}`,
        }) as Bundle<Condition>
        setPatientConditions(conditionBundle.entry?.map((e) => e.resource) || [])

        // Load existing procedure if editing
        if (procedureId) {
          const procedure = await fhirClient.read<Procedure>(
            'Procedure',
            procedureId
          )
          setVersionId(procedure.meta?.versionId)
          setPerformedPeriod(procedure.performedPeriod)

          const procCode = procedure.code?.coding?.[0]?.code || ''
          const bodySiteCode = procedure.bodySite?.[0]?.coding?.[0]?.code
          const linkedCondRef = procedure.reasonReference?.[0]?.reference

          setFormData({
            procedureCode: procCode,
            procedureText: procedure.code?.text || '',
            laterality:
              bodySiteCode === SHOULDER_LATERALITY.LEFT ? 'left' : bodySiteCode === SHOULDER_LATERALITY.RIGHT ? 'right' : '',
            performedDate: getProcedureEffectiveDate(procedure)?.split('T')[0] || '',
            status: procedure.status,
            linkedConditionId: linkedCondRef?.replace('Condition/', '') || '',
            outcome: procedure.outcome?.coding?.[0]?.code || 'successful',
            notes: procedure.note?.[0]?.text || '',
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
  }, [patientId, procedureId])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const selectedProcedure = procedures.find(
        (p) => p.code === formData.procedureCode
      )

      const procedure: Procedure = {
        resourceType: 'Procedure',
        ...(procedureId && { id: procedureId }),
        meta: { profile: [PROFILE_URLS.PROCEDURE], ...(versionId && { versionId }) },
        status: formData.status,
        category: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '387713003',
              display: 'Surgical procedure',
            },
          ],
        },
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: formData.procedureCode,
              display: selectedProcedure?.display,
            },
          ],
          text: formData.procedureText || selectedProcedure?.display,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        ...(performedPeriod
          ? {
              performedPeriod: {
                ...(performedPeriod.start && {
                  start: replaceDatePart(performedPeriod.start, formData.performedDate),
                }),
                ...(performedPeriod.end && {
                  end: replaceDatePart(performedPeriod.end, formData.performedDate),
                }),
              },
            }
          : { performedDateTime: formData.performedDate }),
        bodySite: [
          {
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
          },
        ],
        ...(formData.linkedConditionId && {
          reasonReference: [
            {
              reference: `Condition/${formData.linkedConditionId}`,
            },
          ],
        }),
        ...(formData.outcome && {
          outcome: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: formData.outcome === 'successful' ? '385669000' : '385671000',
                display: formData.outcome === 'successful' ? 'Successful' : 'Unsuccessful',
              },
            ],
          },
        }),
        ...(formData.notes && {
          note: [{ text: formData.notes }],
        }),
      }

      if (isEditing) {
        await fhirClient.update(procedure, versionId)
      } else {
        await fhirClient.create(procedure)
      }

      navigate(`/patient/${patientId}`)
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to save procedure: ${err.message}`)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setSaving(false)
    }
  }

  const getConditionDisplay = (condition: Condition): string => {
    const code = condition.code?.text || condition.code?.coding?.[0]?.display
    const side = condition.bodySite?.[0]?.text || condition.bodySite?.[0]?.coding?.[0]?.display || '—'
    return `${side}: ${code || 'Unknown condition'}`
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
            {isEditing ? 'Edit Procedure' : 'New Procedure'}
          </h2>
          <p className="text-slate-600">Patient: {patientName}</p>
        </div>
        <Link to={patientId ? `/patient/${patientId}` : '/patients'} className="text-slate-600 hover:text-slate-900">
          &larr; Back to patient
        </Link>
      </div>

      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="card">
        <h3 className="card-header">Procedure Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label htmlFor="procedureCode" className="form-label">
              Procedure Type *
            </label>
            {proceduresError && (
              <p className="text-xs text-red-600 mb-1">Could not load procedures: {proceduresError}</p>
            )}
            <select
              id="procedureCode"
              name="procedureCode"
              value={formData.procedureCode}
              onChange={handleChange}
              required
              disabled={proceduresLoading}
              className="form-input"
            >
              {proceduresLoading && <option value="">Loading procedures…</option>}
              {!proceduresLoading && <option value="">-- Select procedure --</option>}
              {procedures.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.display}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group sm:col-span-2">
            <label htmlFor="procedureText" className="form-label">
              Additional Description
            </label>
            <input
              type="text"
              id="procedureText"
              name="procedureText"
              value={formData.procedureText}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., Double-row repair with suture anchors"
            />
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
            <label htmlFor="performedDate" className="form-label">
              Procedure Date *
            </label>
            <input
              type="date"
              id="performedDate"
              name="performedDate"
              value={formData.performedDate}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="status" className="form-label">
              Status *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="">-- Select status --</option>
              <option value="preparation">Preparation</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
              <option value="stopped">Stopped</option>
              <option value="not-done">Not Done</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="outcome" className="form-label">
              Outcome
            </label>
            <select
              id="outcome"
              name="outcome"
              value={formData.outcome}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">-- Select outcome --</option>
              <option value="successful">Successful</option>
              <option value="unsuccessful">Unsuccessful</option>
            </select>
          </div>
        </div>

        <h3 className="card-header mt-6">Related Condition</h3>

        <div className="form-group">
          <label htmlFor="linkedConditionId" className="form-label">
            Linked Condition
          </label>
          <select
            id="linkedConditionId"
            name="linkedConditionId"
            value={formData.linkedConditionId}
            onChange={handleChange}
            className="form-input"
          >
            <option value="">-- No linked condition --</option>
            {patientConditions.map((c) => (
              <option key={c.id} value={c.id}>
                {getConditionDisplay(c)}
              </option>
            ))}
          </select>
          {patientConditions.length === 0 && (
            <p className="text-sm text-slate-500 mt-1">
              No conditions found for this patient.{' '}
              <Link
                to={`/patient/${patientId}/condition/new`}
                className="text-hpi-orange hover:underline"
              >
                Create one first
              </Link>
            </p>
          )}
        </div>

        <h3 className="card-header mt-6">Notes</h3>

        <div className="form-group">
          <label htmlFor="notes" className="form-label">
            Operative Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="form-input"
            placeholder="Enter any relevant operative notes..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Link to={patientId ? `/patient/${patientId}` : '/patients'} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving
              ? 'Saving...'
              : isEditing
              ? 'Update Procedure'
              : 'Create Procedure'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProcedureForm
