function ErrorBanner({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md ${className}`}
    >
      {message}
    </div>
  )
}

export default ErrorBanner
