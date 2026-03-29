import { Component } from "preact";

interface Props {
  data: Record<string, unknown>;
  children: preact.ComponentChildren;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render failures and shows raw JSON as fallback.
 * Required by OpenAI guidelines: "Provide JSON fallbacks when components fail to load."
 */
export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre style={{
          padding: "16px",
          fontSize: "0.75rem",
          overflow: "auto",
          background: "var(--dci-bg-secondary)",
          borderRadius: "var(--dci-radius)",
          color: "var(--dci-text)",
        }}>
          {JSON.stringify(this.props.data, null, 2)}
        </pre>
      );
    }
    return this.props.children;
  }
}
