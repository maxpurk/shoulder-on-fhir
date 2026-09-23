# ADR-0009: FSH file organization by artifact type

**Date:** 2026-04-16
**Status:** Accepted

## Context

During early development, FSH artifacts were co-located in the same file regardless of type. For example, a profile FSH file might also contain an embedded ValueSet or CodeSystem. As the IG grew to 10 base profiles + 27 derived profiles + 5 CodeSystems + 11 ValueSets + 1 extension + 4 examples, this mixed layout made it hard to locate artifacts and caused SUSHI to compile mixed-purpose files unpredictably.

HL7 IG best practices (https://build.fhir.org/ig/FHIR/ig-guidance/) recommend organizing FSH by artifact type in dedicated subdirectories.

## Decision

Organize all FSH source files under `ig/input/fsh/` by artifact type:

```
ig/input/fsh/
├── profiles/                  # Base profiles (9 .fsh files)
│   └── observations/          # 27 derived observation child profiles
├── codesystems/               # 5 custom CodeSystem files
├── valuesets/                 # 11 ValueSet files
├── extensions/                # (currently empty; HandDominance moved to Observation per ADR-0026)
└── examples/                  # 4 example resource instances
```

Each file contains only artifacts of its declared type. Cross-artifact references use canonical URLs.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| One FSH file per profile (including embedded CodeSystems/ValueSets) | Caused mixed-type files; artifacts hard to find; inconsistent with HL7 guidance |
| Single `all.fsh` file | Not scalable; merge conflicts on all changes; SUSHI compiles fine but developer experience is poor |
| Group by clinical domain (e.g., `imaging.fsh`, `prom.fsh`) | Domain grouping crosscuts artifact types; ValueSets and profiles for the same domain would still need to be separated for tooling compatibility |

## Consequences

✅ Each directory has a single responsibility — easy to locate any artifact by type  
✅ Consistent with HL7 IG guidance and patterns used by US Core, IPS, and mCODE  
✅ SUSHI processes subdirectories automatically — no configuration change needed  
✅ Makes the IG structure legible to external reviewers (thesis committee, HL7 community)  
⚠️ 46 FSH files total across 5 directories — navigating requires knowing the type of the artifact you're looking for  

## Sources

- git commit `d331a08` — "refactor(ig): align FSH structure to IG best practices" — reorganized all FSH files into type-based subdirectories
- git commit `09a3256` — "refactor(ig): add bodySite slicing to RotatorCuffCondition and extract ShoulderObservationCodes to codesystems/" — completed the extraction of `ShoulderObservationCodes` into `codesystems/ShoulderObservation.fsh`
- `ig/input/fsh/` — current directory layout
