import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntityMtime, launchExternalMarkdownApp, loadEntityDetail, reloadEntityMarkdown, saveEntityDetail } from "../features/hasm/api";
import { createDetailsDraft, DETAIL_FIELDS, TicketForm } from "../features/entityTicket/TicketForm";
import { MarkdownPanel } from "../features/entityTicket/MarkdownPanel";
import { Button, Col, Container, Row } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityDetailPage.css";
import { ExternalLinksView, isExternalUrl } from "../features/entityTicket/ExternalLinksEditor";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const logger = createLogger("entity-detail");

function EntityDetailPage() {
  const { entityType, entityId } = useParams(); const { state } = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [changed, setChanged] = useState(false); const [deleted, setDeleted] = useState(false); const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const editTriggerRef = useRef(null);
  const root = state?.path;
  const [workspaceState, setWorkspaceState] = useState(state);
  const lifecycleRef = useRef(null);
  useLayoutEffect(() => {
    if (!editing && editTriggerRef.current) {
      const trigger = document.getElementById(editTriggerRef.current)
        ?? (editTriggerRef.current.startsWith("ticket-link") ? document.getElementById("ticket-links-read") : null);
      trigger?.focus();
      editTriggerRef.current = null;
    }
  }, [editing]);
  useLayoutEffect(() => {
    const lifecycle = { active: true, saving: false, refreshing: false };
    lifecycleRef.current = lifecycle;
    return () => { lifecycle.active = false; };
  }, [entityId, entityType, root]);
  useEffect(() => { 
    if (!root) { 
      navigate("/select", { replace: true }); 
      return; 
    } 
    let active = true;
    setTicket(null);
    setForm(null);
    setSaving(false);
    setEditing(null);
    setRefreshing(false);
    setChanged(false);
    setDeleted(false);
    setMessage("");
    setWorkspaceState(state);
    const load = async () => {
      try {
        const value = await loadEntityDetail(root, entityType, entityId);
        if (!active) return;
        setTicket(value);
      } catch (error) {
        if (!active) {
          logger.debug("[SEQ-MD-04][LOAD] ignoring failure from an abandoned ticket");
          return;
        }
        logger.error("[SEQ-MD-04][LOAD] entity load failed", error);
        navigate(error?.message?.includes("MARKDOWN") ? "/error-markdown" : "/error-model", { state: { error: error?.message || String(error) } });
      }
    };
    load();
    return () => { active = false; };
  }, [entityId, entityType, root, navigate]);
  useEffect(() => { 
    let active = true;
    const focused = async () => { 
      if (!ticket) return; 
      try {
        const result = await checkEntityMtime(root, entityType, entityId, ticket.loadedMtimeMs);
        if (!active) return;
        setChanged(result.isModified || result.isDeleted);
        setDeleted(result.isDeleted);
        if (result.isDeleted) setMessage("Markdown file deleted on disk");
      } catch (error) {
        if (!active) return;
        logger.error("[SEQ-MD-04][MTIME] freshness check failed", error);
        setMessage(error?.message || String(error));
      }
    }; 
    window.addEventListener("focus", focused); return () => { active = false; window.removeEventListener("focus", focused); };
  }, [ticket, root, entityType, entityId]);
  if (!ticket) {
    return (
      <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
        <section className="panel-card">Loading ticket...</section>
      </Container>
    );
  }
  const beginEdit = (field, event) => {
    if (editing || saving || refreshing) return;
    editTriggerRef.current = event.currentTarget.id;
    setForm({ name: ticket.name, link: [...(ticket.detail.link ?? [])], details: createDetailsDraft(ticket.detail, entityType) });
    setMessage("");
    setEditing(field);
    logger.debug(`[SEQ-MD-04][EDIT] entering ${field} editing mode`);
  };
  const finishEdit = () => {
    setEditing(null);
    setForm(null);
  };
  const cancelEdit = () => { finishEdit(); setMessage(""); };
  const save = async (event) => { 
    const lifecycle = lifecycleRef.current;
    event.preventDefault();
    if (lifecycle.saving || lifecycle.refreshing) return;
    if (editing === "summary" && !form.name.trim()) {
      setMessage("Summary must not be empty.");
      return;
    }
    if (editing === "links" && form.link.some((url) => !isExternalUrl(url))) {
      setMessage("Each external link must be an absolute HTTP(S) URL without credentials or whitespace.");
      return;
    }
    const patch = {};
    const nameKey = `${entityType.toLowerCase()}Name`;
    if (editing === "summary") patch[nameKey] = form.name;
    if (editing === "links") patch.link = [...form.link];
    if (editing === "details") {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const { key, label, list, uuid, required } of DETAIL_FIELDS[entityType]) {
        const raw = form.details[key];
        const values = list && raw.trim() ? raw.split(",").map((value) => value.trim()) : [];
        if ((uuid && !uuidPattern.test(raw.trim())) || (list && values.some((value) => !uuidPattern.test(value)))) {
          setMessage(`${label} must contain valid entity UUIDs.`);
          return;
        }
        if (required && !raw.trim()) {
          setMessage(`${label} must not be empty.`);
          return;
        }
        patch[key] = list ? values : uuid ? raw.trim() : raw;
      }
      if (entityType === "LINK" && patch.relatedIds.length >= 2 && patch.relatedIds[0].toLowerCase() === patch.relatedIds[1].toLowerCase()) {
        setMessage("A relationship must not link an entity to itself.");
        return;
      }
    }
    lifecycle.saving = true;
    setSaving(true);
    setMessage("");
    try { 
      const detail = { ...ticket.detail, ...patch };
      await saveEntityDetail(entityType, root, detail); 
      if (!lifecycle.active) return;
      setMessage("Metadata saved. Workspace requires re-verification."); 
      setTicket((current) => ({ ...current, name: editing === "summary" ? form.name : current.name, detail: { ...current.detail, ...patch } }));
      finishEdit();
      logger.info(`[SEQ-MD-04][SAVE] ${editing} saved`);
      const collection = { PERSON: "people", EXPERIENCE: "experiences", FACT: "facts", LINK: "links" }[entityType];
      const idKey = `${entityType.toLowerCase()}Id`;
      setWorkspaceState((current) => ({
        ...current,
        isVerified: false,
        ...(current?.model ? { model: {
          ...current.model,
          [collection]: current.model[collection].map((item) => item[idKey] === entityId ? { ...item, ...detail } : item),
        } } : {}),
      }));
    } 
    catch (error) { 
      if (!lifecycle.active) return;
      logger.error("[SEQ-MD-04][SAVE] inline metadata save failed", error);
      setMessage(error?.message || "Save failed"); 
    } 
    finally { 
      lifecycle.saving = false;
      if (lifecycle.active) setSaving(false);
    } 
  };
  const refresh = async () => { 
    const lifecycle = lifecycleRef.current;
    if (lifecycle.saving || lifecycle.refreshing) return;
    lifecycle.refreshing = true;
    setRefreshing(true);
    try { 
      const value = await reloadEntityMarkdown(root, entityType, entityId); 
      if (!lifecycle.active) return;
      setTicket(value); 
      setChanged(false); 
      setDeleted(false); 
      setMessage("Markdown refreshed."); 
    } 
    catch (error) { 
      if (!lifecycle.active) return;
      if (error?.message?.includes("MARKDOWN")) {
        navigate("/error-markdown", { state: { error: error.message } })
      } 
      else {
        logger.error("[SEQ-MD-04][REFRESH] Markdown refresh failed", error);
        setMessage(error?.message || "Refresh failed"); 
      } 
    } finally {
      lifecycle.refreshing = false;
      if (lifecycle.active) setRefreshing(false);
    }
  };
  const editMarkdown = async () => { 
    const lifecycle = lifecycleRef.current;
    logger.info("[SEQ-MD-05][LAUNCH] opening entity Markdown in HASM App");
    try { 
      await launchExternalMarkdownApp(root, entityType, entityId); 
      if (!lifecycle.active) return;
      setMessage("Opened HASM Markdown App. Click 'Refresh Markdown' after saving."); 
    } 
    catch (error) { 
      if (!lifecycle.active) return;
      logger.error("[SEQ-MD-05][LAUNCH] external editor launch failed", error);
      const text = error?.message || "Failed to launch hasm_markdown.exe process."; 
      setMessage(text.includes("EXECUTABLE_NOT_FOUND") ? "hasm_markdown.exe application binary is missing." : text.includes("DIRECTORY_NOT_FOUND") ? "Entity folder does not exist on disk." : text.includes("LAUNCH_TIMEOUT") ? "Launching HASM Markdown App timed out." : text.includes("PROCESS_SPAWN_FAILED") ? "Failed to launch hasm_markdown.exe process." : text); 
    } 
  };
  return (
    <Container as="main" fluid className="ticket-page">
      <header className="ticket-header">
        <div className="d-flex flex-wrap gap-2 mb-2">
          <Button className="btn-hasm-outline" variant="outline-secondary" onClick={() => navigate("/visualizer", { state: workspaceState })}>Back to Visualizer</Button>
        </div>
        <p className="mb-0">{entityType} / {entityId}</p>
        <p className="ticket-reading-hint">Click content to edit. Save or cancel before editing another field.</p>
        {editing === "summary" ? (
          <TicketForm field="summary" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} />
        ) : (
          <h1 aria-label={ticket.name || "Untitled"}><Button id="ticket-summary-read" className="ticket-content-trigger ticket-summary-trigger" aria-label="Edit summary"
            disabled={Boolean(editing) || refreshing} onClick={(event) => beginEdit("summary", event)}>{ticket.name || "Untitled"}</Button></h1>
        )}
      </header>
      {message ? <p role="status" className="ticket-status">{message}</p> : null}
      <Row className="g-3 ticket-grid">
        <Col lg={8}>
          <MarkdownPanel markdown={ticket.markdownBody} refresh={refresh} edit={editMarkdown} changed={changed} deleted={deleted} loading={saving || refreshing} />
        </Col>
        <Col lg={4}>
          <section className="ticket-section" aria-labelledby="ticket-details-heading">
            <h2 id="ticket-details-heading">Details</h2>
            {editing === "details" ? (
              <TicketForm field="details" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} />
            ) : (
              <Button id="ticket-details-read" className="ticket-content-trigger ticket-details-trigger" aria-label="Edit details"
                disabled={Boolean(editing) || refreshing} onClick={(event) => beginEdit("details", event)}>
                {DETAIL_FIELDS[entityType].map(({ key, label, list }) => (
                  <span className="ticket-detail-row" key={key}>
                    <span className="ticket-detail-label">{label}</span>
                    <span>{list ? ticket.detail[key]?.join(", ") || "None" : ticket.detail[key] || "Not set"}</span>
                  </span>
                ))}
              </Button>
            )}
          </section>
          <section className="ticket-section" aria-labelledby="ticket-links-heading">
            <h2 id="ticket-links-heading">External links</h2>
            {editing === "links" ? (
              <TicketForm field="links" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} />
            ) : (
              <ExternalLinksView value={ticket.detail.link ?? []} disabled={Boolean(editing) || refreshing}
                onEdit={(event) => beginEdit("links", event)} />
            )}
          </section>
        </Col>
      </Row>
    </Container>
  );
}
export default EntityDetailPage;