import { NavLink, Link } from 'react-router-dom'
import { BarChart3, Target, CheckCircle, FileText, Crosshair } from 'lucide-react'
import { cn } from '../lib/cn'

const DIMENSIONS = [
  { id: 'accuracy',     label: 'Accuracy',     icon: Crosshair,   path: '/accuracy',     available: false },
  { id: 'completeness', label: 'Completeness', icon: CheckCircle, path: '/completeness', available: false },
  { id: 'conciseness',  label: 'Conciseness',  icon: FileText,    path: '/conciseness',  available: true  },
  { id: 'consistency',  label: 'Consistency',  icon: Target,      path: '/consistency',  available: false },
]

export function Sidebar({ collapsed }) {
  return (
    <aside
      className={cn(
        'min-h-screen flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-linear',
        collapsed ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]'
      )}
      style={{
        '--sidebar-width': '16rem',
        '--sidebar-width-icon': '3rem',
      }}
    >
      {/* Brand — navy background */}
      <div className="bg-[var(--sidebar)] text-white">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 h-14',
            collapsed ? 'justify-center px-0' : 'px-5'
          )}
        >
          <BarChart3 className="w-6 h-6 text-accent shrink-0" />
          <div
            className={cn(
              'overflow-hidden transition-[opacity,width] duration-200 ease-linear',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <h1 className="text-base font-semibold leading-tight whitespace-nowrap">ProVKG</h1>
            <p className="text-[9px] uppercase tracking-widest text-white/50 whitespace-nowrap">Data Quality</p>
          </div>
        </Link>
      </div>

      {/* Nav — light background */}
      <nav className="flex-1 px-2 py-4 bg-[#F7F7F7] border-r border-border">
        <div
          className={cn(
            'overflow-hidden transition-[opacity,height] duration-200 ease-linear',
            collapsed ? 'h-0 opacity-0' : 'h-auto opacity-100 mb-2'
          )}
        >
          <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
            Dimensions
          </p>
        </div>
        <ul className="space-y-1">
          {DIMENSIONS.map((d) => {
            const Icon = d.icon
            if (!d.available) {
              return (
                <li key={d.id}>
                  <div
                    className={cn(
                      'flex items-center rounded-md text-sm text-muted-foreground/40 cursor-not-allowed h-9',
                      collapsed ? 'justify-center w-9 mx-auto' : 'gap-3 px-3'
                    )}
                    title={d.label + ' (Coming soon)'}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span
                      className={cn(
                        'overflow-hidden transition-[opacity] duration-200 ease-linear flex-1 flex items-center',
                        collapsed ? 'opacity-0 w-0' : 'opacity-100'
                      )}
                    >
                      <span className="whitespace-nowrap">{d.label}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider whitespace-nowrap">Soon</span>
                    </span>
                  </div>
                </li>
              )
            }
            return (
              <li key={d.id}>
                <NavLink
                  to={d.path}
                  title={d.label}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md text-sm transition-colors h-9',
                      collapsed ? 'justify-center w-9 mx-auto' : 'gap-3 px-3',
                      isActive
                        ? 'bg-accent text-white'
                        : 'text-muted-foreground hover:bg-black/5 hover:text-text'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span
                    className={cn(
                      'overflow-hidden transition-[opacity] duration-200 ease-linear whitespace-nowrap',
                      collapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}
                  >
                    {d.label}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'border-t border-border text-xs text-muted-foreground/60 bg-[#F7F7F7] border-r',
          collapsed ? 'px-2 py-3 text-center' : 'px-4 py-3'
        )}
      >
        <span
          className={cn(
            'overflow-hidden transition-[opacity] duration-200 ease-linear whitespace-nowrap',
            collapsed ? 'opacity-0 hidden' : 'opacity-100'
          )}
        >
          Universitas Indonesia
        </span>
        <span className={cn(collapsed ? 'block' : 'hidden')}>UI</span>
      </div>
    </aside>
  )
}
