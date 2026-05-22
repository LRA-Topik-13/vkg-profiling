import { Link, useLocation } from 'react-router';
import {
  Target,
  CheckCircle,
  FileText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const SIDEBAR_WIDTH = '16rem';
export const SIDEBAR_COLLAPSED_WIDTH = '5rem';

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();

  const dimensions = [
    {
      id: 'accuracy',
      title: 'Accuracy',
      icon: Target,
      path: '/accuracy',
    },
    {
      id: 'completeness',
      title: 'Completeness',
      icon: CheckCircle,
      path: '/completeness',
    },
    {
      id: 'conciseness',
      title: 'Conciseness',
      icon: FileText,
      path: '/conciseness',
    },
  ];

  return (
    <div
      className="flex flex-col shrink-0 transition-all duration-300 overflow-hidden"
      style={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {/* Logo/Title */}
      <div
        className="relative"
        style={{
          backgroundColor: 'var(--navy)',
          minHeight: '4.5rem',
        }}
      >
        <Link
          to="/"
          className="flex items-center justify-center w-full h-full p-4"
        >
          {collapsed ? (
            <BarChart3
              className="w-8 h-8"
              style={{ color: 'var(--accent)' }}
            />
          ) : (
            <div className="relative flex items-center justify-center w-full">
              <h1
                className="text-2xl whitespace-nowrap"
                style={{ color: 'var(--text-on-dark)' }}
              >
                ProVKG
              </h1>
              <BarChart3
                className="w-8 h-8 absolute"
                style={{
                  color: 'var(--accent)',
                  right: 'calc(50% + 3rem)',
                }}
              />
            </div>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="absolute top-2 right-2 p-1 rounded transition-colors hover:bg-white/20"
          style={{ color: 'var(--text-on-dark)' }}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3" style={{ backgroundColor: '#F7F7F7' }}>
        <div className="space-y-2">
          {dimensions.map((dimension) => {
            const Icon = dimension.icon;
            const isActive = location.pathname === dimension.path;

            return (
              <Link
                key={dimension.id}
                to={dimension.path}
                className="flex items-center gap-3 py-3 transition-colors"
                title={collapsed ? dimension.title : undefined}
                style={{
                  backgroundColor: isActive
                    ? 'var(--accent)'
                    : 'transparent',
                  color: isActive
                    ? 'var(--text-on-accent)'
                    : 'var(--text)',
                  borderRadius: 'var(--radius-md)',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  paddingLeft: collapsed ? '0' : '1rem',
                  paddingRight: collapsed ? '0' : '1rem',
                }}
              >
                <Icon className="w-7 h-7 shrink-0" />
                {!collapsed && (
                  <span className="whitespace-nowrap">{dimension.title}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
