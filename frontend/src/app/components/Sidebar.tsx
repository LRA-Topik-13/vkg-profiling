import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  Target,
  CheckCircle,
  FileText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const SIDEBAR_WIDTH = '17rem';
export const SIDEBAR_COLLAPSED_WIDTH = '5rem';

const DIMENSIONS = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    icon: Target,
    path: '/accuracy',
    tabs: ['Outlier Profiling', 'Property Value Conflict', 'Property Misuse'],
  },
  {
    id: 'completeness',
    title: 'Completeness',
    icon: CheckCircle,
    path: '/completeness',
    tabs: ['Schema Completeness', 'Property Completeness', 'Interlinking Completeness', 'Population Completeness'],
  },
  {
    id: 'conciseness',
    title: 'Conciseness',
    icon: FileText,
    path: '/conciseness',
    tabs: ['Intra-source Uniqueness', 'Cross-source Uniqueness'],
  },
];

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeTabIndex = parseInt(searchParams.get('tab') || '0', 10);

  const [openDims, setOpenDims] = useState<Set<string>>(
    new Set(DIMENSIONS.map((d) => d.id)),
  );

  const toggleDim = (id: string) => {
    setOpenDims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        style={{ backgroundColor: 'var(--navy)', minHeight: '4.5rem' }}
      >
        <Link
          to="/"
          className="flex items-center justify-center w-full h-full px-4 py-2"
        >
          {collapsed ? (
            <BarChart3 className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          ) : (
            <div className="relative flex items-center justify-center w-full">
              <h1
                className="whitespace-nowrap"
                style={{
                  color: 'var(--text-on-dark)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '2rem',
                  letterSpacing: '0.04em',
                }}
              >
                ProVKG
              </h1>
              <BarChart3
                className="w-8 h-8 absolute"
                style={{ color: 'var(--accent)', right: 'calc(50% + 4rem)' }}
              />
            </div>
          )}
        </Link>

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
      <nav className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F7F7F7' }}>
        {DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const isActiveDim = location.pathname === dim.path;
          const isOpen = openDims.has(dim.id);

          return (
            <div key={dim.id}>
              {/* Dimension header row */}
              <div
                className="flex items-center"
                style={{
                  backgroundColor: isActiveDim ? 'var(--accent)' : 'transparent',
                }}
              >
                <Link
                  to={`${dim.path}?tab=0`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                  title={collapsed ? dim.title : undefined}
                  style={{
                    height: '3.3rem',
                    color: isActiveDim ? 'var(--text-on-accent)' : 'var(--text)',
                    paddingLeft: collapsed ? '0' : '1rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <Icon className="w-8 h-8 shrink-0" />
                  {!collapsed && (
                    <span className="whitespace-nowrap font-medium" style={{ fontSize: '1.05rem' }}>
                      {dim.title}
                    </span>
                  )}
                </Link>

                {!collapsed && (
                  <button
                    onClick={() => toggleDim(dim.id)}
                    className="px-3 shrink-0"
                    style={{
                      height: '3.3rem',
                      color: isActiveDim
                        ? 'var(--text-on-accent)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Tabs — full labels when expanded, dots when collapsed */}
              {isOpen && (
                <div>
                  {dim.tabs.map((tab, idx) => {
                    const isActiveTab = isActiveDim && activeTabIndex === idx;
                    return (
                      <Link
                        key={tab}
                        to={`${dim.path}?tab=${idx}`}
                        title={collapsed ? tab : undefined}
                        className="flex items-center"
                        style={{
                          height: '3.3rem',
                          paddingLeft: collapsed ? '0' : '2.75rem',
                          paddingRight: collapsed ? '0' : '1rem',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          backgroundColor: isActiveTab
                            ? 'rgba(0,0,0,0.09)'
                            : 'transparent',
                        }}
                      >
                        {collapsed ? (
                          <span
                            style={{
                              width: '0.45rem',
                              height: '0.45rem',
                              borderRadius: '50%',
                              flexShrink: 0,
                              backgroundColor: isActiveTab
                                ? 'var(--text)'
                                : 'var(--muted-foreground)',
                            }}
                          />
                        ) : (
                          <span
                            className="whitespace-nowrap"
                            style={{
                              fontSize: '0.95rem',
                              color: isActiveTab ? 'var(--text)' : 'var(--muted-foreground)',
                              fontWeight: isActiveTab ? 500 : 400,
                            }}
                          >
                            {tab}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
