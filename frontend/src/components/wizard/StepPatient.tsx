import type { Condition, Coverage, Observation, Patient, Procedure, WizardEntry } from '../../types/fhir'
import {
  HAND_DOMINANCE,
  IPS_ABSENT_UNKNOWN,
  LOINC_SYSTEM,
  OBSERVATION_CODINGS,
  OBSERVATION_PROFILE_URLS,
  PRIOR_TREATMENT_CODES,
  PROCEDURE_CATEGORY,
  PROFILE_URLS,
  RSG_EXT_URL,
  RSG_TYPE_DISPLAY,
  RSG_TYPE_LOINC,
  SHOULDER_REGION_DISORDERS_EXCLUSION_VS,
  VALUESET_URLS,
} from '../../types/fhir'
import { useValueSet } from '../../hooks/useValueSet'
import SnomedTypeahead from '../shared/SnomedTypeahead'
import type { ComorbidityCoded, PatientFormData } from './stepFormData'

const CONDITION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-category'
const CONDITION_CLINICAL_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-clinical'
const CONDITION_VER_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-ver-status'

const ADMIN_GENDER_SYSTEM = 'http://hl7.org/fhir/administrative-gender'
const ADMIN_GENDER_DISPLAYS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Unknown',
}

// Hurley Q1.l "workmen's compensation" — a single yes/no patient-history flag
// in the unanimous-consensus list (Hurley 2024, Q1). The IG realises a "yes"
// answer as a ShoulderCoverage with `Coverage.type = v3-ActCode#WCBPOL`
// (Berufsgenossenschaft in the German context); a "no" or "unknown" answer
// emits no Coverage resource. Broader payer categorisation (GKV/PKV/
// Selbstzahler) is intentionally out of scope — not Hurley-named, and the
// v3-ActCode mapping is partial for German payers anyway (no exact PKV code).
// See ADR-0061.
const V3_ACTCODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode'
const WORKERS_COMP_CODE = { system: V3_ACTCODE_SYSTEM, code: 'WCBPOL', display: "worker's compensation" }
const WORKERS_COMP_DE_LABEL = 'Berufsgenossenschaft (BG)'

interface StepPatientProps {
  patientUuid: string
  conditionUuid: string
  encounterUuid: string
  value: PatientFormData
  onChange: (next: PatientFormData) => void
  onComplete: (entries: WizardEntry[]) => void
}

function StepPatient({ patientUuid, conditionUuid, encounterUuid, value: formData, onChange, onComplete }: StepPatientProps) {
  const { options: handDominanceOptions } = useValueSet(VALUESET_URLS.HAND_DOMINANCE)
  const { options: smokingOptions } = useValueSet(VALUESET_URLS.SMOKING_STATUS)
  const { options: sleepDisturbanceOptions } = useValueSet(VALUESET_URLS.SLEEP_DISTURBANCE_SEVERITY)
  const { options: employmentStatusOptions } = useValueSet(VALUESET_URLS.EMPLOYMENT_STATUS)
  const { options: occupationalPhysicalDemandOptions } = useValueSet(VALUESET_URLS.OCCUPATIONAL_PHYSICAL_DEMAND)
  const { options: occupationalOverheadExposureOptions } = useValueSet(VALUESET_URLS.OCCUPATIONAL_OVERHEAD_EXPOSURE)
  const { options: sportsParticipationLevelOptions } = useValueSet(VALUESET_URLS.SPORTS_PARTICIPATION_LEVEL)
  const { options: functionalLimitationSeverityOptions } = useValueSet(VALUESET_URLS.FUNCTIONAL_LIMITATION_SEVERITY)
  const { options: priorPhysicalTherapySessionCountOptions } = useValueSet(VALUESET_URLS.PRIOR_PHYSICAL_THERAPY_SESSION_COUNT)
  const { options: priorInjectionCountOptions } = useValueSet(VALUESET_URLS.PRIOR_INJECTION_COUNT)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value: fieldValue } = e.target
    onChange({ ...formData, [name]: fieldValue })
  }

  const handlePriorTreatmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    const countField = name === 'priorPhysicalTherapy' ? 'priorPhysicalTherapySessionCount' : 'priorInjectionCount'
    onChange({ ...formData, [name]: value, ...(value !== 'yes' && { [countField]: '' }) })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const patient: Patient = {
      resourceType: 'Patient',
      meta: { profile: [PROFILE_URLS.PATIENT] },
      identifier: [{ system: 'https://maxpurk.github.io/shoulder-on-fhir/identifier/patient', value: formData.patientId }],
      name: [{ use: 'official', family: formData.familyName, ...(formData.givenName.trim() && { given: formData.givenName.trim().split(/\s+/) }) }],
      gender: formData.gender as Patient['gender'],
      birthDate: formData.birthDate,
      ...(formData.phone && {
        telecom: [{ system: 'phone', value: formData.phone, use: 'home' }],
      }),
      ...(formData.street || formData.city
        ? {
            address: [
              {
                use: 'home',
                line: formData.street ? [formData.street] : undefined,
                city: formData.city || undefined,
                postalCode: formData.postalCode || undefined,
                country: 'DE',
              },
            ],
          }
        : {}),
      // HL7 Gender Harmony RSG — complex extension, type pinned to LOINC
      // 76689-9 "Sex assigned at birth" per ADR-0053.
      ...(formData.sexAtBirth && {
        extension: [
          {
            url: RSG_EXT_URL,
            extension: [
              {
                url: 'value',
                valueCodeableConcept: {
                  coding: [{
                    system: ADMIN_GENDER_SYSTEM,
                    code: formData.sexAtBirth,
                    display: ADMIN_GENDER_DISPLAYS[formData.sexAtBirth],
                  }],
                },
              },
              {
                url: 'type',
                valueCodeableConcept: {
                  coding: [{
                    system: LOINC_SYSTEM,
                    code: RSG_TYPE_LOINC,
                    display: RSG_TYPE_DISPLAY,
                  }],
                },
              },
            ],
          },
        ],
      }),
    }

    const entries: WizardEntry[] = [{ uuid: patientUuid, resource: patient }]
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const encounterRef = { reference: `urn:uuid:${encounterUuid}` }
    const conditionRef = { reference: `urn:uuid:${conditionUuid}` }

    if (formData.handDominance) {
      const handDominanceObs: Observation = {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS['hand-dominance']] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history', display: 'Social History' }] }],
        code: { coding: [OBSERVATION_CODINGS['hand-dominance']] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: encounterRef,
        effectiveDateTime: now,
        valueCodeableConcept: {
          coding: [{
            system: HAND_DOMINANCE.SYSTEM,
            code: formData.handDominance,
            display: handDominanceOptions.find((o) => o.code === formData.handDominance)?.display,
          }],
        },
      }
      entries.push({ uuid: crypto.randomUUID(), resource: handDominanceObs })
    }

    const socialHistoryCategory = [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history', display: 'Social History' }],
    }]

    const makeObservation = (key: string, value: Partial<Observation>): Observation => ({
      resourceType: 'Observation',
      meta: { profile: [OBSERVATION_PROFILE_URLS[key]] },
      status: 'final',
      category: socialHistoryCategory,
      code: { coding: [OBSERVATION_CODINGS[key]] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      effectiveDateTime: now,
      ...value,
    })

    if (formData.smokingStatus) {
      const smokingOption = smokingOptions.find((o) => o.code === formData.smokingStatus)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('smoking-status', {
          valueCodeableConcept: {
            coding: [{ system: smokingOption?.system, code: formData.smokingStatus, display: smokingOption?.display }],
          },
        }),
      })
    }

    if (formData.smokingPackYears) {
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('smoking-pack-years', {
          valueQuantity: {
            value: Number(formData.smokingPackYears),
            unit: 'pack-years',
            system: 'http://unitsofmeasure.org',
            code: '{pack-years}',
          },
        }),
      })
    }

    if (formData.employmentStatus) {
      const employmentStatusOption = employmentStatusOptions.find((o) => o.code === formData.employmentStatus)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('employment-status', {
          valueCodeableConcept: {
            coding: [{
              system: employmentStatusOption?.system,
              code: formData.employmentStatus,
              display: employmentStatusOption?.display,
            }],
          },
        }),
      })
    }

    if (formData.occupationalPhysicalDemand) {
      const occupationalPhysicalDemandOption = occupationalPhysicalDemandOptions.find((o) => o.code === formData.occupationalPhysicalDemand)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('occupational-physical-demand', {
          valueCodeableConcept: {
            coding: [{
              system: occupationalPhysicalDemandOption?.system,
              code: formData.occupationalPhysicalDemand,
              display: occupationalPhysicalDemandOption?.display,
            }],
          },
        }),
      })
    }

    if (formData.occupationalOverheadExposure) {
      const overheadOption = occupationalOverheadExposureOptions.find((o) => o.code === formData.occupationalOverheadExposure)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('occupational-overhead-exposure', {
          valueCodeableConcept: {
            coding: [{
              system: overheadOption?.system,
              code: formData.occupationalOverheadExposure,
              display: overheadOption?.display,
            }],
          },
        }),
      })
    }

    if (formData.sleepDisturbance) {
      const sleepDisturbanceOption = sleepDisturbanceOptions.find((o) => o.code === formData.sleepDisturbance)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('sleep-disturbance', {
          valueCodeableConcept: {
            coding: [{
              system: sleepDisturbanceOption?.system,
              code: formData.sleepDisturbance,
              display: sleepDisturbanceOption?.display,
            }],
          },
        }),
      })
    }

    if (formData.sportsParticipation) {
      const sportsParticipationOption = sportsParticipationLevelOptions.find((o) => o.code === formData.sportsParticipation)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('sports-participation', {
          valueCodeableConcept: {
            coding: [{
              system: sportsParticipationOption?.system,
              code: formData.sportsParticipation,
              display: sportsParticipationOption?.display,
            }],
          },
        }),
      })
    }

    if (formData.functionalLimitations) {
      const functionalLimitationOption = functionalLimitationSeverityOptions.find((o) => o.code === formData.functionalLimitations)
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makeObservation('functional-limitations', {
          valueCodeableConcept: {
            coding: [{
              system: functionalLimitationOption?.system,
              code: formData.functionalLimitations,
              display: functionalLimitationOption?.display,
            }],
          },
        }),
      })
    }

    // Prior PT and prior shoulder injection use the dedicated priorTreatment
    // category codes that PriorTreatmentCategoryVS binds (ADR-0034). The
    // RotatorCuffRegistrationBundle's priorTreatment slice rejects any other
    // category — surgical-category procedures belong in RotatorCuffSurgeryBundle.
    // `performedDateTime` defaults to the registration date — the exact
    // treatment date was judged clinically unhelpful (surgeon feedback,
    // ADR-0105) and replaced by a bucketed session/injection count instead;
    // `performed[x]` stays 1..1 on RotatorCuffProcedure (FHIR-required), so a
    // placeholder value is still needed to satisfy the profile.
    const makePriorProcedure = (
      treatment: { system: string; code: string; display: string },
      category: { system: string; code: string; display: string },
    ): Procedure => ({
      resourceType: 'Procedure',
      meta: { profile: [PROFILE_URLS.PROCEDURE] },
      status: 'completed',
      category: { coding: [category] },
      code: { coding: [{ system: treatment.system, code: treatment.code, display: treatment.display }] },
      subject: { reference: `urn:uuid:${patientUuid}` },
      encounter: encounterRef,
      performedDateTime: today,
      reasonReference: [conditionRef],
    })

    if (formData.priorPhysicalTherapy === 'yes') {
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makePriorProcedure(PRIOR_TREATMENT_CODES.PHYSICAL_THERAPY, PROCEDURE_CATEGORY.PHYSICAL_THERAPY),
      })
      if (formData.priorPhysicalTherapySessionCount) {
        const sessionCountOption = priorPhysicalTherapySessionCountOptions.find((o) => o.code === formData.priorPhysicalTherapySessionCount)
        entries.push({
          uuid: crypto.randomUUID(),
          resource: makeObservation('prior-physical-therapy-session-count', {
            valueCodeableConcept: {
              coding: [{
                system: sessionCountOption?.system,
                code: formData.priorPhysicalTherapySessionCount,
                display: sessionCountOption?.display,
              }],
            },
          }),
        })
      }
    }
    if (formData.priorInjection === 'yes') {
      entries.push({
        uuid: crypto.randomUUID(),
        resource: makePriorProcedure(PRIOR_TREATMENT_CODES.SHOULDER_INJECTION, PROCEDURE_CATEGORY.MEDICATION_ADMIN),
      })
      if (formData.priorInjectionCount) {
        const injectionCountOption = priorInjectionCountOptions.find((o) => o.code === formData.priorInjectionCount)
        entries.push({
          uuid: crypto.randomUUID(),
          resource: makeObservation('prior-injection-count', {
            valueCodeableConcept: {
              coding: [{
                system: injectionCountOption?.system,
                code: formData.priorInjectionCount,
                display: injectionCountOption?.display,
              }],
            },
          }),
        })
      }
    }

    // Coverage (expert consensus Q1.l "workmen's compensation") — emitted only when the
    // user answers 'yes' to the WC flag. Realised as a ShoulderCoverage with
    // `Coverage.type = v3-ActCode#WCBPOL` on the registration bundle's
    // `coverage` slice (0..1). 'no' and 'unknown' emit no Coverage resource.
    // See ADR-0061.
    if (formData.workersCompensation === 'yes') {
      const coverage: Coverage = {
        resourceType: 'Coverage',
        meta: { profile: [PROFILE_URLS.COVERAGE] },
        status: 'active',
        type: {
          coding: [WORKERS_COMP_CODE],
          text: WORKERS_COMP_DE_LABEL,
        },
        subscriber: { reference: `urn:uuid:${patientUuid}` },
        beneficiary: { reference: `urn:uuid:${patientUuid}` },
        payor: [{ display: WORKERS_COMP_DE_LABEL }],
      }
      entries.push({ uuid: crypto.randomUUID(), resource: coverage })
    }

    // Comorbidities (expert consensus Q1.c) — tri-state on `comorbidityStatus`:
    //   'specific'   — one ShoulderComorbidityCondition per selected SNOMED code.
    //   'none-known' — one Condition with IPS `no-known-problems`.
    //   'no-info'    — one Condition with IPS `no-problem-info`.
    // Carried on the registration bundle's `comorbidity` slice (ADR-0055).
    if (formData.comorbidityStatus === 'specific') {
      for (const item of formData.comorbidities) {
        const comorbidity: Condition = {
          resourceType: 'Condition',
          meta: { profile: [PROFILE_URLS.COMORBIDITY_CONDITION] },
          clinicalStatus: { coding: [{ system: CONDITION_CLINICAL_SYSTEM, code: 'active', display: 'Active' }] },
          verificationStatus: { coding: [{ system: CONDITION_VER_STATUS_SYSTEM, code: 'confirmed', display: 'Confirmed' }] },
          category: [{ coding: [{ system: CONDITION_CATEGORY_SYSTEM, code: 'problem-list-item', display: 'Problem List Item' }] }],
          code: { coding: [{ system: item.system, code: item.code, display: item.display }], text: item.display },
          subject: { reference: `urn:uuid:${patientUuid}` },
          recordedDate: today,
        }
        entries.push({ uuid: crypto.randomUUID(), resource: comorbidity })
      }
    } else {
      const absentCode = formData.comorbidityStatus === 'none-known'
        ? IPS_ABSENT_UNKNOWN.NO_KNOWN_PROBLEMS
        : IPS_ABSENT_UNKNOWN.NO_PROBLEM_INFO
      const absentCondition: Condition = {
        resourceType: 'Condition',
        meta: { profile: [PROFILE_URLS.COMORBIDITY_CONDITION] },
        clinicalStatus: { coding: [{ system: CONDITION_CLINICAL_SYSTEM, code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: CONDITION_VER_STATUS_SYSTEM, code: 'confirmed', display: 'Confirmed' }] },
        category: [{ coding: [{ system: CONDITION_CATEGORY_SYSTEM, code: 'problem-list-item', display: 'Problem List Item' }] }],
        code: { coding: [{ system: IPS_ABSENT_UNKNOWN.SYSTEM, code: absentCode.code, display: absentCode.display }] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        recordedDate: today,
      }
      entries.push({ uuid: crypto.randomUUID(), resource: absentCondition })
    }

    onComplete(entries)
  }

  const setComorbidities = (next: ComorbidityCoded[]) => {
    onChange({ ...formData, comorbidities: next })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-4">
        <h3 className="card-header">Demographics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Given Name(s) *</label>
            <input
              type="text"
              name="givenName"
              value={formData.givenName}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Family Name *</label>
            <input
              type="text"
              name="familyName"
              value={formData.familyName}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Schmidt"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth *</label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gender *</label>
            <p className="text-xs text-gray-500 mb-1">Administrative gender (FHIR base).</p>
            <select name="gender" value={formData.gender} onChange={handleChange} required className="form-input">
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sex Assigned at Birth</label>
            <p className="text-xs text-gray-500 mb-1">Optional — separate from administrative gender above.</p>
            <select name="sexAtBirth" value={formData.sexAtBirth} onChange={handleChange} className="form-input">
              <option value="">— (not specified)</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Hand Dominance</label>
            <select name="handDominance" value={formData.handDominance} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {handDominanceOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Patient ID</label>
            <input
              type="text"
              name="patientId"
              value={formData.patientId}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="card-header">Contact Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group sm:col-span-2">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              placeholder="+49 30 12345678"
            />
          </div>
          <div className="form-group sm:col-span-2">
            <label className="form-label">Street Address</label>
            <input
              type="text"
              name="street"
              value={formData.street}
              onChange={handleChange}
              className="form-input"
              placeholder="Musterstraße 123"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Postal Code</label>
            <input
              type="text"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              className="form-input"
              placeholder="14482"
            />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="form-input"
              placeholder="Potsdam"
            />
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="card-header">Patient History</h3>
        <p className="text-xs text-gray-500 mb-3">All fields optional.</p>

        <h4 className="font-medium text-gray-700 mb-3">Lifestyle &amp; Social History</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">Smoking Status</label>
            <select name="smokingStatus" value={formData.smokingStatus} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {smokingOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Pack-Years</label>
            <input
              type="number"
              name="smokingPackYears"
              min="0"
              step="0.1"
              value={formData.smokingPackYears}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Sleep Disturbance (due to shoulder)</label>
            <p className="text-xs text-gray-500 mb-1">
              How much shoulder pain disturbs sleep — matches the Constant-Murley score's own sleep sub-item, not
              generic sleep quality.
            </p>
            <select name="sleepDisturbance" value={formData.sleepDisturbance} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {sleepDisturbanceOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sports Participation</label>
            <select name="sportsParticipation" value={formData.sportsParticipation} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {sportsParticipationLevelOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Occupation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="form-group">
            <label className="form-label">Employment Status</label>
            <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {employmentStatusOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Occupational Physical Demand (Intensity)</label>
            <select name="occupationalPhysicalDemand" value={formData.occupationalPhysicalDemand} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {occupationalPhysicalDemandOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Occupational Overhead Work</label>
            <select name="occupationalOverheadExposure" value={formData.occupationalOverheadExposure} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {occupationalOverheadExposureOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Workers' Compensation / Berufsgenossenschaft</label>
            <select name="workersCompensation" value={formData.workersCompensation} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              <option value="yes">Yes — care under workers'-comp regime (BG)</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Functional Status &amp; Prior Treatment</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="form-group sm:col-span-2">
            <label className="form-label">Functional Limitations</label>
            <p className="text-xs text-gray-500 mb-1">
              Highest functional plane still limited by the shoulder — a quick baseline gestalt, distinct from the
              Constant-Murley ADL sub-score captured later at follow-up.
            </p>
            <select name="functionalLimitations" value={formData.functionalLimitations} onChange={handleChange} className="form-input">
              <option value="">Select…</option>
              {functionalLimitationSeverityOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prior Physical Therapy</label>
            <p className="text-xs text-gray-500 mb-1">For this shoulder condition specifically.</p>
            <select name="priorPhysicalTherapy" value={formData.priorPhysicalTherapy} onChange={handlePriorTreatmentChange} className="form-input">
              <option value="">Select…</option>
              <option value="yes">Yes — PT received</option>
              <option value="no">No</option>
            </select>
            {formData.priorPhysicalTherapy === 'yes' && (
              <div className="mt-2">
                <label htmlFor="priorPhysicalTherapySessionCount" className="form-label">Number of sessions *</label>
                <select
                  id="priorPhysicalTherapySessionCount"
                  name="priorPhysicalTherapySessionCount"
                  value={formData.priorPhysicalTherapySessionCount}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Select…</option>
                  {priorPhysicalTherapySessionCountOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Prior Shoulder Injection</label>
            <p className="text-xs text-gray-500 mb-1">For this shoulder condition specifically.</p>
            <select name="priorInjection" value={formData.priorInjection} onChange={handlePriorTreatmentChange} className="form-input">
              <option value="">Select…</option>
              <option value="yes">Yes — injection received</option>
              <option value="no">No</option>
            </select>
            {formData.priorInjection === 'yes' && (
              <div className="mt-2">
                <label htmlFor="priorInjectionCount" className="form-label">Number of injections *</label>
                <select
                  id="priorInjectionCount"
                  name="priorInjectionCount"
                  value={formData.priorInjectionCount}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Select…</option>
                  {priorInjectionCountOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <h4 className="font-medium text-gray-700 mb-3">Comorbidities</h4>
        <div className="grid grid-cols-1 gap-4">
          <div className="form-group">
            <div className="flex flex-col gap-2 mb-2">
              {([
                ['specific', 'Add specific comorbidities (SNOMED)'],
                ['none-known', 'No known comorbidities (asked; none reported)'],
                ['no-info', 'No information available (not asked / unknown)'],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="comorbidityStatus"
                    value={val}
                    checked={formData.comorbidityStatus === val}
                    onChange={() => onChange({
                      ...formData,
                      comorbidityStatus: val,
                      comorbidities: val === 'specific' ? formData.comorbidities : [],
                    })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {formData.comorbidityStatus === 'specific' && (
              <SnomedTypeahead
                valueSetUrl={VALUESET_URLS.COMORBIDITY_TYPEAHEAD}
                excludeValueSetUrl={SHOULDER_REGION_DISORDERS_EXCLUSION_VS}
                value={formData.comorbidities}
                onChange={setComorbidities}
                placeholder="Type at least 2 characters (e.g. hypertension, diabetes)…"
                helpText="Pre-existing conditions NOT related to the shoulder (e.g. hypertension, diabetes) — shoulder-region conditions are captured as a Diagnosis, not a comorbidity."
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary">
          Next: Diagnosis →
        </button>
      </div>
    </form>
  )
}

export default StepPatient
