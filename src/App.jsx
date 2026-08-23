// ###################################################
// File Name : App.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Root application component for HASM
// Description : Mounts the HASM model flow experience.
// ###################################################

import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import GlobalNavbar from "./features/navigation/GlobalNavbar";
import ProtectedRoute from "./features/navigation/ProtectedRoute";
import { ThemeProvider } from "./features/theme/ThemeContext";
import { DEFAULT_COLOR_PATTERN, getThemeVariables } from "./hasm_color_pattern/src/index.js";
import AppBootGatePage from "./pages/AppBootGatePage";
import EntityCreatePage from "./pages/EntityCreatePage";
import ModelInitializationPage from "./pages/ModelInitializationPage";
import ErrorAppPage from "./pages/ErrorAppPage";
import EntityDetailPage from "./pages/EntityDetailPage";
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
  const [activePatternId, setActivePatternId] = useState(DEFAULT_COLOR_PATTERN);

  useEffect(() => {
    const saved = window.localStorage.getItem("hasm-theme-pattern");
    if (saved) {
      setActivePatternId(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hasm-theme-pattern", activePatternId);
  }, [activePatternId]);

  const themeStyle = useMemo(() => getThemeVariables(activePatternId), [activePatternId]);

  return (
    <div className="seq01-app" style={themeStyle}>
      <BrowserRouter>
        <ThemeProvider value={{ activePatternId, setActivePatternId }}>
          <CloseLockListener />
          <GlobalNavbar />
          <Routes>
            <Route path="/" element={<AppBootGatePage />} />
            <Route path="/select" element={<SelectModelPage />} />
            <Route path="/loading-model" element={<LoadingModelPage />} />
            <Route path="/initialize-model" element={<ModelInitializationPage />} />
            <Route path="/error-app" element={<ErrorAppPage />} />
            <Route path="/error-model" element={<ErrorModelPage />} />
            <Route element={<ProtectedRoute requireVerified={true} />}>
              <Route path="/visualizer" element={<VisualizerPage />} />
              <Route path="/entity-create" element={<EntityCreatePage />} />
              <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} />
            </Route>
            <Route
              path="*"
              element={(
                <Navigate
                  to="/select"
                  replace
                  state={{
                    redirectReason: "指定されたページが存在しません。",
                    redirectType: "warning",
                  }}
                />
              )}
            />
          </Routes>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
