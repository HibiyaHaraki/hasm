import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Container, Form, Nav, Navbar } from "react-bootstrap";
import { COLOR_PATTERNS } from "../../hasm_color_pattern/src/index.js";
import { switchWorkspaceCleanly } from "../hasm/api";
import { useTheme } from "../theme/ThemeContext";
import "./GlobalNavbar.css";

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
    <Navbar
      className="global-navbar"
      expand="md"
      sticky="top"
      expanded={isMenuOpen}
      onToggle={setIsMenuOpen}
    >
      <Container fluid>
        <Navbar.Brand className="global-navbar-brand">
          <img src="./src/icons/hasm_favicon.png" alt="" />
          <strong>HASM</strong>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="global-navbar-collapse" aria-label="Toggle menu" />
        <Navbar.Collapse id="global-navbar-collapse">
          <Nav className="me-auto align-items-md-center gap-2 flex-wrap" aria-live="polite">
            <Badge bg="none" className="status-chip">Workspace: {workspacePath}</Badge>
            <Badge bg="none" className="status-chip">Status: {statusLabel}</Badge>
            <Badge bg="none" className="status-chip">Warnings: {warnings}</Badge>
          </Nav>
          <Nav className="align-items-md-center gap-2">
            <Form.Label htmlFor="global-theme-select" className="theme-inline-label mb-0">Theme</Form.Label>
            <Form.Select
              id="global-theme-select"
              size="sm"
              className="global-navbar-theme-select"
              value={activePatternId}
              onChange={(event) => setActivePatternId(event.target.value)}
            >
              {COLOR_PATTERNS.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.label}
                </option>
              ))}
            </Form.Select>
            <Button size="sm" className="btn-hasm-outline" onClick={switchModel}>Switch Model</Button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default GlobalNavbar;
