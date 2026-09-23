# Comorbidity typeahead can surface clinically nonsensical concepts (e.g. "Homoiothermia") — affects both frontends

> **Status:** Limitation — open, defect. Logged 2026-08-06, found live in the SDC frontend's
> comorbidity search returning "Homoiothermia (129007)" as a selectable result.

## Gap

Both frontends bind the comorbidity typeahead to the same SNOMED implicit ValueSet subset,
`http://snomed.info/sct?fhir_vs=isa/404684003` — all descendants of `404684003 |Clinical
finding|` (`frontend/src/types/fhir.ts` `COMORBIDITY_TYPEAHEAD`; `sdc-frontend/src/components/
QuestionnaireForm.tsx` comment at line 85 confirms the SDC `answerValueSet` uses the identical
`isa/404684003` subset). Verified via the SNOMED terminology server: `129007` is
"Homoiothermia (finding)" — a normal physiological finding (the capacity to maintain a
stable body temperature; i.e. being warm-blooded), not a disorder, disease, or any kind of
pathology. `404684003 |Clinical finding|` is SNOMED's broadest finding hierarchy and includes
many concepts like this — presence-of-normal-function findings, not just disorders — so the
typeahead can surface answers that make no sense as a "comorbidity" by definition (a comorbidity
is a co-occurring *disease*).

ADR-0084 already narrows this same VS with a client-side exclusion mechanism, but only for
shoulder-region concepts (to keep shoulder pathology out of the comorbidity list, since it
belongs on `RotatorCuffCondition`/`ShoulderDiagnosisCondition` instead) — it does not address the
separate, broader problem that `Clinical finding` itself is not the same set as `Disorder`.

## Why it matters

A free-text-matching typeahead bound to `Clinical finding` will keep surfacing normal-state and
non-disease findings for any search term that happens to text-match — undermining the field's
clinical purpose and data quality (a coded comorbidity list should only ever contain actual
pathology). This reproduces in **both** frontends since they share the identical VS binding — not
an SDC/unified parity gap like the other findings in this batch.

## Note

Candidate fix: rebind (or additionally exclude) to SNOMED's `64572001 |Disease (disorder)|`
hierarchy instead of (or in addition to) `404684003 |Clinical finding|`, narrowing to genuine
pathology while still allowing symptom/sign-type findings that are legitimately treated as
comorbidities in practice (needs a `shoulder-surgeon` subagent or terminology review to decide
the right boundary — `Disease (disorder)` alone may be too narrow, e.g. it would exclude social/
behavioral findings some registries do track as comorbidity-adjacent). Not implemented here.
