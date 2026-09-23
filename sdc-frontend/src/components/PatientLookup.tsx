import { useState } from 'react'
import type { Patient, Condition } from '../types/fhir'
import { PROFILE_URLS } from '../types/fhir'
import { fhirClient } from '../lib/fhirClient'
import type { LaunchContext } from '../lib/bundleAssembler'

/**
 * Patient lookup step used by Surgery and Follow-Up flows. Resolves the
 * patient by HPI-namespaced identifier or by name, then locates the
 * patient's RotatorCuffCondition for `Encounter.reasonReference` pre-fill.
 *
 * The resolved LaunchContext is handed to bundleAssembler.ts, which wires the
 * actual Patient/Condition references into the submitted bundle by ID — that
 * path is separate from, and does not depend on, SDC itemPopulationContext.
 * FlowPage.tsx additionally, and independently, evaluates the Questionnaire's
 * own declared itemPopulationContext + initialExpression (lib/populationContext.ts)
 * to drive a read-only confirmation display in the rendered form (ADR-0100).
 */

interface Props {
  onResolved: (ctx: LaunchContext, patient: Patient) => void
}

type Mode = 'identifier' | 'name'

export function PatientLookup({ onResolved }: Props) {
  const [mode, setMode] = useState<Mode>('identifier')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Patient[]>([])

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setError(null)
    setCandidates([])
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    setError(null)
    setCandidates([])
    try {
      const value = query.trim()
      if (!value) {
        setError(
          mode === 'identifier'
            ? 'Enter a patient identifier (e.g., SDC-XXXXXXXX) to search.'
            : 'Enter a family or given name to search.',
        )
        return
      }
      const params: Record<string, string> =
        mode === 'identifier'
          ? { identifier: value }
          : { name: value, _count: '20', _sort: '-_lastUpdated' }
      const bundle = await fhirClient.search<Patient>('Patient', params)
      const patients = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter((p): p is Patient => p?.resourceType === 'Patient')
      if (patients.length === 0) {
        setError(
          mode === 'identifier'
            ? 'No patient found with that identifier.'
            : 'No patient matched this name.',
        )
      } else {
        setCandidates(patients)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setSearching(false)
    }
  }

  const pickPatient = async (patient: Patient) => {
    setSearching(true)
    setError(null)
    try {
      if (!patient.id) throw new Error('Selected patient has no id')
      // Resolve the patient's RotatorCuffCondition for Encounter.reasonReference,
      // plus any coexisting non-rotator-cuff diagnoses (ADR-0159) for the
      // Surgery flow's per-concomitant-procedure diagnosis picker.
      const [conditionBundle, otherDiagnosisBundle] = await Promise.all([
        fhirClient.search<Condition>('Condition', {
          subject: `Patient/${patient.id}`,
          _profile: PROFILE_URLS.CONDITION,
        }),
        fhirClient.search<Condition>('Condition', {
          subject: `Patient/${patient.id}`,
          _profile: PROFILE_URLS.OTHER_DIAGNOSIS_CONDITION,
        }),
      ])
      const condition = conditionBundle.entry?.[0]?.resource
      const conditionId = condition?.id
      if (!conditionId) {
        setError('Patient has no RotatorCuffCondition — register them first via /register.')
        return
      }
      const otherDiagnoses = (otherDiagnosisBundle.entry ?? []).map((e) => e.resource)
      onResolved(
        { patientId: patient.id, conditionId, conditionBodySite: condition.bodySite?.[0], otherDiagnoses },
        patient,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve condition')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="card mb-6">
      <h2 className="card-header">Patient Lookup</h2>
      <p className="text-sm text-gray-600 mb-4">
        Resolve a previously registered patient by HPI identifier or by name. The form will show a
        read-only confirmation of the patient's linked diagnosis, resolved via SDC{' '}
        <code className="text-xs">itemPopulationContext</code> + <code className="text-xs">initialExpression</code>.
      </p>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => switchMode('identifier')}
          className={`px-3 py-1 text-sm border rounded ${
            mode === 'identifier'
              ? 'bg-hpi-orange text-white border-hpi-orange'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Patient identifier
        </button>
        <button
          type="button"
          onClick={() => switchMode('name')}
          className={`px-3 py-1 text-sm border rounded ${
            mode === 'name'
              ? 'bg-hpi-orange text-white border-hpi-orange'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Name
        </button>
      </div>
      <form onSubmit={search} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'identifier'
              ? 'Patient identifier (e.g., SDC-A1B2C3D4)'
              : 'Family or given name'
          }
          className="form-input flex-1"
        />
        <button
          type="submit"
          disabled={searching}
          className="btn btn-primary disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Find Patient'}
        </button>
      </form>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {candidates.length > 0 && (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
          {candidates.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50"
                onClick={() => pickPatient(p)}
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(p.name?.[0]?.given ?? []).join(' ')} {p.name?.[0]?.family}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.identifier?.[0]?.value} · {p.gender} · DOB {p.birthDate}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600">Select →</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
