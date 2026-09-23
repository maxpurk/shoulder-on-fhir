import { useEffect, useMemo, useState } from 'react'
import type { OperationOutcome, Patient, Questionnaire, QuestionnaireResponse, TransactionResponseBundle } from '../types/fhir'
import { QUESTIONNAIRE_URLS } from '../types/fhir'
import { fhirClient } from '../lib/fhirClient'
import { preflightValidate } from '../lib/preflightValidate'
import { extractResources, collectExtractionTargets } from '../lib/extractor'
import { resolveExtractionPlan, type ResolvedProfile } from '../lib/profileMetadataResolver'
import { assembleBundle, type LaunchContext } from '../lib/bundleAssembler'
import {
  extractPopulationContexts,
  resolvePopulationContexts,
  evaluateInitialExpressions,
  requiresPatientLaunchContext,
  withLaunchContextResources,
  type FhirResourceLike,
} from '../lib/populationContext'
import { QuestionnaireForm } from './QuestionnaireForm'
import { PatientLookup } from './PatientLookup'
import { SubmissionResult } from './SubmissionResult'
import ValidatorBanner from './ValidatorBanner'

export type FlowType = 'registration' | 'surgery' | 'follow-up'

const FLOW_TO_QURL: Record<FlowType, string> = {
  registration: QUESTIONNAIRE_URLS.REGISTRATION,
  surgery: QUESTIONNAIRE_URLS.SURGERY,
  'follow-up': QUESTIONNAIRE_URLS.FOLLOW_UP,
}

interface Props {
  flow: FlowType
}

export function FlowPage({ flow }: Props) {
  const questionnaireUrl = FLOW_TO_QURL[flow]

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  // Derived from the Questionnaire's own declared sdc-questionnaire-launchContext
  // extension, not a hardcoded per-flow flag — see ADR-0101. `questionnaire` is
  // still null on the render passes before it loads, but those passes never
  // reach the branch that reads `requiresLookup` (they return earlier, at the
  // loadingQ / fetchError checks below), so the `true` fallback is never acted on.
  const requiresLookup = questionnaire ? requiresPatientLaunchContext(questionnaire) : true
  const [loadingQ, setLoadingQ] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // ADR-0103/ADR-0122: every element type + fixed value the extractor needs
  // is resolved at runtime from HAPI once, here, when the Questionnaire
  // loads — not mid-submission, so extractResources() stays synchronous. A
  // resolution failure blocks the form the same way a Questionnaire-fetch
  // failure already does, rather than silently dropping answers (see
  // extractor.ts's defense-in-depth guard, which now only ever fires as a
  // true last resort).
  const [profileMeta, setProfileMeta] = useState<Map<string, ResolvedProfile>>(new Map())
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [launchContext, setLaunchContext] = useState<LaunchContext | null>(null)
  const [resolvedPatient, setResolvedPatient] = useState<Patient | null>(null)
  const [initialOverrides, setInitialOverrides] = useState<Record<string, string>>({})
  // Resolved launchContext/itemPopulationContext resources, exposed to
  // QuestionnaireForm as the FHIRPath environment for calculatedExpression
  // (e.g. %patient). Both current IG expressions are %resource-only, so this
  // is unused today — it keeps a single evaluation mechanism for any future
  // calc that references a launch-context resource (ADR-0174).
  const [calcEnv, setCalcEnv] = useState<Record<string, FhirResourceLike>>({})
  const [result, setResult] = useState<TransactionResponseBundle | null>(null)
  const [preflightIssues, setPreflightIssues] = useState<OperationOutcome['issue']>([])
  const [validatorUnavailable, setValidatorUnavailable] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadingQ(true)
      setFetchError(null)
      setLoadingMeta(true)
      setMetaError(null)

      let q: Questionnaire
      try {
        const bundle = await fhirClient.search<Questionnaire>('Questionnaire', { url: questionnaireUrl })
        const resource = bundle.entry?.[0]?.resource
        if (!resource) throw new Error('Questionnaire not found on server')
        q = resource
        if (cancelled) return
        setQuestionnaire(q)
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load Questionnaire')
          setLoadingMeta(false)
        }
        return
      } finally {
        if (!cancelled) setLoadingQ(false)
      }

      // Prefetch the extraction plan (ADR-0103/ADR-0122) — once here, well before submit.
      const targets = collectExtractionTargets(q.item ?? [])
      const requestedProfiles = new Set(targets.map((t) => t.profileCanonical)).size
      try {
        const resolved = await resolveExtractionPlan(targets)
        if (resolved.size < requestedProfiles) {
          throw new Error(
            `Could not resolve metadata for ${requestedProfiles - resolved.size} of ${requestedProfiles} profile(s)`,
          )
        }
        if (!cancelled) setProfileMeta(resolved)
      } catch (err) {
        if (!cancelled) setMetaError(err instanceof Error ? err.message : 'Failed to load profile metadata from the FHIR server')
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [questionnaireUrl, retryKey])

  const handleSubmit = useMemo(
    () => async (qr: QuestionnaireResponse): Promise<TransactionResponseBundle> => {
      setPreflightIssues([])
      setValidatorUnavailable(null)
      const extracted = extractResources(qr, questionnaire?.item ?? [], profileMeta)
      const { entries, bundleProfile } = assembleBundle(extracted, questionnaireUrl, {
        questionnaireResponse: qr,
        launchContext: launchContext ?? undefined,
      })
      // Strict pre-flight via Validator sidecar (ADR-0051).
      const preflight = await preflightValidate(entries, bundleProfile)
      if (preflight.kind === 'blocked') {
        setPreflightIssues(preflight.issues)
        throw new Error(`Pre-flight blocked submission: ${preflight.issues.filter(i => i.severity === 'error' || i.severity === 'fatal').length} error(s). See banner above.`)
      }
      if (preflight.kind === 'warnings') setPreflightIssues(preflight.issues)
      if (preflight.kind === 'unavailable') setValidatorUnavailable(preflight.message ?? '')
      return fhirClient.submitBundle(entries, bundleProfile)
    },
    [questionnaire, questionnaireUrl, launchContext, profileMeta],
  )

  const blocking = preflightIssues.some((i) => i.severity === 'error' || i.severity === 'fatal')

  // Sort blocking issues first so the banner's display cap below can never
  // hide the very issues it's telling the user to fix — a real bug found
  // live (ADR-0134): a flat slice(0, N) on an unsorted array let error/fatal
  // issues land past the cutoff whenever 10+ lower-severity issues preceded
  // them, showing only warnings while the "submission blocked" message
  // referenced errors nowhere visible on screen.
  const severityRank: Record<string, number> = { fatal: 0, error: 1, warning: 2, information: 3 }
  const sortedPreflightIssues = [...preflightIssues].sort(
    (a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
  )
  const blockingIssueCount = sortedPreflightIssues.filter(
    (i) => i.severity === 'error' || i.severity === 'fatal'
  ).length
  const displayedPreflightIssues = sortedPreflightIssues.slice(0, Math.max(10, blockingIssueCount))

  if (result) {
    return <SubmissionResult flow={flow} response={result} onReset={() => setResult(null)} />
  }

  if (loadingQ) {
    return <div className="card"><p className="text-sm text-gray-500">Loading Questionnaire from FHIR server…</p></div>
  }

  if (fetchError || !questionnaire) {
    return (
      <div className="card">
        <p className="text-sm text-red-700">Failed to load Questionnaire: {fetchError ?? 'not found'}</p>
        <p className="text-xs text-gray-500 mt-2">
          Ensure HAPI is running and profiles are loaded (<code>./seed/load-profiles.sh</code>).
        </p>
        <button type="button" className="btn btn-secondary mt-3" onClick={() => setRetryKey((k) => k + 1)}>
          Retry
        </button>
      </div>
    )
  }

  if (loadingMeta) {
    return <div className="card"><p className="text-sm text-gray-500">Loading profile metadata from FHIR server…</p></div>
  }

  if (metaError) {
    return (
      <div className="card">
        <p className="text-sm text-red-700">Could not load profile metadata: {metaError}</p>
        <p className="text-xs text-gray-500 mt-2">
          Submissions may be incomplete without it (ADR-0103/ADR-0122). Ensure HAPI is reachable and profiles are loaded.
        </p>
        <button type="button" className="btn btn-secondary mt-3" onClick={() => setRetryKey((k) => k + 1)}>
          Retry
        </button>
      </div>
    )
  }

  // Surgery / Follow-Up require PatientLookup before the form.
  if (requiresLookup && !launchContext) {
    return (
      <PatientLookup
        onResolved={async (ctx, patient) => {
          setLaunchContext(ctx)
          setResolvedPatient(patient)
          // Real SDC itemPopulationContext + initialExpression evaluation
          // (ADR-0100, ADR-0101). Best-effort: a failed resolution just leaves
          // the read-only confirmation field blank, it never blocks the form.
          try {
            if (!questionnaire) return
            const contexts = extractPopulationContexts(questionnaire.item ?? [])
            const resolved = await resolvePopulationContexts(contexts, ctx)
            // Also expose the already-resolved Patient under whatever name
            // the Questionnaire's own launchContext extension declares for
            // it (ADR-0101) — not a hardcoded "%patient", genuinely read.
            withLaunchContextResources(questionnaire, { Patient: patient as unknown as FhirResourceLike }, resolved)
            setInitialOverrides(evaluateInitialExpressions(questionnaire.item ?? [], resolved))
            setCalcEnv(resolved)
          } catch {
            setInitialOverrides({})
            setCalcEnv({})
          }
        }}
      />
    )
  }

  return (
    <>
      {resolvedPatient && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Launch context:</span>{' '}
            {(resolvedPatient.name?.[0]?.given ?? []).join(' ')} {resolvedPatient.name?.[0]?.family}
            {' '}
            <span className="text-xs text-blue-700">(Patient/{resolvedPatient.id} · Condition/{launchContext?.conditionId})</span>
          </p>
        </div>
      )}

      {validatorUnavailable !== null && (
        <ValidatorBanner message={validatorUnavailable || undefined} />
      )}

      {preflightIssues.length > 0 && (
        <div
          className={
            blocking
              ? 'mb-4 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-900'
              : 'mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-900'
          }
        >
          <p className="font-medium mb-2">
            {blocking
              ? 'Pre-flight validation errors — submission blocked. Fix the issues and re-submit.'
              : 'Pre-flight warnings — submission allowed; please review:'}
          </p>
          <ul className="list-disc list-inside space-y-1">
            {displayedPreflightIssues.map((i, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs">[{i.severity}]</span>{' '}
                {i.details?.text ?? i.diagnostics ?? i.code}
              </li>
            ))}
          </ul>
          {preflightIssues.length > displayedPreflightIssues.length && (
            <p className="mt-2 text-xs italic">
              …and {preflightIssues.length - displayedPreflightIssues.length} more warning(s) not shown.
            </p>
          )}
        </div>
      )}

      <QuestionnaireForm
        questionnaire={questionnaire}
        flow={flow}
        onSubmit={handleSubmit}
        onSuccess={setResult}
        initialOverrides={initialOverrides}
        otherDiagnoses={launchContext?.otherDiagnoses ?? []}
        calcEnv={calcEnv}
      />
    </>
  )
}

