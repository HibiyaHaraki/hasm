import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPerson, loadHasmModelDb } from "../features/hasm/api";
import { Button, Container, Form } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityFormPage.css";

function ModelInitializationPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const path = state?.path;
  const [personName, setPersonName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) {
      navigate("/select", { replace: true });
    }
  }, [navigate, path]);

  if (!path) return null;

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await createPerson(path, {
        personName,
        personDescription: "",
        securityLevel: 1,
        createLifeExperience: true,
      });
      const model = await loadHasmModelDb(path);
      navigate("/visualizer", { replace: true, state: { path, model, isVerified: true } });
    } catch (nextError) {
      setError(nextError?.message || "Failed to initialize model.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card panel-card--wide">
        <h1>Initialize New HASM Model</h1>
        <p className="selection-copy">
          The visualizer requires at least one entity. Enter one PERSON name to bootstrap a minimal model.
        </p>

        <Form onSubmit={submit} noValidate>
          <Form.Group className="mb-2" controlId="person-name">
            <Form.Label>PERSON name (required)</Form.Label>
            <Form.Control
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              required
            />
          </Form.Group>

          <p className="selection-copy">Auto-applied: security level = 1, create root EXPERIENCE stream = true.</p>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="outline-secondary" className="btn-hasm-outline" onClick={() => navigate("/select", { replace: true })}>
              Cancel
            </Button>
            <Button type="submit" className="btn-hasm-primary" disabled={submitting || !personName.trim()}>
              {submitting ? "Initializing..." : "Initialize and Open Visualizer"}
            </Button>
          </div>

          {error ? <p className="validation-message">{error}</p> : null}
        </Form>
      </section>
    </Container>
  );
}

export default ModelInitializationPage;
