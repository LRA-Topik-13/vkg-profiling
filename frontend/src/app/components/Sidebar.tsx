import { Link, useLocation } from 'react-router';
import { Target, CheckCircle, FileText, BarChart3 } from 'lucide-react';

export default function Sidebar() {
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
    <div className="w-64 min-h-screen flex flex-col">
      {/* Logo/Title */}
      <Link
        to="/"
        className="p-6"
        style={{ backgroundColor: 'var(--navy)' }}
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl" style={{ color: 'var(--text-on-dark)' }}>
            ProVKG
          </h1>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-4" style={{ backgroundColor: '#F7F7F7' }}>
        <div className="space-y-2">
          {dimensions.map((dimension) => {
            const Icon = dimension.icon;
            const isActive = location.pathname === dimension.path;

            return (
              <Link
                key={dimension.id}
                to={dimension.path}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'var(--text-on-accent)' : 'var(--text)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{dimension.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
