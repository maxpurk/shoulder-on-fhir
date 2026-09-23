import { Link } from 'react-router-dom'

interface FlowCard {
  to: string
  title: string
  blurb: string
}

const FLOW_CARDS: FlowCard[] = [
  {
    to: '/register',
    title: 'Register a new patient',
    blurb: 'Pre-operative record: patient demographics, diagnosis, baseline clinical exam and outcome scores, imaging, prior physiotherapy or injection.',
  },
  {
    to: '/surgery',
    title: 'Record a surgical event',
    blurb: 'For an already-registered patient: surgical encounter, index procedure, concomitant procedures, intra-operative findings.',
  },
  {
    to: '/follow-up',
    title: 'Record a follow-up visit',
    blurb: 'Per-visit record at each scheduled follow-up (6 weeks, 3, 6, 12, 24 months): post-operative exam and patient-reported outcomes.',
  },
  {
    to: '/patients',
    title: 'View existing patients',
    blurb: 'Browse, edit, or inspect any patient already in the registry. Add individual records outside the guided flows.',
  },
]

function Home() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900">Rotator Cuff Registry</h2>
        <p className="text-slate-600 mt-2 leading-relaxed max-w-3xl">
          This registry provides standardized, structured documentation of rotator cuff pathology
          and its surgical treatment as a longitudinal clinical record for each patient — from
          pre-operative assessment, through the surgical procedure, to scheduled post-operative
          follow-up. Records are stored as interoperable, structured clinical data to support
          consistent data collection and outcome analysis across cases.
        </p>
      </div>

      <div className="mb-10 p-5 bg-white border border-slate-200 rounded-lg">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
          How to use this registry
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
          <li>
            <strong className="text-slate-900">Register a new patient</strong> — capture demographics,
            diagnosis, baseline exam, outcome scores, and imaging before surgery.
          </li>
          <li>
            <strong className="text-slate-900">Record a surgical event</strong> — document the
            procedure and intra-operative findings for a patient already registered.
          </li>
          <li>
            <strong className="text-slate-900">Record a follow-up visit</strong> — document the
            post-operative exam and patient-reported outcomes at each scheduled follow-up.
          </li>
          <li>
            <strong className="text-slate-900">View existing patients</strong> — browse, inspect, or
            edit any record already in the registry.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FLOW_CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block p-5 bg-white rounded-lg border border-slate-200 hover:border-hpi-orange hover:shadow-md transition-all"
          >
            <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Home
