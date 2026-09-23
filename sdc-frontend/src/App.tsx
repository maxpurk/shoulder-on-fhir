import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home } from './components/Home'
import { FlowPage } from './components/FlowPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 pb-12">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<FlowPage flow="registration" />} />
            <Route path="/surgery" element={<FlowPage flow="surgery" />} />
            <Route path="/follow-up" element={<FlowPage flow="follow-up" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function AppHeader() {
  const location = useLocation()
  const onLanding = location.pathname === '/'
  return (
    <header className="bg-white border-b border-slate-200 mb-8">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/hpi-logo.png" alt="Hasso Plattner Institut" className="h-8 w-auto shrink-0" />
          <div className="border-l border-slate-200 pl-3">
            <h1 className="text-lg font-semibold text-slate-900">Rotator Cuff Registry</h1>
            <p className="text-xs text-slate-500">Structured data capture demonstrator</p>
          </div>
        </Link>
        {!onLanding && (
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← Back to landing</Link>
        )}
      </div>
    </header>
  )
}
