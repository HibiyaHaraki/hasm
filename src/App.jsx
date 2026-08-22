// ###################################################
// File Name : App.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Root application component for HASM
// Description : Mounts the HASM model flow experience.
// ###################################################

import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DEFAULT_COLOR_PATTERN, getThemeVariables } from "./hasm_color_pattern/src/index.js";
import AppBootGatePage from "./pages/AppBootGatePage";
import ErrorAppPage from "./pages/ErrorAppPage";
import LoadingModelPage from "./pages/LoadingModelPage";
import SelectModelPage from "./pages/SelectModelPage";
import "./seq01.css";

function App() {
  return (
    <div className="seq01-app" style={getThemeVariables(DEFAULT_COLOR_PATTERN)}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppBootGatePage />} />
          <Route path="/select" element={<SelectModelPage />} />
          <Route path="/loading-model" element={<LoadingModelPage />} />
          <Route path="/error-app" element={<ErrorAppPage />} />
          <Route path="*" element={<AppBootGatePage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
