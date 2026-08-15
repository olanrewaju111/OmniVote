'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={`h-full flex items-center justify-center bg-background ${this.props.className ?? ''}`}
        >
          <div className="max-w-md w-full text-center space-y-4 px-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-emerald"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-foreground">
              {this.props.title ?? 'Something went wrong'}
            </h3>

            <p className="text-sm text-muted-foreground">
              An unexpected error occurred in this section. You can try again or
              switch to another tab.
            </p>

            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center rounded-md bg-emerald px-4 py-2 text-sm font-medium text-white hover:bg-emerald/90 focus:outline-none focus:ring-2 focus:ring-emerald focus:ring-offset-2 focus:ring-offset-background transition-colors cursor-pointer"
            >
              Try Again
            </button>

            {this.state.error && (
              <details className="text-left mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-card/60 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.componentStack && (
                    <>
                      {'\n\nComponent stack:'}
                      {this.state.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;