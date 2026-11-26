import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Upload, FileSearch, Clock,
  Pill, Ghost, Network, Radar, Bot, FileText,
  ShieldCheck, AlertTriangle, Heart, ChevronRight, Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Patients', icon: Users, path: '/patients' },
  { label: 'Upload Documents', icon: Upload, path: '/upload' },
  { divider: true, label: 'Clinical Intelligence' },
  { label: 'Patient Reconstruction', icon: FileSearch, path: '/reconstruction' },
  { label: 'Medical Timeline', icon: Clock, path: '/timeline' },
  { label: 'Contradictions', icon: AlertTriangle, path: '/contradictions' },
  { label: 'Medications', icon: Pill, path: '/medications' },
  { label: 'Ghost Records', icon: Ghost, path: '/ghost-records' },
  { divider: true, label: 'AI Systems' },
  { label: 'Knowledge Graph', icon: Network, path: '/knowledge-graph' },
  { label: 'Uncertainty Radar', icon: Radar, path: '/uncertainty' },
  { label: 'Agent Control', icon: Bot, path: '/agents' },
  { divider: true, label: 'Reports' },
  { label: 'Patient Handover', icon: FileText, path: '/handover' },
  { label: 'Audit & Security', icon: ShieldCheck, path: '/audit' },
]

export function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-navy-900 text-white transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-navy-800">
        <div className="flex-shrink-0 w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <Heart className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-white leading-tight">TRUST-MED AI</div>
            <div className="text-xs text-navy-400">Clinical Intelligence</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-navy-800 text-navy-400 hover:text-white"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <Menu className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {navItems.map((item, idx) => {
          if ('divider' in item && item.divider) {
            if (collapsed) return <div key={idx} className="my-2 border-t border-navy-800" />
            return (
              <div key={idx} className="px-4 pt-4 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-navy-500">
                  {item.label}
                </span>
              </div>
            )
          }

          const Icon = item.icon!
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path!))

          return (
            <Link
              key={item.path}
              to={item.path!}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-teal-600 text-white font-medium'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-navy-800 p-4">
        {!collapsed && (
          <p className="text-xs text-navy-500 text-center">
            Clinical Intelligence Platform
          </p>
        )}
      </div>
    </aside>
  )
}
