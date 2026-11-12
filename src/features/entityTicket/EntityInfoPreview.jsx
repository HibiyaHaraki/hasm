import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card } from "react-bootstrap";
import { loadEntityDetail, withTimeout } from "../hasm/api";
import { createLogger } from "../../hasm_logger/src/react/logger.js";
import { createEntityReferenceIndex, entityReferenceTitle } from "./EntityReferences";
import "./EntityInfoPreview.css";

const logger = createLogger("entity-info-preview");
const PREVIEW_EVENT = "hasm-entity-preview";
const ENTITY_PATH = /^\/entity-detail\/(PERSON|EXPERIENCE|FACT|LINK)\/([0-9a-f-]{36})$/i;

export function dismissEntityPreview() {
  document.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { dismiss: true } }));
}

export function previewGraphEntity(node, event, source) {
  document.dispatchEvent(new CustomEvent(PREVIEW_EVENT, {
    detail: node ? { type: node.entityType, id: node.id, source, x: event?.clientX, y: event?.clientY } : null,
  }));
}

function referenceAt(target) {
  const source = target instanceof Element ? target.closest("a[href], [data-entity-type][data-entity-id]") : null;
  if (!source || source.matches(":disabled, [aria-disabled='true']")) return null;
  if (source.dataset.entityType) {
    return { source, type: source.dataset.entityType, id: source.dataset.entityId };
  }
  const url = new URL(source.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const match = url.pathname.match(ENTITY_PATH);
  return match ? { source, type: match[1].toUpperCase(), id: match[2] } : null;
}

function EntityInfoCard({ preview, index, cardId, cardRef }) {
  const { type, id, loaded, error } = preview;
  const entity = loaded?.detail || index.entities.get(id)?.entity;
  const title = loaded?.name || entityReferenceTitle(index, id, type);
  const excerpt = loaded?.markdownBody?.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
  const fields = {
    PERSON: [["Birthday", "birthday"], ["Date of death", "die"]],
    EXPERIENCE: [["Owner", "personId"], ["Parent experiences", "parentExperienceIds"]],
    FACT: [["Occurred at", "occurredAt"], ["Experiences", "experienceIds"], ["People", "personIds"]],
    LINK: [["Relationship type", "linkType"], ["Related entities", "relatedIds"]],
  }[type] || [];
  const valueFor = (key) => {
    const value = entity?.[key];
    if (key.endsWith("Id") || key.endsWith("Ids")) {
      const ids = Array.isArray(value) ? value : value ? [value] : [];
      return ids.length ? ids.map((reference) => entityReferenceTitle(index, reference)).join(", ") : "None";
    }
    return value || "Not set";
  };
  return (
    <Card ref={cardRef} id={cardId} role="tooltip" className="entity-info-preview"
      style={{ left: preview.x, top: preview.y }}>
      <Card.Body>
        <p className="entity-info-identity">{type}/{id}</p>
        <Card.Title as="h2">{title}</Card.Title>
        {entity ? <dl>{fields.map(([label, key]) => (
          <div key={key}><dt>{label}</dt><dd>{valueFor(key)}</dd></div>
        ))}</dl> : null}
        {!loaded && !error ? <p role="status">Loading entity information...</p> : null}
        {error ? <p role="alert">Could not load entity information: {error}</p> : null}
        {loaded ? <p className="entity-info-description">{excerpt ? excerpt.slice(0, 400) + (excerpt.length > 400 ? "..." : "") : "No description."}</p> : null}
      </Card.Body>
    </Card>
  );
}

export default function EntityInfoPreview() {
  const location = useLocation();
  const path = location.state?.path;
  const index = useMemo(() => createEntityReferenceIndex(location.state?.model), [location.state?.model]);
  const cardId = useId();
  const cardRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;
    let current = null;
    let openTimer;
    let closeTimer;
    let restoreDescription = () => {};
    const dismiss = () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
      current = null;
      restoreDescription();
      restoreDescription = () => {};
      if (active) setPreview(null);
    };
    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(dismiss, 150);
    };
    const show = (reference) => {
      window.clearTimeout(closeTimer);
      if (!path || !reference) return;
      if (current?.source === reference.source && current?.id === reference.id && current?.type === reference.type) return;
      dismiss();
      const rect = reference.source.getBoundingClientRect();
      const width = Math.min(360, Math.max(0, window.innerWidth - 24));
      const next = {
        ...reference,
        x: Math.max(12, Math.min(reference.x ?? rect.left, window.innerWidth - width - 12)),
        y: Math.max(12, Math.min((reference.y ?? rect.bottom) + 12, window.innerHeight - Math.min(360, window.innerHeight - 24) - 12)),
      };
      current = next;
      openTimer = window.setTimeout(async () => {
        if (!active || current !== next) return;
        const previous = reference.source.getAttribute("aria-describedby");
        reference.source.setAttribute("aria-describedby", [previous, cardId].filter(Boolean).join(" "));
        restoreDescription = () => {
          if (previous === null) reference.source.removeAttribute("aria-describedby");
          else reference.source.setAttribute("aria-describedby", previous);
        };
        setPreview(next);
        try {
          const loaded = await withTimeout(loadEntityDetail(path, next.type, next.id), 3000, "Entity information timed out.");
          if (active && current === next) setPreview({ ...next, loaded });
        } catch (error) {
          if (!active || current !== next) return;
          logger.error("[SEQ-MD-04][PREVIEW] entity information load failed", error);
          setPreview({ ...next, error: error?.message || String(error) });
        }
      }, 200);
    };
    const enter = (event) => {
      if (cardRef.current?.contains(event.target)) {
        window.clearTimeout(closeTimer);
        return;
      }
      const reference = referenceAt(event.target);
      if (reference) show(reference);
    };
    const leave = (event) => {
      const destination = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (current?.source.contains(destination) || cardRef.current?.contains(destination)) return;
      if (current?.source.contains(event.target) || cardRef.current?.contains(event.target)) scheduleClose();
    };
    const graph = (event) => event.detail?.dismiss ? dismiss() : event.detail ? show(event.detail) : scheduleClose();
    const key = (event) => { if (event.key === "Escape") dismiss(); };
    const scroll = (event) => {
      if (!(event.target instanceof Node) || !cardRef.current?.contains(event.target)) dismiss();
    };
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    document.addEventListener("keydown", key);
    document.addEventListener(PREVIEW_EVENT, graph);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      dismiss();
      active = false;
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("keydown", key);
      document.removeEventListener(PREVIEW_EVENT, graph);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [path, location.key, cardId]);

  return preview ? <EntityInfoCard preview={preview} index={index} cardId={cardId} cardRef={cardRef} /> : null;
}
