import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Container } from "react-bootstrap";
import { cleanupTutorialWorkspace } from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import "./PanelCard.css";

const logger = createLogger("error-model");
// [SEQ-MD-06][REQ-06-RULE-001][REQ-06-FUNC-201] Model workspace error fallback screen for /error-model:
// renders the workspace failure message from router state.
// [REQ-06-FUNC-206][REQ-02-RULE-016] Choose workspace removes a temporary tutorial before returning.
function ErrorModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [cleanupError, setCleanupError] = useState("");
  async function chooseWorkspace() {
    try {
      if (window.sessionStorage.getItem("hasm-tutorial-workspace")) {
        await cleanupTutorialWorkspace();
        window.sessionStorage.removeItem("hasm-tutorial-workspace");
        window.sessionStorage.removeItem("hasm-active-workspace");
        window.sessionStorage.removeItem("hasm-workspace-read-only");
      }
      navigate("/select", { replace: true });
    } catch (error) {
      logger.error("[SEQ-MD-02][TUTORIAL] cleanup failed", error);
      setCleanupError(error?.message || String(error));
    }
  }
  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card border-danger" role="alert">
        <p className="sequence-label">HASM / MODEL ERROR</p>
        <h1>Workspace could not load</h1>
        <p>{location.state?.error || "The workspace is unavailable."}</p>
        {cleanupError ? <p>{cleanupError}</p> : null}
        <Button className="btn-hasm-primary" onClick={chooseWorkspace}>Choose workspace</Button>
      </section>
    </Container>
  );
}

export default ErrorModelPage;