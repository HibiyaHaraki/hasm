import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createHasmWorkspace,
  createVisualizerDemoWorkspace,
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

function SelectModelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectReason = location.state?.redirectReason || "";
  const [inputPath, setInputPath] = useState("");
  const [validation, setValidation] = useState({ status: "idle", message: location.state?.validationError || "" });
  const [workspaceCreateLoading, setWorkspaceCreateLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const submittingRef = useRef(false);

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

  async function openVisualizerDemo() {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const demo = await createVisualizerDemoWorkspace();
      logger.info("[SEQ-MD-03][DEMO] opening populated visualizer workspace");
      navigate("/visualizer", { state: { path: demo.path, model: demo.model, isVerified: true } });
    } catch (error) {
      logger.error("[SEQ-MD-03][DEMO] failed to create visualizer workspace", error);
      setValidation({ status: "invalid", message: error?.message || "Could not create the visualizer test workspace." });
    } finally {
      setDemoLoading(false);
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

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card">
        <p className="sequence-label">HASM WORKSPACE</p>
        <h1>Open a workspace</h1>
        <p className="selection-copy">Enter the folder containing the HASM workspace you want to load.</p>
        <Form onSubmit={submit} noValidate>
          <Form.Group controlId="workspace-path" className="mb-2">
            <Form.Label>Workspace folder</Form.Label>
            <InputGroup>
              <Form.Control
                value={inputPath}
                onChange={(event) => setInputPath(event.target.value)}
                placeholder="C:\\HASM\\MyLife"
                autoComplete="off"
              />
              <Button type="submit" className="btn-hasm-primary" disabled={validation.status !== "valid" || submittingRef.current}>Open</Button>
            </InputGroup>
          </Form.Group>
          <p className="validation-message" role="status" data-status={validation.status}>{validation.message}</p>
        </Form>
        <Button
          variant="outline-secondary"
          className="btn-hasm-outline demo-visualizer-button"
          onClick={openVisualizerDemo}
          disabled={demoLoading}
        >
          {demoLoading ? "Creating test graph..." : "Test 3D commit graph"}
        </Button>
        <Button
          variant="outline-secondary"
          className="btn-hasm-outline demo-visualizer-button"
          onClick={createNewWorkspace}
          disabled={workspaceCreateLoading}
        >
          {workspaceCreateLoading ? "Creating workspace..." : "Create New HASM"}
        </Button>
      </section>
    </Container>
  );
}

export default SelectModelPage;