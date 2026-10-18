import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /**
   * Changing this value clears a latched error. Pass the current route (e.g.
   * `location.pathname`) so navigating away from a failed view recovers instead of
   * staying stuck on the error.
   */
  resetKey?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render and chunk-load failures for the routed view so a failed route shows a
 * recoverable retry instead of blanking the whole app. The shell (nav, header) sits
 * outside this boundary and stays usable.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route failed to load', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: RouteErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private retry = (): void => {
    this.setState({ hasError: false });
    if (this.props.onRetry) this.props.onRetry();
    else window.location.reload();
  };

  private goHome = (): void => {
    this.setState({ hasError: false });
    if (this.props.onGoHome) this.props.onGoHome();
    else window.location.hash = '#/today';
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="flex min-h-[60vh] items-center justify-center p-6 text-fg">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0 text-q1" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-fg">This view could not load</h1>
          </div>
          <p className="mt-3 text-sm text-muted">
            The page may have failed to download. Try again, or return to Today. Your data stays on
            this device.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={this.retry}>
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </Button>
            <Button variant="outline" onClick={this.goHome}>
              Go to Today
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
