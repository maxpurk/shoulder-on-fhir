# The population query can return more than one diagnosis, and the group it fills does not repeat

> **Status:** Limitation — open. Population behaviour of the four forms that take a patient at
> launch. Found 2026-09-17 while checking the population declarations against the
> specification. Classified against the expert consensus: **none** — no `Q#.#` element is
> affected and every element involved stays representable. This is a form-authoring gap, not a
> data-model gap.

## Gap

The surgery and follow-up forms, under both extraction mechanisms, declare an
`itemPopulationContext` on a group: a `Condition?subject={{%patient.id}}&_profile=…` query whose
result is bound to a named variable for the descendants of that group to read.

The specification's stated behaviour for that extension is to create one group repetition per
row the query returns. The group carries no `repeats`, so it is single by default, and nothing
in the form bounds the query to one row. A patient with a bilateral tear, a re-tear, or any
second `RotatorCuffCondition` on file therefore returns two rows into a group that can hold one.

What happens then is not specified for this extension. For the retired predecessor the
specification called the analogous case fatal: "If an expression results in multiple repetitions
for a single for the root Questionnaire or for an item where 'repeat' is false, it is an error
and no extraction can occur." For the current extension it says nothing, so the outcome is
whatever the engine chooses. This project's own filler takes the first row.

## Why it matters

The value the query resolves is the diagnosis a visit is recorded against, and it is seeded into
a hidden item that extraction reads to write `Encounter.reasonReference`. A patient with two
diagnoses on file can have a visit filed against the wrong one, silently, with a conformant
bundle either way. Two engines given the same form and the same patient may disagree about which.

The two example patients each carry one rotator cuff diagnosis, so nothing in the worked
examples exercises it.

## Note

Two coherent fixes, neither made yet, because the choice is clinical and not mechanical.

- **Bound the query** to one row and order it deliberately, so the form states which diagnosis a
  visit defaults to. Whichever order is chosen is a clinical assertion and needs to be one.
- **Let the group repeat** and ask which diagnosis the visit concerns, which is the honest answer
  for a bilateral patient and adds a question to four forms.

Related: `limitations_items/0020` records what does and does not travel with a definition-based
form. This item is about population, which runs before extraction and shares none of its
machinery.
