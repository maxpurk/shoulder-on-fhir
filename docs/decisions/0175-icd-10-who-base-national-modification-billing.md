# ADR-0175: ICD-10 (WHO) as the dual-coding reference base; national modifications (ICD-10-GM) deferred to future work for billing

**Date:** 2026-08-22
**Status:** Accepted
**Builds on:** ADR-0022 (FHIR R4 base, not DE Basisprofil — European/EHDS scope), ADR-0010 / ADR-0027 (standard-terminology-first), ADR-0055 / ADR-0056 (ShoulderComorbidityCondition bound to the IPS SNOMED problem-list value set, where the dual-coding note lives), ADR-0061 (an earlier fabricated code — `PRIVA` — was caught and removed; codes are verified against a live server before use)

## Context

The IG codes the rotator-cuff diagnosis in **SNOMED CT** (`Condition.code` fixed
to a single inclusion concept) and binds **no ICD-10 code anywhere** — verified:
0 ICD system URLs across the compiled IG and seed bundles. ICD is only ever an
**optional additional `coding[]`** a deploying site may add for dual-coding
(comorbidity, local billing).

Two things prompted this ADR:

1. **Which ICD dialect should the IG's documentation and the thesis reference
   material name?** The prose and the ShoulderComorbidityCondition note named
   **ICD-10-GM** (the German modification). That is a national modification
   maintained by BfArM; it is meaningful to a German site but not to the other
   SECEC member-state sites this IG's cross-border scope targets (ADR-0022 fixed
   the artifact at the European/EHDS level, not the German one).

2. **A correctness defect surfaced during a terminology audit** of the thesis
   appendix reference tables: they had been populated with **ICD-10-CM (US)**
   constructs — the five-character `M75.10/.11/.12` split and the
   `S46.0-` "add 7th character A / initial encounter" episode extension — neither
   of which exists in ICD-10 (WHO) or ICD-10-GM. (WHO ICD-10 `M75.1` "Rotator
   cuff syndrome" and `S46.0` "Injury of muscle and tendon of the rotator cuff of
   shoulder" are terminal 4-character codes; the partial/complete granularity the
   CM split expresses is carried in this IG by SNOMED CT and dedicated
   Observations, not by ICD.) This confirmed the reference material needed a
   single, correct, deliberately-chosen dialect.

## Decision

1. **The dual-coding reference base is ICD-10 (WHO)** — the un-modified
   international classification (`http://hl7.org/fhir/sid/icd-10`, 2019 final
   release). It is the jurisdiction-neutral base every national modification
   derives from, and it matches the IG's cross-border European scope. This is a
   documentation/reference decision only: it changes **no** binding, because the
   IG binds no ICD.
2. **National ICD-10 modifications are a deployment-time / future-work concern.**
   A national deployment substitutes its own modification for local billing and
   statutory reporting; in Germany that is **ICD-10-GM** (BfArM), mandated for DRG
   and §295/§301 SGB V reporting. Publishing SNOMED CT ↔ ICD-10-GM (and ↔ OPS for
   procedures) **concept maps** to bridge those billing/statutory workflows is
   recorded as future work — not part of the current IG.
3. **Documentation updated to reflect this:** the IG `terminology.md` design-
   principles note, the ShoulderComorbidityCondition profile note, and the thesis
   (background/methods/results prose + the appendix ICD tables, collapsed to their
   WHO 4-character codes with the CM artifacts removed).

## Alternatives Considered

- **Keep ICD-10-GM as the named reference.** Rejected: it narrows an
  explicitly-European artifact to a German audience, and it is not the base other
  member states use. It remains the *correct* target for the German-billing
  future-work concept map, so it is retained there, not as the primary reference.
- **ICD-11.** The current WHO revision, but adoption across registries and billing
  is still nascent; ICD-10 (WHO/GM) is what German DRG/statutory reporting and the
  reference registries actually use today. Out of scope; revisit if/when the
  billing bridge is built.
- **Bind ICD in the IG (primary or required).** Rejected long ago and unchanged
  here: SNOMED CT is the primary clinical coding (finer granularity, ADR-0010/
  ADR-0027); ICD stays optional dual-coding only.

## Consequences

- **No IG artifact change** — no profile, ValueSet, or CodeSystem binds ICD, so
  SUSHI output and validation are unaffected. Only two narrative notes changed
  (`terminology.md`, ShoulderComorbidityCondition Description).
- The interoperability story is cleaner and honest to scope: SNOMED CT primary;
  ICD-10 (WHO) as the neutral dual-coding base; national modifications as a
  deployment-time mapping, with the German (ICD-10-GM/OPS) bridge named as future
  work.
- The terminology-audit defect (CM codes in the reference tables) is closed; the
  reference tables now carry only verified ICD-10 (WHO) codes.
