import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPerson, loadHasmModelDb } from "../features/hasm/api";

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
    <main className="entity-create-page">
      <section className="entity-create-panel">
        <p className="sequence-label">HASM / SEQ-08</p>
        <h1>Initialize New HASM Model</h1>
        <p className="selection-copy">
          The visualizer requires at least one entity. Enter one PERSON name to bootstrap a minimal model.
        </p>

        <form className="entity-create-form" onSubmit={submit} noValidate>
          <label>
            PERSON name (required)
            <input
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              required
            />
          </label>

          <p className="selection-copy">Auto-applied: security level = 1, create root EXPERIENCE stream = true.</p>

          <div className="entity-create-actions">
            <button type="button" onClick={() => navigate("/select", { replace: true })}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !personName.trim()}>
              {submitting ? "Initializing..." : "Initialize and Open Visualizer"}
            </button>
          </div>

          {error ? <p className="validation-message">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

export default ModelInitializationPage;
