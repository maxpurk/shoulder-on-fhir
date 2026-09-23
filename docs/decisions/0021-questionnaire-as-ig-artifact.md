# ADR-0021: ShoulderRegistration Questionnaire published as a formal IG artifact

**Date:** 2026-05-05
**Status:** Accepted

## Context

The SDC Questionnaire for the Shoulder on FHIR registry was initially defined as a TypeScript constant (`sdc-frontend/src/questionnaire/ShoulderRegistration.ts`). While this made the frontend work, it created several problems:

1. **Not a FHIR artifact.** The Questionnaire could not be retrieved via `GET /Questionnaire?url=...` — it existed only as client-side JavaScript, invisible to FHIR tooling, the IG Publisher, and the FHIR validator CLI.
2. **Breaks the SDC source-of-truth principle.** In the SDC IG pattern, the Questionnaire is server-authoritative — the form renderer fetches it from the server. Hardcoding it in the client means any change to the form definition requires a client rebuild, not a profile reload.
3. **Not versioned in the IG.** The Questionnaire could not be validated, versioned, or published as part of the IG artifact set. It would not appear in the IG's Artifacts listing.
4. **No formal extraction mapping.** The connection between Questionnaire items and the IG profiles existed only as runtime `linkId` conventions in `extractor.ts`. There was no machine-readable declaration of which profile element each question maps to.

## Decision

**Publish the ShoulderRegistration Questionnaire as a FHIR FSH Instance in the IG.**

**File:** `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`

```fsh
Instance: shoulder-registration
InstanceOf: Questionnaire
Usage: #definition
...
```

`Usage: #definition` is the SUSHI designation for non-example definitional artifacts. SUSHI outputs the compiled JSON to `ig/fsh-generated/resources/Questionnaire-shoulder-registration.json`, which is already in the path read by `seed/load-profiles.sh`. A new Questionnaire loading section was added to `load-profiles.sh` to upload it to HAPI.

**item.definition annotations added.** Each leaf item was annotated with a `definition` URI pointing to its target element in the IG profiles:
- Patient group leaf items → `ShoulderPatient#Patient.{element}`
- Condition group leaf items → `RotatorCuffCondition#Condition.{element}`
- Procedure group leaf items → `ShoulderProcedure#Procedure.{element}`
- Observation leaf items (`obs.*`) → `{derived-profile}#Observation.valueQuantity` or `#Observation.valueCodeableConcept`
- Group-level items for Patient, Condition, and Procedure carry a `definition` pointing to the profile root URL, declaring the extraction context

This is the definition-based extraction approach described in the HL7 SDC IG. At runtime, `extractor.ts` still uses `linkId` conventions for extraction (which is equivalent); the `definition` annotations formalize the same mapping in a standard, machine-readable way.

**Questionnaire items for clinicalAssessment and outcomeScores groups** have no group-level `definition` because each `obs.*` item maps to a distinct Observation resource (not a single resource context). Per-item `definition` annotations declare the value element in each derived profile individually.

**SDC frontend updated.** `QuestionnaireForm.tsx` now fetches the Questionnaire from HAPI on mount via `GET /Questionnaire?url={canonical}` instead of importing the TypeScript constant. A loading state is shown while the fetch is in progress; a clear error message is shown if HAPI is unavailable or profiles are not loaded.

The TypeScript constant in `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` is retained as the original source but is no longer imported by the frontend. It serves as a human-readable reference and could be removed in a future cleanup.

## Architectural Context

This change completes the SDC pattern for the registry:

```
IG artifact (Questionnaire FSH)
    ↓  sushi + load-profiles.sh
HAPI server (/Questionnaire/shoulder-registration)
    ↓  GET /Questionnaire?url=...  (QuestionnaireForm.tsx on mount)
SDC frontend renders form
    ↓  user fills out form
buildQuestionnaireResponse() → QuestionnaireResponse
    ↓  extractResources() — linkId conventions (≡ item.definition)
FHIR resources (Patient, Condition, Procedure, Observations)
    ↓  validateBundle() → submitBundle()
HAPI server (stored as discrete resources)
```

The Questionnaire is now the server-authoritative form definition. The frontend is a pure renderer — form structure changes require only a profile reload (`./seed/load-profiles.sh`), not a client rebuild.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Pre-authored JSON in `ig/input/resources/` | Valid FHIR IG pattern but inconsistent with the rest of the IG which uses FSH throughout. Would require adding a separate directory to `load-profiles.sh` and is not processed by SUSHI. |
| Keep TypeScript constant; no FHIR artifact | Leaves the Questionnaire outside the IG, unvalidatable, and not server-authoritative. Breaks the SDC source-of-truth principle. |
| StructureMap-based extraction | Replaces `extractor.ts` with a formal FHIR StructureMap. More standard but substantially more complex; `extractor.ts` is fully tested and equivalent. Appropriate as future work for production deployment. |
| SDC `$extract` server operation | Delegates extraction to the server. HAPI supports `$extract` experimentally; would remove client-side extraction code. Out of scope for this prototype — requires verified HAPI SDC support. |

## Consequences

✅ The ShoulderRegistration Questionnaire is a first-class FHIR IG artifact — validatable with `java -jar validator.jar`, listed in the IG Publisher Artifacts page, retrievable from HAPI  
✅ `item.definition` annotations formally declare the Questionnaire→profile extraction mapping for each of the 25 leaf items  
✅ SDC frontend follows the correct SDC pattern: server is the source of truth for the form definition  
✅ Form structure changes require only `sushi . && ./seed/load-profiles.sh`, not a frontend rebuild  
✅ Consistent with the rest of the IG — FSH throughout  
⚠️ SDC frontend now requires HAPI to be running to render the form. A loading state and clear error message are shown if the server is unavailable. This is by design for a server-connected registry prototype.  
⚠️ `extractor.ts` runtime extraction still uses `linkId` conventions rather than reading `item.definition` at runtime. The two are equivalent; `definition` is metadata for tooling, not a runtime lookup key. Full definition-based extraction (reading `definition` to drive resource construction) is an architectural upgrade for future work.

## Sources

- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — FSH source
- `ig/fsh-generated/resources/Questionnaire-shoulder-registration.json` — compiled output (after `sushi .`)
- `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` — original TypeScript definition (retained, not imported)
- `sdc-frontend/src/components/QuestionnaireForm.tsx` — dynamic fetch on mount
- `seed/load-profiles.sh` — Questionnaire loading section added
- ADR-0018 — SDC Questionnaire frontend architecture
- ADR-0020 — bundle completeness; `required: true` items documented there
- HL7 SDC IG — definition-based extraction; `item.definition` semantics
