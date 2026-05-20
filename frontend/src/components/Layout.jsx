import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = () => setCollapsed((c) => !c)

  // Cmd+B (Mac) / Ctrl+B (Windows) keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} />
      <main className="flex-1 overflow-auto bg-bg">
        {/* Sidebar trigger in main content area */}
        <div className="sticky top-0 z-10 flex items-center h-14 px-4 border-b border-border bg-bg">
          <button
            onClick={toggle}
            className="inline-flex items-center justify-center rounded-md w-8 h-8 text-muted-foreground hover:text-text hover:bg-muted transition-colors"
            aria-label="Toggle sidebar"
            title="Toggle sidebar (⌘B)"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
