import { useState } from 'react'
import { fhirClient, FhirError, ValidatorUnavailableError } from '../../lib/fhirClient'
import { preflightValidate } from '../../lib/preflightValidate'
import ValidatorBanner from '../ValidatorBanner'
import type {
  BundleEntry,
  OperationOutcome,
  TransactionResponseBundle,
  Encounter,
} from '../../types/fhir'
import { BUNDLE_PROFILES } from '../../types/fhir'

interface Props {
  encounter: Encounter
  entries: BundleEntry[]
  /** Called after a successful submission so the wizard can reset */
  onSubmitted: (response: TransactionResponseBundle) => void
  /** Called when the user wants to go back and edit */
  onBack: () => void
}

function severityClasses(sev: string) {
  if (sev === 'error' || sev === 'fatal') return 'bg-red-50 border-red-200 text-red-800'
  if (sev === 'warning') return 'bg-yellow-50 border-yellow-200 text-yellow-900'
  return 'bg-blue-50 border-blue-200 text-blue-900'
}

function ReviewSubmit({ encounter, entries, onSubmitted, onBack }: Props) {
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<OperationOutcome | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<TransactionResponseBundle | null>(null)
  const [validatorUnavailable, setValidatorUnavailable] = useState<string | null>(null)

  const bundlePreview = {
    resourceType: 'Bundle' as const,
    meta: { profile: [BUNDLE_PROFILES.FOLLOW_UP] },
    type: 'transaction' as const,
    entry: entries.map(({ uuid, resource }) => ({
      fullUrl: `urn:uuid:${uuid}`,
      resource,
      request: { method: 'POST' as const, url: resource.resourceType },
    })),
  }

  const obsCount = entries.filter((e) => e.resource.resourceType === 'Observation').length
  const qrCount = entries.filter((e) => e.resource.resourceType === 'QuestionnaireResponse').length
  const imagingCount = entries.filter((e) => e.resource.resourceType === 'ImagingStudy').length

  // Manual pre-flight check button — routes through the Validator sidecar
  // (ADR-0051), same engine as tools/validate.sh. Lets the user preview the
  // OperationOutcome before clicking Submit. Errors will still block Submit;
  // warnings won't.
  async function runValidate() {
    setValidating(true)
    setOutcome(null)
    setValidatorUnavailable(null)
    try {
      const result = await fhirClient.validateBundle(entries, BUNDLE_PROFILES.FOLLOW_UP)
      setOutcome(result)
    } catch (err) {
      if (err instanceof ValidatorUnavailableError) {
        setValidatorUnavailable(err.message)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Validation request failed')
      }
    } finally {
      setValidating(false)
    }
  }

  async function runSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    setValidatorUnavailable(null)
    try {
      const preflight = await preflightValidate(entries, BUNDLE_PROFILES.FOLLOW_UP)
      if (preflight.kind === 'blocked') {
        setOutcome({ resourceType: 'OperationOutcome', issue: preflight.issues })
        setSubmitting(false)
        return
      }
      if (preflight.kind === 'warnings') {
        setOutcome({ resourceType: 'OperationOutcome', issue: preflight.issues })
      }
      if (preflight.kind === 'unavailable') setValidatorUnavailable(preflight.message ?? '')

      const result = await fhirClient.submitBundle(entries, BUNDLE_PROFILES.FOLLOW_UP)
      setSubmitResult(result)
      onSubmitted(result)
    } catch (err) {
      if (err instanceof FhirError) {
        setSubmitError(`HAPI rejected the bundle: ${err.message}`)
        if (err.operationOutcome) setOutcome(err.operationOutcome as OperationOutcome)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-header">Step 5 — Review and submit</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Visit start" value={encounter.period?.start?.slice(0, 16).replace('T', ' ') ?? '—'} />
        <Stat label="Encounter type" value={encounter.type?.[0]?.coding?.[0]?.display ?? '—'} />
        <Stat label="Observations" value={String(obsCount)} />
        <Stat label="QR included" value={qrCount > 0 ? 'yes' : 'no'} />
        <Stat label="Re-imaging" value={imagingCount > 0 ? 'yes' : 'no'} />
      </div>

      <details className="mb-6">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Show bundle JSON (the exact payload sent to HAPI)
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto text-xs bg-gray-900 text-gray-100 rounded p-3">
          {JSON.stringify(bundlePreview, null, 2)}
        </pre>
      </details>

      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={submitting}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={runValidate}
          disabled={validating || submitting}
          title="Preview pre-flight result without submitting"
        >
          {validating ? 'Validating…' : 'Run pre-flight check'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={runSubmit}
          disabled={submitting}
          title="POST transaction to HAPI"
        >
          {submitting ? 'Submitting…' : 'Submit follow-up'}
        </button>
      </div>

      {validatorUnavailable !== null && (
        <ValidatorBanner message={validatorUnavailable || undefined} />
      )}

      {outcome && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Pre-flight result — {outcome.issue?.length ?? 0} issue
            {outcome.issue?.length === 1 ? '' : 's'}
            <span className="ml-2 font-normal text-xs text-gray-500">
              (errors block submit; warnings allow)
            </span>
          </h3>
          {(!outcome.issue || outcome.issue.length === 0) && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 mb-2">
              No issues. The sidecar engine is the same one CI uses (tools/validate.sh).
            </div>
          )}
          <ul className="space-y-2">
            {outcome.issue?.map((iss, i) => (
              <li key={i} className={`border rounded p-2 text-sm ${severityClasses(iss.severity)}`}>
                <div className="font-semibold uppercase text-xs">{iss.severity}</div>
                <div>{iss.details?.text ?? iss.diagnostics ?? iss.code}</div>
                {iss.expression && iss.expression.length > 0 && (
                  <div className="text-xs mt-1 opacity-80 break-words">at: {iss.expression.join(', ')}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 mb-2">
          {submitError}
        </div>
      )}

      {submitResult && (
        <div className="bg-green-50 border border-green-200 text-green-900 rounded p-3">
          <p className="font-semibold mb-2">Submitted. HAPI assigned:</p>
          <ul className="text-xs space-y-1">
            {submitResult.entry?.map((e, i) => (
              <li key={i}>
                <code>{e.response?.location ?? '—'}</code> · {e.response?.status ?? ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

export default ReviewSubmit
