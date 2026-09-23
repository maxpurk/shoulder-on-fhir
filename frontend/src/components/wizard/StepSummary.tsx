import type { Patient, Condition, Procedure, Observation, WizardEntry, OperationOutcome } from '../../types/fhir'
import ValidatorBanner from '../ValidatorBanner'
import ErrorBanner from '../shared/ErrorBanner'

interface StepSummaryProps {
  allEntries: WizardEntry[]
  onSubmit: () => Promise<void>
  submitting: boolean
  error: string | null
  validationIssues: OperationOutcome['issue']
  validatorUnavailable?: string | null
  onBack: () => void
}

function StepSummary({ allEntries, onSubmit, submitting, error, validationIssues, validatorUnavailable, onBack }: StepSummaryProps) {
  const blocking = validationIssues.some((i) => i.severity === 'error' || i.severity === 'fatal')
  const patient = allEntries.find(e => e.resource.resourceType === 'Patient')?.resource as Patient | undefined
  const conditionEntries = allEntries.filter(e => e.resource.resourceType === 'Condition')
  const procedureEntries = allEntries.filter(e => e.resource.resourceType === 'Procedure')
  const observationEntries = allEntries.filter(e => e.resource.resourceType === 'Observation')

  const name = patient?.name?.[0]
  const fullName = `${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim()

  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700 font-semibold text-lg">
          <span>Review Registration</span>
        </div>
        <p className="text-blue-600 text-sm mt-1">
          {allEntries.length} resource(s) will be submitted as a single atomic transaction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        {/* Patient */}
        <div className="card">
          <h3 className="card-header">Patient</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Name</p><p className="font-medium">{fullName || '—'}</p></div>
            <div><p className="text-gray-500">Date of Birth</p><p className="font-medium">{patient?.birthDate || '—'}</p></div>
          </div>
        </div>

        {/* Conditions */}
        {conditionEntries.length > 0 && (
          <div className="card">
            <h3 className="card-header">Diagnosis</h3>
            {conditionEntries.map(({ uuid, resource }) => {
              const c = resource as Condition
              return (
                <div key={uuid} className="text-sm">
                  <p className="font-medium">{c.code?.coding?.[0]?.display || c.code?.text}</p>
                  <p className="text-gray-500">{c.bodySite?.[0]?.coding?.[0]?.display} · {c.clinicalStatus?.coding?.[0]?.code}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Procedures */}
        {procedureEntries.length > 0 && (
          <div className="card">
            <h3 className="card-header">Prior Treatment</h3>
            {procedureEntries.map(({ uuid, resource }) => {
              const p = resource as Procedure
              return (
                <div key={uuid} className="text-sm">
                  <p className="font-medium">{p.code?.coding?.[0]?.display || p.code?.text}</p>
                  <p className="text-gray-500">{p.performedDateTime?.split('T')[0]} · {p.status}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Observations */}
        {observationEntries.length > 0 && (
          <div className="card">
            <h3 className="card-header">Observations ({observationEntries.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {observationEntries.map(({ uuid, resource }) => {
                const o = resource as Observation
                let value: string | number = '—'
                if (o.valueInteger !== undefined) value = o.valueInteger
                else if (o.valueQuantity) value = `${o.valueQuantity.value} ${o.valueQuantity.unit ?? o.valueQuantity.code ?? ''}`.trim()
                else if (o.valueCodeableConcept) value = o.valueCodeableConcept.coding?.[0]?.display ?? o.valueCodeableConcept.text ?? '—'
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
        <button type="button" onClick={onBack} className="btn btn-secondary">
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="btn btn-primary px-8"
        >
          {submitting ? 'Submitting...' : 'Submit Registration →'}
        </button>
      </div>
    </div>
  )
}

export default StepSummary
