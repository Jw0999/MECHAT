import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0B0F10] text-[#F5F7F7] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-xl">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-[#9BA5A8] max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-xs px-5 py-2.5 rounded-full transition shadow-lg shadow-brand/20 active:scale-95"
          >
            <RefreshCw size={14} />
            <span>Reload MeChat</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
