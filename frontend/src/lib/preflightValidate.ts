/**
 * Strict pre-flight validation via the FHIR Validator sidecar (ADR-0051).
 *
 * Decision rules:
 *   - `error` / `fatal` issues  → kind: 'blocked' (do NOT submit)
 *   - only `warning` / `information` → kind: 'warnings' (proceed, surface)
 *   - no issues                 → kind: 'ok'
 *   - sidecar unreachable       → kind: 'unavailable' (proceed with banner)
 *
 * Wrapped around fhirClient.validateBundle which throws
 * ValidatorUnavailableError on connectivity failure. The helper performs
 * one short retry on the first connection failure to ride out a cold-start
 * race (sidecar JVM still warming).
 */
import {
  fhirClient,
  ValidatorUnavailableError,
  BUNDLE_PROFILES,
} from './fhirClient'
import type { WizardEntry, OperationOutcome } from '../types/fhir'

export type PreflightResult =
  | { kind: 'ok' }
  | { kind: 'warnings'; issues: OperationOutcome['issue'] }
  | { kind: 'blocked'; issues: OperationOutcome['issue'] }
  | { kind: 'unavailable'; message?: string }

const RETRY_DELAY_MS = 1500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function preflightValidate(
  entries: WizardEntry[],
  bundleProfile: string = BUNDLE_PROFILES.REGISTRATION
): Promise<PreflightResult> {
  let outcome: OperationOutcome
  try {
    outcome = await fhirClient.validateBundle(entries, bundleProfile)
  } catch (err) {
    if (err instanceof ValidatorUnavailableError) {
      // Cold-start race: one short retry before declaring unavailable.
      await sleep(RETRY_DELAY_MS)
      try {
        outcome = await fhirClient.validateBundle(entries, bundleProfile)
      } catch (retryErr) {
        return {
          kind: 'unavailable',
          message:
            retryErr instanceof Error ? retryErr.message : 'Validator unreachable',
        }
      }
    } else {
      // Unexpected error type — treat as unavailable so we don't block the user
      // on a frontend bug we didn't anticipate.
      return {
        kind: 'unavailable',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }

  const issues = outcome.issue ?? []
  const blocking = issues.filter(
    (i) => i.severity === 'error' || i.severity === 'fatal'
  )
  if (blocking.length > 0) return { kind: 'blocked', issues }
  const warnings = issues.filter(
    (i) => i.severity === 'warning' || i.severity === 'information'
  )
  if (warnings.length > 0) return { kind: 'warnings', issues: warnings }
  return { kind: 'ok' }
}
