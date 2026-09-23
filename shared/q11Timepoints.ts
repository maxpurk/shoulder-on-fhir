/**
 * CANONICAL SOURCE — edit this file, then run `tools/sync-shared-code.sh`
 * (or `build-and-deploy.sh`, which runs it automatically) to propagate to
 * `frontend/src/lib/shared/q11Timepoints.ts` and
 * `sdc-frontend/src/lib/shared/q11Timepoints.ts`. Both copies are generated
 * and carry a header saying so — do not edit them directly. See
 * `constantScore.ts` in this directory for why a sync script is used
 * instead of a real shared package/Vite alias (ADR-0157).
 *
 * expert consensus Q11.a-e research follow-up timepoints — 6 weeks / 3 months / 6
 * months / 1 year / 2 years post-index-procedure. `code` matches the IG's
 * `Q11Timepoint` CodeSystem (ig/input/fsh/codesystems/Q11Timepoint.fsh).
 */

export const Q11_TIMEPOINTS = [
  { label: '6 wk', days: 42, code: '6-weeks' },
  { label: '3 mo', days: 90, code: '3-months' },
  { label: '6 mo', days: 180, code: '6-months' },
  { label: '12 mo', days: 365, code: '1-year' },
  { label: '24 mo', days: 730, code: '2-years' },
] as const
