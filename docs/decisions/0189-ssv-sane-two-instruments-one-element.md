# ADR-0189: SSV and SANE are two instruments counted as one consensus element

**Date:** 2026-09-12
**Status:** Accepted
**Found via:** a thesis proofreading pass on the consensus decomposition rules.
The rule justifying the Q12 count asserted that the slash in "SSV/SANE" is the
source's notation for one instrument under two names. Checking that against the
consensus paper's own appendix showed it is not supportable, and the same claim
had been copied into the mapping notes and the guide's narrative.

## Context

Answer A12 of the expert consensus reads: "The preferred clinical outcome scores
are the Constant score and SSV/SANE score."

The round 2 ballot behind that answer asked "Is there a preferred outcome
measure?" and offered five options: ASES, Constant score, WORC, Oxford shoulder
score, Subjective Shoulder Value. The Single Assessment Numeric Evaluation was
not among them. It appears for the first time in the round 3 answer statement,
joined to the Subjective Shoulder Value by a slash, and the paper never separates
the two again.

The two are separately published instruments. The Subjective Shoulder Value asks
the patient to rate the shoulder as a percentage of an entirely normal shoulder,
which would score 100%, and was validated against the Constant score with
correlations of 0.61 to 0.80 depending on the cohort (Gilbart and Gerber 2007).
The Single Assessment Numeric Evaluation asks "How would you rate your shoulder
today as a percentage of normal (0% to 100% scale with 100% being normal)?" and
was validated against the Rowe and ASES scores (Williams et al. 1999). They ask
for the same kind of single rating and they usually agree, but they are two
instruments, not one instrument with two names, and no published crosswalk
declares them interchangeable.

ADR-0039 collapsed `Q12-SSV` and `Q12-SANE` into the single mapping element
`Q12-SSV-SANE`. That accounting decision is correct and stands. Its stated reason,
that the pair is one dual-named instrument, is not, and this ADR replaces it.

Two further defects surfaced with it. The local CodeSystem defined `#sane-score`
as "a 0-100 visual analogue scale", which the instrument is not; ADR-0183
corrected the same error in the profile Descriptions but did not reach the
CodeSystem. And the phrase "dual-named instrument" had spread into the
QuestionnaireResponse profile, the FunctionalLimitations profile, and the
published narrative.

## Decision

The guide keeps both `SsvScoreObservation` and `SaneScoreObservation`, and the
mapping keeps counting the pair as one consensus element.

The reason for counting once is the source's own treatment: the answer statement
joins the two with a slash and never separates them, so a decomposition that
followed the paper cannot split them into two requirements. The reason for keeping
two profiles is that they are two instruments, so a registry that uses one of them
records that one under its own name.

Concretely:

- `ShoulderObservationCodes#sane-score` is redefined to the instrument's own
  wording, a rating of the shoulder today as a percentage of normal on a 0-100%
  scale, and named as separately published from the Subjective Shoulder Value.
  `#ssv-score` gains the matching statement and its source.
- Every "dual-named instrument" formulation is replaced by "the SSV/SANE pair the
  answer statement names": `RotatorCuffQuestionnaireResponse`,
  `FunctionalLimitationsObservation`, the CodeSystem comment, and
  `pagecontent/index.md`.
- `pagecontent/profiles.md` states plainly that the two are separately published
  instruments, that the consensus names them together, that the guide therefore
  carries a profile for each, and that a registry using only one records only
  that one.
- The mapping row `Q12-SSV-SANE` carries the ballot evidence in its notes.

Not in scope: no profile is merged, renamed, or deleted; no canonical URL
changes; the Questionnaires keep both items; the seed bundles keep their twelve
SSV and four SANE Observations; neither frontend changes. The derived Observation
profile count stays 57 and the consensus denominator stays 58.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Merge the two profiles into one, under a combined code | Asserts in the artefact that the two are the same instrument, which the sources do not support. It would also delete a published canonical, rewrite sixteen seeded Observations, drop the derived profile count from 57 to 56 across the guide, the README, several earlier ADRs, and the thesis, and break the SDC forms unless both Questionnaires changed in the same commit. Large blast radius to encode a clinical error. |
| Keep both profiles but collect only one in the frontends | Sound in a deployment, wrong in a demonstrator whose job is to show every element of the guide being captured. The choice of instrument belongs to the adopting registry. |
| Split the mapping back into two consensus elements | Inflates the denominator with an instrument the panel never balloted, and departs from the source's own wording. |
| Leave the wording as it was | The CodeSystem definition was factually wrong and published, and the "one instrument under two names" claim contradicted the thesis's own background chapter. |

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement.** The consensus names the preferred scores; it is silent on how
an implementation should represent a slashed pair. No element is added or
removed, no mapping row is created, and the Layer 1 denominator is unchanged.

## Verification

- `sushi .` — 0 errors, 0 warnings; ValueSets 35, CodeSystems 19 unchanged.
- Compiled `CodeSystem-shoulder-observation.json` re-read: both concept
  definitions carry the corrected wording, and no definition mentions a visual
  analogue scale.
- Terminology re-checked 2026-09-12: no LOINC concept for either instrument
  (LOINC 2.82 text search via `tx.fhir.org`, filters "subjective shoulder",
  "shoulder value", "single assessment numeric", "SANE", all empty) and no SNOMED
  CT International concept (observable entity and full-domain searches). Both
  stay on local codes.
- `tools/check-artifact-names.sh` — exit 0.

## Consequences

✅ The published guide describes both instruments correctly, and a reader can see
why two profiles exist for one consensus element.
✅ The mapping notes carry the evidence, so the counting decision is auditable
without re-reading the paper.
✅ Nothing is deleted, so every count, canonical, seeded resource, and form stays
as it is.
⚠️ A submission can still carry both scores for one visit, and the two numbers
will differ slightly. That reflects what the instruments are, and the seeded
example patients model it deliberately.
⚠️ Both remain locally coded, so the pair stays part of the terminology frontier
until a standard concept exists.

## Sources

- Hurley et al. 2024, SECEC rotator cuff tear registry Delphi consensus, Appendix
  1: round 2 preferred-outcome-measure ballot and round 3 answer A12.
- Gilbart and Gerber 2007, Comparison of the subjective shoulder value and the
  Constant score, J Shoulder Elbow Surg 16(6):717-21.
- Williams et al. 1999, Comparison of the Single Assessment Numeric Evaluation
  method and two shoulder rating scales, Am J Sports Med 27(2):214-21.
- ADR-0039 — collapsed the two mapping elements into `Q12-SSV-SANE`; its
  accounting stands, its "dual-named instrument" reasoning is corrected here.
- ADR-0183 — the UCUM `%` and 0-100 bound migration, which corrected the same
  visual-analogue-scale error in the profile Descriptions.
- ADR-0149 — the seeded SANE values, a few points off the same visit's SSV;
  confirmed by this ADR, not superseded.
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`,
  `ig/input/fsh/profiles/RotatorCuffQuestionnaireResponse.fsh`,
  `ig/input/fsh/profiles/observations/FunctionalLimitationsObservation.fsh`,
  `ig/input/pagecontent/{index,profiles}.md`,
  `mapping/SECEC_FHIR_Mapping.csv` row `Q12-SSV-SANE`.
