import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  checkWorkspaceLock,
  loadHasmModelDb,
  subscribeToTauriEvent,
  verifyHasmStorage,
  withTimeout,
} from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import { Button, Container, ProgressBar } from "react-bootstrap";
import "./PanelCard.css";
import "./LoadingModelPage.css";

const logger = createLogger("loading-model");
const WATCHDOG_MS = 10000;
const LOADING_STEPS = [
  { id: "SUBSCRIPTIONS", title: "Prepare progress listeners" },
  { id: "WORKSPACE_LOCK", title: "Check workspace lock" },
  { id: "DB_LOAD", title: "Load database metadata" },
  { id: "DB_SYNC", title: "Synchronize workspace folders", parent: "DB_LOAD" },
  { id: "DB_LOAD_PERSON", title: "Load PERSON entities", parent: "DB_LOAD", collection: "people" },
  { id: "DB_LOAD_EXPERIENCE", title: "Load EXPERIENCE entities", parent: "DB_LOAD", collection: "experiences" },
  { id: "DB_LOAD_FACT", title: "Load FACT entities", parent: "DB_LOAD", collection: "facts" },
  { id: "DB_LOAD_LINK", title: "Load LINK entities", parent: "DB_LOAD", collection: "links" },
  { id: "STORAGE_VERIFY", title: "Verify workspace storage" },
];
const DATABASE_STEPS = LOADING_STEPS.filter((step) => step.parent === "DB_LOAD");

function initialSteps() {
  return LOADING_STEPS.map((step) => ({
    ...step, status: "Waiting", progress: 0, message: "", current: null, total: null,
  }));
}

function LoadingModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.state?.path;
  const redirectReason = location.state?.redirectReason || "";
  const [state, setState] = useState(() => ({ steps: initialSteps(), notice: "", result: null }));
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!redirectReason) {
      return;
    }
    setState((current) => ({ ...current, notice: redirectReason }));
    navigate("/loading-model", { replace: true, state: { path } });
  }, [navigate, path, redirectReason]);

  useEffect(() => {
    if (!path) {
      navigate("/error-model", { replace: true, state: { error: "No workspace path was supplied." } });
      return undefined;
    }

    let active = true;
    let activeStep = "SUBSCRIPTIONS";
    let databaseStepIndex = -1;
    let watchdog;
    const listeners = [];
    const updateStep = (id, patch) => {
      setState((current) => ({
        ...current,
        steps: current.steps.map((step) => step.id === id ? { ...step, ...patch } : step),
      }));
    };
    const startStep = (id, message) => {
      activeStep = id;
      updateStep(id, { status: "In progress", message });
      logger.debug(`[SEQ-MD-02][PROGRESS] starting ${id}`);
    };
    const completeStep = (id, message) => {
      updateStep(id, { status: "Complete", progress: 100, message, current: null, total: null });
    };
    setState((current) => ({ ...current, steps: initialSteps(), result: null }));
    setShowDetail(false);
    startStep("SUBSCRIPTIONS", "Connecting to workspace progress events...");
    const stop = () => {
      active = false;
      window.clearTimeout(watchdog);
      listeners.splice(0).forEach((unlisten) => unlisten());
    };
    const fail = (message) => {
      if (!active) return;
      stop();
      logger.error("[SEQ-MD-02][LOAD] model load failed", message);
      navigate("/error-model", { replace: true, state: { error: message } });
    };
    const resetWatchdog = (message) => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => fail(message), WATCHDOG_MS);
    };
    const handleProgress = (stepId, event) => {
      const progress = event?.payload || event;
      // SEQ-MD-02: a completed stage must not overwrite progress or extend the next watchdog.
      if (!progress || !active || activeStep !== stepId) return;
      if (!Number.isFinite(progress.percentage) || progress.percentage < 0 || progress.percentage > 100) {
        logger.warn("[SEQ-MD-02][PROGRESS] ignoring invalid progress percentage");
        return;
      }
      const databaseIndex = DATABASE_STEPS.findIndex((step) => step.id === progress.step);
      if (stepId === "DB_LOAD" && databaseIndex >= 0) {
        if (databaseIndex < databaseStepIndex) return;
        databaseStepIndex = databaseIndex;
        setState((current) => ({
          ...current,
          steps: current.steps.map((step) => {
            const index = DATABASE_STEPS.findIndex((item) => item.id === step.id);
            if (index >= 0 && index < databaseIndex) return { ...step, status: "Complete", progress: 100 };
            if (index === databaseIndex) return {
              ...step, status: "In progress", progress: progress.percentage, message: progress.message,
              current: progress.current, total: progress.total,
            };
            return step;
          }),
        }));
      } else if (progress.step && progress.step !== stepId) {
        logger.warn("[SEQ-MD-02][PROGRESS] ignoring unexpected progress stage");
        return;
      }
      resetWatchdog(`${stepId === "STORAGE_VERIFY" ? "Storage verification" : "DB loading"} stalled`);
      updateStep(stepId, {
        progress: databaseIndex >= 0
          ? Math.round((databaseIndex + progress.percentage / 100) / DATABASE_STEPS.length * 100)
          : progress.percentage,
        message: progress.message,
        current: progress.current, total: progress.total,
      });
    };

    async function load() {
      try {
        // SEQ-MD-02: register ownership individually, including partial/late IPC resolution.
        await Promise.all(["model-load-progress", "model-verify-progress"].map(async (name) => {
          const stepId = name === "model-load-progress" ? "DB_LOAD" : "STORAGE_VERIFY";
          const unlisten = await subscribeToTauriEvent(name, (event) => handleProgress(stepId, event));
          if (!active) unlisten();
          else listeners.push(unlisten);
        }));
        if (!active) return;
        completeStep("SUBSCRIPTIONS", "Workspace progress events connected.");
        startStep("WORKSPACE_LOCK", "Checking access and recovering stale locks...");
        const lock = await withTimeout(checkWorkspaceLock(path), 3000, "Lock check timed out");
        if (!active) return;
        completeStep("WORKSPACE_LOCK", lock.isReadOnly ? "Read-only access confirmed." : "Writable access confirmed.");
        window.sessionStorage.setItem("hasm-active-workspace", path);
        window.sessionStorage.setItem("hasm-workspace-read-only", String(lock.isReadOnly));
        if (lock.isStaleRecovered) setState((current) => ({ ...current, notice: "Recovered stale lock file from previous process crash." }));
        if (lock.isReadOnly) setState((current) => ({ ...current, notice: "Opened in Read-Only Mode" }));

        startStep("DB_LOAD", "Opening workspace database and synchronizing folders...");
        resetWatchdog("DB loading stalled");
        const model = await loadHasmModelDb(path);
        if (!active) return;
        setState((current) => ({
          ...current,
          steps: current.steps.map((step) => step.parent === "DB_LOAD" ? {
            ...step, status: "Complete", progress: 100,
            message: step.collection ? `${model[step.collection]?.length || 0} entities loaded.` : "Workspace folders synchronized.",
            current: null, total: null,
          } : step),
        }));
        completeStep("DB_LOAD", "Database metadata loaded.");
        startStep("STORAGE_VERIFY", "Checking required Markdown files and unreferenced folders...");
        resetWatchdog("Storage verification stalled");
        const verification = await verifyHasmStorage(path, model);
        if (active) {
          completeStep("STORAGE_VERIFY", "Workspace storage verified.");
          stop();
          const totalEntities =
            (model.people?.length || 0) +
            (model.experiences?.length || 0) +
            (model.facts?.length || 0) +
            (model.links?.length || 0);

          if (totalEntities === 0) {
            navigate("/initialize-model", { replace: true, state: { path } });
            return;
          }

          logger.info("[SEQ-MD-02][LOAD] workspace loaded and verified");
          setState((current) => ({
            ...current,
            result: { path, model, isVerified: true, isReadOnly: lock.isReadOnly, warnings: verification.unreferencedEntities },
          }));
        }
      } catch (error) {
        fail(error?.message || String(error));
      }
    }

    load();
    return stop;
  }, [navigate, path]);

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card model-loading-card">
        <h1>{state.result?.path === path ? "Workspace ready" : "Loading workspace"}</h1>
        <ol className="model-loading-stepper" aria-label="Workspace loading steps">
          {state.steps.filter((step) => !step.parent).map((step, index) => (
            <li key={step.id} data-status={step.status} aria-current={step.status === "In progress" ? "step" : undefined}>
              <span className="model-loading-step-number" aria-hidden="true">{index + 1}</span>
              <span>{step.title}<span className="model-loading-step-status">{step.status}</span></span>
            </li>
          ))}
        </ol>
        <div className="model-loading-actions">
          <Button className="btn-hasm-outline" variant="outline-secondary" aria-expanded={showDetail}
            aria-controls="model-loading-details" onClick={() => setShowDetail((current) => !current)}>
            {showDetail ? "Hide detail" : "Show detail"}
          </Button>
          {state.result?.path === path ? (
            <Button className="btn-hasm-primary" onClick={() => {
              logger.info("[SEQ-MD-02][LOAD] opening verified workspace visualization");
              navigate("/visualizer", { replace: true, state: state.result });
            }}>Go to visualization</Button>
          ) : null}
        </div>
        <div id="model-loading-details" hidden={!showDetail}>
          <ol className="model-loading-steps" aria-label="Detailed loading progress">
            {state.steps.map((step) => (
              <li key={step.id} className={`model-loading-step${step.parent ? " model-loading-substep" : ""}`} data-status={step.status}>
                <div className="model-loading-step-heading">
                  <h2>{step.title}</h2>
                  <span>{step.status}</span>
                </div>
                <ProgressBar>
                  <ProgressBar now={step.progress} aria-label={step.title}
                    aria-valuetext={`${step.status}, ${Math.round(step.progress)}%`}
                    label={`${Math.round(step.progress)}%`} />
                </ProgressBar>
                <p className="model-loading-step-message" role="status">
                  {step.message || "Waiting for the previous step."}
                  {Number.isInteger(step.current) && Number.isInteger(step.total) && step.total >= 0
                    ? ` (${step.current} / ${step.total})` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
        {state.result?.path === path ? <p role="status">Loading complete. Choose Go to visualization when you are ready.</p> : null}
        {state.notice ? <p className="model-notice">{state.notice}</p> : null}
      </section>
    </Container>
  );
}

export default LoadingModelPage;