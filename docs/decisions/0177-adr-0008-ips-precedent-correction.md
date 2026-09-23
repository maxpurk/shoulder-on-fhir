# ADR-0177: Correct ADR-0008's IPS precedent claim — IPS Observation profiles do not share an abstract intermediate base

**Date:** 2026-08-23
**Status:** Accepted
**Amends:** ADR-0008 (one Consequences bullet)
**Builds on:** ADR-0008 (the ADR whose stated precedent this corrects — its decision, 57 derived Observation profiles, is unaffected)

## Context

ADR-0008's Consequences section states:

> ✅ Follows the US Core / IPS base + derived pattern — standard and recognizable

This was checked against the actual IPS FSH source already vendored in this repo for reference, IPS's own `Observation*.fsh` FSH sources (7 files: `ObservationAlcoholUseUvIps`, `ObservationPregnancyEddUvIps`, `ObservationPregnancyOutcomeUvIps`, `ObservationPregnancyStatusUvIps`, `ObservationResultsLaboratoryPathologyUvIps`, `ObservationResultsRadiologyUvIps`, `ObservationTobaccoUseUvIps`). Every one of them declares `Parent: Observation` — i.e. each IPS Observation profile derives directly from the FHIR core `Observation` resource. There is no IPS-specific abstract intermediate profile (no `ObservationUvIps` or similar) that any of them share. IPS does *not* use an abstract-base-plus-derived-children architecture for its Observation profiles; it uses seven independent leaf profiles.

The US Core half of the same claim was checked separately (HL7 US Core IG, `us-core-vital-signs`) and holds: `us-core-vital-signs` is itself a base profile that further profiles (`us-core-blood-pressure`, `us-core-bmi`, `us-core-body-height`, etc.) derive from, and US Core additionally ships `us-core-simple-observation` as a shared parent for several lab/simple-result profiles. So "Follows the US Core... pattern" is accurate; "...and IPS..." is not.

This inaccuracy was also present in two other places, corrected together with ADR-0008:
- The project FAQ entry on the Observation profile count, which repeated ADR-0008's claim as "This is the same pattern HL7's US Core (~20 Observation profiles) and IPS use."
- `ig/input/fsh/profiles/ShoulderObservation.fsh`'s own `Description` block — "Child profiles follow the base + derived pattern used by US Core and IPS." — the most consequential occurrence, since `Description` is published verbatim into the built IG HTML output (a claim about another IG's architecture, shipped to every reader of the IG).

A stronger, more directly official replacement precedent was identified and verified for all three: FHIR R4 core's own `vitalsigns` profile is itself a base that `bodyheight`, `bodyweight`, `bloodpressure`, `bodytemp`, `heartrate`, `resprate`, `oxygensat`, and `headcircum` derive from — confirmed by fetching each StructureDefinition's canonical JSON directly (`https://hl7.org/fhir/R4/vitalsigns.profile.json`, `https://hl7.org/fhir/R4/bodyheight.profile.json`): `bodyheight.baseDefinition == "http://hl7.org/fhir/StructureDefinition/vitalsigns"`, `bodyheight.derivation == "constraint"`. This is the base FHIR standard itself, not just a downstream IG — a more authoritative precedent than either US Core or IPS. One honest nuance: `vitalsigns` itself has `abstract: false` (it can be instantiated directly as a generic vital-sign Observation), whereas `ShoulderObservation` is `^abstract = true` (cannot be instantiated on its own). The core mechanism being cited — a shared parent profile that derived children narrow by fixing `code` + `value[x]` type — is unaffected by that difference.

## Decision

Correct the precedent claim to name only what each source IG actually demonstrates:

> ✅ Follows the US Core base + derived pattern (`us-core-vital-signs` → `us-core-blood-pressure` etc.) — standard and recognizable. IPS's own Observation profiles (IPS's own `Observation*.fsh` FSH sources) do not share an abstract intermediate the way `ShoulderObservation` does — each derives directly from core `Observation` — so IPS is not a precedent for the *abstract-base* half of this design, only (loosely) for "one profile per measurement type" as a general IG habit.

The underlying decision — abstract base profile + 57 derived child profiles, one per measurement code — is **unchanged and unaffected**. Only the stated precedent is corrected. ADR-0008's original text is left in place (per this project's ADR-correction convention, e.g. ADR-0080 on ADR-0071/0079, ADR-0160 on ADR-0008's slicing rationale) with a pointer to this ADR, rather than being silently rewritten.

the project FAQ entry on the Observation profile count and `ShoulderObservation.fsh`'s `Description` block are both corrected directly (a living FAQ file and a published-but-non-ADR IG artifact, not frozen ADR text) to drop the IPS half of the precedent claim and cite the FHIR-core `vitalsigns`/US Core precedent instead.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave ADR-0008 as originally written | The claim is checkably false against IPS's own FSH source, already vendored in this repo for exactly this kind of comparison; leaving it risks misstating another IG's architecture to any thesis reader who verifies the claim. |
| Silently edit ADR-0008's bullet in place, no trace of the correction | Against this project's established ADR convention — corrections are recorded as a new dated ADR that amends the old one (precedent: ADR-0080, ADR-0160). |
| Also claim mCODE as a precedent | Not checked here; out of scope — the correction only touches the claim actually made (US Core, IPS). |

## Consequences

✅ ADR-0008's precedent claim now matches the actual IPS FSH source vendored in this repo
✅ The FAQ answering "why 57 Observation profiles" no longer overstates IPS's architecture
✅ The published IG HTML output (`ShoulderObservation`'s own `Description`) no longer ships the same overclaim to external readers — the highest-stakes of the three occurrences, since it wasn't internal-only like the ADR/FAQ
✅ The underlying architecture (57 derived Observation profiles) is fully unaffected — this ADR only fixes the *precedent claim*, not the *decision*
⚠️ Requires a `sushi .` + `seed/load-profiles.sh` (or `--reload-ig`) pass and, if the HTML site is already published, a `--genonce` rebuild, to actually update the live IG output — not run as part of authoring this ADR
⚠️ Any thesis text repeating "US Core / IPS base + derived pattern" verbatim should be checked against the corrected claim — not verified as part of this ADR

## Sources

- IPS's own `ObservationAlcoholUseUvIps.fsh` FSH sources, `ObservationPregnancyEddUvIps.fsh`, `ObservationPregnancyOutcomeUvIps.fsh`, `ObservationPregnancyStatusUvIps.fsh`, `ObservationResultsLaboratoryPathologyUvIps.fsh`, `ObservationResultsRadiologyUvIps.fsh`, `ObservationTobaccoUseUvIps.fsh` — all seven declare `Parent: Observation` directly
- HL7 FHIR R4 core — `https://hl7.org/fhir/R4/vitalsigns.profile.json` (id `vitalsigns`, url `http://hl7.org/fhir/StructureDefinition/vitalsigns`, `abstract: false`) and `https://hl7.org/fhir/R4/bodyheight.profile.json` (`baseDefinition: "http://hl7.org/fhir/StructureDefinition/vitalsigns"`, `derivation: "constraint"`) — fetched and inspected directly 2026-08-23; the same base+derived relationship holds for `bodyweight`, `bloodpressure`, `bodytemp`, `heartrate`, `resprate`, `oxygensat`, `headcircum` per https://hl7.org/fhir/R4/observation-vitalsigns.html
- HL7 US Core IG — `us-core-vital-signs` StructureDefinition (base for `us-core-blood-pressure`, `us-core-bmi`, etc.) and `us-core-simple-observation`: https://hl7.org/fhir/us/core/StructureDefinition-us-core-vital-signs.html
- `docs/decisions/0008-abstract-base-27-derived-observation-profiles.md` (ADR-0008) — the ADR being corrected
- The project FAQ entry on the Observation profile count — corrected alongside this ADR
- `ig/input/fsh/profiles/ShoulderObservation.fsh` — published `Description` text corrected alongside this ADR
