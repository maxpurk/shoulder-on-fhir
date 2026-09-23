import { useEffect, useMemo, useState } from 'react'
import type { Encounter, Procedure } from '../../types/fhir'
import { computeTimepoints, getProcedureEffectiveDate, TOLERANCE_DAYS } from '../../lib/patientStage'

interface Props {
  indexProcedure: Procedure | undefined
  priorEncounters: Encounter[]
  onPick: (visitDate: string) => void
  /** If set, auto-invoke onPick for the timepoint with this days offset on mount. */
  autoPickDays?: number
}

function toIsoLocalDateTime(date: Date): string {
  return date.toISOString()
}

function todayAtNineAm(): string {
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  return toIsoLocalDateTime(d)
}

function TimepointPicker({ indexProcedure, priorEncounters, onPick, autoPickDays }: Props) {
  const surgeryDate = indexProcedure ? getProcedureEffectiveDate(indexProcedure) : undefined
  const [customDate, setCustomDate] = useState<string>('')

  const timepoints = useMemo(
    () =>
      computeTimepoints({
        indexProcedureDate: surgeryDate,
        followUpEncounters: priorEncounters,
      }),
    [surgeryDate, priorEncounters],
  )

  // Honor ?timepoint=<days> deep-link from PatientDetail CTAs.
  useEffect(() => {
    if (autoPickDays === undefined) return
    const tp = timepoints.find((t) => t.days === autoPickDays && t.status !== 'done')
    if (tp) onPick(tp.scheduledIso)
  }, [autoPickDays, timepoints, onPick])

  return (
    <div className="card">
      <h2 className="card-header">Step 2 — Pick the follow-up timepoint</h2>

      {!surgeryDate && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded p-3 mb-4">
          No dated index surgery found for this patient (expected if the Surgery flow hasn't
          been submitted yet). The schedule chips can't be auto-computed — use the custom date
          input below.
        </div>
      )}

      {surgeryDate && (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Index surgery performed on{' '}
            <strong>{new Date(surgeryDate).toISOString().slice(0, 10)}</strong>. Follow-up
            schedule:
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {timepoints.map((tp) => {
              const done = tp.status === 'done'
              return (
                <button
                  key={tp.label}
                  type="button"
                  className={`chip ${
                    done
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-800 border-gray-300 hover:border-hpi-orange hover:text-hpi-orange'
                  }`}
                  onClick={() => !done && onPick(tp.scheduledIso)}
                  disabled={done}
                  title={
                    done
                      ? `An Encounter already exists within ${TOLERANCE_DAYS} days of this timepoint`
                      : `Use this timepoint (${new Date(tp.scheduledIso).toISOString().slice(0, 10)})`
                  }
                >
                  {tp.label}
                  {done && <span className="ml-1 text-xs">✓ recorded</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div>
        <label className="form-label" htmlFor="customDate">
          Or pick a custom visit date & time
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="customDate"
            type="datetime-local"
            className="form-input flex-1"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!customDate}
            onClick={() => {
              const iso = customDate ? new Date(customDate).toISOString() : todayAtNineAm()
              onPick(iso)
            }}
          >
            Use this date
          </button>
        </div>
      </div>

      {priorEncounters.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Prior follow-up encounters ({priorEncounters.length})
          </h3>
          <ul className="text-xs text-gray-600 space-y-1">
            {priorEncounters
              .slice()
              .sort((a, b) =>
                (a.period?.start ?? '').localeCompare(b.period?.start ?? ''),
              )
              .map((enc) => (
                <li key={enc.id}>
                  <code>Encounter/{enc.id}</code> · {enc.period?.start?.slice(0, 10) ?? '—'} · status{' '}
                  {enc.status}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default TimepointPicker
