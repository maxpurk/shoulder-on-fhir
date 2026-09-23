# Template-based extraction asserts profile conformance by hand, and only a static check holds it

> **Status:** Limitation — open, narrowed. `tools/check-template-fidelity.sh` now reads the
> profiles a template claims and holds the template to them, including pins written as a bare
> `Coding` or a bare code, pins inside a backbone or an extension, and pins the containing
> bundle profile places on an entry's resource: 244 literals judged across 86 entries, none
> disagreeing. So the static half of the gap is closed. What remains is the runtime half: no
> static check can tell whether an expression will yield a value when the form is filled. Found 2026-09-17 while filling the generic form filler
> against the registration template. Classified against the expert consensus: **none** — no `Q#.#` element is affected, and
> every element involved stays representable. This is an authoring-assurance gap, not a data-model gap.

## Gap

Definition-based extraction names an element of a profile (`item.definition` →
`<canonical>#<element id>`) and resolves that element's type, cardinality and fixed values from the
StructureDefinition at runtime. Conformance is therefore *derived*: the profile is the input.

Template-based extraction reads no StructureDefinition at all. The Questionnaire carries the
submission as a literal contained Bundle, and every fixed value in it was typed by hand. Conformance
is therefore *asserted*, and the assertion is unverified: nothing in the build compares a template
against the profiles its `meta.profile` claims. A template can drift from those profiles, and the
first thing that notices is the validator, at submission time, in front of the user.

Three consequences of exactly that, all found in one fill of the registration form and all now fixed:

| symptom | cause | severity as encountered |
|---|---|---|
| `Procedure.performed[x]: minimum required = 1, but only found 0` | the prior-treatment Procedure is produced by a boolean, but its dates came from two optional questions | submission blocked |
| every extracted resource carried no time | 44 temporal expressions read one optional question, where the definition-based sibling uses `now()`, `today()` and `%resource.authored` | valid, clinically useless |
| every extracted Patient carried one example patient's phone number and street address | the template is a worked example whose demographic elements have no `templateExtractValue` sidecar and no question to fill them | fabricated data in every submission |

The first two are the same omission: the template was hand-copied from a worked example and the
computed fallbacks its definition-based counterpart derives from the profiles were not carried over.
The third is the general case — any element a template carries but no question fills is copied
verbatim into every submission, and only reading the template line by line reveals which.

A related asymmetry is unresolved: a definition-based Questionnaire names the resource profiles it
extracts into but never names the Bundle profile they compose into, so a generic client cannot
preselect it and the operator picks it from a list. A template states it, in `Bundle.meta.profile`.

## Why it matters

The demonstration turns on a generic client producing a conformant submission from the Questionnaire
alone. That claim survives this — every fix above landed in the Questionnaire, none in the client,
and the client caught the error it could not itself have predicted by deferring to the validator. But
the claim's cost is now on the critical path: template-based extraction moves responsibility for
profile conformance from the client to whoever authors the template, and this repository offers that
author no check. `sushi` validates FSH syntax, not whether a contained Bundle satisfies the profile it
claims.

## Note

**The static half is now checked.** `tools/check-template-fidelity.sh` resolves every entry of
every contained template bundle to the profile its own `meta.profile` claims, walks that profile's
`baseDefinition` chain, and reports three things:

- a literal system and code the template states on a path the profile pins, where the two disagree;
- a top-level element the profile makes mandatory that the template neither states nor carries a
  `templateExtractValue` expression for;
- a coding of a multi-coding pin that the template restates in part and leaves incomplete, which the
  first check cannot see because it walks the template's literals and so never visits a value the
  template omits.

It follows the same per-resource source choice `seed/load-profiles.sh` makes, preferring the
published `ig/output` for content while letting the compiled `fsh-generated` decide which
Questionnaires exist, so a resource left behind in a stale build directory is not mistaken for one
the guide still ships. Exit 0 is clean. At the time of writing: 86 template entries examined, 244
literals on a profile-pinned path, all 244 in agreement, no unfillable required element, and no
element in any profile pinning more than one coding, so the third check is reported and unexercised.

**Numeric bounds are outside the script.** A profile states a permitted range as `minValue[x]` and
`maxValue[x]` on an element, and a Questionnaire restates it as `minValue` and `maxValue` extensions
on the item, which is what lets a renderer refuse an out-of-range entry without reading a profile.
Both mechanisms restate it, so this is not a template-only exposure, and nothing compares the two.
The three template Questionnaires currently carry no bounds at all, where their definition-based
siblings carry 28, 27 and 1, so an out-of-range value is refused at entry in one and caught only by
the validator in the other.

**The runtime half is not, and cannot be statically.** An element whose expression reads an optional
question has a way to be filled and may still arrive empty, which is exactly the
`Procedure.performed[x]` defect above. The check sees a `templateExtractValue` sidecar and is
satisfied. Catching that needs the form filled, which is what the extraction tests in
`sdc-generic-frontend/test/` do for the specific cases found.

**The asymmetry noted above is resolved elsewhere.** A definition-based Questionnaire cannot name
the Bundle profile its resources compose into, because every sub-extension of `definitionExtract` is
scoped to a bundle entry. No bundle profile in this guide constrains `Bundle.meta`, so the
submission still conforms and the operator supplies the profile out of band. Recorded in
`limitations_items/0020`.
