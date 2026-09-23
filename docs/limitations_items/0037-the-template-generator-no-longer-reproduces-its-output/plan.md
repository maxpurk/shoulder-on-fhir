# The template-questionnaire generator no longer reproduces its own output

> **Status:** Limitation — open. Found 2026-09-18, while adding a question gate to the template
> forms: re-running `tools/generate-template-questionnaires.py` silently reverted two accepted
> decisions already in the checked-in `.fsh`. Classified against the expert consensus: **none** —
> no element changes representability; this is a build-reproducibility gap.

## Gap

The three `Shoulder*FullTemplateQuestionnaire.fsh` files are generated from
`seed/bundles/anna-mueller/` by `tools/generate-template-questionnaires.py`. The header of each
says so. Two later corrections were applied to the generated files by hand and never folded back
into the generator, so the script and its output have diverged:

1. Every date expression in the registration and follow-up templates falls back when the visit
   date is left blank — `iif(<answer>.exists(), <answer>, now())`, `today()` for a `date`, and
   `%resource.authored` for the prior-treatment dates. The generator still emits the bare answer.
   About 44 expressions in the registration template and 30 in the follow-up.
2. The registration template's Patient entry no longer carries the worked example's telephone
   number and street address. The generator still emits both.

Running the script reverts both, with no error and no warning, and the loss is invisible in review
because the affected lines look like ordinary regenerated output.

The reconciliation is not purely mechanical. The surgery template was left unchanged by the
correction, so a generator that wraps every date site uniformly would produce a third state,
matching neither the checked-in surgery template nor the two corrected ones. Which of those is
right is a decision about the surgery form, not a transcription question.

## Why it matters

A generated artefact whose generator cannot regenerate it is a file nobody can safely rebuild.
The next change to the template forms is either another hand edit, deepening the divergence, or a
re-run that quietly undoes accepted work. The gate this item was found by had to be hand-applied
for exactly that reason, and the generator carries the matching change unverified against real
output.

## Note

Reconciling it means deciding the surgery template's fallbacks, then moving the two corrections
into the generator and confirming that a run leaves the three files byte-identical. A check that
re-runs the generator into a scratch directory and diffs would then hold the property, and would
have caught the divergence on the day it appeared.
