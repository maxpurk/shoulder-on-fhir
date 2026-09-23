# ADR-0164: Residual `qa.html` documentation-link errors triaged as cosmetic, deferred not fixed

**Date:** 2026-08-15
**Status:** Superseded by ADR-0191

> Superseded 2026-09-15. Three of this record's claims did not hold: the fragments were a
> specification deviation rather than only a rendering mismatch, the residual is an IG Publisher
> defect that no authoring form can avoid, and the `ignoreWarnings` cleanup proposed below is not
> possible because errors cannot be suppressed. Its two counts also double-count one defect.
> ADR-0191 carries the corrected analysis. Kept unedited below as the record of what was decided
> at the time.

## Context

Inspecting the deployed IG's QA report (`qa.html` / `qa.txt` as served from the deployed IG site)
during the same session that fixed the `constant-score-component-sum` invariant (ADR-0162)
and the two `CodeSystem.valueSet` "extra details" errors (ADR-0163) surfaced the full error
inventory. With those two genuine model-level defects resolved, the IG Publisher still reports
**97 "errors" + 295 "broken links"** (394 total `ERROR:` lines in `qa.txt`). A line-by-line
categorization (normalizing message text and bucketing) shows every remaining item is a
*generated-HTML hyperlink that fails to resolve* — none is a conformance or data-model defect:

1. **276 broken links to profile element anchors** — `#Observation.valueQuantity` (141),
   `#Observation.valueCodeableConcept` (111), four Constant-Murley `component:*.valueQuantity`
   (24). Cause: the three SDC Questionnaires' `item.definition` values anchor on the FHIR
   choice-suffix form (`…#Observation.valueQuantity`), but the rendered profile page emits no
   anchor by that name (it renders `value[x]`), so the publisher's auto-generated cross-link
   404s. The `item.definition` values are semantically correct and load-bearing for SDC
   definition-based extraction (`extractor.ts` parses them) — this is a doc-rendering mismatch.
2. **97 Questionnaire narrative hyperlinks** — `Questionnaire.text.div: Hyperlink … does not
   resolve` in the auto-generated `text.div` of the three Questionnaires.
3. **~19 misc profile-anchor links** — `Patient.address.*`, `Condition.onsetDateTime`,
   `Condition.extension[condition-dueTo]`, `AcquisitionModality`.

Evidence the artifact is otherwise correct: `tools/validate.sh` passes 39/39 (0 failures), all
profiles compile under `sushi .`, both frontends and HAPI operate, and `package.tgz` is usable.

## Decision

Triage all residual `qa.html` link items as **cosmetic (documentation-rendering) and defer them**
— do not fix in this cycle. This is the DSRM-sanctioned "surface a known gap explicitly rather
than iterate the artifact indefinitely" stance (Peffers et al. 2007, Activity 5). The finding is
logged as an open limitations item (`docs/limitations_items/0017-ig-publisher-residual-doc-link-errors/`)
for later harvest into the thesis §Limitations, and deliberately NOT force-fixed, because the
largest bucket (the 276 `item.definition` anchors) intersects the live SDC extraction mechanism
and warrants a verified, scoped change — not a blind `item.definition` rewrite.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Rewrite the SDC `item.definition` anchors `#Observation.valueQuantity` → `#Observation.value[x]` to make the links resolve | The anchors are parsed by `extractor.ts` for definition-based extraction; a blind change risks breaking extraction. Needs a verified, scoped fix, not a QA-cleanup sweep |
| Add an IG Publisher expected-messages / `ignoreWarnings` file to suppress the known links | Legitimate and still available later, but suppression should follow an explicit decision on each class; deferring keeps the honest count visible for now and avoids masking anything prematurely |
| Fix them all now | Disproportionate effort for zero conformance benefit; the artifact validates 39/0 as-is |

## Consequences

✅ The genuine model-level errors are gone (ADR-0162, ADR-0163); what remains is documented, categorized, and known-cosmetic rather than an unexplained error count.
✅ Thesis honesty preserved: the gap is captured as a limitations item for §Limitations rather than silently ignored.
⚠️ The published QA page still shows a high error count (97 + 295) that overstates how broken the IG is; a reviewer must be pointed at this triage. Cheapest future cleanup: an IG Publisher expected-messages / `ignoreWarnings` file suppressing the known anchor links.
❌ No `item.definition` / Questionnaire / profile changes made — the SDC extraction path is untouched.

## Sources

- IG Publisher `qa.txt` / `qa.html` on the deployed demo server (2026-08-15 build: `errors = 97, warn = 457, broken links = 295`)
- `docs/limitations_items/0017-ig-publisher-residual-doc-link-errors/plan.md`
- `sdc-frontend/src/lib/extractor.ts` — consumes `item.definition` (why bucket 1 is not a blind fix)
- ADR-0162 (invariant fix), ADR-0163 (CodeSystem.valueSet fix) — the two genuine errors already cleared
- Research methodology: Peffers et al. (2007) DSRM Activity 5 (cited in the thesis 04_methods chapter(s))
