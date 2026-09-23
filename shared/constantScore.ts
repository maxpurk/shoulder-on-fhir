/**
 * CANONICAL SOURCE — edit this file, then run `tools/sync-shared-code.sh`
 * (or `build-and-deploy.sh`, which runs it automatically) to propagate to
 * `frontend/src/lib/shared/constantScore.ts` and
 * `sdc-frontend/src/lib/shared/constantScore.ts`. Both copies are generated
 * and carry a header saying so — do not edit them directly.
 *
 * Why a sync script instead of a real shared npm package/Vite alias
 * (ADR-0157): `docker-compose.yml` scopes each frontend's Docker build
 * context to its own directory (`context: ./frontend`, `context:
 * ./sdc-frontend`), so a cross-directory import that resolves fine in local
 * `npm run dev` would fail inside the actual Docker build used for
 * deployment — the shared file wouldn't be inside either build context.
 * Widening the build context to the repo root was considered and rejected
 * (would also pull in `tools/validator_cli.jar`, ~185MB, into every
 * frontend image's build context). A codegen/sync step, run before
 * `docker compose build`, sidesteps this entirely: the file physically
 * exists inside each frontend's own directory by the time Docker sees it.
 *
 * Constant-Murley sub-item -> sub-score derivation, per the POOS-15 Constant
 * Score out-patient worksheet (verbatim point scales), reviewed by the
 * shoulder-surgeon subagent against that source before implementation.
 *
 * Two of the six originally-considered auto-derivations (Pain, Power) were
 * rejected outright during that review: the "source" field this registry
 * already captures measures a genuinely different clinical construct than
 * the POOS-15 item, not just a rescaled version of the same one. Their fix
 * is a dedicated new manual field instead of a forced conversion — see
 * `PAIN_NORMAL_ACTIVITIES_OPTS` and `derivePowerPoints` below for the
 * reasoning at each site. Four of the eleven sub-items (Sleep, Flexion,
 * Abduction, Internal Rotation) do auto-derive cleanly from existing fields.
 */

export interface ScaleOption {
  code: string
  label: string
  points: number
}

// A item 1 — "pain in normal activities" (POOS-15 verbatim). Averaged with
// derivePainItem2Points() to form the full Pain sub-score; never used alone.
export const PAIN_NORMAL_ACTIVITIES_OPTS: ScaleOption[] = [
  { code: 'none', label: 'No pain', points: 15 },
  { code: 'mild', label: 'Mild pain', points: 10 },
  { code: 'moderate', label: 'Moderate pain', points: 5 },
  { code: 'severe', label: 'Severe or permanent pain', points: 0 },
]

// B1 — occupation / daily-living limitation
export const OCCUPATION_LIMIT_OPTS: ScaleOption[] = [
  { code: 'none', label: 'Not limited', points: 4 },
  { code: 'moderate', label: 'Moderately limited', points: 2 },
  { code: 'severe', label: 'Severely limited', points: 0 },
]

// B2 — leisure / recreation limitation (same point scale as B1, distinct question)
export const LEISURE_LIMIT_OPTS: ScaleOption[] = [
  { code: 'none', label: 'Not limited', points: 4 },
  { code: 'moderate', label: 'Moderately limited', points: 2 },
  { code: 'severe', label: 'Severely limited', points: 0 },
]

// B4 — painless arm-use ceiling
export const ARM_USE_OPTS: ScaleOption[] = [
  { code: 'waist', label: 'Waist', points: 2 },
  { code: 'xiphoid', label: 'Xiphoid (sternum)', points: 4 },
  { code: 'neck', label: 'Neck', points: 6 },
  { code: 'head', label: 'Head', points: 8 },
  { code: 'above-head', label: 'Above head', points: 10 },
]

// C3 — External Rotation, cumulative functional hand positions. Single-select
// (not independently-toggleable checkboxes) — the worksheet's progression is
// a functional ladder where each successive position is strictly better.
export const ER_POSITION_OPTS: ScaleOption[] = [
  { code: 'behind-head-elbow-forward', label: 'Hand behind head, elbow forward', points: 2 },
  { code: 'behind-head-elbow-back', label: 'Hand behind head, elbow back', points: 4 },
  { code: 'above-head-elbow-forward', label: 'Hand above head, elbow forward', points: 6 },
  { code: 'above-head-elbow-back', label: 'Hand above head, elbow back', points: 8 },
  { code: 'full-elevation', label: 'Full elevation of arm', points: 10 },
]

// B3 — sleep disturbance, for contexts with no existing SleepDisturbanceObservation
// to auto-derive from (e.g. Follow-Up, which does not capture this axis at all —
// ADR-0093). Same codes/points as mapSleepToAdlPoints, exposed as a selectable
// option list for manual entry.
export const SLEEP_DISTURBANCE_OPTS: ScaleOption[] = [
  { code: 'unaffected', label: 'Unaffected', points: 2 },
  { code: 'occasional', label: 'Occasionally disturbed', points: 1 },
  { code: 'nightly', label: 'Nightly disturbed', points: 0 },
]

export function pointsForCode(opts: ScaleOption[], code: string): number | undefined {
  return opts.find((o) => o.code === code)?.points
}

function clampRound(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Parses a form-state number string ('' = not entered) to a number, or undefined. */
export function parseFilled(raw: string): number | undefined {
  if (raw === '') return undefined
  const n = Number(raw)
  return Number.isNaN(n) ? undefined : n
}

// C1 / C2 — Forward Flexion / Abduction degree bands (identical table).
// Must be fed by ACTIVE ROM (not Passive) — Constant's ROM sub-score is
// specifically an active-motion assessment.
export function bandRomDegrees(deg: number): number {
  if (deg <= 30) return 0
  if (deg <= 60) return 2
  if (deg <= 90) return 4
  if (deg <= 120) return 6
  if (deg <= 150) return 8
  return 10
}

// C4 — Internal Rotation vertebral-level ladder (8 tiers) -> POOS-15's
// 6-point scale. Surgeon-corrected: `greater-trochanter` stays at the floor
// (0) alongside `unable` — it scores 0 because it sits below POOS-15's own
// lowest named rung (Thigh), not because it is clinically equivalent to
// total inability. `l3` rounds UP to align with `t12` (8), not down to `l5`'s
// waist-level anchor (6) — rounding a functional-reach ladder toward the
// lower/more-impaired anchor is the larger of the two possible errors.
const INTERNAL_ROTATION_LADDER: Record<string, number> = {
  unable: 0,
  'greater-trochanter': 0,
  buttock: 2,
  sacrum: 4,
  l5: 6,
  l3: 8,
  t12: 8,
  't7-or-above': 10,
}

export function mapInternalRotationLadder(code: string): number | undefined {
  return INTERNAL_ROTATION_LADDER[code]
}

// B3 — sleep disturbance ordinal -> ADL sleep points. ADR-0081 already built
// this field to mirror the Constant sleep sub-item exactly (see its own help
// text in StepPatient.tsx), so this is a direct 1:1 restatement, not a new
// clinical judgment call.
const SLEEP_ADL_POINTS: Record<string, number> = {
  unaffected: 2,
  occasional: 1,
  nightly: 0,
}

export function mapSleepToAdlPoints(code: string): number | undefined {
  return SLEEP_ADL_POINTS[code]
}

// A item 2 — proportional inverse rescale of this registry's 0-10
// average-pain rating onto POOS-15's 0-15 linear pain scale. Legitimate as a
// stand-in for POOS-15 item 2 ALONE (same construct — a linear pain-level
// scale — just a different range). NOT a stand-in for the full Pain
// sub-score: POOS-15 averages item 2 with a separate categorical question
// (item 1, `PAIN_NORMAL_ACTIVITIES_OPTS`) that measures shoulder impact on
// normal activities specifically, which does not correlate linearly with a
// generic pain-severity rating (surgeon review rejected using painAverage
// alone as a silent stand-in for the whole averaged Pain sub-score).
export function derivePainItem2Points(painAverage: number): number {
  return clampRound(15 - 1.5 * painAverage, 0, 15)
}

// D — Constant power test. Deliberately fed ONLY by a dedicated
// `constantPowerTest` kg field, never by SupraspinatusStrengthDynamometryObservation:
// that test is positioned (per ADR-0089) to isolate supraspinatus and
// minimize deltoid contribution (empty-can/Jobe position), while Constant's
// power sub-score is a global scaption-plane abduction-strength test
// (deltoid + cuff, resisted downward pull at 90°, neutral rotation) — a
// different muscle target that is clinically expected to diverge from an
// isolated supraspinatus reading in exactly the cuff-tear population this
// registry serves (surgeon review rejected the reuse outright).
export function derivePowerPoints(kg: number): number {
  return clampRound(kg * 2, 0, 25)
}

/** Averages whichever of the given points are defined; undefined if none are. */
export function averageDefined(...points: (number | undefined)[]): number | undefined {
  const defined = points.filter((p): p is number => p !== undefined)
  if (defined.length === 0) return undefined
  return Math.round(defined.reduce((a, b) => a + b, 0) / defined.length)
}

/** Sums whichever of the given points are defined; undefined if none are. */
export function sumDefined(...points: (number | undefined)[]): number | undefined {
  const defined = points.filter((p): p is number => p !== undefined)
  if (defined.length === 0) return undefined
  return defined.reduce((a, b) => a + b, 0)
}

export interface ConstantDerivationInputs {
  /** Registration: assessment.painAverage; Follow-Up: q12State['pain-average']. 0-10 string, '' = not entered. */
  painAverage: string
  /** Registration: patient.sleepDisturbance; Follow-Up: has no equivalent (pass ''). Ordinal code. */
  sleepDisturbance: string
  /** Active Forward Flexion, degrees. */
  forwardFlexion: string
  /** Active Abduction, degrees. */
  abduction: string
  /** Active Internal Rotation at side, vertebral-level ordinal code. */
  internalRotation: string
}

export interface ConstantManualInputs {
  painNormalActivities: string
  adlOccupation: string
  adlLeisure: string
  adlArmUse: string
  romExternalRotation: string
  /** Constant power test, kg — dedicated field, distinct from supraspinatus dynamometry. */
  powerTest: string
}

export interface SubscoreResult {
  /** Rolled-up subscore, or undefined if no contributing sub-item has a value. */
  value?: number
  /** How many of `total` sub-items contributed to `value`. */
  filled: number
  total: number
}

export interface ConstantDerivedResult {
  pain: SubscoreResult
  adl: SubscoreResult
  rom: SubscoreResult
  strength: SubscoreResult
}

/**
 * A sub-score is only clinically meaningful once every one of its
 * contributing sub-items is present — a partial sum/average (e.g. ROM with
 * only Flexion filled) is not a valid POOS-15 sub-score. Both frontends use
 * this to decide whether to display/persist a sub-score at all, rather than
 * showing a partial number.
 */
export function isSubscoreComplete(s: SubscoreResult): boolean {
  return s.value !== undefined && s.filled === s.total
}

export function computeConstantSubscores(
  derivation: ConstantDerivationInputs,
  manual: ConstantManualInputs,
): ConstantDerivedResult {
  const painAverage = parseFilled(derivation.painAverage)
  const painItem1 = manual.painNormalActivities
    ? pointsForCode(PAIN_NORMAL_ACTIVITIES_OPTS, manual.painNormalActivities)
    : undefined
  const painItem2 = painAverage !== undefined ? derivePainItem2Points(painAverage) : undefined
  const painFilled = [painItem1, painItem2].filter((p) => p !== undefined).length
  const pain: SubscoreResult = { value: averageDefined(painItem1, painItem2), filled: painFilled, total: 2 }

  const adlOccupation = manual.adlOccupation ? pointsForCode(OCCUPATION_LIMIT_OPTS, manual.adlOccupation) : undefined
  const adlLeisure = manual.adlLeisure ? pointsForCode(LEISURE_LIMIT_OPTS, manual.adlLeisure) : undefined
  const adlSleep = derivation.sleepDisturbance ? mapSleepToAdlPoints(derivation.sleepDisturbance) : undefined
  const adlArmUse = manual.adlArmUse ? pointsForCode(ARM_USE_OPTS, manual.adlArmUse) : undefined
  const adlFilled = [adlOccupation, adlLeisure, adlSleep, adlArmUse].filter((p) => p !== undefined).length
  const adl: SubscoreResult = { value: sumDefined(adlOccupation, adlLeisure, adlSleep, adlArmUse), filled: adlFilled, total: 4 }

  const flexion = parseFilled(derivation.forwardFlexion)
  const abduction = parseFilled(derivation.abduction)
  const romFlexion = flexion !== undefined ? bandRomDegrees(flexion) : undefined
  const romAbduction = abduction !== undefined ? bandRomDegrees(abduction) : undefined
  const romER = manual.romExternalRotation ? pointsForCode(ER_POSITION_OPTS, manual.romExternalRotation) : undefined
  const romIR = derivation.internalRotation ? mapInternalRotationLadder(derivation.internalRotation) : undefined
  const romFilled = [romFlexion, romAbduction, romER, romIR].filter((p) => p !== undefined).length
  const rom: SubscoreResult = { value: sumDefined(romFlexion, romAbduction, romER, romIR), filled: romFilled, total: 4 }

  const powerKg = parseFilled(manual.powerTest)
  const strengthValue = powerKg !== undefined ? derivePowerPoints(powerKg) : undefined
  const strength: SubscoreResult = { value: strengthValue, filled: strengthValue !== undefined ? 1 : 0, total: 1 }

  return { pain, adl, rom, strength }
}
