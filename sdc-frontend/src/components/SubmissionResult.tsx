import type { TransactionResponseBundle } from '../types/fhir'
import type { FlowType } from './FlowPage'

interface Props {
  flow: FlowType
  response: TransactionResponseBundle
  onReset: () => void
}

const FLOW_LABELS: Record<FlowType, { heading: string; firstEntry: string; resetButton: string }> = {
  registration: { heading: 'Registration Submitted', firstEntry: 'Patient ID', resetButton: 'Register Another Patient' },
  surgery: { heading: 'Surgery Submitted', firstEntry: 'Encounter ID', resetButton: 'Record Another Surgery' },
  'follow-up': { heading: 'Follow-Up Submitted', firstEntry: 'Encounter ID', resetButton: 'Record Another Follow-Up' },
}

export function SubmissionResult({ flow, response, onReset }: Props) {
  const entries = response.entry ?? []
  const firstEntry = entries[0]
  const firstEntryId = firstEntry?.response?.location?.split('/')[1]
  const labels = FLOW_LABELS[flow]

  return (
    <div className="max-w-2xl mx-auto mt-10 card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{labels.heading}</h2>
          <p className="text-sm text-gray-500">Transaction bundle accepted by HAPI FHIR</p>
        </div>
      </div>

      {firstEntryId && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-medium">{labels.firstEntry}:</span> {firstEntryId}
          </p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Resources created ({entries.length})</h3>
        <ul className="space-y-1">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="font-mono text-xs">{entry.response?.location ?? `entry[${i}]`}</span>
              <span className="text-gray-400 text-xs">{entry.response?.status}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 bg-gray-50 rounded-md mb-6">
        <p className="text-xs text-gray-500">
          The questionnaire response was automatically converted into discrete clinical records
          and submitted together as a single transaction.
        </p>
      </div>

      <button onClick={onReset} className="btn btn-primary w-full">
        {labels.resetButton}
      </button>
    </div>
  )
}
