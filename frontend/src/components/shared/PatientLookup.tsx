import { useEffect, useRef, useState } from 'react'
import { fhirClient, FhirError } from '../../lib/fhirClient'
import type { Patient, Condition, Procedure, Encounter } from '../../types/fhir'
import { PATIENT_IDENTIFIER_SYSTEM, PROFILE_URLS } from '../../types/fhir'
import { classifyEncounter, findIndexProcedure } from '../../lib/patientStage'

export interface LookupResult {
  patient: Patient
  condition: Condition
  /** index procedure if found (defines T0 reference for timepoint chips) */
  indexProcedure?: Procedure
  /** prior follow-up encounters already in HAPI for this patient */
  priorEncounters: Encounter[]
  /** ADR-0159: coexisting non-rotator-cuff diagnoses (ShoulderDiagnosisCondition,
   * ADR-0077's otherDiagnosis slice) already recorded at Registration — lets the
   * Surgery flow offer a per-concomitant-procedure diagnosis picker. */
  otherDiagnoses: Condition[]
}

interface Props {
  onSelect: (result: LookupResult) => void
  /**
   * If set, auto-populate the search box with this identifier on mount and
   * fire the search. If the search returns exactly one patient, also auto-
   * load that patient's context and call onSelect. Used by deep-link CTAs
   * from the PatientDetail timeline.
   */
  initialIdentifier?: string
}

type Mode = 'identifier' | 'name'

function patientLabel(p: Patient): string {
  const n = p.name?.[0]
  const given = n?.given?.join(' ') ?? ''
  const family = n?.family ?? ''
  return [given, family].filter(Boolean).join(' ').trim() || `(unnamed) ${p.id ?? ''}`
}

function PatientLookup({ onSelect, initialIdentifier }: Props) {
  const [mode, setMode] = useState<Mode>('identifier')
  const [query, setQuery] = useState(initialIdentifier ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Patient[]>([])
  const autoTriggered = useRef(false)

  async function runSearch(rawQuery: string, searchMode: Mode, autoLoad: boolean) {
    const term = rawQuery.trim()
    if (!term) return
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const params: Record<string, string> =
        searchMode === 'identifier'
          ? { identifier: `${PATIENT_IDENTIFIER_SYSTEM}|${term}` }
          : { name: term }
      params._count = '20'
      params._sort = '-_lastUpdated'
      const bundle = await fhirClient.search<Patient>('Patient', params)
      const found = (bundle.entry ?? []).map((e) => e.resource)
      if (found.length === 0) setError('No patient matched this search.')
      setResults(found)
      if (autoLoad && found.length === 1) {
        await loadPatientContext(found[0])
      }
    } catch (err) {
      setError(err instanceof FhirError ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function searchPatients(e: React.FormEvent) {
    e.preventDefault()
    await runSearch(query, mode, false)
  }

  useEffect(() => {
    if (autoTriggered.current) return
    if (!initialIdentifier) return
    autoTriggered.current = true
    setMode('identifier')
    setQuery(initialIdentifier)
    void runSearch(initialIdentifier, 'identifier', true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIdentifier])

  async function loadPatientContext(patient: Patient) {
    if (!patient.id) return
    setLoading(true)
    setError(null)
    try {
      const [conditionBundle, procedureBundle, encounterBundle] = await Promise.all([
        fhirClient.search<Condition>('Condition', {
          subject: `Patient/${patient.id}`,
          _sort: '-_lastUpdated',
          _count: '10',
        }),
        fhirClient.search<Procedure>('Procedure', {
          subject: `Patient/${patient.id}`,
          _sort: '-date',
          _count: '10',
        }),
        fhirClient.search<Encounter>('Encounter', {
          subject: `Patient/${patient.id}`,
          _sort: 'date',
          _count: '20',
        }),
      ])
      const allConditions = (conditionBundle.entry ?? []).map((e) => e.resource)
      const otherDiagnoses = allConditions.filter((c) =>
        c.meta?.profile?.includes(PROFILE_URLS.OTHER_DIAGNOSIS_CONDITION),
      )
      const condition = allConditions.find(
        (c) => !c.meta?.profile?.includes(PROFILE_URLS.OTHER_DIAGNOSIS_CONDITION),
      )
      if (!condition) {
        setError('Patient has no Condition on file — complete the Register flow first.')
        return
      }
      const indexProcedure = findIndexProcedure(
        (procedureBundle.entry ?? []).map((e) => e.resource),
      )
      const priorEncounters = (encounterBundle.entry ?? [])
        .map((e) => e.resource)
        .filter((e) => classifyEncounter(e) === 'follow-up')
      onSelect({ patient, condition, indexProcedure, priorEncounters, otherDiagnoses })
    } catch (err) {
      setError(err instanceof FhirError ? err.message : 'Failed to load patient context')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-header">Step 1 — Find the registered patient</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className={`chip ${
            mode === 'identifier'
              ? 'bg-hpi-orange text-white border-hpi-orange'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
          onClick={() => setMode('identifier')}
        >
          Patient identifier
        </button>
        <button
          type="button"
          className={`chip ${
            mode === 'name'
              ? 'bg-hpi-orange text-white border-hpi-orange'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
          onClick={() => setMode('name')}
        >
          Name (fallback)
        </button>
      </div>

      <form onSubmit={searchPatients} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          className="form-input flex-1"
          placeholder={
            mode === 'identifier'
              ? 'e.g. PAT-12345 (HPI patient identifier)'
              : 'family or given name'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {results.length} match{results.length === 1 ? '' : 'es'}. Click to load follow-up context.
          </p>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left p-3 hover:bg-gray-50"
                  onClick={() => loadPatientContext(p)}
                  disabled={loading}
                >
                  <div className="font-medium text-gray-900">{patientLabel(p)}</div>
                  <div className="text-xs text-gray-500">
                    Patient/{p.id} · {p.gender ?? '—'} · DOB {p.birthDate ?? '—'}
                    {p.identifier?.[0]?.value && (
                      <span className="ml-2">
                        · identifier: <code>{p.identifier[0].value}</code>
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'identifier' && (
        <p className="text-xs text-gray-500 mt-4">
          Identifier system: <code>{PATIENT_IDENTIFIER_SYSTEM}</code>
        </p>
      )}
    </div>
  )
}

export default PatientLookup
