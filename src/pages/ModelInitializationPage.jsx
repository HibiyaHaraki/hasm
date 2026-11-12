import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPerson, loadHasmModelDb } from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import { Button, Container, Form, Modal } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityFormPage.css";
import "./ModelInitializationPage.css";

const logger = createLogger("model-initialization");

function ModelInitializationPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const path = state?.path;
  const [personName, setPersonName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) {
      navigate("/select", { replace: true });
    }
  }, [navigate, path]);

  if (!path) return null;

  function review(event) {
    event.preventDefault();
    if (submittingRef.current || !personName.trim() || !event.currentTarget.checkValidity()) return;
    setError("");
    setShowConfirmation(true);
    logger.info("[SEQ-MD-08][INITIALIZE] reviewing model initialization");
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (!initialized) {
        await createPerson(path, {
          personName: personName.trim(),
          birthDate,
          personDescription: "",
          securityLevel: 1,
          createLifeExperience: true,
        });
        setInitialized(true);
        logger.info("[SEQ-MD-08][INITIALIZE] PERSON, Life EXPERIENCE and birth date FACT created");
      }
      const model = await loadHasmModelDb(path);
      navigate("/visualizer", { replace: true, state: { path, model, isVerified: true } });
    } catch (nextError) {
      logger.error("[SEQ-MD-08][INITIALIZE] initialization or model loading failed", nextError);
      setError(nextError?.message || "Failed to initialize model.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card panel-card--wide">
        <h1>Initialize New HASM Model</h1>
        <p className="selection-copy">
          Enter a PERSON name and birth date. Review the details before creating their life timeline.
        </p>

        <Form onSubmit={review}>
          <Form.Group className="mb-2" controlId="person-name">
            <Form.Label>PERSON name (required)</Form.Label>
            <Form.Control
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              required
              disabled={submitting || initialized}
            />
          </Form.Group>

          <Form.Group className="mb-2" controlId="birth-date">
            <Form.Label>Birth date (required)</Form.Label>
            <Form.Control type="date" min="0001-01-01" max="9999-12-31"
              value={birthDate} onChange={(event) => setBirthDate(event.target.value)}
              required disabled={submitting || initialized} />
          </Form.Group>

          <p className="selection-copy">Automatically creates a PERSON, Life EXPERIENCE, and birth date FACT.</p>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="outline-secondary" className="btn-hasm-outline" disabled={submitting} onClick={() => navigate("/select", { replace: true })}>
              Cancel
            </Button>
            <Button type="submit" className="btn-hasm-primary" disabled={submitting || !personName.trim() || !birthDate}>
              Review model
            </Button>
          </div>

        </Form>
      </section>
      <Modal show={showConfirmation} onHide={() => {
        if (!submitting && !initialized) setShowConfirmation(false);
      }} backdrop="static" keyboard={!submitting && !initialized}
        centered contentClassName="model-initialization-confirmation" aria-labelledby="confirm-model-title">
        <Modal.Header>
          <Modal.Title id="confirm-model-title">Confirm new HASM model</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <dl>
            <dt>PERSON name</dt><dd>{personName.trim()}</dd>
            <dt>Birth date</dt><dd>{birthDate}</dd>
            <dt>Life EXPERIENCE</dt><dd>{personName.trim()} Life</dd>
            <dt>Birth date FACT</dt><dd>{personName.trim()} Birth date</dd>
          </dl>
          <p>The birth date FACT will belong to this PERSON and their Life EXPERIENCE.</p>
          {error ? <p className="validation-message" role="alert">{error}</p> : null}
        </Modal.Body>
        <Modal.Footer>
          <Button className="btn-hasm-outline" variant="outline-secondary"
            disabled={submitting || initialized} onClick={() => setShowConfirmation(false)}>Back to edit</Button>
          <Button className="btn-hasm-primary" disabled={submitting} onClick={submit}>
            {submitting ? "Initializing..." : initialized ? "Retry opening visualizer" : "Confirm and create model"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default ModelInitializationPage;
