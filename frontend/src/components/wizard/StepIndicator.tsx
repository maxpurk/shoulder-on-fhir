interface Step {
  number: number
  title: string
  optional?: boolean
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
}

// Pill-based layout (matches the follow-up wizard's Stepper) so long step
// titles wrap onto multiple lines on narrow viewports instead of squeezing
// into a fixed-width flex row with whitespace-nowrap labels.
function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {steps.map((step) => {
        const isCompleted = currentStep > step.number
        const isActive = currentStep === step.number

        return (
          <li
            key={step.number}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              isCompleted
                ? 'bg-green-50 border-green-200 text-green-700'
                : isActive
                ? 'bg-hpi-orange border-hpi-orange text-white'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'bg-white text-hpi-orange'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {isCompleted ? '✓' : step.number}
            </span>
            <span className="font-medium">
              {step.title}
              {step.optional && <span className="ml-1 font-normal opacity-75">(optional)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default StepIndicator
