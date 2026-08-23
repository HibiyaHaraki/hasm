import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  checkWorkspaceLock,
  loadHasmModelDb,
  subscribeToTauriEvent,
  verifyHasmStorage,
  withTimeout,
} from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const logger = createLogger("loading-model");
const WATCHDOG_MS = 10000;

function LoadingModelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.state?.path;
  const redirectReason = location.state?.redirectReason || "";
  const watchdogRef = useRef();
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
    let unlistenLoad = () => {};
    let unlistenVerify = () => {};
    const fail = (message) => active && navigate("/error-model", { replace: true, state: { error: message } });
    const resetWatchdog = (message) => {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = window.setTimeout(() => fail(message), WATCHDOG_MS);
    };
    const handleProgress = (event) => {
      const progress = event?.payload || event;
      if (!progress || !active) return;
      resetWatchdog(`${progress.step === "STORAGE_VERIFY" ? "Storage verification" : "DB loading"} stalled`);
      setState((current) => ({ ...current, progress: progress.percentage, message: progress.message }));
    };

    async function load() {
      try {
        [unlistenLoad, unlistenVerify] = await Promise.all([
          subscribeToTauriEvent("model-load-progress", handleProgress),
          subscribeToTauriEvent("model-verify-progress", handleProgress),
        ]);
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
        window.clearTimeout(watchdogRef.current);
        if (active) {
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
        window.clearTimeout(watchdogRef.current);
        logger.error("[SEQ-MD-02][LOAD] model load failed", error);
        fail(error?.message || String(error));
      }
    }

    load();
    return () => {
      active = false;
      window.clearTimeout(watchdogRef.current);
      unlistenLoad();
      unlistenVerify();
    };
  }, [navigate, path]);

  return (
    <main className="boot-layout">
      <section className="boot-panel" aria-live="polite">
        <p className="sequence-label">HASM / SEQ-02</p>
        <h1>Loading workspace</h1>
        <p>{state.message}</p>
        <progress className="model-progress" value={state.progress} max="100">{state.progress}%</progress>
        <p>{Math.round(state.progress)}%</p>
        {state.notice ? <p className="model-notice">{state.notice}</p> : null}
      </section>
    </main>
  );
}

export default LoadingModelPage;