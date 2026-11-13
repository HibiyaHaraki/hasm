import { useLocation, useNavigate } from "react-router-dom";
import { Button, Container } from "react-bootstrap";
import "./PanelCard.css";

// [SEQ-MD-06][REQ-06-RULE-001][REQ-06-FUNC-201] Model workspace error fallback screen for /error-model:
// renders the workspace failure message from router state.
// [REQ-06-FUNC-206] Choose workspace navigates back to /select without throwing state errors.
function ErrorModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card border-danger" role="alert">
        <p className="sequence-label">HASM / MODEL ERROR</p>
        <h1>Workspace could not load</h1>
        <p>{location.state?.error || "The workspace is unavailable."}</p>
        <Button className="btn-hasm-primary" onClick={() => navigate("/select", { replace: true })}>Choose workspace</Button>
      </section>
    </Container>
  );
}

export default ErrorModelPage;