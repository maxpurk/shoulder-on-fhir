# ADR-0136: Port address, phone, and Sex Assigned at Birth to SDC Registration

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #2 — SDC's submitted `Patient` had `address: null`, `telecom: null`, and no extensions at all, while the unified frontend's `Patient` carries a full address, phone, and the `individual-recordedSexOrGender` (RSG, ADR-0053, L3.A.6) extension.

## Context

`ShoulderPatient.fsh` already declares `telecom MS`, `address MS` (inherited `Address-eu` typing via `patient-eu-core`), and the RSG extension slice (0..1, type fixed to LOINC 76689-9) — all pre-existing, unchanged by this ADR. SDC's Registration Questionnaire simply never asked for any of it. Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** for phone/address (Layer 2, IG-operational, no consensus element involved), and also **(b)** for Sex Assigned at Birth (L3.A.6 already Full, ADR-0053 already made every terminology decision — the LOINC type code, the administrative-gender value binding).

Two of the three new fields hit the same architectural limit already documented for Coverage (ADR-0061/ADR-0131): the generic per-element resolver (ADR-0103/ADR-0122) reads one leaf's `item.definition` target and writes one element, but has no mechanism to also fix a *sibling* element from the same answer. This matters here because:
- The RSG extension needs **two** sibling sub-extensions populated from **one** answer: `extension[value]` (the actual coding) and `extension[type]` (fixed to LOINC 76689-9) — structurally identical to Coverage's "one answer, two things need setting" shape.
- `Patient.telecom` has no slicing fixing `system`/`use`, so a plain `item.definition` on `telecom.value` alone cannot also stamp `system: 'phone'` the way the unified frontend's hardcoded builder does.

## Decision

1. **`ShoulderRegistrationQuestionnaire.fsh`**, `patient` group (`item[0]`), 5 new items appended after `patient.gender`:
   - `patient.sexAssignedAtBirth` — loose leaf (no `item.definition`), `#choice`, same 4 `$ADMIN_GENDER` answerOptions as `patient.gender`. Read out-of-band via `findAnswerByLinkId`, same as `coverage.workersCompensation`.
   - `patient.phone` — `#string`, `item.definition` → `Patient.telecom.value`. Accepted gap: no `system`/`use` fixing (see Consequences).
   - `patient.street` / `patient.postalCode` / `patient.city` — `#string`, `item.definition` → `Patient.address.line` / `.postalCode` / `.city`. These are plain 2-segment paths (no sibling-fixing needed) so they resolve fully generically, same mechanism already proven by `patient.givenName`/`patient.familyName` (`Patient.name.given`/`.family`).

   `Questionnaire.version` bumped `0.5.0` → `0.6.0`.

2. **`extractor.ts`**: new `buildSexAssignedAtBirthExtension(coding: Coding): Extension` helper, called from `extractResources` after the main group loop, same position as the Coverage lookup — reads `patient.sexAssignedAtBirth`'s answer via `findAnswerByLinkId`, and if present, appends the built extension onto the already-extracted `out.patient` (a plain object-spread modification, not a new resource — the first case in this codebase of a loose leaf modifying an existing extracted resource rather than producing a standalone one). No display lookup table needed: the answer's own `valueCoding` already carries `system`/`code`/`display` baked in from the FSH `answerOption`, unlike the unified frontend's hardcoded `ADMIN_GENDER_DISPLAYS` (needed there only because its plain HTML `<select>` has no embedded display text to read back).

No `bundleAssembler.ts` changes — `patient.phone`/`street`/`postalCode`/`city` flow through the existing generic `buildResourceForExtractionGroup` path untouched.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Give `patient.phone` a small hardcoded builder (like Coverage/RSG) so `ContactPoint.system` gets fixed to `'phone'` | For 3 lines of profile-conformant-but-incomplete data (`ContactPoint.value` only, `system` unset — both individually valid FHIR, `system` is 0..1), a third hardcoded escape hatch felt like more architecture than the gap warrants. Noted as an accepted minor gap instead; revisit if a future point in this same feedback round adds a second sibling-fixing need for telecom. |
| Extend the generic resolver to support fixing a second, non-answered sibling element (closing this class of gap for good, not just for RSG/Coverage/phone one at a time) | Real, larger refactor of `resolveObservationFixedValues`'s current Observation-code/category-only scope — explicitly flagged as a legitimate follow-up in the extractor's own module comment already, not something to fold into a single feedback-item port. |

## Consequences

✅ SDC's submitted `Patient` now carries address, phone, and Sex Assigned at Birth — closes clinical-review item #2.
✅ `sushi .`: 0 errors / 0 warnings. `sdc-frontend` `npm run build` (tsc + vite): compiles cleanly.
✅ No mapping status change — L3.A.6 was already Full (IG-operational, ADR-0053); phone/address are Layer 2, not tracked in the Full/Partial count.
⚠️ ~~`Patient.telecom[0]` carries only `value`, no `system`/`use` — a real, minor, accepted gap~~ **Superseded by ADR-0138**: live testing found this wasn't just imprecise but a genuine `cpt-2` invariant violation (base FHIR requires `system` whenever `value` is present) — blocking, not cosmetic. `patient.phone` was converted to a loose leaf with a hand-built `ContactPoint` (`system`/`use` fixed), same pattern as Coverage/RSG. Left here, struck through, as a record of the reasoning that turned out to be wrong and why.
⚠️ Third instance in this codebase (after Coverage, now RSG) of the "loose leaf + hardcoded builder" pattern for sibling-fixing gaps the generic resolver doesn't cover — each individually small and well-precedented, but worth eventually generalizing per the extractor's own noted follow-up.

## Sources

- the cross-frontend parity audit, item #2.
- `ig/input/fsh/profiles/ShoulderPatient.fsh` — `telecom`/`address`/RSG extension slice, all pre-existing, unchanged.
- `frontend/src/components/wizard/StepPatient.tsx` (lines ~80-134) — reference implementation this ADR ports.
- ADR-0053 — sole clinical/terminology authority for the RSG extension; nothing here revisits it.
- ADR-0061/ADR-0131 — the Coverage precedent for the loose-leaf + hardcoded-builder pattern this ADR reuses twice more.
- `sdc-frontend/src/lib/extractor.ts` (`buildSexAssignedAtBirthExtension`, `findAnswerByLinkId` call site).
