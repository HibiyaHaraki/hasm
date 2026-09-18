import { useLocation, useNavigate } from "react-router-dom";
import { Button, Container } from "react-bootstrap";
import "./PanelCard.css";

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