import "./globalDropGuard";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { Viewer } from "./Viewer";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("ShipMemory render failed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 48, fontFamily: "-apple-system, sans-serif" }}>
          <h2>ShipMemory couldn’t render</h2>
          <p style={{ color: "#666" }}>{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// `?viewer=<hub-relative path>` → this window is a standalone attachment
// viewer (opened by App.tsx in its own WebviewWindow), not the notepad.
const viewerPath = new URLSearchParams(window.location.search).get("viewer");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      {viewerPath ? <Viewer relPath={viewerPath} /> : <App />}
    </RootErrorBoundary>
  </React.StrictMode>,
);
