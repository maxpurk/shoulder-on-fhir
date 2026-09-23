# Expand beyond rotator cuff pathology to other shoulder disease

> **Status:** Future work item — deliberate scope boundary, not a defect.

## Gap

The IG is deliberately scoped to rotator cuff tear documentation, per the thesis title and the
Hurley consensus it implements. Other shoulder pathologies (instability, primary glenohumeral
arthritis, adhesive capsulitis as a primary diagnosis rather than a complication) use entirely
different classification systems and outcome instruments, and are out of scope.
`ShoulderDiagnosisCondition` already carries a narrow non-RC *secondary*-diagnosis slice
(ADR-0077), but there is no primary-diagnosis pathway for a different shoulder condition.

## Why it matters

A natural next design cycle for anyone wanting a general-purpose shoulder registry rather than a
rotator-cuff-specific one — worth naming explicitly as a boundary rather than leaving as an
implicit assumption.
