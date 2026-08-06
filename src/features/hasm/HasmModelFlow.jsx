// ###################################################
// File Name : HasmModelFlow.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Main flow controller for HASM model operations
// Description : Handles boot, open, visualize, and detail routing states.
// ###################################################

import { useEffect, useMemo, useState } from "react";
import { openHasmModel } from "./api";
import ColorPatternSelector from "./components/ColorPatternSelector";
import { ENTITY_TYPES } from "./constants";
import BootPage from "./pages/BootPage";
import EntityDetailRouterPage from "./pages/EntityDetailRouterPage";
import OpenModelPage from "./pages/OpenModelPage";
import VisualizeModelPage from "./pages/VisualizeModelPage";
import {
  COLOR_PATTERNS,
  DEFAULT_COLOR_PATTERN,
  getThemeVariables,
} from "../../hasm_color_pattern/src/index.js";
import { errorLog, infoLog } from "../../hasm_logger/src/react/logger.js";

const EMPTY_WORKSPACE = {
  modelRoot: "",
  sections: {
    PERSON: [],
    EXPERIENCE: [],
    FACT: [],
    LINK: [],
  },
  counts: {
    PERSON: 0,
    EXPERIENCE: 0,
    FACT: 0,
    LINK: 0,
  },
};

function HasmModelFlow() {
  // Step 1. Define global UI/workspace state used across all pages.
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [page, setPage] = useState("boot");
  const [selectedEntityType, setSelectedEntityType] = useState("PERSON");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [activePatternId, setActivePatternId] = useState(DEFAULT_COLOR_PATTERN);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Step 2. Derive workspace-level computed values.
  const modelLoaded = Boolean(workspace.modelRoot);

  const totalCount = useMemo(
    () => ENTITY_TYPES.reduce((sum, entityType) => sum + (workspace.counts[entityType] || 0), 0),
    [workspace.counts],
  );

  // Step 3. Restore the previously selected theme pattern from localStorage.
  useEffect(() => {
    const saved = window.localStorage.getItem("hasm-theme-pattern");
    if (saved && COLOR_PATTERNS.some((pattern) => pattern.id === saved)) {
      setActivePatternId(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hasm-theme-pattern", activePatternId);
  }, [activePatternId]);

  // Step 4. Compute runtime CSS variables from the active color pattern.
  const themeStyle = useMemo(() => getThemeVariables(activePatternId), [activePatternId]);

  async function refreshWorkspace() {
    // Step 5. Re-open the current model root and refresh section/count snapshots.
    if (!workspace.modelRoot) {
      return;
    }

    const next = await openHasmModel(workspace.modelRoot);
    setWorkspace(next);
  }

  function openDetail(entityType, entityId) {
    // Step 6. Persist selected entity and route to detail page.
    setSelectedEntityType(entityType);
    setSelectedEntityId(entityId);
    setPage("detail");
  }

  // Step 7. Render page by current flow state: boot -> open -> visualize -> detail/draft.
  return (
    <main className="app-shell" style={themeStyle}>
      <div className="workspace-flow">
        <button
          type="button"
          className="theme-toggle-button"
          onClick={() => setThemePanelOpen((open) => !open)}
          aria-expanded={themePanelOpen}
          aria-controls="theme-panel"
        >
          Theme
        </button>

        {themePanelOpen ? (
          <ColorPatternSelector
            id="theme-panel"
            patterns={COLOR_PATTERNS}
            activePatternId={activePatternId}
            onChange={setActivePatternId}
            onClose={() => setThemePanelOpen(false)}
          />
        ) : null}

        {page === "boot" ? (
          <BootPage
            modelLoaded={modelLoaded}
            modelRoot={workspace.modelRoot}
            totalCount={totalCount}
            onContinue={() => setPage(modelLoaded ? "visualize" : "open")}
            onOpenModel={() => setPage("open")}
            onViewDraft={() => setPage("draft")}
          />
        ) : null}

        {page === "open" ? (
          <OpenModelPage
            initialPath={workspace.modelRoot}
            statusMessage={statusMessage}
            errorMessage={errorMessage}
            onBack={() => setPage("boot")}
            onCreateNew={() => {
              setStatusMessage("Create new HASM model flow is coming soon.");
              setErrorMessage("");
            }}
            onOpenSuccess={(nextWorkspace) => {
              infoLog("Model opened successfully", nextWorkspace.modelRoot);
              setWorkspace(nextWorkspace);
              setStatusMessage("Model opened successfully.");
              setErrorMessage("");
              setPage("visualize");
            }}
            onOpenFailure={(nextError) => {
              // Keep error state synchronized with UI feedback and logs.
              errorLog("Failed to open model", nextError);
              setErrorMessage(nextError);
              setStatusMessage("");
            }}
          />
        ) : null}

        {page === "visualize" ? (
          <VisualizeModelPage
            workspace={workspace}
            onBack={() => setPage("boot")}
            onOpenModel={() => setPage("open")}
            onSelectEntity={openDetail}
            onRefresh={async () => {
              try {
                await refreshWorkspace();
                infoLog("Model refreshed", workspace.modelRoot);
                setStatusMessage("Model refreshed.");
                setErrorMessage("");
              } catch (error) {
                // Capture refresh failures for troubleshooting while surfacing UI error.
                errorLog("Failed to refresh model", error);
                setErrorMessage(String(error));
              }
            }}
            statusMessage={statusMessage}
            errorMessage={errorMessage}
          />
        ) : null}

        {page === "detail" ? (
          <EntityDetailRouterPage
            modelRoot={workspace.modelRoot}
            entityType={selectedEntityType}
            entityId={selectedEntityId}
            onBack={() => setPage("visualize")}
            onSaveSuccess={async (message) => {
              infoLog("Entity save succeeded", selectedEntityType, selectedEntityId, message);
              setStatusMessage(message);
              setErrorMessage("");
              await refreshWorkspace();
            }}
            onSaveFailure={(message) => {
              // Persist save failures in state and log to aid post-mortem debugging.
              errorLog("Entity save failed", selectedEntityType, selectedEntityId, message);
              setErrorMessage(message);
            }}
          />
        ) : null}

        {page === "draft" ? (
          <section className="draft-page card-surface">
            <p className="eyebrow">Temporal Draft Page</p>
            <h2>3D visualize draft placeholder</h2>
            <p>
              This page intentionally keeps the old visualize direction as draft-only.
              The active front-end flow now follows Boot, Open Model, Visualize, and Detail.
            </p>
            <button type="button" className="primary-button" onClick={() => setPage("boot")}>
              Back To Boot
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default HasmModelFlow;