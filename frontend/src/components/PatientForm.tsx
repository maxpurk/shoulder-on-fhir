import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type { Patient } from '../types/fhir'
import { PROFILE_URLS } from '../types/fhir'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

function PatientForm() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(patientId)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | undefined>()

  // Form state
  const [formData, setFormData] = useState({
    identifier: '',
    familyName: '',
    givenName: '',
    gender: '' as Patient['gender'],
    birthDate: '',
    phone: '',
    street: '',
    city: '',
    postalCode: '',
  })

  // Load existing patient if editing
  useEffect(() => {
    if (patientId) {
      loadPatient(patientId)
    }
  }, [patientId])

  const loadPatient = async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const patient = await fhirClient.read<Patient>('Patient', id)
      setVersionId(patient.meta?.versionId)

      setFormData({
        identifier: patient.identifier?.[0]?.value || '',
        familyName: patient.name?.[0]?.family || '',
        givenName: patient.name?.[0]?.given?.join(' ') || '',
        gender: patient.gender || ('' as Patient['gender']),
        birthDate: patient.birthDate || '',
        phone: patient.telecom?.find((t) => t.system === 'phone')?.value || '',
        street: patient.address?.[0]?.line?.[0] || '',
        city: patient.address?.[0]?.city || '',
        postalCode: patient.address?.[0]?.postalCode || '',
      })
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to load patient: ${err.message}`)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const patient: Patient = {
        resourceType: 'Patient',
        ...(patientId && { id: patientId }),
        meta: { profile: [PROFILE_URLS.PATIENT], ...(versionId && { versionId }) },
        identifier: [
          {
            system: 'https://maxpurk.github.io/shoulder-on-fhir/identifier/patient',
            value: formData.identifier || `PAT-${Date.now()}`,
          },
        ],
        name: [
          {
            use: 'official',
            family: formData.familyName,
            ...(formData.givenName.trim() && { given: formData.givenName.trim().split(' ').filter(Boolean) }),
          },
        ],
        gender: formData.gender,
        birthDate: formData.birthDate,
      }

      // Add optional telecom
      if (formData.phone) {
        patient.telecom = [
          {
            system: 'phone',
            value: formData.phone,
            use: 'home',
          },
        ]
      }

      // Add optional address
      if (formData.street || formData.city || formData.postalCode) {
        patient.address = [
          {
            use: 'home',
            line: formData.street ? [formData.street] : undefined,
            city: formData.city || undefined,
            postalCode: formData.postalCode || undefined,
            country: 'DE',
          },
        ]
      }

      if (isEditing) {
        await fhirClient.update(patient, versionId)
        navigate(`/patient/${patientId}`)
      } else {
        const created = await fhirClient.create(patient)
        navigate(`/patient/${created.id}`)
      }
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to save patient: ${err.message}`)
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
        <h2 className="text-2xl font-bold text-slate-900">
          {isEditing ? 'Edit Patient' : 'New Patient'}
        </h2>
        <Link to={isEditing ? `/patient/${patientId}` : '/'} className="text-slate-600 hover:text-slate-900">
          &larr; {isEditing ? 'Back to patient' : 'Back to list'}
        </Link>
      </div>

      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="card">
        <h3 className="card-header">Demographics</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="givenName" className="form-label">
              Given Name(s) *
            </label>
            <input
              type="text"
              id="givenName"
              name="givenName"
              value={formData.givenName}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="familyName" className="form-label">
              Family Name *
            </label>
            <input
              type="text"
              id="familyName"
              name="familyName"
              value={formData.familyName}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="e.g., Schmidt"
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthDate" className="form-label">
              Birth Date *
            </label>
            <input
              type="date"
              id="birthDate"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="gender" className="form-label">
              Gender *
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="identifier" className="form-label">
              Patient ID
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              className="form-input"
              placeholder="Auto-generated if empty"
            />
          </div>

        </div>

        <h3 className="card-header mt-6">Contact Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., +49 30 12345678"
            />
          </div>

          <div className="form-group sm:col-span-2">
            <label htmlFor="street" className="form-label">
              Street Address
            </label>
            <input
              type="text"
              id="street"
              name="street"
              value={formData.street}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., Musterstraße 123"
            />
          </div>

          <div className="form-group">
            <label htmlFor="postalCode" className="form-label">
              Postal Code
            </label>
            <input
              type="text"
              id="postalCode"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., 14482"
            />
          </div>

          <div className="form-group">
            <label htmlFor="city" className="form-label">
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., Potsdam"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Link to={isEditing ? `/patient/${patientId}` : '/'} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : isEditing ? 'Update Patient' : 'Create Patient'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PatientForm
