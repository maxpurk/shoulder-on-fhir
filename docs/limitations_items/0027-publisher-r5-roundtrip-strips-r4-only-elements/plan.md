# The publisher's R5 round-trip strips R4-only elements from contained templates

> **Status:** Limitation — open, external. Not fixable from this repository: the defect is in the IG
> Publisher, which normalises resources through its internal R5 model, and no arrangement of the FSH
> avoids it. Found 2026-09-16 while clearing the 36 residual errors on the registration template
> (ADR-0195), which resolved the one symptom that raised an error and left the two that do not.
> Classified against the expert consensus: the round-trip strips elements that consensus rows name
> directly. `CarePlan.activity.detail.scheduledTiming` is the FHIR element of `Q11.a`–`Q11.e`, and
> `Condition.evidence.detail` is the linkage `Q1.i`, `Q4.b`, `Q4.c` and `Q5` each name as their
> realisation; `Encounter.diagnosis.rank` is the IG-Operational row `L3.F.5`. Representability is
> nonetheless unchanged at 58 elements and 0 Missing, because representability is a property of the
> profiles: `RotatorCuffResearchCarePlan` and `RotatorCuffCondition` publish intact, as do the example
> Bundles, and the loss is confined to one derived artifact. This is a publishing-tool defect in a
> generated copy, not a data-model gap.

## Gap

The three template Questionnaires each carry the whole submission as a contained transaction Bundle.
The Publisher round-trips `Questionnaire.contained[]` through its R5 model, so any element R4 has and
R5 does not is dropped on the way out and cannot be restored on the way back. Measured by diffing
`ig/output/` against `ig/fsh-generated/resources/` on the 2026-09-16 build (Publisher 2.3.4):

| element | R5 disposition | lost from | errors raised |
|---|---|---|---|
| `Encounter.diagnosis.rank` | removed | registration, 2 entries | 36, now resolved by ADR-0195 |
| `Condition.evidence.detail` | merged into a `CodeableReference` | registration, 3 entries | **0** |
| `CarePlan.activity.detail.*` | replaced by `plannedActivityReference` | surgery, 5 activities | **0** |

Top-level resources are unaffected: `Bundle-AnnaRegistrationBundle` carries the same
`Encounter.diagnosis` and keeps `rank` 1 and 2 through the same build. The loss is specific to
resources contained in a Questionnaire.

## Why it matters

The stripped copies are what the published guide serves and what `package.tgz` contains, so an
implementer installing `shoulder-on-fhir` receives templates that are missing content the
source defines. The surgery template is the worst case: all five Q11 follow-up activities lose their
status, scheduled date, description and timepoint code, leaving the research `CarePlan` schedule
empty in the published artifact.

The two losses are not equivalent in kind. In the surgery template the stripped element *is* the
data, so the Q11 schedule is gone. In the registration template the Observations survive as their own
bundle entries and only the linkage back to the index Condition is dropped, so the values a consensus
row carries are still present but no longer reachable through `Condition.evidence.detail`.

Both residual losses are silent. `Condition.evidence.detail` and `CarePlan.activity.detail` are
optional in their profiles, so removing them violates no cardinality rule and the quality report
stays clean. With `Encounter.diagnosis.rank` relaxed to `0..1`, nothing in the build signals that the
round-trip is lossy at all.

## Note

The running demonstration system is not affected. `seed/load-profiles.sh` loads the two lossy
templates from `ig/fsh-generated/resources/`, so HAPI and all four form fillers serve the unstripped
templates. See the Update below for how it decides that.

Two follow-ups are worth considering and neither is done: a build check that diffs the emitted
template Questionnaires against `fsh-generated/` and fails on any lost element, so the defect cannot
ship unnoticed a second time; and reporting the round-trip upstream to the IG Publisher project.
Pinning an older Publisher was considered and rejected in ADR-0195 — 2.3.4 is the current release, so
there is no forward fix, and the normalisation is architectural rather than a recent regression.

## Update, 2026-09-16

The build check this entry listed as an open follow-up now exists:
`tools/check-output-fidelity.sh`, over `tools/publish-fidelity.py`. It compares
the leaf element paths of every resource in the published guide against the same
resource as compiled, so it reports a loss without anyone having predicted which
element would be lost.

`seed/load-profiles.sh` now asks that question per resource rather than keeping a
list, and loads from the published guide wherever publishing is lossless. As of
this writing 160 resources publish intact and two do not: the registration
template loses `Encounter.diagnosis.rank`, and the surgery template loses seven
paths under `CarePlan.activity.detail`. Those two keep being loaded from source,
automatically, and will stop being treated as exceptions the moment the round
trip stops dropping them.

The check is a tool, not a gate: nothing in `build-and-deploy.sh` calls it, so a loss is reported
when someone asks and does not fail a build.

## Update, 2026-09-17

Restructuring the templates to avoid `contained[]` is closed as an option, not merely unattractive.
SDC 4.0.0 defines the `template` slice of `sdc-questionnaire-templateExtract` as "a reference to a
contained resource to use as a template", so the specification mandates the exact construct the
Publisher mishandles. That leaves two open routes and neither is taken:

- **Graft at build time.** After the guide is built, copy the lossy resources over their `ig/output/`
  counterparts and repack `package.tgz`. The published bytes would then match the source, an
  implementer installing the package would receive intact templates, and the loader could drop the
  per-resource choice entirely. The Publisher-rendered `.html`, `.xml` and `.ttl` for those resources
  would stay stripped unless regenerated, trading one silent inconsistency for a smaller documented
  one.
- **Stop carrying elements R5 deletes.** `Encounter.diagnosis.rank` is already redundant against
  `diagnosis.use`, which both frontends and all three templates populate, and `CarePlan.activity.reference`
  to a referenced request resource is the R4 spelling that survives the conversion. This removes the
  cause rather than the symptom and is the most expensive, with the mapping, an ADR, both frontends
  and both example patients downstream.

Reporting the round trip upstream remains open.
