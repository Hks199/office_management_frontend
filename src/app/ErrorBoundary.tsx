import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="state full-screen">
        <h1>The workspace encountered a problem</h1>
        <p>Reload the page to restore your session.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
