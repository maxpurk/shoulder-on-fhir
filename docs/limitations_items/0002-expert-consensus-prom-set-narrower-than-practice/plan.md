# Expert-consensus PROM set is narrower than real-world registry practice

> **Status:** Limitation — open, methodological boundary rather than a defect.

## Gap

WORC and QuickDASH — both explicitly considered and retired from this IG (ADR-0054, failed
Hurley et al.'s 80% Delphi consensus threshold) — are nonetheless the dominant real-world PROM
choice among comparator registries: PRULO uses WORC + QuickDASH, RePaRe uses QuickDASH, AAOS SER's
stack overlaps only on ASES/SANE. No two of the ten registries surveyed use the same PROM combination, and this IG's consensus-bound set (Constant-Murley + SSV/SANE)
isn't the modal choice in that landscape.

## Why it matters

This is a limitation inherited from the source consensus itself, not a modeling gap in how the IG
implements it. The IG treats the Hurley/SECEC Delphi panel as its authoritative information model,
so excluding non-consensus instruments is correct by construction — but it means PROM coverage
reads as narrower than practice against any single comparator registry.

## Note

Not something a future implementation cycle would "fix" without contradicting ADR-0054's own
honesty discipline. A methodological boundary to state, not an IG change to make.
