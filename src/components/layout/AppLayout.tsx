import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Search } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'

export function AppLayout() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/patients?search=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patients..."
                className="pl-9 pr-4 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-800 w-64"
              />
            </div>
          </form>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-xs text-gray-500 hover:text-navy-800 font-medium"
            >
              TRUST-MED AI
            </Link>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
