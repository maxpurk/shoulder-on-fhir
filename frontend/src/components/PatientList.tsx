import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fhirClient, FhirError } from '../lib/fhirClient'
import type { Patient, Bundle } from '../types/fhir'
import LoadingSpinner from './shared/LoadingSpinner'
import ErrorBanner from './shared/ErrorBanner'

/**
 * PatientList Component
 *
 * Displays a searchable list of patients from the FHIR server.
 * Allows navigation to patient details and associated conditions/procedures.
 */
function PatientList() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch patients on component mount
  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async (search?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params: Record<string, string> = {
        _sort: '-_lastUpdated',
        _count: '50',
      }

      if (search) {
        params.name = search
      }

      const bundle = await fhirClient.search<Patient>('Patient', params) as Bundle<Patient>
      const patientList = bundle.entry?.map((e) => e.resource) || []
      setPatients(patientList)
    } catch (err) {
      if (err instanceof FhirError) {
        setError(`Failed to fetch patients: ${err.message}`)
      } else {
        setError('An unexpected error occurred')
      }
      console.error('Error fetching patients:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPatients(searchTerm)
  }

  const getPatientName = (patient: Patient): string => {
    const name = patient.name?.[0]
    if (!name) return 'Unknown'
    const given = name.given?.join(' ') || ''
    const family = name.family || ''
    return `${given} ${family}`.trim() || 'Unknown'
  }

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('de-DE')
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Patients</h2>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name..."
            className="form-input flex-1"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                fetchPatients()
              }}
              className="btn btn-secondary"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      {/* Patient Table */}
      {patients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No patients found</p>
          <Link to="/patient/new/wizard" className="btn btn-primary">
            Register First Patient
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birth Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gender
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/patient/${patient.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/patient/${patient.id}`}
                      className="text-hpi-orange hover:underline font-medium"
                    >
                      {getPatientName(patient)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(patient.birthDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {patient.gender || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <p className="mt-4 text-sm text-gray-500">
        Showing {patients.length} patient{patients.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default PatientList
