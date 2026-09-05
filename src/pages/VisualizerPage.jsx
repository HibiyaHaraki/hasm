import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { computeVisualizerLayout, subscribeToTauriEvent } from "../features/hasm/api";
import { useTheme } from "../features/theme/ThemeContext";
import { DEFAULT_LAYOUT_FILTER } from "../features/visualizer/layoutFilter";
import { HasmVisualizerComponent } from "../hasm_visualizer/index.js";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const WATCHDOG_MS = 10000;
const logger = createLogger("visualizer");

function VisualizerPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const model = state?.model;
  const { activePatternId } = useTheme();
  const watchdogRef = useRef();
  const hasRenderedLayoutRef = useRef(false);
  const [filter, setFilter] = useState(DEFAULT_LAYOUT_FILTER);
  const [layoutPayload, setLayoutPayload] = useState(null);
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
        if (!active) return;
        setLayoutPayload(payload);
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
    }).then((listener) => { unlisten = listener; renderLayout(hasRenderedLayoutRef.current); }).catch((error) => fail(error, hasRenderedLayoutRef.current));
    return () => { active = false; window.clearTimeout(watchdogRef.current); unlisten(); };
  }, [filter, model, navigate, state?.isVerified, state?.path]);

  return <HasmVisualizerComponent
    colorPattern={activePatternId}
    model={model}
    layoutPayload={layoutPayload}
    filter={filter}
    onFilterChange={setFilter}
    onNodeSelect={(node) => navigate(`/entity-detail/${node.entityType}/${node.id}`, { state: { path: state.path, model, isVerified: state?.isVerified !== false } })}
    loading={renderState.loading}
    progress={renderState.progress}
    message={renderState.message}
    warning={renderState.warning}
    notice={renderState.notice}
    onCreateEntity={() => navigate("/entity-create", { state: { path: state.path, model, isVerified: true } })}
  />;
}

export default VisualizerPage;