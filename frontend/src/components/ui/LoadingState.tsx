import { Card } from './Card';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <Card className="flex items-center justify-center h-full">
      <div className="animate-pulse space-y-4 text-center" role="status" aria-live="polite">
        <div className="h-20 w-48 bg-madhive-purple-medium/50 rounded mx-auto" />
        <div className="h-4 w-32 bg-madhive-purple-medium/50 rounded mx-auto" />
        <span className="sr-only">{message}</span>
      </div>
    </Card>
  );
}

export function ErrorState({
  message,
  error,
}: {
  message?: string;
  error?: Error | unknown;
}) {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';

  return (
    <Card className="flex items-center justify-center h-full">
      <div className="text-center" role="alert" aria-live="assertive">
        <p className="text-error text-tv-base font-semibold">
          {message || 'Error loading data'}
        </p>
        <p className="text-madhive-chalk/60 text-tv-sm mt-2">{errorMessage}</p>
      </div>
    </Card>
  );
}

export function EmptyState({ message = 'No data available' }: { message?: string }) {
  return (
    <Card className="flex items-center justify-center h-full">
      <p className="text-madhive-chalk/60 text-tv-base" role="status">
        {message}
      </p>
    </Card>
  );
}
