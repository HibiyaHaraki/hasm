import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  browseWorkspaceDirectory,
  cleanupTutorialWorkspace,
  createHasmWorkspace,
  createTutorialWorkspace,
  pickWorkspaceDirectory,
  validateHasmFolderPath,
  withTimeout,
} from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import { Button, Container, Form, InputGroup } from "react-bootstrap";
import "./PanelCard.css";
import "./SelectModelPage.css";

const logger = createLogger("select-model");

function normalizeWorkspacePath(value) {
  const path = value.trim();
  return path.length >= 2 && path.startsWith('"') && path.endsWith('"')
    ? path.slice(1, -1).trim()
    : path;
}

// [SEQ-MD-01][REQ-01-FUNC-503][REQ-01-FUNC-504][REQ-01-FUNC-505] Manual workspace path input with
// 300ms-debounced real-time validation under a 2,000ms IPC timeout.
// [REQ-01-FUNC-506][REQ-01-FUNC-508][REQ-01-FUNC-509] Enables/disables Open and shows inline warnings by validation state.
// [REQ-01-FUNC-510][REQ-01-FUNC-512][REQ-01-FUNC-601][REQ-01-FUNC-602] Captures the quote-normalized path and transfers it to /loading-model.
// [REQ-02-RULE-012][REQ-02-RULE-016] Browse and temporary tutorial workspace actions.
// [REQ-07-RULE-002] Displays redirectReason from router state and clears it to prevent duplicate notices.
// Create New HASM uses the native save dialog and workspace scaffolding (REQ-08-001 / REQ-08-002).
function SelectModelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectReason = location.state?.redirectReason || "";
  const [inputPath, setInputPath] = useState("");
  const [validation, setValidation] = useState({ status: "idle", message: location.state?.validationError || "" });
  const [workspaceCreateLoading, setWorkspaceCreateLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const tutorialRef = useRef(false);
  const mountedRef = useRef(false);
  const browsingRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!redirectReason) {
      return;
    }
    setValidation({ status: "invalid", message: redirectReason });
    navigate("/select", { replace: true, state: {} });
  }, [navigate, redirectReason]);

  useEffect(() => {
    const path = normalizeWorkspacePath(inputPath);
    if (!path) {
      setValidation((current) => {
        if (current.status === "invalid" && current.message) {
          return current;
        }
        return { status: "idle", message: "" };
      });
      return undefined;
    }

    let active = true;
    const debounceId = window.setTimeout(async () => {
      setValidation({ status: "checking", message: "Checking workspace path..." });
      try {
        await withTimeout(validateHasmFolderPath(path), 2000, "Path verification timed out.");
        if (active) setValidation({ status: "valid", message: "" });
      } catch (error) {
        if (active) {
          const message = error?.message === "Path verification timed out." ? error.message : "Invalid HASM workspace folder.";
          setValidation({ status: "invalid", message });
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(debounceId);
    };
  }, [inputPath]);

  function submit(event) {
    event.preventDefault();
    if (validation.status !== "valid" || submittingRef.current) return;

    submittingRef.current = true;
    logger.info("[SEQ-MD-01][SELECT] workspace selected manually");
    navigate("/loading-model", { state: { path: normalizeWorkspacePath(inputPath) } });
  }

  async function browseWorkspace() {
    if (browsingRef.current) return;
    browsingRef.current = true;
    setBrowsing(true);
    try {
      const selectedPath = await browseWorkspaceDirectory();
      if (!selectedPath) return;
      if (selectedPath !== inputPath) {
        setValidation({ status: "idle", message: "" });
        setInputPath(selectedPath);
      }
      logger.info("[SEQ-MD-02][SELECT] workspace folder selected with native dialog");
    } catch (error) {
      logger.error("[SEQ-MD-02][SELECT] workspace browsing failed", error);
      setValidation({ status: "invalid", message: error?.message || "Could not browse workspace folders." });
    } finally {
      browsingRef.current = false;
      setBrowsing(false);
    }
  }

  async function createNewWorkspace() {
    if (workspaceCreateLoading) return;
    setWorkspaceCreateLoading(true);
    try {
      const selectedPath = await pickWorkspaceDirectory("NewLife.hasm");
      if (!selectedPath) {
        setValidation({ status: "idle", message: "" });
        return;
      }
      const created = await withTimeout(
        createHasmWorkspace(selectedPath),
        3000,
        "Workspace scaffolding timed out.",
      );
      logger.info("[SEQ-MD-08][WORKSPACE] workspace created from select page", created.path);
      navigate("/loading-model", { state: { path: created.path } });
    } catch (error) {
      logger.error("[SEQ-MD-08][WORKSPACE] failed to create workspace", error);
      setValidation({
        status: "invalid",
        message: error?.message || "Failed to scaffold new workspace.",
      });
    } finally {
      setWorkspaceCreateLoading(false);
    }
  }

  async function startTutorial() {
    if (tutorialRef.current) return;
    tutorialRef.current = true;
    setTutorialLoading(true);
    try {
      const created = await createTutorialWorkspace();
      window.sessionStorage.setItem("hasm-tutorial-workspace", created.path);
      if (!mountedRef.current) {
        await cleanupTutorialWorkspace();
        window.sessionStorage.removeItem("hasm-tutorial-workspace");
        return;
      }
      logger.info("[SEQ-MD-02][TUTORIAL] opening example workspace");
      navigate("/loading-model", { state: { path: created.path } });
    } catch (error) {
      logger.error("[SEQ-MD-02][TUTORIAL] workspace creation failed", error);
      if (mountedRef.current) {
        setValidation({ status: "invalid", message: error?.message || String(error) });
      } else {
        window.dispatchEvent(new CustomEvent("hasm-tutorial-error", { detail: error?.message || String(error) }));
      }
      tutorialRef.current = false;
      setTutorialLoading(false);
    }
  }

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card">
        <p className="sequence-label">HASM WORKSPACE</p>
        <h1>Open a workspace</h1>
        <p className="selection-copy">Enter or browse for a HASM workspace folder, including folders ending in .hasm.</p>
        <Form onSubmit={submit} noValidate>
          <Form.Group controlId="workspace-path" className="mb-2">
            <Form.Label>Workspace folder</Form.Label>
            <InputGroup>
              <Form.Control
                value={inputPath}
                onChange={(event) => {
                  setValidation({ status: "idle", message: "" });
                  setInputPath(event.target.value);
                }}
                placeholder="C:\\HASM\\MyLife"
                autoComplete="off"
              />
              <Button type="button" className="btn-hasm-outline" variant="outline-secondary"
                onClick={browseWorkspace} disabled={browsing || tutorialLoading}>
                {browsing ? "Browsing..." : "Browse"}
              </Button>
              <Button type="submit" className="btn-hasm-primary" disabled={validation.status !== "valid" || submittingRef.current || tutorialLoading}>Open</Button>
            </InputGroup>
          </Form.Group>
          <p className="validation-message" role="status" data-status={validation.status}>{validation.message}</p>
        </Form>
        <Button
          variant="outline-secondary"
          className="btn-hasm-outline workspace-action-button"
          onClick={createNewWorkspace}
          disabled={workspaceCreateLoading || tutorialLoading}
        >
          {workspaceCreateLoading ? "Creating workspace..." : "Create New HASM"}
        </Button>
        <Button type="button" variant="outline-secondary" className="btn-hasm-outline workspace-action-button"
          onClick={() => setShowTutorial(!showTutorial)} aria-expanded={showTutorial} aria-controls="tutorial-guide"
          disabled={tutorialLoading}>
          Tutorial: explore an example
        </Button>
        {showTutorial ? (
          <section id="tutorial-guide" aria-label="Tutorial guide">
            <h2>Explore the example</h2>
            <p>This temporary Marie Curie example contains a PERSON, EXPERIENCES, FACTS and a LINK.</p>
            <ol>
              <li>Start the example and wait for workspace verification, then choose Go to visualization.</li>
              <li>Explore the timeline and select an entity to inspect its details and Markdown.</li>
              <li>Try editing or creating an entity, then return to the visualization.</li>
            </ol>
            <p>The temporary workspace and any edits are deleted when you switch models or close the app.</p>
            <Button className="btn-hasm-primary" onClick={startTutorial} disabled={tutorialLoading}>
              {tutorialLoading ? "Creating example..." : "Start tutorial"}
            </Button>
          </section>
        ) : null}
      </section>
    </Container>
  );
}

export default SelectModelPage;