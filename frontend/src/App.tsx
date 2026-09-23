import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './components/Home'
import PatientList from './components/PatientList'
import PatientDetail from './components/PatientDetail'
import PatientForm from './components/PatientForm'
import ConditionForm from './components/ConditionForm'
import ProcedureForm from './components/ProcedureForm'
import ObservationForm from './components/ObservationForm'
import RegistrationWizard from './components/RegistrationWizard'
import SurgeryWizard from './components/SurgeryWizard'
import FollowUpWizard from './components/followup/FollowUpWizard'

function App() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close the mobile menu on navigation — otherwise it stays open behind
  // the newly-routed page.
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/register', label: 'Register' },
    { path: '/surgery', label: 'Surgery' },
    { path: '/follow-up', label: 'Follow-up' },
    { path: '/patients', label: 'Patients' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — the 5-link nav doesn't fit below md (768px), so it
          collapses into a hamburger menu there instead of overflowing the
          viewport (the root cause of the horizontal-overflow-on-iOS bug
          this fix addresses — confirmed via WebKit device emulation before
          writing any code). */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center space-x-3 min-w-0">
              <img src="/hpi-logo.png" alt="Hasso Plattner Institut" className="h-10 w-auto shrink-0" />
              <div className="min-w-0 border-l border-slate-200 pl-3">
                <h1 className="text-xl font-bold text-slate-900 truncate">Rotator Cuff Registry</h1>
                <p className="text-xs text-slate-500 truncate hidden sm:block">Hasso Plattner Institut</p>
              </div>
            </Link>

            {/* Desktop/tablet nav — hidden below md */}
            <nav className="hidden md:flex space-x-2">
              {navLinks.map((link) => {
                const active =
                  link.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(link.path)
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-hpi-orange text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            {/* Hamburger toggle — visible only below md */}
            <button
              type="button"
              className="md:hidden shrink-0 p-2 rounded-md text-slate-600 hover:bg-slate-100"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav panel — only rendered below md, toggled by the hamburger */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-200 px-4 py-2 space-y-1">
            {navLinks.map((link) => {
              const active =
                link.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(link.path)
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    active
                      ? 'bg-hpi-orange text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegistrationWizard />} />
          <Route path="/surgery" element={<SurgeryWizard />} />
          <Route path="/follow-up" element={<FollowUpWizard />} />

          {/* Patient management (existing per-resource CRUD views) */}
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patient/new" element={<PatientForm />} />
          <Route path="/patient/:patientId" element={<PatientDetail />} />
          <Route path="/patient/:patientId/edit" element={<PatientForm />} />
          <Route path="/patient/:patientId/condition/new" element={<ConditionForm />} />
          <Route path="/patient/:patientId/condition/:conditionId" element={<ConditionForm />} />
          <Route path="/patient/:patientId/procedure/new" element={<ProcedureForm />} />
          <Route path="/patient/:patientId/procedure/:procedureId" element={<ProcedureForm />} />
          <Route path="/patient/:patientId/observation/new" element={<ObservationForm />} />
          <Route path="/patient/:patientId/observation/:observationId" element={<ObservationForm />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-slate-500">
            Rotator Cuff Registry · Hasso Plattner Institut
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
