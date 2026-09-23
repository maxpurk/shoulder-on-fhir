Alias: $Q11 = https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/q11-timepoint
// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffResearchCarePlan Profile                                       │
// │  Research follow-up timepoints and milestones                             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: RotatorCuffResearchCarePlan
Parent: CarePlan
Id: rotator-cuff-research-care-plan
Title: "Rotator Cuff Research Care Plan"
Description: """
Profile for documenting the planned follow-up schedule for a rotator cuff
surgery registry participant (expert consensus Q11, research follow-up at 5 named
timepoints Q11.a–e: 6 weeks, 3 months, 6 months, 1 year, 2 years). Encodes the
minimum follow-up duration and research-defined assessment timepoints (e.g.
6 weeks, 3 months, 6 months, 12 months, 2 years post-surgery) so that
completeness of follow-up can be tracked and reported.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-research-care-plan"
* ^version = "0.4.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-08-04"

// ── Status ────────────────────────────────────────────────────────────────────
* status 1..1 MS

// ── Intent ────────────────────────────────────────────────────────────────────
* intent 1..1 MS
// Fixed to #plan for all research follow-up care plans
* intent = #plan

// ── Subject (Patient Reference) ───────────────────────────────────────────────
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ── Period (overall follow-up window) ────────────────────────────────────────
// period.start = index surgery date; period.end = minimum required follow-up end date
* period MS
* period.start MS
* period.end MS

// ── Activity (individual assessment timepoints) ───────────────────────────────
* activity MS
* activity.detail MS
* activity.detail.status MS
// scheduledTiming encodes the planned timepoint (e.g. 6 weeks, 12 months post-op)
* activity.detail.scheduledTiming MS
* activity.detail.description MS
// Discriminates which of the 5 Q11.a-e timepoints this activity represents, // set once, at CarePlan-creation time, by both frontends' auto-generator
// (ADR-0129); not an out-of-band update to an already-submitted resource.
* activity.detail.code MS
* activity.detail.code from Q11Timepoint (required)

// ── Activity slicing, one slice per expert consensus Q11 timepoint ────────────
// `activity.detail.code` is the discriminator this profile already names, so it
// is also what the slices discriminate on. Slicing makes each of the five
// timepoints addressable by element id, which lets a definition-based SDC
// Questionnaire declare `CarePlan.activity:sixWeeks.detail.scheduled[x].event`
// and take the code identifying the timepoint from this profile instead of
// restating it. Each slice constrains `scheduled[x]` to Timing for itself, which
// a scheduled research visit always is. Without that the element carries three
// types under every slice and an id walking into Timing is ambiguous, and a
// mustSupport flag alone compiles to nothing, because the unsliced element
// already carries it. Slicing is open and every slice optional, so a plan carrying
// fewer than five timepoints, or an additional activity outside the consensus
// set, still conforms.
* activity ^slicing.discriminator[0].type = #pattern
* activity ^slicing.discriminator[=].path = "detail.code"
* activity ^slicing.rules = #open
* activity ^slicing.description = "One activity per expert consensus Q11 research follow-up timepoint"
* activity contains
    sixWeeks 0..1 MS and
    threeMonths 0..1 MS and
    sixMonths 0..1 MS and
    oneYear 0..1 MS and
    twoYears 0..1 MS
* activity[sixWeeks].detail.code = $Q11#6-weeks
* activity[sixWeeks].detail.scheduled[x] only Timing
* activity[sixWeeks] ^short = "Expert consensus Q11.a, 6 weeks post-surgery"
* activity[threeMonths].detail.code = $Q11#3-months
* activity[threeMonths].detail.scheduled[x] only Timing
* activity[threeMonths] ^short = "Expert consensus Q11.b, 3 months post-surgery"
* activity[sixMonths].detail.code = $Q11#6-months
* activity[sixMonths].detail.scheduled[x] only Timing
* activity[sixMonths] ^short = "Expert consensus Q11.c, 6 months post-surgery"
* activity[oneYear].detail.code = $Q11#1-year
* activity[oneYear].detail.scheduled[x] only Timing
* activity[oneYear] ^short = "Expert consensus Q11.d, 1 year post-surgery"
* activity[twoYears].detail.code = $Q11#2-years
* activity[twoYears].detail.scheduled[x] only Timing
* activity[twoYears] ^short = "Expert consensus Q11.e, 2 years post-surgery"
