# ADR-0203: The Constant-Murley worksheet codes are one ordinal system, and the forms display what it declares

**Date:** 2026-09-18
**Status:** Accepted
**Relates to:** ADR-0027 (standard terminology first, local codes only where none exists), ADR-0090 (Constant-Murley sub-scores via `component[]`), ADR-0202 (extraction targets name element ids that exist)

## Context

`ConstantCalculatorInputCodes` supplies the answer codes for the Constant-Murley
worksheet questions in `ShoulderRegistrationQuestionnaire` and
`ShoulderFollowUpQuestionnaire`. Three of its codes, `none`, `moderate` and
`severe`, are each used on more than one question: once on the pain question and
again on two activity-limitation questions.

The two forms gave each reuse a wording of its own. The pain question read
"No pain", "Mild pain", "Moderate pain" and "Severe or permanent pain". The
activity questions read "Not limited", "Moderately limited" and "Severely
limited". The CodeSystem declares one display per code, and its definitions say
what the codes are:

```
#none      "None"      "The zero category of the axis the question names: no pain, or not limited."
#moderate  "Moderate"  "The middle category: moderate pain, or moderately limited."
#severe    "Severe"    "The highest category: severe or permanent pain, or severely limited."
```

The system therefore already declared itself an ordinal scale whose axis comes
from the question. The forms had drifted from it. The conformance gate reported
this as twenty-four `Wrong Display Name` errors, twelve on each form, and those
two forms were the only files of forty-nine that failed.

Two of the twenty-four were a different kind: `Xiphoid (sternum)` against the
declared `Xiphoid`, and `Full elevation of arm` against `Full elevation`. There
the form added a clarifying phrase instead of reusing a code.

## Decision

The CodeSystem is one ordinal system shared across the worksheet's axes, which
is what its own definitions state. The answer displays in both Questionnaires
now carry the display the CodeSystem declares. The codes do not change.

The question text supplies the axis, and it already does so explicitly:
"POOS-15: Pain, impact on normal activities" and "POOS-15: ADL,
occupation/daily-living limitation". An answer reading "Moderate" under a
question that names the axis is unambiguous.

The sleep-disturbance codes in the same system, `unaffected`, `occasional` and
`nightly`, are specific to their question and were never in conflict. They stay
as they are, which is the same rule applied to a question whose answers are not
an ordinal category.

## Alternatives considered

**One system per axis** (`pain-none`, `activity-not-limited`). This treats the
shared spelling as a coincidence. It is a breaking change to two published forms
and to any `QuestionnaireResponse` already stored against them, and it would
have been chosen on a reading the CodeSystem's own definitions contradict.

**Designations on the CodeSystem**, one per axis, so that both wordings resolve.
This preserves the question-specific text at the cost of declaring every wording
twice and leaving a reader to work out which applies where. It was not tested,
because the simpler change removes the ambiguity instead of encoding it.

**Dropping `display` from `answerOption.valueCoding`.** Non-breaking and
conformant, but a form filler then shows the code or nothing, so the forms get
worse for the people filling them in.

## Consequences

The conformance gate reports zero errors across all forty-nine validated files,
confirmed on the deployment server. Both affected Questionnaires now carry one
warning each.

Nothing stored moves. No code from this system reaches a stored `Observation`:
the answers are calculator input, the worksheet items carry no
`definitionExtract`, and what is extracted is the numeric sub-score on
`ConstantScoreObservation.component`. The consensus element Q12-Constant stays
representable.

`#severe` no longer carries "or permanent" in its label. The qualifier survives
in the code's definition, and a display is a label and not a definition.

A second implementer now sees one code with one display wherever it appears, and
the question carries the axis. That is the exposure the limitation recorded
against this system was about, so `limitations_items/0034` is closed and removed.
