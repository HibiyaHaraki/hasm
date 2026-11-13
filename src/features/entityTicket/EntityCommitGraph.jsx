import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { computeVisualizerLayout, withTimeout } from "../hasm/api";
import { useTheme } from "../theme/ThemeContext";
import { getPatternById } from "../../hasm_color_pattern/src/index.js";
import { createCommitGraph2D } from "../../hasm_visualizer/twoCommitGraph.js";
import { computeFactRowIndexById, computeLaneIndexByKey, graphWidthForLaneCount, LANE_LEFT_MARGIN_PX, LANE_WIDTH_PX, ROW_HEIGHT_PX, TABLE_HEADER_HEIGHT_PX } from "../../hasm_visualizer/graph2DLayout.js";
import { createLogger } from "../../hasm_logger/src/react/logger.js";
import { extractEntityGraphModel } from "./entityGraphModel";
import { createEntityReferenceIndex, entityReferenceTitle } from "./EntityReferences";
import { translateTicket } from "./ticketLanguage";
import "./EntityCommitGraph.css";
import { ExperienceBadge, experienceAtNode } from "../../hasm_visualizer/ExperienceBadge.jsx";
import { buildExperienceColorMaps, positionKey } from "../../hasm_visualizer/threeCommitGraph.js";
import { previewGraphEntity } from "./EntityInfoPreview";
import { formatOccurrence } from "./formatOccurrence";

const logger = createLogger("entity-commit-graph");
const FILTER = { timeScaleMode: "SequentialIndex", zScaleFactor: 1 };

// [REQ-04-RULE-023] Compact entity extended commit graph rendered with the shared 2D renderer.
// [REQ-04-RULE-024] Persistently emphasizes the addressed entity through the highlight API.
// [REQ-04-RULE-025] SequentialIndex layout with the adjacent newest-first FACT title table.
export function EntityCommitGraph({ entityType, entityId, detail, workspaceState, disabled, onSelect, language }) {
  const { activePatternId } = useTheme();
  const sceneRef = useRef(null);
  const viewportRef = useRef(null);
  const factTableRef = useRef(null);
  const rendererRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [hoveredNode, setHoveredNode] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const graphModel = useMemo(
    () => extractEntityGraphModel(workspaceState?.model, entityType, entityId, detail),
    [workspaceState?.model, entityType, entityId, detail],
  );
  const index = useMemo(() => createEntityReferenceIndex(graphModel), [graphModel]);
  const t = (text, values) => translateTicket(text, values, language);
  const factRows = useMemo(() => layout ? [...computeFactRowIndexById(layout).keys()] : [], [layout]);
  const laneCount = layout ? Math.max(1, computeLaneIndexByKey(layout).size) : 1;
  const laneWidth = viewportWidth
    ? Math.max(0.01, Math.min(LANE_WIDTH_PX, (viewportWidth * 0.3 - LANE_LEFT_MARGIN_PX - 10) / laneCount))
    : LANE_WIDTH_PX;
  const width = graphWidthForLaneCount(laneCount, laneWidth);
  const theme = getPatternById(activePatternId).colors;
  const experienceColors = useMemo(() => layout ? buildExperienceColorMaps(layout, theme) : null, [layout, theme]);
  const badgeFor = (node, inline = false) => {
    const experience = experienceAtNode(layout, node);
    return <ExperienceBadge experience={experience} inline={inline}
      href={experience && !disabled ? `/entity-detail/EXPERIENCE/${experience.id}` : undefined}
      onSelect={onSelect}
      color={experience && experienceColors.trunkColorByPositionKey.get(positionKey(experience.x, experience.y))} theme={theme} />;
  };
  const syncScroll = (nextScrollTop) => {
    const table = factTableRef.current;
    if (!table) return;
    table.scrollTop = Math.max(0, Math.min(nextScrollTop, table.scrollHeight - table.clientHeight));
    rendererRef.current?.setScrollTop(table.scrollTop);
  };

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => setViewportWidth(viewport.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [layout]);

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
      const currentNode = {
        id: entityId,
        linkedEntityIds: entityType === "LINK"
          ? index.entities.get(entityId)?.entity.relatedIds ?? []
          : entityType === "PERSON"
            ? graphModel.experiences.map((experience) => experience.experienceId)
            : [],
      };
      // SEQ-MD-04: hover adds emphasis but never clears the addressed ticket.
      const renderer = createCommitGraph2D(
        sceneRef.current, layout, getPatternById(activePatternId).colors,
        disabled ? null : onSelect, (node, event) => {
          previewGraphEntity(node, event, sceneRef.current);
          setHoveredNode(node);
          renderer.setHighlight({
            ...currentNode,
            linkedEntityIds: [...currentNode.linkedEntityIds, ...(node
              ? [node.id, ...(node.linkedEntityIds ?? []), ...(node.parentExperienceIds ?? [])]
              : [])],
          });
        }, dates, null,
        {
          timeScaleMode: "SequentialIndex",
          rowHeightPx: ROW_HEIGHT_PX,
          headerHeightPx: TABLE_HEADER_HEIGHT_PX,
          laneWidthPx: laneWidth,
          onScroll: syncScroll,
          experienceLabel: (title) => t("Open {type}: {title}", { type: "EXPERIENCE", title }),
        },
      );
      renderer.setHighlight(currentNode);
      rendererRef.current = renderer;
      renderer.setScrollTop(factTableRef.current?.scrollTop ?? 0);
      return () => { previewGraphEntity(null); rendererRef.current = null; renderer(); };
    } catch (failure) {
      logger.error("[SEQ-MD-04][GRAPH] rendering failed", failure);
      setRenderError(failure?.message || String(failure));
      return undefined;
    }
  }, [layout, graphModel, index, entityId, entityType, activePatternId, disabled, onSelect, language, laneWidth]);

  return (
    <section className="ticket-section ticket-commit-graph" aria-labelledby="ticket-graph-heading">
      <h2 id="ticket-graph-heading">{t("Extended commit graph")}</h2>
      {graphModel ? <p className="ticket-graph-current">
        {t("Current entity")}: <strong>{entityType}: {entityReferenceTitle(index, entityId, entityType, null, t)}</strong>
      </p> : null}
      {!graphModel ? <p>{t("Workspace relationship information is unavailable.")}</p> : (
        <>
          {!layout && !error ? <p role="status">{t("Loading graph...")}</p> : null}
          {error || renderError ? <p role="alert">{t("Could not display graph:")} {t(error || renderError)}</p> : null}
          {layout?.warnings?.length ? <p role="status">{layout.warnings.join(" ")}</p> : null}
          {layout ? (
            <div ref={viewportRef} className="ticket-graph-viewport">
              <div className="ticket-graph-sequential">
                <div ref={sceneRef} className="ticket-graph-scene" style={{ width }}
                  role="group" aria-label={t("Extended commit graph")} />
                <div ref={factTableRef} className="ticket-graph-fact-table"
                  onScroll={(event) => rendererRef.current?.setScrollTop(event.currentTarget.scrollTop)}
                  style={{ "--ticket-graph-row-height": `${ROW_HEIGHT_PX}px`, "--ticket-graph-header-height": `${TABLE_HEADER_HEIGHT_PX}px` }}>
                  <table aria-label={t("FACT titles")}>
                    <colgroup><col /><col className="ticket-graph-occurrence-column" /></colgroup>
                    <thead><tr><th scope="col">{t("FACT titles")}</th><th scope="col">{t("Occurred at")}</th></tr></thead>
                    <tbody>
                      {factRows.map((id) => {
                        const title = entityReferenceTitle(index, id, "FACT", null, t);
                        const isCurrent = entityType === "FACT" && id === entityId;
                        const occurredAt = index.entities.get(id)?.entity.occurredAt;
                        const fullOccurrence = formatOccurrence(occurredAt, language, t);
                        return (
                          <tr key={id}>
                            <td>
                              <div className="ticket-graph-fact-title" title={title}>
                                {badgeFor(layout.nodes3d.find((node) => node.entityType === "FACT" && node.id === id && node.isDirectFact)
                                  || layout.nodes3d.find((node) => node.entityType === "FACT" && node.id === id), true)}
                                {' '}
                                {disabled ? <span>{isCurrent ? <strong>{title}</strong> : title}</span> : (
                                  <Link to={`/entity-detail/FACT/${id}`} state={workspaceState}
                                    aria-current={isCurrent ? "page" : undefined}>
                                    {isCurrent ? <strong>{title}</strong> : title}
                                  </Link>
                                )}
                              </div>
                            </td>
                            <td className="ticket-graph-occurrence" aria-label={fullOccurrence}
                              title={occurredAt ? `${fullOccurrence} (${occurredAt})` : fullOccurrence}>
                              {formatOccurrence(occurredAt, language, t, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
          <p className="ticket-graph-hint">{t("Solid FACTs are recorded events; hollow FACTs are ancestor reflections. Dashed lines are LINKs.")}</p>
          {hoveredNode ? <p className="ticket-graph-hint" role="status">
            {badgeFor(hoveredNode)}
            {hoveredNode.entityType}: {hoveredNode.label}
          </p> : null}
          {workspaceState?.isVerified === false ? <p>{t("Return to Visualizer to re-verify before opening related entities.")}</p> : null}
          <details>
            <summary>{t("Graph entities")}</summary>
            <ul className="ticket-graph-entities">
              {[...index.entities].map(([id, { type }]) => (
                <li key={`${type}-${id}`} className={id === entityId && type === entityType ? "ticket-graph-current" : undefined}>
                  <span>{type}: </span>
                  {disabled ? <span aria-disabled="true">{entityReferenceTitle(index, id, type, null, t)}</span> : (
                    <Link to={`/entity-detail/${type}/${id}`} state={workspaceState}
                      aria-current={id === entityId && type === entityType ? "page" : undefined}>
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
