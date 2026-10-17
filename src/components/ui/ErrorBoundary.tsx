import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
        <div
          role="alert"
          className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0 text-q1" />
            <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
          </div>
          <p className="mt-3 text-sm text-muted">
            The app hit an unexpected error. Reload to try again. Your data stays on this device.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button variant="outline" onClick={this.reset}>
              <RotateCcw size={14} />
              Try again
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
