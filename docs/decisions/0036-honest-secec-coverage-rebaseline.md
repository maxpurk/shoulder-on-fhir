# ADR-0036: Honest re-baseline of SECEC element accounting (Hurley-anchored decomposition)

**Date:** 2026-05-18
**Status:** Accepted — supersedes the coverage statistics in ADR-0027; coverage statistics **re-baselined again by ADR-0039 (2026-05-19); Supplementary layer dispositions partially superseded by ADR-0054 (2026-05-22); per-element Full/Partial classification replaced by the code/value provenance axis in ADR-0178 (2026-08-25)**

> **Status update (2026-08-25, ADR-0178):** The per-element Full/Partial "coverage status" classification this lineage carries was replaced by a two-facet code/value **terminology-provenance** axis (`Reused` / `Local` / `Numeric`). Representability (0 Missing) and the two-layer accounting remain in force; only the per-element status column changed. Body below unedited for audit trail.

> **Status update (2026-05-22, ADR-0054):** The Supplementary layer this ADR introduced (ASES, WORC, DASH, QuickDASH, lost-to-follow-up) has been retired. The four convenience PROMs were removed from the IG entirely; lost-to-follow-up was relocated to Layer 3 (`L3.H.4`) as the operational pattern it actually is. The mapping is now **two-layer (Hurley + Layer 3)**. The honesty-rebaseline framing this ADR established (count only what consensus names) is preserved and tightened; the body below is unedited for audit trail.

> **Status update (2026-05-19, ADR-0039):** A second-pass word-by-word audit caught two further inflation errors and one accounting gap this ADR did not close: `Q12-SSV` + `Q12-SANE` collapsed into one `Q12-SSV-SANE` (Hurley's slash is dual-name notation for one instrument — confirmed in the paper's Discussion: *"the Constant score and SSV/SANE"*); Q7 ultrasound (60% — no consensus) removed from the Hurley denominator and relocated to a new **Layer 3** that enumerates 37 IG-operational elements the IG carries beyond what Hurley names. Net: Hurley denominator 60 → 58; Full 43 → 42; Partial 17 → 16. The two-layer model this ADR introduced (Hurley + Supplementary) is preserved and extended; the body below is unedited for audit trail.

## Context

ADR-0027 (2026-05-11) closed all previously Missing SECEC elements and reported the resulting coverage as **44 Full + 24 Partial + 0 Missing of 68 elements (100% Full+Partial, 64.7% Full)**. That denominator (68) was derived from a decomposition of Hurley A12 into ten sub-elements (Q12.1–Q12.10) that included ASES, WORC, DASH, and QuickDASH alongside Constant, SSV, SANE, and VAS pain.

On 2026-05-18, during the Constant-Murley → SNOMED CT migration (`273383002`) and subsequent DASH → SNOMED CT migration (`444875003`), a re-read of Hurley et al. (2024) revealed that the Q12.1–Q12.10 decomposition was a **fabrication**. Hurley's A12 specifies, in the paper text:

> "The components that should be included in a patient-reported outcome measure are **a) Pain, b) Strength, c) Function/limitations, d) Range of motion, e) Return to sport/work, f) Impact on daily activities, and g) Satisfaction**. The preferred clinical outcome scores are the **Constant score and subjective shoulder value/single assessment numeric evaluation score**."

So A12 actually defines:
1. Seven required PROM **components** (a–g), and
2. Three **preferred instruments** (Constant, SSV, SANE).

**ASES, WORC, DASH, QuickDASH, and EQ-5D are nowhere in the paper.** They are common clinical PROMs in the shoulder literature but are not part of the SECEC Delphi consensus output. Their inclusion as numbered "Q12.1 / Q12.3 / Q12.7 / Q12.8" sub-elements falsely inflated the consensus denominator and the headline coverage figure.

A parallel audit of the other Q-sections found additional over-decompositions of single-statement Hurley questions:
- **A3** (radiographs in all suspected RC tears): one consensus statement → CSV had 3 sub-rows (performed / views / findings).
- **A5** (advanced imaging when planning surgery): one statement → 3 sub-rows.
- **A6** (MRI default, CT for arthroplasty): one statement → 3 sub-rows.
- **A7** (no consensus on ultrasound): one statement → 2 sub-rows.
- **A10** (routine follow-up 6 mo – 1 y): one statement → 2 sub-rows.
- **A13** (no routine FU imaging except in research): one statement → 2 sub-rows.
- **A1(f)** (prior PT/injections, one bundled consensus item): split into Q1.6 + Q1.7 in the CSV.
- **A11** (5 named research timepoints a–e): CSV did not enumerate the 5 timepoints but introduced 3 operational-metadata rows instead.

Net: the inflation/under-decomposition net is **+8 elements** (true Hurley count: 60; previously claimed: 68).

The user-provided rule during the SNOMED migration session was unambiguous: *"if it is in the Hurley paper use it, if not do not use it."* Applied consistently, this means SECEC coverage statistics must be reported against an honest, Hurley-anchored denominator.

The thesis prose was checked before deciding the correction strategy. Only one active prose line in the thesis Results chapter references Q12 instruments at all, and it already lists them Hurley-faithfully ("Constant-Murley, SSV/SANE, VAS pain, satisfaction, return to activity") without invoking the fabricated sub-numbering. All inflated numerical claims in the thesis chapters were commented-out drafts. Rewrite risk: **low**.

The user-confirmed strategy (2026-05-18) is a **two-layer model**: re-baseline the SECEC layer to Hurley faithfulness; preserve the four implementation-added shoulder PROMs in a separate Supplementary layer so they remain available to registries that want them, without inflating the SECEC denominator.

## Decision

1. **Re-baseline the mapping to a Hurley-anchored decomposition of 60 elements**, using Hurley's own letter notation (`Q1.a` … `Q1.n` skipping `g`; `Q2.a` … `Q2.i`; `Q3` / `Q5` / `Q6` / `Q7` / `Q10` / `Q13` as single-statement elements; `Q4.a` … `Q4.e`; `Q8.a` … `Q8.e`; `Q9.a` … `Q9.g`; `Q11.a` … `Q11.e`; `Q12.a` … `Q12.g` for components plus `Q12-Constant`, `Q12-SSV`, `Q12-SANE` for preferred instruments).

2. **Move ASES, WORC, DASH, QuickDASH, and lost-to-follow-up tracking to a separate "Supplementary profiles" section** with IDs `S1` … `S5`. Supplementary entries are *not* counted toward the SECEC consensus denominator. They are documented as commonly used in clinical practice / shoulder registries but not specifically named in Hurley A12 (or, for lost-to-follow-up, in A11).

3. **Preserve all profile artifacts.** No `Observation` profiles are deleted. ASES, WORC, DASH, QuickDASH continue to be valid IG profiles — their classification as Supplementary changes only the accounting, not the implementation. (The user explicitly chose the two-layer model over a strict-fidelity option that would have deleted the four supplementary profiles.)

4. **Report two layers separately.** Mapping doc, `index.md`, and `profiles.md` now show "Hurley layer" (60 elements: 43 Full + 17 Partial + 0 Missing; 71.7% Full; 100% Full+Partial) and "Supplementary layer" (5 entries: 1 Full + 4 Partial) as distinct sections.

5. **Profile FSH descriptions** for the four supplementary PROMs replace `"Covers SECEC Q12.x"` with explicit language: `"Not named in Hurley A12 ... included as a commonly used shoulder PROM that, when administered, covers Hurley A12 components a–g. See ADR-0036."`

6. **ADR-0027 is not rewritten.** Its body is preserved for audit-trail purposes; a top-of-file status note points readers to this ADR.

7. **The April 2026 project status snapshot** is preserved unedited as a historical record, with a one-line forward-pointer added at the top.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| **Strict Hurley fidelity** — delete ASES, WORC, DASH, QuickDASH profiles entirely | Loses clinically useful instruments that registries may want; undoes the just-completed DASH → SNOMED migration; reduces IG utility without strengthening Hurley fidelity beyond what the Supplementary section already achieves |
| **Pragmatic minimum** — fix only the misleading `"Covers SECEC Q12.x"` profile descriptions; leave the CSV's Q12 sub-numbering | The mapping doc would still mix Hurley-named and invented elements without separation; coverage statistics would remain inflated; the Q3/Q5/Q6/Q7/Q10/Q13/Q11 over- and under-decompositions would also remain unaddressed |
| **Rewrite ADR-0027 in place** | Loses the historical record that an inflated count existed and was self-identified; weaker audit trail for thesis defence |
| **Edit the historical snapshot** | Breaks the snapshot's value as a point-in-time record; mirrors the project's established archive-directory rule for frozen historical reference |
| **Dual-coding the supplementary PROMs (SNOMED + local)** as a way to retain them while pretending they cover named Hurley elements | The fundamental issue is denominator inflation, not code-system choice; dual-coding doesn't make a non-Hurley instrument part of Hurley |

## Consequences

✅ Honest, Hurley-anchored coverage denominator (60) — strongest scientific defensibility for thesis defence.

✅ Two-layer model preserves all working profiles; registries can still use ASES/WORC/DASH/QuickDASH from the Supplementary section.

✅ Element IDs use Hurley's own letter notation, making it trivial to cross-check any IG claim against the paper.

✅ Audit trail intact: ADR-0027 preserved unedited with forward-pointer; April 2026 snapshot preserved unedited with forward-pointer.

✅ Two SNOMED CT bindings landed during the same work cycle (Constant `273383002`, DASH `444875003`) and remain in place; DASH now sits in the Supplementary section but keeps its SNOMED binding.

⚠️ Headline "Full" count drops from 46 → 43 in the SECEC layer (44 → 43 if we subtract the now-Full DASH that moved to Supplementary; +1 for Constant SNOMED migration). The "Full+Partial" headline (100%) is preserved.

⚠️ Headline element count drops from 68 → 60 in the SECEC layer — readers comparing this IG to the prior "68 elements" figure (in ADR-0027, the April snapshot, and earlier `index.md` versions) will see the change. The mapping doc's "What Changed" section documents this prominently.

⚠️ Coverage percentages have shifted: 64.7% Full → 71.7% Full (Hurley layer only). The Full % went *up* because the removed fabricated rows were predominantly Partial.

⚠️ Bikkanuri et al. (2024) 80% Full+Partial benchmark comparison is unaffected — the IG still substantially exceeds it.

## Sources

- Hurley ET et al. (2024). European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus. *JSES International* 8(3):478–482. [doi:10.1016/j.jseint.2024.01.015](https://doi.org/10.1016/j.jseint.2024.01.015). Full text retrieved from Zotero (item key `TU27GN8G`) and read in full during the 2026-05-18 audit.
- `mapping/SECEC_FHIR_Mapping.csv` — restructured with Hurley-anchored IDs + Supplementary section.
- `mapping/SECEC_FHIR_Mapping.md` — v2 re-baselined executive summary, per-section table, "What Changed" section.
- `: ig/input/pagecontent/index.md` — Scope section rewritten with honest denominator.
- `: ig/input/pagecontent/profiles.md` — PROM table split into "Hurley A12 preferred instruments" and "Supplementary shoulder PROMs".
- `: ig/input/fsh/profiles/observations/{Ases,Worc,Dash,QuickDash,Constant,Ssv,Sane,PainSeverity}ScoreObservation.fsh` — descriptions updated.
- ADR-0027 — `0027-complete-secec-coverage-standard-terminologies.md`, amended with top-of-file status note. Body preserved for audit.
- ADR-0032 — `0032-value-set-scope-and-provenance.md`. Establishes the editorial-scope-and-provenance framing that this ADR extends to the supplementary-PROMs justification.
- the April 2026 project status snapshot — historical snapshot, preserved with forward-pointer.
