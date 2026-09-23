# SDC's Follow-Up flow asks the user to pick "Encounter Type" from raw terminology labels; unified fixes it silently

> **Status:** Limitation — open, SDC/unified parity gap. Logged 2026-08-06, found live in the
> SDC Follow-Up form's Encounter Type dropdown (`— select —` / "Encounter for check up" /
> "Follow-up encounter" ✓ / "Patient encounter procedure").

## Gap

The unified frontend's `encounterBuilder.ts` takes `Encounter.type` as a fixed coding parameter
(`REGISTRATION_ENCOUNTER_TYPE` / `FOLLOW_UP_ENCOUNTER_TYPE`, imported constants) — it is never
exposed as a user-facing field in any wizard step; the correct SNOMED coding is simply set
programmatically based on which flow is running. In the SDC Questionnaire, the same element is a
**required** user-facing choice item: `ShoulderFollowUpQuestionnaire.fsh` `item[0].item[0]`,
linkId `encounter.type`, bound to `ShoulderEncounterType`, with `initial[0].valueCoding` set to
`390906007 "Follow-up encounter"` — but still shown as an editable dropdown offering "Encounter
for check up" and "Patient encounter procedure" as alternatives a user could pick instead.

## Why it matters

These three options are raw SNOMED display strings with no clinical guidance on when a follow-up
visit would ever be anything other than "Follow-up encounter" — a clinician has no principled way
to choose between "Encounter for check up" and "Patient encounter procedure" for a routine
registry follow-up visit, and picking wrong has no validation consequence (all three are valid
codes in the bound VS) but does produce inconsistent `Encounter.type` data across the registry for
what is structurally always the same kind of visit. This is a parity gap in the wrong direction —
unlike `0005`/`0006` where SDC is missing something unified has, here SDC turns a value the
unified frontend correctly treats as fixed/derived into an unnecessary, confusing manual decision.

## Note

Likely fix: make `encounter.type` `readOnly` (the same SDC mechanism already used for the
Constant-Murley sub-scores, `item.readOnly = true`) with its `initial` value standing as the
fixed answer, rather than a free choice — matching unified's "set programmatically, never asked"
behavior. Not implemented here.

> Re-verified against source 2026-09-09, with two corrections.
>
> **Scope is wider than logged.** Surgery has the identical pattern: an editable choice at
> `ShoulderSurgeryQuestionnaire.fsh:97-105` with `initial = 308335008`, against unified's fixed
> `SURGERY_ENCOUNTER_TYPE` constant (`SurgeryWizard.tsx:398-400`). Registration has no Encounter
> group at all; its type is a literal in `bundleAssembler.ts:298`. So the fix must cover Follow-Up
> and Surgery.
>
> **The proposed fix would not work on its own.** `QuestionnaireForm.tsx:261` computes `isReadOnly`
> but applies it only on the string, text and numeric branches (`:291`, `:308`, `:386`). The choice
> `<select>` at `:455` carries only `disabled={isNotDone}`, so an `item.readOnly = true` choice item
> would still render fully editable. The renderer needs the same guard on the choice branch.
