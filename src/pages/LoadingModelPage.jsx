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
import { Container, ProgressBar } from "react-bootstrap";
import "./PanelCard.css";
import "./LoadingModelPage.css";

const logger = createLogger("loading-model");
const WATCHDOG_MS = 10000;

function LoadingModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.state?.path;
  const redirectReason = location.state?.redirectReason || "";
  const [state, setState] = useState({ progress: 0, message: "Initializing workspace...", notice: "" });

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
    let watchdog;
    const listeners = [];
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
    const handleProgress = (event) => {
      const progress = event?.payload || event;
      if (!progress || !active) return;
      resetWatchdog(`${progress.step === "STORAGE_VERIFY" ? "Storage verification" : "DB loading"} stalled`);
      setState((current) => ({ ...current, progress: progress.percentage, message: progress.message }));
    };

    async function load() {
      try {
        // SEQ-MD-02: register ownership individually, including partial/late IPC resolution.
        await Promise.all(["model-load-progress", "model-verify-progress"].map(async (name) => {
          const unlisten = await subscribeToTauriEvent(name, handleProgress);
          if (!active) unlisten();
          else listeners.push(unlisten);
        }));
        if (!active) return;
        const lock = await withTimeout(checkWorkspaceLock(path), 3000, "Lock check timed out");
        if (!active) return;
        window.sessionStorage.setItem("hasm-active-workspace", path);
        window.sessionStorage.setItem("hasm-workspace-read-only", String(lock.isReadOnly));
        if (lock.isStaleRecovered) setState((current) => ({ ...current, notice: "Recovered stale lock file from previous process crash." }));
        if (lock.isReadOnly) setState((current) => ({ ...current, notice: "Opened in Read-Only Mode" }));

        resetWatchdog("DB loading stalled");
        const model = await loadHasmModelDb(path);
        if (!active) return;
        resetWatchdog("Storage verification stalled");
        const verification = await verifyHasmStorage(path, model);
        if (active) {
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
          navigate("/visualizer", { replace: true, state: { path, model, isVerified: true, isReadOnly: lock.isReadOnly, warnings: verification.unreferencedEntities } });
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
      <section className="panel-card" aria-live="polite">
        <h1>Loading workspace</h1>
        <p>{state.message}</p>
        <ProgressBar now={state.progress} label={`${Math.round(state.progress)}%`} />
        {state.notice ? <p className="model-notice">{state.notice}</p> : null}
      </section>
    </Container>
  );
}

export default LoadingModelPage;