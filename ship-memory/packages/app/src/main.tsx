import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { Viewer } from "./Viewer";

// `?viewer=<hub-relative path>` → this window is a standalone attachment
// viewer (opened by App.tsx in its own WebviewWindow), not the notepad.
const viewerPath = new URLSearchParams(window.location.search).get("viewer");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {viewerPath ? <Viewer relPath={viewerPath} /> : <App />}
  </React.StrictMode>,
);
