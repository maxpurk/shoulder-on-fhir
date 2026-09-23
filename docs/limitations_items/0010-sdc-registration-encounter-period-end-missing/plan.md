# SDC's Registration Encounter never carries `period.end`; unified's does (a derived default)

> **Status:** Limitation — open, SDC/unified parity gap. Logged 2026-08-07, found via a live
> `Patient/$everything` comparison of two patients created 2026-08-06, one per frontend.

## Gap

Unified frontend's `RegistrationWizard.tsx` builds the Registration `Encounter` via the shared
`frontend/src/lib/encounterBuilder.ts`, whose `buildEncounter()` defaults `period.end` to
`visitStart + 30 minutes` whenever no explicit `visitEnd` is supplied (line ~44:
`input.visitEnd ?? new Date(new Date(input.visitStart).getTime() + 30 * 60 * 1000).toISOString()`).
Registration never supplies an explicit `visitEnd`, so every unified Registration Encounter gets
this synthetic +30min end (confirmed live: a test patient's Encounter showed
`start: 2026-08-06T18:59:23.465Z` / `end: 2026-08-06T19:29:23.465Z`, exactly 30 minutes later).

SDC's Registration `Encounter` literal in `sdc-frontend/src/lib/bundleAssembler.ts` sets only
`period: { start: new Date().toISOString() }` — no `end`, ever. This was already touched once by
ADR-0152 (2026-08-04), which added the `period.start` field to close a "no period field at all"
gap — but that ADR's own Decision text describes the parity target as unified's Registration
Encounter setting period to "submission time (`new Date()`)", without accounting for the shared
builder's separate default-end behavior. Whether that default-end logic predates or postdates
ADR-0152 wasn't determined; either way, the two frontends' live output differs today.

**Extends to the Follow-Up Encounter too (re-confirmed 2026-08-12).** A second `$everything`
comparison (unified Friedrich Wagner vs SDC Ingrid Fischer, one full longitudinal patient per
frontend) found the SDC **Follow-Up** Encounter *also* carries `period.start` but no `period.end`,
while the unified Follow-Up Encounter gets the same shared-builder synthetic `+30 min` end. So the
asymmetry is not registration-specific — it affects every SDC Encounter except Surgery (whose
incision/closure times supply both `period.start` and `period.end` explicitly). Observed values:
SDC Registration Enc `start` only; SDC Follow-Up Enc `start: 2026-08-06T10:00:00+02:00` / `end:
NONE`; both unified counterparts had a populated `end`.

## Why it matters

A `status: finished` Encounter with a `start` but no `end` is an incomplete temporal record — the
unified frontend's synthetic +30min value isn't clinically meaningful either (it's a placeholder,
not a captured duration), but at least the element is populated and queryable. This is `L3.C.2` in
the Layer 2 (IG-operational) mapping, already `Full` — the gap is purely an implementation
asymmetry between the two frontends' output shape, not a mapping/consensus issue.

## Note

Cheapest fix: mirror unified's shared-builder default in `bundleAssembler.ts` — set
`period: { start: <ts>, end: <ts + 30min> }` for the same synthetic-duration reasoning, or thread
an explicit visit-end field through the SDC Registration Questionnaire if a real captured value is
preferred over a synthetic default (a separate, larger design question). Not implemented here.
