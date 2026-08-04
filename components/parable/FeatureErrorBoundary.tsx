"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type FeatureErrorBoundaryProps = {
  children: ReactNode;
  featureLabel?: string;
  onTripped?: (error: Error) => void;
};

type FeatureErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export default class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  state: FeatureErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unexpected feature error.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PARABLE breaker] ${this.props.featureLabel ?? "Feature"}`, error, info);
    this.props.onTripped?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-white/10 bg-[#090B13] px-4 py-6 text-center"
          role="status"
        >
          <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Circuit breaker
          </p>
          <p className="mt-2 font-body text-sm text-brand-muted">
            {this.props.featureLabel ?? "Feature"} temporarily offline.
          </p>
          <p className="mt-1 font-body text-xs text-white/45">
            Live stream remains protected.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
