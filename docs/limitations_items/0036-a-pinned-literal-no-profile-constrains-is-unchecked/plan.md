# A literal a form pins into an element no profile constrains is checked by nothing

> **Status:** Limitation — open. Found 2026-09-18, when a patient registered through the generic
> form filler could not be found again by a lookup on `Patient?identifier=<system>|<value>`: the
> registration form pinned a `Patient.identifier.system` that exists nowhere else in the guide, so
> the patient sat in a namespace of its own. Fixed in the form (ADR-0205); the gap that let it be
> written stands. Classified against the expert consensus: **none** — `L3.A.1` stays representable,
> and the defect is in a literal, not in the model. This is an authoring-assurance gap.

## Gap

Definition-based extraction derives an element's type, cardinality and pinned values from the
StructureDefinition, so a declaration that disagrees with the profile is caught. A
`definitionExtractValue` carrying a `fixed-value` for an element the profile leaves open is
derived from nothing: the form states the value, and the value is whatever the author typed.
`tools/check-template-fidelity.sh` reports a template literal that disagrees with a profile pin,
which is the same shape of check and equally blind here, because there is no pin to disagree with.

`ShoulderPatient` constrains `identifier.system` to `1..1 MS` and stops there, deliberately, so
that a patient identified in a hospital's own namespace still conforms. The consequence is that
an identifier system is a free URI, and a form is free to invent one. Identifier search matches
system and value together, so an invented system is not a cosmetic drift — it partitions the
patients on one server into namespaces that cannot see each other, and every flow that begins by
finding an existing patient starts at the wrong end of the partition.

The exposure is not limited to this element. Any element a profile leaves unpinned and a form
fills with a literal has the same property: `Encounter.identifier.system`, an
`Observation.performer` written as a fixed reference, any local code a form states without the
profile binding it.

## Why it matters

Two mechanisms and two frontends write patients into one server, and the demonstration's
longitudinal claim rests on the second visit finding what the first visit wrote. Nothing in the
build compares one artefact's literal against another's, so agreement across four writers is held
by hand. ADR-0161 corrected the same disagreement in a form filler once already, differing by the
casing of a single letter; ADR-0205 corrected it again in the guide, differing by the whole path.
Twice by inspection is the argument for a check.

## Note

The shape a check would take: collect every URI literal the guide states for a given role — the
`fixed-value` declarations in the Questionnaires, the constants in both frontends, the examples,
the mapping — and report a role written more than one way. That is close to what
`tools/check-artifact-names.sh` already does for names declared in FSH, which derives the forms it
searches for rather than pattern-matching a suffix, and the same derivation would work here: the
set of identifier systems the guide uses is small, closed and known from the examples.
