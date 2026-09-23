/**
 * Strict pre-flight validation via the FHIR Validator sidecar (ADR-0051).
 * Mirrors the helper in frontend/src/lib/preflightValidate.ts.
 *
 * Decision rules:
 *   - `error` / `fatal` issues  → kind: 'blocked' (do NOT submit)
 *   - only `warning` / `information` → kind: 'warnings' (proceed, surface)
 *   - no issues                 → kind: 'ok'
 *   - sidecar unreachable       → kind: 'unavailable' (proceed with banner)
 */
import { fhirClient, ValidatorUnavailableError } from './fhirClient'
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
  bundleProfile: string
): Promise<PreflightResult> {
  let outcome: OperationOutcome
  try {
    outcome = await fhirClient.validateBundle(entries, bundleProfile)
  } catch (err) {
    if (err instanceof ValidatorUnavailableError) {
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
