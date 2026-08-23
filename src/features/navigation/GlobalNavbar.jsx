import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLOR_PATTERNS } from "../../hasm_color_pattern/src/index.js";
import { switchWorkspaceCleanly } from "../hasm/api";
import { useTheme } from "../theme/ThemeContext";

function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activePatternId, setActivePatternId } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const workspacePath =
    location.state?.path ||
    window.sessionStorage.getItem("hasm-active-workspace") ||
    "No workspace selected";

  const readOnly = window.sessionStorage.getItem("hasm-workspace-read-only") === "true";
  const isVerified = location.state?.isVerified !== false && Boolean(location.state?.model || window.sessionStorage.getItem("hasm-active-workspace"));
  const warnings = location.state?.warnings?.length || 0;

  const statusLabel = useMemo(() => {
    if (!workspacePath || workspacePath === "No workspace selected") return "Unloaded";
    if (readOnly) return "Read-Only";
    if (!isVerified) return "Needs Verify";
    return "Ready";
  }, [workspacePath, readOnly, isVerified]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  async function switchModel() {
    const path = window.sessionStorage.getItem("hasm-active-workspace");
    if (path) {
      await switchWorkspaceCleanly(path, readOnly);
    }
    window.sessionStorage.removeItem("hasm-active-workspace");
    window.sessionStorage.removeItem("hasm-workspace-read-only");
    navigate("/select", { replace: true });
  }

  return (
    <header className={`global-navbar${isMenuOpen ? " is-menu-open" : ""}`}>
      <div className="global-navbar-title">
        <strong>HASM</strong>
      </div>

      <button
        type="button"
        className="global-navbar-hamburger"
        aria-label="Toggle menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true">{isMenuOpen ? "Close" : "Menu"}</span>
      </button>

      <div className="global-navbar-status" aria-live="polite">
        <span className="status-chip">Workspace: {workspacePath}</span>
        <span className="status-chip">Status: {statusLabel}</span>
        <span className="status-chip">Warnings: {warnings}</span>
      </div>

      <div className="global-navbar-actions">
        <label htmlFor="global-theme-select" className="theme-inline-label">Theme</label>
        <select
          id="global-theme-select"
          value={activePatternId}
          onChange={(event) => setActivePatternId(event.target.value)}
        >
          {COLOR_PATTERNS.map((pattern) => (
            <option key={pattern.id} value={pattern.id}>
              {pattern.label}
            </option>
          ))}
        </select>
        <button type="button" className="switch-model-button" onClick={switchModel}>Switch Model</button>
      </div>
    </header>
  );
}

export default GlobalNavbar;
