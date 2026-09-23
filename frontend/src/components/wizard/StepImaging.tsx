import type { ImagingStudy, Observation, WizardEntry } from '../../types/fhir'
import { SHOULDER_LATERALITY, OBSERVATION_CODES, PROFILE_URLS, OBSERVATION_PROFILE_URLS, VALUESET_URLS } from '../../types/fhir'
import { useValueSet } from '../../hooks/useValueSet'
import { OBSERVATION_METADATA } from '../../config/observationMetadata'
import type { ImagingFormData } from './stepFormData'

interface StepImagingProps {
  patientUuid: string
  encounterUuid: string
  laterality: string
  value: ImagingFormData
  onChange: (next: ImagingFormData) => void
  onComplete: (entries: WizardEntry[]) => void
  onSkip: () => void
  onBack: () => void
}

// Cofield boundaries (ADR-0047): <1 small, 1–3 medium, 3–5 large, >5 massive.
function deriveCofieldBucket(cm: number): 'small' | 'medium' | 'large' | 'massive' {
  if (cm < 1) return 'small'
  if (cm <= 3) return 'medium'
  if (cm <= 5) return 'large'
  return 'massive'
}

function StepImaging({ patientUuid, encounterUuid, laterality, value: formData, onChange, onComplete, onSkip, onBack }: StepImagingProps) {
  const { options: patteOptions, loading: patteLoading, error: patteError } = useValueSet(VALUESET_URLS.PATTE_CLASSIFICATION)
  const { options: goutallierOptions, loading: goutallierLoading, error: goutallierError } = useValueSet(VALUESET_URLS.GOUTALLIER_CLASSIFICATION)
  const { options: cofieldOptions, loading: cofieldLoading, error: cofieldError } = useValueSet(VALUESET_URLS.COFIELD_TEAR_SIZE_CLASSIFICATION)
  const { options: modalityOptions, loading: modalityLoading, error: modalityError } = useValueSet(VALUESET_URLS.IMAGING_MODALITY)

  const { patte, goutallier, tearSize, tearSizeClassification, imagingModalities } = formData

  const bodySite = {
    coding: [
      {
        system: SHOULDER_LATERALITY.SYSTEM,
        code: laterality === 'left' ? SHOULDER_LATERALITY.LEFT : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT : undefined,
        display: laterality === 'left' ? SHOULDER_LATERALITY.LEFT_DISPLAY : laterality === 'right' ? SHOULDER_LATERALITY.RIGHT_DISPLAY : undefined,
      },
    ],
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const effectiveDate = new Date().toISOString().split('T')[0]
    const patteMeta = OBSERVATION_METADATA['patte-classification']
    const goutallierMeta = OBSERVATION_METADATA['goutallier-classification']
    const entries: WizardEntry[] = []

    if (patte) {
      const patteOption = patteOptions.find((o) => o.code === patte)
      const obs: Observation = {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.PATTE_CLASSIFICATION] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
        code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.PATTE_CLASSIFICATION, display: 'Patte Classification' }] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: { reference: `urn:uuid:${encounterUuid}` },
        effectiveDateTime: effectiveDate,
        valueCodeableConcept: {
          coding: [{ system: patteMeta.codeSystem, code: patte, display: patteOption?.display }],
        },
        bodySite,
      }
      entries.push({ uuid: crypto.randomUUID(), resource: obs })
    }

    if (goutallier) {
      const goutallierOption = goutallierOptions.find((o) => o.code === goutallier)
      const obs: Observation = {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.GOUTALLIER_CLASSIFICATION] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
        code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.GOUTALLIER_CLASSIFICATION, display: 'Goutallier Classification' }] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: { reference: `urn:uuid:${encounterUuid}` },
        effectiveDateTime: effectiveDate,
        valueCodeableConcept: {
          coding: [{ system: goutallierMeta.codeSystem, code: goutallier, display: goutallierOption?.display }],
        },
        bodySite,
      }
      entries.push({ uuid: crypto.randomUUID(), resource: obs })
    }

    // ADR-0155: one ImagingStudy per selected modality — a patient can have
    // both a plain radiograph (Q3, DX) and an advanced study (Q6, MR/CT/US).
    // ADR-0172: `started` reuses the same registration date the imaging
    // Observations above stamp as effectiveDateTime — no separate UI field.
    for (const modality of imagingModalities) {
      const modalityOption = modalityOptions.find((o) => o.code === modality)
      const study: ImagingStudy = {
        resourceType: 'ImagingStudy',
        meta: { profile: [PROFILE_URLS.IMAGING_STUDY] },
        status: 'available',
        subject: { reference: `urn:uuid:${patientUuid}` },
        // ADR-0187: the registration study carries the same visit anchor every
        // other resource in this bundle carries. Previously omitted here while
        // the follow-up flow set it, which left the pre-operative study tied to
        // no visit at all once persisted.
        encounter: { reference: `urn:uuid:${encounterUuid}` },
        started: effectiveDate,
        modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: modality, display: modalityOption?.display }],
      }
      entries.push({ uuid: crypto.randomUUID(), resource: study })
    }

    const tearSizeNum = parseFloat(tearSize)
    if (!isNaN(tearSizeNum) && tearSize.trim() !== '') {
      const tearMeta = OBSERVATION_METADATA['tear-size']
      const obs: Observation = {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.TEAR_SIZE] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
        code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_SIZE, display: 'Tear Size' }] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: { reference: `urn:uuid:${encounterUuid}` },
        effectiveDateTime: effectiveDate,
        valueQuantity: { value: tearSizeNum, unit: tearMeta.unitDisplay, system: 'http://unitsofmeasure.org', code: tearMeta.unit },
        bodySite,
      }
      entries.push({ uuid: crypto.randomUUID(), resource: obs })
    }

    if (tearSizeClassification) {
      const cofieldMeta = OBSERVATION_METADATA['tear-size-classification']
      const cofieldOption = cofieldOptions.find((o) => o.code === tearSizeClassification)
      const obs: Observation = {
        resourceType: 'Observation',
        meta: { profile: [OBSERVATION_PROFILE_URLS[OBSERVATION_CODES.TEAR_SIZE_CLASSIFICATION] ?? PROFILE_URLS.OBSERVATION] },
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
        code: { coding: [{ system: OBSERVATION_CODES.SYSTEM, code: OBSERVATION_CODES.TEAR_SIZE_CLASSIFICATION, display: 'Tear Size Classification (Cofield)' }] },
        subject: { reference: `urn:uuid:${patientUuid}` },
        encounter: { reference: `urn:uuid:${encounterUuid}` },
        effectiveDateTime: effectiveDate,
        valueCodeableConcept: {
          coding: [{ system: cofieldMeta.codeSystem, code: tearSizeClassification, display: cofieldOption?.display }],
        },
        bodySite,
      }
      entries.push({ uuid: crypto.randomUUID(), resource: obs })
    }

    if (entries.length === 0) {
      onSkip()
      return
    }

    onComplete(entries)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card mb-6">
        <h3 className="card-header">Imaging Findings</h3>

        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          Shoulder: <strong>{laterality === 'left' ? 'Left' : laterality === 'right' ? 'Right' : '—'}</strong>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="form-group">
            <label className="form-label">Imaging Modality</label>
            <p className="text-xs text-gray-500 mb-2">
              Which imaging was obtained for this work-up — select all that apply (e.g. a plain
              radiograph and an MRI are often both obtained)
            </p>
            {modalityError && <p className="text-xs text-red-600 mb-1">Could not load options: {modalityError}</p>}
            {modalityLoading && <p className="text-xs text-gray-500">Loading…</p>}
            <div className="flex flex-wrap gap-2">
              {modalityOptions.map((o) => (
                <label
                  key={o.code}
                  className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={imagingModalities.includes(o.code)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...imagingModalities, o.code]
                        : imagingModalities.filter((c) => c !== o.code)
                      onChange({ ...formData, imagingModalities: next })
                    }}
                    className="rounded border-gray-300"
                  />
                  {o.display}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Patte Classification (Tendon Retraction)</label>
            <p className="text-xs text-gray-500 mb-2">Grading of tendon retraction from the insertion point</p>
            {patteError && <p className="text-xs text-red-600 mb-1">Could not load options: {patteError}</p>}
            <select
              value={patte}
              onChange={(e) => onChange({ ...formData, patte: e.target.value })}
              disabled={patteLoading}
              className="form-input"
            >
              {patteLoading && <option value="">Loading…</option>}
              {!patteLoading && <option value="">-- Select stage --</option>}
              {patteOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Goutallier Classification (Fatty Infiltration)</label>
            <p className="text-xs text-gray-500 mb-2">Grading of fatty infiltration of the rotator cuff muscles</p>
            {goutallierError && <p className="text-xs text-red-600 mb-1">Could not load options: {goutallierError}</p>}
            <select
              value={goutallier}
              onChange={(e) => onChange({ ...formData, goutallier: e.target.value })}
              disabled={goutallierLoading}
              className="form-input"
            >
              {goutallierLoading && <option value="">Loading…</option>}
              {!goutallierLoading && <option value="">-- Select grade --</option>}
              {goutallierOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tear Size (cm)</label>
            <p className="text-xs text-gray-500 mb-2">Maximum tear diameter in centimetres (MRI or intra-operative measurement)</p>
            <input
              type="number"
              inputMode="decimal"
              value={tearSize}
              onChange={(e) => {
                const next = e.target.value
                const cm = parseFloat(next)
                // Auto-suggest Cofield bucket only when the field was empty or
                // still matches the previously auto-derived bucket. Explicit
                // overrides survive subsequent cm edits.
                const prevCm = parseFloat(tearSize)
                const prevAutoBucket = !isNaN(prevCm) ? deriveCofieldBucket(prevCm) : ''
                const shouldAutoFill =
                  !tearSizeClassification || tearSizeClassification === prevAutoBucket
                const autoBucket = !isNaN(cm) && next.trim() !== '' ? deriveCofieldBucket(cm) : ''
                onChange({
                  ...formData,
                  tearSize: next,
                  tearSizeClassification: shouldAutoFill ? autoBucket : tearSizeClassification,
                })
              }}
              min={0}
              max={10}
              step={0.1}
              placeholder="e.g. 2.5"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tear Size Classification (Cofield)</label>
            <p className="text-xs text-gray-500 mb-2">
              Auto-suggested from cm value (small &lt;1, medium 1–3, large 3–5, massive &gt;5). Override if needed.
            </p>
            {cofieldError && <p className="text-xs text-red-600 mb-1">Could not load options: {cofieldError}</p>}
            <select
              value={tearSizeClassification}
              onChange={(e) => onChange({ ...formData, tearSizeClassification: e.target.value })}
              disabled={cofieldLoading}
              className="form-input"
            >
              {cofieldLoading && <option value="">Loading…</option>}
              {!cofieldLoading && <option value="">-- Select bucket --</option>}
              {cofieldOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">← Back</button>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onSkip} className="btn btn-secondary">Skip this step</button>
          <button type="submit" className="btn btn-primary">
            Next: Clinical Assessment →
          </button>
        </div>
      </div>
    </form>
  )
}

export default StepImaging
