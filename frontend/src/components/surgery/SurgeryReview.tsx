import type { Patient, Condition, Encounter, Procedure, Observation, WizardEntry, OperationOutcome } from '../../types/fhir'
import ValidatorBanner from '../ValidatorBanner'
import ErrorBanner from '../shared/ErrorBanner'

interface Props {
  patient: Patient
  condition: Condition
  entries: WizardEntry[]
  submitting: boolean
  error: string | null
  validationIssues: OperationOutcome['issue']
  validatorUnavailable?: string | null
  onSubmit: () => void
  onBack: () => void
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function SurgeryReview({ patient, condition, entries, submitting, error, validationIssues, validatorUnavailable, onSubmit, onBack }: Props) {
  const blocking = validationIssues.some((i) => i.severity === 'error' || i.severity === 'fatal')
  const encounterEntry = entries.find((e) => e.resource.resourceType === 'Encounter')
  const procedureEntries = entries.filter((e) => e.resource.resourceType === 'Procedure')
  const observationEntries = entries.filter((e) => e.resource.resourceType === 'Observation')

  const encounter = encounterEntry?.resource as Encounter | undefined
  const name = patient.name?.[0]
  const fullName = `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim()

  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 font-semibold text-lg">
          <span>Review Surgery</span>
        </div>
        <p className="text-blue-600 text-sm mt-1">
          {entries.length} resource(s) will be submitted as a single atomic transaction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        {/* Patient / Diagnosis */}
        <div className="card">
          <h3 className="card-header">Patient &amp; Diagnosis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Name</p><p className="font-medium">{fullName || '—'}</p></div>
            <div><p className="text-gray-500">Diagnosis</p><p className="font-medium">{condition.code?.coding?.[0]?.display || condition.code?.text || '—'}</p></div>
          </div>
        </div>

        {/* Encounter */}
        {encounter && (
          <div className="card">
            <h3 className="card-header">Surgical Event</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Setting</p>
                <p className="font-medium">{encounter.class?.code === 'IMP' ? 'Inpatient' : 'Day surgery'}</p>
              </div>
              <div>
                <p className="text-gray-500">Incision – Closure</p>
                <p className="font-medium">
                  {formatDateTime(encounter.period?.start)}
                  {encounter.period?.end && ` – ${formatDateTime(encounter.period.end)}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Procedures */}
        {procedureEntries.length > 0 && (
          <div className="card">
            <h3 className="card-header">Procedures</h3>
            <div className="divide-y divide-gray-100">
              {procedureEntries.map(({ uuid, resource }) => {
                const p = resource as Procedure
                return (
                  <div key={uuid} className="text-sm py-2 first:pt-0 last:pb-0">
                    <p className="font-medium">{p.code?.coding?.[0]?.display || p.code?.text || '—'}</p>
                    {p.outcome && <p className="text-gray-500">Outcome: {p.outcome.coding?.[0]?.display}</p>}
                    {p.note?.[0]?.text && <p className="text-gray-500">Notes: {p.note[0].text}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Observations */}
        {observationEntries.length > 0 && (
          <div className="card">
            <h3 className="card-header">Intra-operative Findings ({observationEntries.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {observationEntries.map(({ uuid, resource }) => {
                const o = resource as Observation
                let value: string | number = '—'
                if (o.valueQuantity) value = `${o.valueQuantity.value} ${o.valueQuantity.unit ?? o.valueQuantity.code ?? ''}`.trim()
                else if (o.valueCodeableConcept) value = o.valueCodeableConcept.coding?.[0]?.display ?? o.valueCodeableConcept.text ?? '—'
                else if (o.valueInteger !== undefined) value = o.valueInteger
                else if (o.valueString) value = o.valueString
                else if (o.valueBoolean !== undefined) value = o.valueBoolean ? 'Yes' : 'No'
                return (
                  <div key={uuid} className="text-sm">
                    <span className="text-gray-500">{o.code?.coding?.[0]?.display}: </span>
                    <span className="font-medium">{value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {validatorUnavailable !== null && validatorUnavailable !== undefined && (
        <ValidatorBanner message={validatorUnavailable || undefined} />
      )}

      {validationIssues.length > 0 && (
        <div
          className={
            blocking
              ? 'bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md mb-4'
              : 'bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-md mb-4'
          }
        >
          <p className="font-semibold mb-2">
            {blocking
              ? 'Validation errors — submission blocked. Fix the issues below and try again.'
              : 'Validation warnings — submission allowed, but please review:'}
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {validationIssues.map((issue, i) => (
              <li key={i}>
                <span className="font-mono text-xs">[{issue.severity}]</span>{' '}
                {issue.details?.text || issue.diagnostics || issue.code}
                {issue.expression && issue.expression.length > 0 && (
                  <span className="opacity-70"> ({issue.expression.join(', ')})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <ErrorBanner message={error} className="mb-4" />
      )}

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary" disabled={submitting}>
          ← Back
        </button>
        <button type="button" onClick={onSubmit} className="btn btn-primary px-8" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Surgery Bundle'}
        </button>
      </div>
    </div>
  )
}

export default SurgeryReview
