import { Link } from 'react-router-dom'

/**
 * Landing page for the SDC frontend. Three cards — Registration / Surgery /
 * Follow-Up — mirror the registry's three record types. Each card routes
 * into its own flow that fetches a structured questionnaire and submits the
 * matching set of records.
 */
export function Home() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Rotator Cuff Registry</h2>
        <p className="text-slate-600 mt-2 leading-relaxed">
          This registry provides standardized, structured documentation of rotator cuff pathology
          and its surgical treatment as a longitudinal clinical record for each patient — from
          pre-operative assessment, through the surgical procedure, to scheduled post-operative
          follow-up. This demonstrator renders each record as a structured questionnaire, so the
          form and the underlying clinical data model stay in lock-step.
        </p>
      </div>

      <div className="mb-8 p-5 bg-white border border-slate-200 rounded-lg">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
          How to use this registry
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
          <li>
            <strong className="text-slate-900">Registration</strong> — patient demographics, diagnosis,
            prior treatments, baseline clinical assessment and outcome scores, before surgery.
          </li>
          <li>
            <strong className="text-slate-900">Surgery</strong> — the surgical encounter, primary and
            concomitant procedures, and intra-operative findings, for an already-registered patient.
          </li>
          <li>
            <strong className="text-slate-900">Follow-Up</strong> — the post-operative exam and
            patient-reported outcomes at each scheduled follow-up visit.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          to="/register"
          title="Registration"
          description="Pre-operative record: patient demographics, diagnosis, prior treatments, baseline clinical assessment and baseline outcome scores, patient history."
        />
        <Card
          to="/surgery"
          title="Surgery"
          description="Surgical event record: encounter, primary and concomitant procedures, optional intra-operative findings. Requires a previously registered patient."
        />
        <Card
          to="/follow-up"
          title="Follow-Up"
          description="Per-visit record at each scheduled follow-up (6 weeks, 3, 6, 12, 24 months). Patient details pre-fill automatically."
        />
      </div>
    </div>
  )
}

interface CardProps {
  to: string
  title: string
  description: string
}

function Card({ to, title, description }: CardProps) {
  return (
    <Link to={to} className="card hover:shadow-md transition-shadow no-underline">
      <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-700">{description}</p>
    </Link>
  )
}
