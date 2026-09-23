# The follow-up form asks which timepoint a visit is, and then discards it

> **Status:** Open.

## Gap

`ShoulderFollowUpQuestionnaire` asks which of the five consensus timepoints a
visit belongs to, six weeks through two years, and marks the question required.
The item carries no `definition`, so extraction has nowhere to put the answer
and the submission does not contain it. The person filling the form is made to
answer something the registry then throws away.

The template form does not ask at all, so the two forms disagree about whether
the question exists.

## Why it matters

Required questions that go nowhere are the kind of thing that erodes trust in a
form, and a reviewer comparing the two forms sees an inconsistency with no stated
reason.

The information is not actually lost: the typed builder derives the timepoint
from the operation date, which is recorded, and a query can do the same. So the
gap is that the form asks for something derivable and then silently drops it,
not that the registry cannot tell which visit is which.

## Note

Two honest resolutions, and the choice is a modelling decision rather than a
defect fix. Either stop asking, and say in the form that the timepoint is derived
from the operation date; or give the answer somewhere to live and have both forms
carry it. `Encounter.type` already carries the kind of visit, so it is not
obviously the right home.
