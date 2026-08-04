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
import { COLOR_PATTERNS } from "./theme/colorPatterns";

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
  const [activePatternId, setActivePatternId] = useState(COLOR_PATTERNS[0].id);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Step 2. Derive workspace-level computed values.
  const modelLoaded = Boolean(workspace.modelRoot);

  const totalCount = useMemo(
    () => ENTITY_TYPES.reduce((sum, entityType) => sum + (workspace.counts[entityType] || 0), 0),
    [workspace.counts],
  );

  const activePattern = useMemo(
    () => COLOR_PATTERNS.find((pattern) => pattern.id === activePatternId) || COLOR_PATTERNS[0],
    [activePatternId],
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

  function toRgba(hexColor, alpha) {
    const hex = hexColor.replace("#", "");
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function mixHex(firstColor, secondColor, ratio) {
    const a = firstColor.replace("#", "");
    const b = secondColor.replace("#", "");

    const ar = Number.parseInt(a.slice(0, 2), 16);
    const ag = Number.parseInt(a.slice(2, 4), 16);
    const ab = Number.parseInt(a.slice(4, 6), 16);

    const br = Number.parseInt(b.slice(0, 2), 16);
    const bg = Number.parseInt(b.slice(2, 4), 16);
    const bb = Number.parseInt(b.slice(4, 6), 16);

    const rr = Math.round(ar + (br - ar) * ratio);
    const rg = Math.round(ag + (bg - ag) * ratio);
    const rb = Math.round(ab + (bb - ab) * ratio);

    return `#${rr.toString(16).padStart(2, "0")}${rg.toString(16).padStart(2, "0")}${rb.toString(16).padStart(2, "0")}`;
  }

  // Step 4. Compute runtime CSS variables from the active color pattern.
  const mainColor = activePattern.colors.mainColor;
  const textColor = activePattern.colors.textColor;
  const textBackgroundColor = activePattern.colors.textBackgroundColor;
  const secondaryColor = activePattern.colors.secondaryColor ?? mixHex(mainColor, textColor, 0.22);
  const surfaceColor = activePattern.colors.surfaceColor ?? textBackgroundColor;
  const mutedColor = activePattern.colors.mutedColor ?? toRgba(textColor, 0.74);
  const borderColor = activePattern.colors.borderColor ?? toRgba(textColor, 0.28);
  const softColor = activePattern.colors.softColor ?? toRgba(textBackgroundColor, 0.86);
  const inputBgColor = activePattern.colors.inputBgColor ?? toRgba(textBackgroundColor, 0.74);
  const inputTextColor = activePattern.colors.inputTextColor ?? textColor;
  const successColor = activePattern.colors.successColor ?? mixHex(mainColor, "#22c55e", 0.58);
  const dangerColor = activePattern.colors.dangerColor ?? mixHex(mainColor, "#ef4444", 0.62);

  const themeStyle = {
    "--theme-primary": mainColor,
    "--theme-secondary": secondaryColor,
    "--theme-surface": surfaceColor,
    "--theme-text": textColor,
    "--theme-muted": mutedColor,
    "--theme-border": borderColor,
    "--theme-soft": softColor,
    "--theme-textbackground": textBackgroundColor,
    "--theme-input-bg": inputBgColor,
    "--theme-input-text": inputTextColor,
    "--theme-success": successColor,
    "--theme-danger": dangerColor,
  };

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
            onOpenSuccess={(nextWorkspace) => {
              setWorkspace(nextWorkspace);
              setStatusMessage("Model opened successfully.");
              setErrorMessage("");
              setPage("visualize");
            }}
            onOpenFailure={(nextError) => {
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
                setStatusMessage("Model refreshed.");
                setErrorMessage("");
              } catch (error) {
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
              setStatusMessage(message);
              setErrorMessage("");
              await refreshWorkspace();
            }}
            onSaveFailure={(message) => {
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