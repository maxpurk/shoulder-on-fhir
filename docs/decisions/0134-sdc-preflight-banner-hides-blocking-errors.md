# ADR-0134: SDC pre-flight banner could hide the actual blocking errors behind a flat 10-item slice

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** live testing of ADR-0133's SDC changes on the deployment server — submitting a test Registration bundle produced a banner reading "Pre-flight validation errors — submission blocked... 4 error(s)" whose visible issue list contained 10 `warning`/`information`-severity items and zero `error`/`fatal` ones, i.e. the exact issues causing the block were not visible anywhere on screen.

## Context

`FlowPage.tsx`'s pre-flight banner rendered `preflightIssues.slice(0, 10)` — a flat, unsorted cap. `preflightValidate.ts` returns `kind: 'blocked'` with the *complete* unsorted issue list (blocking and non-blocking mixed, in whatever order the FHIR Validator emitted them — typically resource-by-resource in bundle order, not severity order). Whenever 10 or more non-blocking issues preceded the first blocking one in that order — a realistic case for any bundle producing many `dom-6` narrative warnings across several resources before reaching the one resource with a real `error`/`fatal` issue — the slice cut the blocking issues out entirely, while the separate error-count message (computed correctly, over the *full* array) still told the user "N error(s), see banner above" with nothing to see.

The unified frontend's equivalent (`StepSummary.tsx`) has no such cap — it `.map()`s the full array — so this was SDC-specific, introduced when the banner was originally built without anticipating a bundle large enough to exceed 10 total issues (this IG's own audit found registration bundles can carry 100+ warnings — the cross-frontend parity audit's exercise recorded 158 for one seed bundle).

Per the Clinical Feedback Integration Workflow classification: this is a plain bug fix, not a modeling decision — no clinical/terminology content involved.

## Decision

`FlowPage.tsx`: sort `preflightIssues` by severity rank (`fatal` → `error` → `warning` → `information`) before slicing, and size the display cap as `Math.max(10, blockingIssueCount)` — guaranteeing every blocking issue is always shown, regardless of how many lower-severity issues exist alongside them. Added a "…and N more warning(s) not shown" trailer when the cap actually truncates something, so the omission itself isn't silent, matching the transparency the rest of this codebase's error surfaces aim for.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Remove the cap entirely, always render every issue | A real bundle can carry 100+ warnings (per the exercise that found this bug); an unbounded list would make the banner unusable for the common "everything's fine, just some FYI warnings" case, which is more frequent than the blocked case this ADR targets. |
| Only show blocking issues when blocked, hide warnings entirely | Loses information a clinician reviewing a blocked submission might want (e.g. a warning adjacent to the actual error, same resource) — sorting-then-capping keeps warnings visible up to the cap without hiding what matters. |

## Consequences

✅ A blocked SDC submission's actual blocking issue(s) are now always visible in the banner, regardless of how many non-blocking issues exist in the same response.
✅ `sdc-frontend` `npm run build` (tsc + vite): compiles cleanly.
⚠️ Found this way rather than by code review — a reminder that "advisory" pre-flight UX still needs the same scrutiny as the data-modeling work it was built to unblock testing of.

## Sources

- `sdc-frontend/src/components/FlowPage.tsx` — the fix.
- `sdc-frontend/src/lib/preflightValidate.ts` — confirms `blocked`/`warnings` results carry the complete unsorted issue array; the bug was purely in the banner's own display logic.
- `frontend/src/components/wizard/StepSummary.tsx` — the unified frontend's equivalent, confirmed to have no equivalent cap.
- the cross-frontend parity audit — the exercise whose seed-bundle warning counts (up to 158) motivated keeping a display cap at all, rather than removing it outright.
