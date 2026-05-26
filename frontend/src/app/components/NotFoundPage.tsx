import { Link } from 'react-router';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="text-center max-w-md">
        <FileQuestion
          className="mx-auto mb-6 w-16 h-16 opacity-40"
          style={{ color: 'var(--muted-foreground)' }}
        />
        <h1 className="text-5xl font-bold" style={{ color: 'var(--text)' }}>
          404
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--muted-foreground)' }}>
          Page not found
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2.5 text-sm font-medium"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--text-on-accent)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
