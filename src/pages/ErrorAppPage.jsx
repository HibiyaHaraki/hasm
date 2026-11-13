import { useLocation, useNavigate } from "react-router-dom";
import { Button, Container } from "react-bootstrap";
import "./PanelCard.css";

// [SEQ-MD-06][REQ-06-RULE-001][REQ-06-FUNC-101] App system error fallback screen for /error-app:
// renders the startup validation error message from router state without crashing.
// [REQ-06-FUNC-102] Retry re-runs the SEQ-01 boot validation by navigating back to the boot gate.
function ErrorAppPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = location.state?.error || "The HASM application could not complete startup validation.";
  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card border-danger" role="alert">
        <p className="sequence-label">HASM / STARTUP ERROR</p>
        <h1>Application validation failed</h1>
        <p>{message}</p>
        <Button className="btn-hasm-primary" onClick={() => navigate("/", { replace: true })}>Retry</Button>
      </section>
    </Container>
  );
}

export default ErrorAppPage;