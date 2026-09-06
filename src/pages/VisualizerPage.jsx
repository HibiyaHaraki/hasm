import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const [renderState, setRenderState] = useState({ loading: true, progress: 0, message: "Initializing 3D engine...", warning: "", notice: "" });

  const fail = useCallback((error, isFilterUpdate) => {
    if (error?.message?.includes("ERR_NO_ACTIVE_MODEL")) return navigate("/select", { replace: true });
    if (error?.message?.includes("ERR_MODEL_NOT_VERIFIED")) return navigate("/loading-model", { replace: true, state: { path: state?.path, returnTo: "/visualizer" } });
    if (isFilterUpdate) return setRenderState((current) => ({ ...current, loading: false, notice: "Filter update timed out. Reverting view." }));
    return navigate("/error-model", { replace: true, state: { error: error?.message || "Layout calculation stalled" } });
  }, [navigate, state?.path]);

  const resetWatchdog = useCallback(() => {
    window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => fail(new Error("Layout calculation stalled"), isFilterUpdateRef.current), WATCHDOG_MS);
  }, [fail]);

  useEffect(() => {
    if (!model) {
      navigate("/select", { replace: true });
      return undefined;
    }
    if (state?.isVerified === false) {
      navigate("/loading-model", { replace: true, state: { path: state.path, returnTo: "/visualizer" } });
      return undefined;
    }

    let unlisten = () => {};
    subscribeToTauriEvent("visualizer-layout-progress", (event) => {
      const progress = event?.payload || event;
      resetWatchdog();
      setRenderState((current) => ({ ...current, progress: progress.percentage, message: progress.message }));
    }).then((listener) => { unlisten = listener; }).catch((error) => fail(error, false));

    return () => { window.clearTimeout(watchdogRef.current); unlisten(); };
  }, [fail, model, navigate, resetWatchdog, state?.isVerified, state?.path]);

  // SEQ-03 geometry stays in Rust; the shared visualizer component owns the scene, the
  // PERSON/EXPERIENCE scope selection, and the render budget, and calls back here for layout.
  const computeLayout = useCallback(async (scopedModel, filter, { isFilterUpdate }) => {
    isFilterUpdateRef.current = isFilterUpdate;
    setRenderState((current) => ({ ...current, loading: true, progress: 0, message: "Calculating 3D layout...", notice: "" }));
    resetWatchdog();
    try {
      const payload = await computeVisualizerLayout(scopedModel, filter);
      window.clearTimeout(watchdogRef.current);
      setRenderState((current) => ({ ...current, loading: false, warning: payload.warnings?.join(" ") || "" }));
      return payload;
    } catch (error) {
      window.clearTimeout(watchdogRef.current);
      logger.error("[SEQ-MD-03][LAYOUT] calculation failed", error);
      fail(error, isFilterUpdate);
      throw error;
    }
  }, [fail, resetWatchdog]);

  const openEntityTicket = useCallback((node) => {
    navigate(`/entity-detail/${node.entityType}/${node.id}`, { state: { path: state?.path, model, isVerified: state?.isVerified !== false } });
  }, [model, navigate, state?.isVerified, state?.path]);

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
        <div className="visualizer-page-header">
          <p className="sequence-label">HASM / SEQ-03</p>
          <h1>Commit graph</h1>
        </div>
      )}
      toolbarSlot={(
        <button type="button" onClick={() => navigate("/entity-create", { state: { path: state.path, model, isVerified: true } })}>
          Create New Entity
        </button>
      )}
      overlaySlot={(
        <>
          {renderState.loading ? (
            <div className="graph-progress">
              <p>{renderState.message}</p>
              <progress value={renderState.progress} max="100">{renderState.progress}%</progress>
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