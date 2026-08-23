import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { computeVisualizerLayout, subscribeToTauriEvent } from "../features/hasm/api";
import { useTheme } from "../features/theme/ThemeContext";
import { DEFAULT_LAYOUT_FILTER, nextLayoutFilter, TIME_SCALE_MODES } from "../features/visualizer/layoutFilter";
import { createCommitGraph } from "../features/visualizer/threeCommitGraph";
import { getPatternById } from "../hasm_color_pattern/src/index.js";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const WATCHDOG_MS = 10000;
const logger = createLogger("visualizer");

function VisualizerPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const model = state?.model;
  const { activePatternId } = useTheme();
  const sceneRef = useRef(null);
  const disposeSceneRef = useRef(() => {});
  const watchdogRef = useRef();
  const hasRenderedLayoutRef = useRef(false);
  const [filter, setFilter] = useState(DEFAULT_LAYOUT_FILTER);
  const [renderState, setRenderState] = useState({ loading: true, progress: 0, message: "Initializing 3D engine...", warning: "", notice: "", tooltip: null });

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
    const fail = (error, isFilterUpdate) => {
      if (!active) return;
      if (error?.message?.includes("ERR_NO_ACTIVE_MODEL")) return navigate("/select", { replace: true });
      if (error?.message?.includes("ERR_MODEL_NOT_VERIFIED")) return navigate("/loading-model", { replace: true, state: { path: state.path, returnTo: "/visualizer" } });
      if (isFilterUpdate) return setRenderState((current) => ({ ...current, loading: false, notice: "Filter update timed out. Reverting view." }));
      navigate("/error-model", { replace: true, state: { error: error?.message || "Layout calculation stalled" } });
    };
    const resetWatchdog = (isFilterUpdate) => {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = window.setTimeout(() => fail(new Error("Layout calculation stalled"), isFilterUpdate), WATCHDOG_MS);
    };
    const renderLayout = async (isFilterUpdate) => {
      setRenderState((current) => ({ ...current, loading: true, progress: 0, message: "Calculating 3D layout...", notice: "" }));
      resetWatchdog(isFilterUpdate);
      try {
        const payload = await computeVisualizerLayout(model, filter);
        window.clearTimeout(watchdogRef.current);
        if (!active || !sceneRef.current) return;
        disposeSceneRef.current();
        const theme = getPatternById(activePatternId).colors;
        disposeSceneRef.current = createCommitGraph(
          sceneRef.current,
          payload,
          theme,
          (node) => navigate(`/entity-detail/${node.entityType}/${node.id}`, { state: { path: state.path, model, isVerified: state?.isVerified !== false } }),
          (node, event) => setRenderState((current) => ({ ...current, tooltip: node ? { ...node, x: event.clientX, y: event.clientY } : null })),
        );
        hasRenderedLayoutRef.current = true;
        setRenderState((current) => ({ ...current, loading: false, warning: payload.warnings?.join(" ") || "" }));
      } catch (error) {
        window.clearTimeout(watchdogRef.current);
        logger.error("[SEQ-MD-03][LAYOUT] calculation failed", error);
        fail(error, isFilterUpdate);
      }
    };
    subscribeToTauriEvent("visualizer-layout-progress", (event) => {
      const progress = event?.payload || event;
      resetWatchdog(false);
      setRenderState((current) => ({ ...current, progress: progress.percentage, message: progress.message }));
    }).then((listener) => { unlisten = listener; renderLayout(hasRenderedLayoutRef.current); }).catch((error) => fail(error, false));
    return () => { active = false; window.clearTimeout(watchdogRef.current); unlisten(); disposeSceneRef.current(); };
  }, [activePatternId, filter, model, navigate, state?.isVerified, state?.path]);

  return <main className="visualizer-page"><header className="visualizer-toolbar"><div><p className="sequence-label">HASM / SEQ-03</p><h1>Commit graph</h1></div><label>Time scale<select value={filter.timeScaleMode} onChange={(event) => setFilter(nextLayoutFilter(filter, "timeScaleMode", event.target.value))}>{TIME_SCALE_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label><label>Z scale<input type="range" min="0.5" max="2" step="0.5" value={filter.zScaleFactor} onChange={(event) => setFilter(nextLayoutFilter(filter, "zScaleFactor", event.target.value))} /></label><button type="button" onClick={() => navigate("/entity-create", { state: { path: state.path, model, isVerified: true } })}>Create New Entity</button></header><section className="graph-stage" aria-label="HASM 3D commit graph"><div className="graph-canvas" ref={sceneRef} />{renderState.loading ? <div className="graph-progress"><p>{renderState.message}</p><progress value={renderState.progress} max="100">{renderState.progress}%</progress></div> : null}{renderState.warning ? <p className="graph-warning">{renderState.warning}</p> : null}{renderState.notice ? <p className="graph-notice">{renderState.notice}</p> : null}{renderState.tooltip ? <div className="graph-tooltip" style={{ left: renderState.tooltip.x, top: renderState.tooltip.y }}>{renderState.tooltip.entityType}: {renderState.tooltip.label}</div> : null}</section></main>;
}

export default VisualizerPage;