import { Component, ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-8 text-center" role="alert" aria-live="assertive">
          <h2 className="text-tv-xl text-error font-display mb-4">
            Something went wrong
          </h2>
          <p className="text-madhive-chalk/80 text-tv-base mb-6">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-madhive-pink hover:bg-madhive-pink-bright text-madhive-purple-deepest font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-madhive-pink focus:ring-offset-2 focus:ring-offset-madhive-purple-dark"
            aria-label="Reload page"
          >
            Reload Page
          </button>
        </Card>
      );
    }

    return this.props.children;
  }
}
