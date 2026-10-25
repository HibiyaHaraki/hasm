import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, ProgressBar } from "react-bootstrap";
import { computeVisualizerLayout, subscribeToTauriEvent } from "../features/hasm/api";
import { useTheme } from "../features/theme/ThemeContext";
import HasmVisualizerComponent from "../hasm_visualizer/HasmVisualizerComponent.jsx";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const WATCHDOG_MS = 10000;
const logger = createLogger("visualizer");

// The shared visualizer defaults to English sentence-case labels; SEQ-03 uses its own wording.
const VISUALIZER_LABELS = {
  timeScale: "Time scale",
  zScale: "Z scale",
  personScope: "PERSON scope",
  experienceScope: "EXPERIENCE scope",
  clearScope: "Clear scope",
};

function VisualizerPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const model = state?.model;
  const { activePatternId } = useTheme();
  const watchdogRef = useRef();
  const isFilterUpdateRef = useRef(false);
  const activeRef = useRef(false);
  const requestRef = useRef(null);
  const [renderState, setRenderState] = useState({ loading: true, progress: 0, message: "Initializing 3D engine...", warning: "", notice: "" });

  const fail = useCallback((error, isFilterUpdate) => {
    if (!activeRef.current) return;
    if (error?.message?.includes("ERR_NO_ACTIVE_MODEL")) return navigate("/select", { replace: true });
    if (error?.message?.includes("ERR_MODEL_NOT_VERIFIED")) return navigate("/loading-model", { replace: true, state: { path: state?.path, returnTo: "/visualizer" } });
    if (isFilterUpdate) return setRenderState((current) => ({ ...current, loading: false, notice: "Filter update timed out. Reverting view." }));
    return navigate("/error-model", { replace: true, state: { error: error?.message || "Layout calculation stalled" } });
  }, [navigate, state?.path]);

  const resetWatchdog = useCallback(() => {
    window.clearTimeout(watchdogRef.current);
    const request = requestRef.current;
    if (!activeRef.current || !request) return;
    watchdogRef.current = window.setTimeout(() => {
      if (requestRef.current !== request || !activeRef.current) return;
      requestRef.current = null;
      logger.error("[SEQ-MD-03][LAYOUT] active layout stalled");
      fail(new Error("Layout calculation stalled"), isFilterUpdateRef.current);
    }, WATCHDOG_MS);
  }, [fail]);

  // SEQ-MD-03/04: child layout effects may start work before parent passive effects.
  useLayoutEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      requestRef.current = null;
      window.clearTimeout(watchdogRef.current);
    };
  }, [model, state?.path]);

  useEffect(() => {
    if (!model) {
      navigate("/select", { replace: true });
      return undefined;
    }
    if (state?.isVerified === false) {
      navigate("/loading-model", { replace: true, state: { path: state.path, returnTo: "/visualizer" } });
      return undefined;
    }

    let active = true;
    let unlisten = () => {};
    subscribeToTauriEvent("visualizer-layout-progress", (event) => {
      if (!active || !activeRef.current || !requestRef.current) return;
      const progress = event?.payload || event;
      resetWatchdog();
      setRenderState((current) => ({ ...current, progress: progress.percentage, message: progress.message }));
    }).then((listener) => {
      if (!active) listener();
      else unlisten = listener;
    }).catch((error) => {
      if (active) {
        logger.error("[SEQ-MD-03][LAYOUT] progress subscription failed", error);
        fail(error, false);
      }
    });

    return () => { active = false; unlisten(); };
  }, [fail, model, navigate, resetWatchdog, state?.isVerified, state?.path]);

  // SEQ-03 geometry stays in Rust; the shared visualizer component owns the scene, the
  // PERSON/EXPERIENCE scope selection, and the render budget, and calls back here for layout.
  const computeLayout = useCallback(async (scopedModel, filter, { isFilterUpdate }) => {
    if (!activeRef.current) return null;
    const request = {};
    requestRef.current = request;
    isFilterUpdateRef.current = isFilterUpdate;
    setRenderState((current) => ({ ...current, loading: true, progress: 0, message: "Calculating 3D layout...", notice: "" }));
    resetWatchdog();
    try {
      const payload = await computeVisualizerLayout(scopedModel, filter);
      if (!activeRef.current || requestRef.current !== request) return null;
      requestRef.current = null;
      window.clearTimeout(watchdogRef.current);
      setRenderState((current) => ({ ...current, loading: false, warning: payload.warnings?.join(" ") || "" }));
      return payload;
    } catch (error) {
      if (!activeRef.current || requestRef.current !== request) {
        logger.debug("[SEQ-MD-03][LAYOUT] ignoring failure from an abandoned request");
        return null;
      }
      requestRef.current = null;
      window.clearTimeout(watchdogRef.current);
      logger.error("[SEQ-MD-03][LAYOUT] calculation failed", error);
      fail(error, isFilterUpdate);
      throw error;
    }
  }, [fail, resetWatchdog]);

  const openEntityTicket = useCallback((node) => {
    navigate(`/entity-detail/${node.entityType}/${node.id}`, { state: { ...state, model, isVerified: state?.isVerified !== false } });
  }, [model, navigate, state]);

  const factDatesById = useMemo(() => new Map((model?.facts || []).map((fact) => [fact.factId, fact.occurredAt])), [model]);

  if (!model || state?.isVerified === false) return null;

  return (
    <HasmVisualizerComponent
      colorPattern={activePatternId}
      labels={VISUALIZER_LABELS}
      model={model}
      computeLayout={computeLayout}
      onSelectNode={openEntityTicket}
      factDatesById={factDatesById}
      headerSlot={(
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h1 className="mb-0">Commit graph</h1>
        </div>
      )}
      toolbarSlot={(
        <Button className="btn-hasm-primary" onClick={() => navigate("/entity-create", { state: { path: state.path, model, isVerified: true } })}>
          Create New Entity
        </Button>
      )}
      overlaySlot={(
        <>
          {renderState.loading ? (
            <div className="graph-progress">
              <p>{renderState.message}</p>
              <ProgressBar now={renderState.progress} label={`${Math.round(renderState.progress)}%`} />
            </div>
          ) : null}
          {renderState.warning ? <p className="graph-warning">{renderState.warning}</p> : null}
          {renderState.notice ? <p className="graph-notice">{renderState.notice}</p> : null}
        </>
      )}
    />
  );
}

export default VisualizerPage;