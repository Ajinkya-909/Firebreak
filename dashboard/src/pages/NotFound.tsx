import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Card, EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <Card>
      <EmptyState icon={Compass} title="Page not found">
        <Link to="/" className="text-accent-ink hover:underline">
          Go to the overview
        </Link>
      </EmptyState>
    </Card>
  );
}
