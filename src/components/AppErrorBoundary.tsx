import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AlertTriangle, RotateCcw } from "lucide-react";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-inset ring-red-500/20">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <div className="max-w-sm">
        <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          An unexpected error occurred on this page. Your data is safe.
        </p>
        {message && (
          <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
            {message}
          </p>
        )}
      </div>
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => console.error("[AppErrorBoundary]", error)}
    >
      {children}
    </ErrorBoundary>
  );
}
