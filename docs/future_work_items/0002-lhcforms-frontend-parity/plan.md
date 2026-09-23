# LHC-Forms frontend revival — bring the archived third demo to parity

> **Status:** Future work item — not yet implemented, not yet approved for implementation.
> Captured 2026-07-25 while estimating the effort to revive the archived LHC-Forms frontend
> (deprecated by `docs/decisions/0041-deprecate-lhcforms-frontend.md`) so it demonstrates the
> current three-bundle architecture instead of the pre-restructure single-Questionnaire shape it
> was frozen at.

## Context

LHC-Forms (NLM's off-the-shelf `<wc-lhc-form>` renderer, formerly port 3002) was the project's
third demonstrator paradigm: fetch a Questionnaire from HAPI, render it with zero custom
extraction code, POST a bare `QuestionnaireResponse` — no bundle. It was archived once the SDC
frontend (port 3001) reached full SDC v3.0.0 conformance and covered the same ground at higher
fidelity (ADR-0041). Reviving it would restore the one thing it uniquely showed: a genuinely
off-the-shelf, zero-custom-code renderer working against this IG's published Questionnaires.

**Verified facts** (from reading the archived code, not the ADR summary): the archived frontend's
`src/App.tsx` is a single 251-line file — one hardcoded Questionnaire
URL (`shoulder-registration` only), no router, no patient lookup, no bundle assembly. It has not
been touched since the three-bundle architecture (ADR-0034) or SDC v3.0.0 conformance (ADR-0040)
landed.

## Two possible scopes

**A — Bare resurrection (restore exactly what existed):** ~30–60 min. Reverse ADR-0041's
mechanical removal: restore the frontend directory at the repository root, restore the
`docker-compose.yml` service block and the `build-and-deploy.sh` build/echo lines. Residual risk:
untested whether stock LHC-Forms evaluates the `calculatedExpression` extension the Constant-Murley
total item now carries (added by ADR-0090, after this frontend was archived) — it may render
read-only/blank instead of live-summing.

**B — Full parity with the current 3-flow / 3-bundle setup:** ~2–4 days. Needs:
- A router + three Questionnaire targets (registration/surgery/follow-up), mirroring
  `sdc-frontend/src/components/FlowPage.tsx`'s pattern.
- A bolted-on `PatientLookup` step for Surgery/Follow-Up (LHC-Forms has no native
  external-context mechanism either — same ~180-line shape as
  `sdc-frontend/src/components/PatientLookup.tsx`).
- A way to turn the raw `QuestionnaireResponse` LHC-Forms produces into a conformant bundle
  instead of posting it bare. **This is now unblocked by
  `docs/decisions/0095-server-side-extract-not-implemented.md`**, which names the reusable path:
  wrap `sdc-frontend/src/lib/extractor.ts` + `bundleAssembler.ts` (already renderer-agnostic) in
  a small sidecar, or import them directly into this frontend's build.
- `preflightValidate.ts`-style wiring to the `validator-service` sidecar (port 3500, ADR-0051)
  for pre-flight checks, matching both live frontends.

Most of scope B is integration/testing against already-correct, already-existing logic
(`extractor.ts`, `bundleAssembler.ts`, the `PatientLookup` pattern) rather than new logic — the
bulk of the time is verifying LHC-Forms' own rendering behaves correctly end-to-end, in a browser,
across all three Questionnaires.

> **Empirical note (from a three-frontend gap-analysis run):** the *other* candidate for the
> QR→bundle step — pointing the LHC path at HAPI's server-side `QuestionnaireResponse/$extract`
> (Clinical Reasoning module) instead of wrapping the custom extractor — was enabled on the live
> server and tested end-to-end. It is a **dead end for this IG's quantitative observations**: a
> name-only (`valueString`) QR extracts cleanly, but as soon as a ROM `Observation` is included,
> `$extract` throws `HAPI-0389 NullPointerException ("elementDef is null")` building
> `Observation.valueQuantity` from the decimal answer. So the reusable `extractor.ts` +
> `bundleAssembler.ts` path named above is not merely *a* reusable option — it is the only viable
> one here, corroborating `docs/decisions/0095-server-side-extract-not-implemented.md`. (The LHC
> renderer's *form* is unaffected — it renders the identical Questionnaire as the SDC frontend; the
> failure is purely in the standard server extractor.)

## Open question for whoever picks this up

Is the goal scope A (cheap, restores the historical citation) or scope B (turns it back into a
live, load-bearing demonstrator)? The two have a ~50x effort difference and should be an explicit
choice, not a default.

## Related limitations

- `limitations_items/0020-sdc-questionnaire-not-standalone-conformant-extract-recipe/` — a
  prerequisite for scope B. An off-the-shelf renderer carrying no custom extraction code can only
  assemble a conformant bundle once the cross-resource references and the required-but-not-collected
  submission defaults are declared inside the Questionnaire, instead of living in this project's own
  TypeScript.
