# ADR-0143: Fix wrong IPS absent-unknown CodeSystem display text in SDC Registration

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** The final comprehensive two-frontend test (the cross-frontend parity audit, "Final" item) — building one complete patient through the SDC Registration form and submitting it produced a real, blocking pre-flight validation error.

## Context

`ShoulderRegistrationQuestionnaire.fsh`'s `comorbidity.absentReason` item hardcodes two `answerOption[].valueCoding` entries against the IPS `absent-unknown-uv-ips` CodeSystem:

```
answerOption[0].valueCoding = .../absent-unknown-uv-ips#no-known-problems "No known comorbidities (asked; none reported)"
answerOption[1].valueCoding = .../absent-unknown-uv-ips#no-problem-info "No information available"
```

Submitting a Registration bundle with the first option selected produced a `validator-service` pre-flight **error**:

```
[error] Wrong Display Name 'No known comorbidities (asked; none reported)' for
http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips#no-known-problems.
Valid display is 'No known problems' (for the language(s) 'en')
```

Querying HAPI's own loaded copy of the CodeSystem confirmed the official displays:

```
no-known-problems -> No known problems
no-problem-info    -> No information about problems
```

Both FSH-hardcoded strings were wrong — the second (`no-problem-info` → "No information available") shares the same defect even though it happened not to be exercised by the specific test that surfaced the first. The unified frontend's equivalent `IPS_ABSENT_UNKNOWN` constant (`frontend/src/types/fhir.ts`) already used the correct terms, so this was an SDC-only bug: SDC's mechanism reads the QuestionnaireResponse answer's `valueCoding.display` verbatim into the submitted `Condition.code.coding[].display`, with no equivalent to unified's separation between UI label copy and the actual coding's `display`.

## Decision

Corrected both `answerOption[].valueCoding` display strings in `ShoulderRegistrationQuestionnaire.fsh` to the CodeSystem's own official displays ("No known problems" / "No information about problems"), matching what `frontend/src/types/fhir.ts`'s `IPS_ABSENT_UNKNOWN` constant already used.

This is the same class of fix as ADR-0142 (unify hardcoded coding displays, official terminology over ad-hoc wording) — found one comprehensive-test cycle later, after ADR-0142 had already closed the SNOMED-laterality and `clinicalStatus` instances of this pattern.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Loosen the validator to not flag display-name mismatches | Would hide a real conformance defect — the FHIR spec's own recommendation is that a `Coding.display` match the code system's registered display when known, and the validator catching this is exactly the CI/pre-flight gate working as designed (ADR-0024/ADR-0051). |
| Rebind to `answerValueSet` (like ADR-0142's laterality fix) instead of correcting the literal strings | The IPS `absent-unknown-uv-ips` CodeSystem's `no-known-problems`/`no-problem-info` are two specific, stable, hand-picked options (not a full VS a clinician browses) — there's no natural IG-authored ValueSet scoping to just these two codes the way `ShoulderLaterality` already existed for laterality. Correcting the literal strings is proportionate; inventing a new 2-code ValueSet for this would be over-engineering for two fixed, unlikely-to-change values. |

## Consequences

✅ Closes the one real validation-blocking bug found during the final comprehensive two-frontend test.
✅ `sushi .`: 0 errors / 0 warnings.
✅ Verified live on the deployment server: resubmitting the same Registration form (with a specific comorbidity selected, no absentReason set) succeeded — 61 resources created, 0 pre-flight errors.
⚠️ No mapping status change — display text only, not a coding/structural change.

## Sources

- the cross-frontend parity audit — "Final" comprehensive test section.
- Live `validator-service` pre-flight output (2026-08-03), captured verbatim above.
- `http://localhost:8080/fhir/DEFAULT/CodeSystem?url=http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips` — authoritative displays as loaded into HAPI (ADR-0055/ADR-0056's IPS package load).
- `frontend/src/types/fhir.ts` (`IPS_ABSENT_UNKNOWN`) — the unified frontend's already-correct reference values.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` (`comorbidity.absentReason`, item[5].item[12]).
