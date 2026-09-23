/**
 * Yellow banner shown when the FHIR Validator sidecar (ADR-0051) is
 * unreachable at submit time. The submission proceeds (fail-open) and the
 * design-time gate (tools/validate.sh) remains authoritative.
 */

interface Props {
  message?: string
}

export function ValidatorBanner({ message }: Props) {
  return (
    <div className="border-l-4 border-yellow-400 bg-yellow-50 p-3 mb-4 text-sm text-yellow-800">
      <div className="font-medium">Validator service unavailable</div>
      <div className="mt-1">
        Submission was accepted but not pre-checked. The design-time gate
        (<code>tools/validate.sh</code>) remains authoritative.
        {message ? <span className="block opacity-70 mt-1">{message}</span> : null}
      </div>
    </div>
  )
}

export default ValidatorBanner
