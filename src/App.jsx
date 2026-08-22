// ###################################################
// File Name : App.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Root application component for HASM
// Description : Mounts the HASM model flow experience.
// ###################################################

import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DEFAULT_COLOR_PATTERN, getThemeVariables } from "./hasm_color_pattern/src/index.js";
import AppBootGatePage from "./pages/AppBootGatePage";
import ErrorAppPage from "./pages/ErrorAppPage";
import EntityDetailPlaceholderPage from "./pages/EntityDetailPlaceholderPage";
import ErrorModelPage from "./pages/ErrorModelPage";
import LoadingModelPage from "./pages/LoadingModelPage";
import SelectModelPage from "./pages/SelectModelPage";
import VisualizerPage from "./pages/VisualizerPage";
import { releaseWorkspaceLock, subscribeToTauriEvent, withTimeout } from "./features/hasm/api";
import { createLogger } from "./hasm_logger/src/react/logger.js";
import "./seq01.css";

const logger = createLogger("app-lifecycle");

function CloseLockListener() {
  useEffect(() => {
    let unlisten = () => {};
    subscribeToTauriEvent("tauri://close-requested", async () => {
      const path = window.sessionStorage.getItem("hasm-active-workspace");
      const readOnly = window.sessionStorage.getItem("hasm-workspace-read-only") === "true";
      if (path && !readOnly) {
        try { await withTimeout(releaseWorkspaceLock(path), 1000, "Workspace lock release timed out"); }
        catch (error) { logger.error("[SEQ-MD-02][LOCK] workspace lock release failed", error); }
      }
    }).then((listener) => { unlisten = listener; }).catch((error) => logger.warn("[SEQ-MD-02][LOCK] close listener unavailable", error));
    return () => unlisten();
  }, []);
  return null;
}

function App() {
  return (
    <div className="seq01-app" style={getThemeVariables(DEFAULT_COLOR_PATTERN)}>
      <BrowserRouter>
        <CloseLockListener />
        <Routes>
          <Route path="/" element={<AppBootGatePage />} />
          <Route path="/select" element={<SelectModelPage />} />
          <Route path="/loading-model" element={<LoadingModelPage />} />
          <Route path="/error-app" element={<ErrorAppPage />} />
          <Route path="/error-model" element={<ErrorModelPage />} />
          <Route path="/visualizer" element={<VisualizerPage />} />
          <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPlaceholderPage />} />
          <Route path="*" element={<AppBootGatePage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
