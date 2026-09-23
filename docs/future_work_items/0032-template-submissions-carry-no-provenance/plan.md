# A template submission says nothing about where it came from

> **Status:** Scoped, not approved.

## Gap

The three template forms produce resources and no account of their origin. There
is no `Observation.performer`, no `derivedFrom` pointing back at the response
that produced them, and no `Provenance`. The standard says a form should do the
first two, and its own worked example does both.

The response itself is not kept either: the submission carries each answer into
the record it belongs to and no `QuestionnaireResponse` of its own, so there is
no form instance to point at.

## Why it matters

A registry that cannot say which submission a value came from cannot audit it,
and cannot withdraw one submission's contribution without re-deriving everything.

## Note

Deliberately deferred rather than overlooked. Carrying it needs a
`QuestionnaireResponse` entry in the submission for the other resources to
reference, which the registration and follow-up bundle profiles allow and the
surgery bundle profile does not, so it is a change to a bundle profile and not
only to a form. `Observation.performer` needs a practitioner the form does not
currently ask for.
