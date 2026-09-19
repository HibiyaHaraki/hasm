import { useLocation, useNavigate } from "react-router-dom";
import { Button, Container } from "react-bootstrap";
import "./PanelCard.css";

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