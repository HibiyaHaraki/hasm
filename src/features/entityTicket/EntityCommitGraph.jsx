import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { computeVisualizerLayout, withTimeout } from "../hasm/api";
import { useTheme } from "../theme/ThemeContext";
import { getPatternById } from "../../hasm_color_pattern/src/index.js";
import { createCommitGraph2D } from "../../hasm_visualizer/twoCommitGraph.js";
import { computeLaneIndexByKey, graphWidthForLaneCount, TIME_AXIS_WIDTH_PX } from "../../hasm_visualizer/graph2DLayout.js";
import { createLogger } from "../../hasm_logger/src/react/logger.js";
import { extractEntityGraphModel } from "./entityGraphModel";
import { createEntityReferenceIndex, entityReferenceTitle } from "./EntityReferences";
import { translateTicket } from "./ticketLanguage";
import "./EntityCommitGraph.css";

const logger = createLogger("entity-commit-graph");
const FILTER = { timeScaleMode: "Linear", zScaleFactor: 1 };

export function EntityCommitGraph({ entityType, entityId, detail, workspaceState, disabled, onSelect, language }) {
  const { activePatternId } = useTheme();
  const sceneRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [hoveredNode, setHoveredNode] = useState(null);
  const graphModel = useMemo(
    () => extractEntityGraphModel(workspaceState?.model, entityType, entityId, detail),
    [workspaceState?.model, entityType, entityId, detail],
  );
  const index = useMemo(() => createEntityReferenceIndex(graphModel), [graphModel]);
  const t = (text, values) => translateTicket(text, values, language);

  useEffect(() => {
    let active = true;
    setLayout(null);
    setError("");
    if (!graphModel) return undefined;
    logger.info("[SEQ-MD-04][GRAPH] calculating extracted entity graph");
    withTimeout(Promise.resolve().then(() => computeVisualizerLayout(graphModel, FILTER)), 10000, "Graph layout timed out.")
      .then((payload) => { if (active) setLayout(payload); })
      .catch((failure) => {
        if (!active) return;
        logger.error("[SEQ-MD-04][GRAPH] layout failed", failure);
        setError(failure?.message || String(failure));
      });
    return () => { active = false; };
  }, [graphModel]);

  useEffect(() => {
    setRenderError("");
    setHoveredNode(null);
    if (!layout || !sceneRef.current) return undefined;
    try {
      const dates = new Map(graphModel.facts.map((fact) => [fact.factId, fact.occurredAt]));
      return createCommitGraph2D(
        sceneRef.current, layout, getPatternById(activePatternId).colors,
        (node) => { if (!disabled) onSelect(node); }, (node) => setHoveredNode(node), dates, null,
        { timeScaleMode: "Linear", timeLabel: translateTicket("Occurred at", {}, language) },
      );
    } catch (failure) {
      logger.error("[SEQ-MD-04][GRAPH] rendering failed", failure);
      setRenderError(failure?.message || String(failure));
      return undefined;
    }
  }, [layout, graphModel, activePatternId, disabled, onSelect, language]);

  const width = layout ? graphWidthForLaneCount(computeLaneIndexByKey(layout).size) + TIME_AXIS_WIDTH_PX : 0;
  return (
    <section className="ticket-section ticket-commit-graph" aria-labelledby="ticket-graph-heading">
      <h2 id="ticket-graph-heading">{t("Extended commit graph")}</h2>
      {!graphModel ? <p>{t("Workspace relationship information is unavailable.")}</p> : (
        <>
          {!layout && !error ? <p role="status">{t("Loading graph...")}</p> : null}
          {error || renderError ? <p role="alert">{t("Could not display graph:")} {t(error || renderError)}</p> : null}
          {layout?.warnings?.length ? <p role="status">{layout.warnings.join(" ")}</p> : null}
          {layout ? (
            <div className="ticket-graph-viewport">
              <div ref={sceneRef} className="ticket-graph-scene" style={{ width: `max(100%, ${width}px)` }}
                role="group" aria-label={t("Extended commit graph")} />
            </div>
          ) : null}
          <p className="ticket-graph-hint">{t("Solid FACTs are recorded events; hollow FACTs are ancestor reflections. Dashed lines are LINKs.")}</p>
          {hoveredNode ? <p className="ticket-graph-hint" role="status">
            {hoveredNode.entityType}: {hoveredNode.label}
          </p> : null}
          {workspaceState?.isVerified === false ? <p>{t("Return to Visualizer to re-verify before opening related entities.")}</p> : null}
          <details>
            <summary>{t("Graph entities")}</summary>
            <ul className="ticket-graph-entities">
              {[...index.entities].map(([id, { type }]) => (
                <li key={`${type}-${id}`}>
                  <span>{type}: </span>
                  {disabled ? <span aria-disabled="true">{entityReferenceTitle(index, id, type, null, t)}</span> : (
                    <Link to={`/entity-detail/${type}/${id}`} state={workspaceState}>
                      {entityReferenceTitle(index, id, type, null, t)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
