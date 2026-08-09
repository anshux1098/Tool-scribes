import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 gap-4">
          <p className="text-[48px]">⚠</p>
          <h1 className="font-syne text-[24px] text-tv-text">Something went wrong</h1>
          <p className="text-[14px] text-tv-text-s font-mono text-center max-w-md">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="mt-2 px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
