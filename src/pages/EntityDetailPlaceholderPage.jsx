import { useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import "./PanelCard.css";

function EntityDetailPlaceholderPage() {
  const { entityType, entityId } = useParams();
  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card">
        <h1>Entity detail</h1>
        <p>{entityType}: {entityId}</p>
      </section>
    </Container>
  )
}

export default EntityDetailPlaceholderPage;