// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SDC definition-based extraction rule sets                                 │
// │  One declaration block per extracted resource, so the Questionnaire        │
// │  carries the whole recipe and the client needs no registry knowledge.      │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// Every extracted Observation needs the same four values that no question asks:
// a status, the subject, the visit, and an effective time. Only the target
// profile differs, so the block is parameterised on the item path and the
// profile canonical.
//
// The uuid variables (%patientId, %encounterId) are allocated once at the
// Questionnaire root by extractAllocateId.
//
// Insert these AFTER every literal item rule in the file, so the soft index
// [+] appends past any extension the item already declares (minValue/maxValue).

RuleSet: DeclareObservation(path, profile)
* {path}.extension[+].url = $SDC_DEF_EXTRACT
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueCanonical = "{profile}"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.status"
* {path}.extension[=].extension[+].url = "fixed-value"
* {path}.extension[=].extension[=].valueCode = #final

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.subject.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%patientId"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.encounter.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%encounterId"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.effective[x]"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "iif(%resource.repeat(item).where(linkId='encounter.date').answer.value.exists(), %resource.repeat(item).where(linkId='encounter.date').answer.value, iif(%resource.repeat(item).where(linkId='encounter.startDate').answer.value.exists(), %resource.repeat(item).where(linkId='encounter.startDate').answer.value, now()))"


// Surgery and Follow-Up attach to a patient that already exists on the server,
// so there is no locally allocated Patient uuid to point at. The subject comes
// from the QuestionnaireResponse itself, which is data the extraction engine can
// see. This requires the form filler to set QuestionnaireResponse.subject.

RuleSet: DeclareObservationExistingSubject(path, profile)
* {path}.extension[+].url = $SDC_DEF_EXTRACT
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueCanonical = "{profile}"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.status"
* {path}.extension[=].extension[+].url = "fixed-value"
* {path}.extension[=].extension[=].valueCode = #final

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.subject.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%resource.subject.reference"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.encounter.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%encounterId"

* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.effective[x]"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "iif(%resource.repeat(item).where(linkId='encounter.date').answer.value.exists(), %resource.repeat(item).where(linkId='encounter.date').answer.value, iif(%resource.repeat(item).where(linkId='encounter.startDate').answer.value.exists(), %resource.repeat(item).where(linkId='encounter.startDate').answer.value, now()))"

// The side is answered once per form. Every observation that names a physical
// site takes it from that one answer, and the declaration sits on the item
// whose definitionExtract creates the observation: the specification walks down
// from the extraction context, so a value declared above it is out of scope for
// an engine that follows the stated traversal.
//
// first() is load-bearing, not defensive. In the surgery form the side is answered
// inside the repeating procedure group, so the unscoped expression yields one value
// per repetition and bodySite holds one. The intra-operative findings belong to the
// index procedure, which is the first repetition. In the other two forms the side is
// answered once and first() changes nothing.

RuleSet: DeclareBodySite(path, profile, sideLinkId)
* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.bodySite"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='{sideLinkId}').answer.value.first()"


// An aggregate score is about a patient, not about a measured site, so the five
// PROM profiles constrain no bodySite and declare focus instead, pointing at the
// diagnosis the score is about. Without it two scores recorded for a bilateral
// patient at one visit carry the same code, subject and time, and nothing says
// which shoulder each belongs to.
//
// The reference target differs by form. Registration allocates the condition
// itself, so the uuid is in scope. Surgery and Follow-Up attach to a condition
// that already exists on the server, and the form asks for its id.

RuleSet: DeclareFocusAllocatedCondition(path, profile)
* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.focus.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%conditionId"

RuleSet: DeclareFocusExistingCondition(path, profile)
* {path}.extension[+].url = $SDC_DEF_VALUE
* {path}.extension[=].extension[+].url = "definition"
* {path}.extension[=].extension[=].valueUri = "{profile}#Observation.focus.reference"
* {path}.extension[=].extension[+].url = "expression"
* {path}.extension[=].extension[=].valueExpression.language = #text/fhirpath
* {path}.extension[=].extension[=].valueExpression.expression = "%resource.repeat(item).where(linkId='encounter.conditionId').answer.value.select('Condition/' + $this)"
