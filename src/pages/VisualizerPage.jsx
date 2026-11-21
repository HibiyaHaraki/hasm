import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, ProgressBar } from "react-bootstrap";
import { EVENTS, Joyride } from "react-joyride";
import { computeVisualizerLayout, subscribeToTauriEvent } from "../features/hasm/api";
import { useTheme } from "../features/theme/ThemeContext";
import HasmVisualizerComponent from "../hasm_visualizer/HasmVisualizerComponent.jsx";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import "./VisualizerPage.css";

const WATCHDOG_MS = 10000;
const logger = createLogger("visualizer");

const TOUR_STEPS = [
  {
    title: "Create a workspace",
    target: "body",
    placement: "center",
    instructions: [
      "Open the navigation menu and choose Switch Model. This deletes the temporary demo and its edits.",
      "On Open a workspace, choose Create New HASM and select a new folder.",
      "After loading, enter a PERSON name and birth date, choose Review model, and confirm to create the life timeline.",
    ],
  },
  {
    title: "Create an entity",
    target: "[data-tour='create-entity']",
    instructions: [
      "On the commit graph, choose Create New Entity.",
      "Choose PERSON, EXPERIENCE, FACT, or LINK, then fill in its fields and relationships.",
      "Choose the Create button for that type. The model reloads and returns to the graph.",
    ],
  },
  {
    title: "Open an entity detail page",
    target: ".graph-stage",
    instructions: [
      "In the 2D graph, select a FACT title, FACT marker, EXPERIENCE lane label, or dashed LINK. In 3D, select an item in the graph.",
      "The detail page shows its metadata and Markdown. Use Back to Visualizer to return to the graph.",
    ],
  },
  {
    title: "Explore the extended commit graph",
    target: ".graph-stage",
    instructions: [
      "Open an entity detail page from the commit graph, then scroll to Extended commit graph near the bottom.",
      "The current entity is highlighted. Select a related FACT title, EXPERIENCE label, or LINK in the graph to open its detail page.",
      "Expand Graph entities for another list of related entities.",
    ],
  },
];

function TourTooltip({ step, index, size, isLastStep, tooltipProps, backProps, primaryProps, skipProps }) {
  return (
    <div {...tooltipProps} role="dialog" aria-labelledby="tutorial-tour-title" aria-describedby="tutorial-tour-content" className="tutorial-tour">
      <h2 id="tutorial-tour-title">{step.title}</h2>
      <p className="tutorial-tour-progress" aria-live="polite">Step {index + 1} of {size}</p>
      <div id="tutorial-tour-content">{step.content}</div>
      <div className="tutorial-tour-actions">
        <Button {...skipProps} variant="outline-secondary" className="btn-hasm-outline">Skip tour</Button>
        <Button {...backProps} variant="outline-secondary" className="btn-hasm-outline" disabled={index === 0}>Back</Button>
        <Button {...primaryProps} className="btn-hasm-primary">{isLastStep ? "Finish" : "Next"}</Button>
      </div>
    </div>
  );
}

// The shared visualizer defaults to English sentence-case labels; SEQ-03 uses its own wording.
const VISUALIZER_LABELS = {
  timeScale: "Time scale",
  zScale: "Z scale",
  personScope: "PERSON scope",
  experienceScope: "EXPERIENCE scope",
  clearScope: "Clear scope",
};

// [SEQ-MD-03][REQ-03-RULE-014][REQ-03-RULE-009] Host page for the shared hasm_visualizer component: supplies the model,
// the layout callback, node-click routing, and page chrome only.
// [REQ-03-FUNC-101][REQ-03-FUNC-102][REQ-03-FUNC-103] Mount-time progress subscription and model/verification guards.
// [REQ-03-FUNC-104][REQ-03-FUNC-106][REQ-03-FUNC-107][REQ-03-RULE-018] 10,000ms layout watchdog owned by the
// active request only; stalls route to /error-model, abandoned requests are ignored.
// [REQ-03-FUNC-201][REQ-03-FUNC-202][REQ-03-FUNC-203] Filter updates recompute layout with a progress overlay
// and revert the view with a notice on timeout.
// [REQ-03-FUNC-302][REQ-03-FUNC-513] Graph selection opens the typed ticket with workspace and view context.
// [REQ-03-RULE-021] Demo-only product tour after successful graph layout.
// Create New Entity routes to /entity-create (REQ-08-014).
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
  const [tourOpen, setTourOpen] = useState(false);
  const isTutorial = Boolean(state?.path && state.path === window.sessionStorage.getItem("hasm-tutorial-workspace"));

  useEffect(() => {
    if (!isTutorial || !model || state?.isVerified === false || renderState.loading
      || window.sessionStorage.getItem("hasm-tutorial-tour-seen") === state.path) return;
    window.sessionStorage.setItem("hasm-tutorial-tour-seen", state.path);
    setTourOpen(true);
    logger.info("[SEQ-MD-03][TUTORIAL] opening product tour");
  }, [isTutorial, model, renderState.loading, state?.isVerified, state?.path]);

  useEffect(() => {
    if (!tourOpen) return undefined;
    const dismiss = (event) => {
      if (event.key === "Escape") setTourOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [tourOpen]);

  const fail = useCallback((error, isFilterUpdate) => {
    if (!activeRef.current) return;
    if (error?.message?.includes("ERR_NO_ACTIVE_MODEL")) return navigate("/select", { replace: true });
    if (error?.message?.includes("ERR_MODEL_NOT_VERIFIED")) return navigate("/loading-model", { replace: true, state: { ...state, path: state?.path, returnTo: "/visualizer" } });
    if (isFilterUpdate) return setRenderState((current) => ({ ...current, loading: false, notice: "Filter update timed out. Reverting view." }));
    return navigate("/error-model", { replace: true, state: { error: error?.message || "Layout calculation stalled" } });
  }, [navigate, state]);

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
      navigate("/loading-model", { replace: true, state: { ...state, path: state.path, returnTo: "/visualizer" } });
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
      // SEQ-MD-03: scope keeps ancestor branches but can omit their PERSON context.
      const ownerIds = new Set((scopedModel.experiences ?? []).map((experience) => experience.personId));
      const scopedPeople = new Set((scopedModel.people ?? []).map((person) => person.personId));
      const owners = (model?.people ?? []).filter((person) => ownerIds.has(person.personId) && !scopedPeople.has(person.personId));
      const layoutModel = owners.length ? { ...scopedModel, people: [...(scopedModel.people ?? []), ...owners] } : scopedModel;
      const payload = await computeVisualizerLayout(layoutModel, filter);
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
  }, [fail, model, resetWatchdog]);

  const openEntityTicket = useCallback((node, visualizerView) => {
    navigate(`/entity-detail/${node.entityType}/${node.id}`, { state: { ...state, model, visualizerView, isVerified: state?.isVerified !== false } });
  }, [model, navigate, state]);

  const factDatesById = useMemo(() => new Map((model?.facts || []).map((fact) => [fact.factId, fact.occurredAt])), [model]);

  if (!model || state?.isVerified === false) return null;

  return (
    <>
    <HasmVisualizerComponent
      colorPattern={activePatternId}
      labels={VISUALIZER_LABELS}
      model={model}
      initialViewState={state?.visualizerView}
      computeLayout={computeLayout}
      onSelectNode={openEntityTicket}
      getNodeHref={(node) => `/entity-detail/${node.entityType}/${node.id}`}
      factDatesById={factDatesById}
      headerSlot={(
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h1 className="mb-0">Commit graph</h1>
          {isTutorial ? <Button variant="outline-secondary" className="btn-hasm-outline"
            disabled={renderState.loading}
            onClick={() => setTourOpen(true)}>Replay tour</Button> : null}
        </div>
      )}
      toolbarSlot={(
        <Button data-tour="create-entity" className="btn-hasm-primary" onClick={() => navigate("/entity-create", { state: { path: state.path, model, isVerified: true } })}>
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
    {tourOpen && isTutorial && <Joyride
      run
      continuous
      steps={TOUR_STEPS.map(({ instructions, ...step }) => ({
        ...step,
        content: <ol>{instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>,
      }))}
      tooltipComponent={TourTooltip}
      floatingOptions={{ strategy: "fixed", shiftOptions: { crossAxis: true } }}
      locale={{ back: "Back", next: "Next", last: "Finish", skip: "Skip tour" }}
      options={{ skipBeacon: true, blockTargetInteraction: true, overlayClickAction: false, dismissKeyAction: false, arrowColor: "var(--theme-surface)", zIndex: 1200 }}
      onEvent={(event) => {
        if (event.type === EVENTS.TOUR_END) setTourOpen(false);
        if (event.type === EVENTS.TARGET_NOT_FOUND || event.type === EVENTS.ERROR) {
          logger.error("[SEQ-MD-03][TUTORIAL] product tour failed", event.error || event.type);
          setRenderState((current) => ({ ...current, notice: "The tour could not be displayed. Please replay it." }));
          setTourOpen(false);
        }
      }}
    />}
    </>
  );
}

export default VisualizerPage;