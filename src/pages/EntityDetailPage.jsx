import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntityMtime, launchExternalMarkdownApp, loadEntityDetail, reloadEntityMarkdown, saveEntityDetail } from "../features/hasm/api";
import { TicketForm } from "../features/entityTicket/TicketForm";
import { MarkdownPanel } from "../features/entityTicket/MarkdownPanel";
import { Button, Col, Container, Row } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityDetailPage.css";
import { isExternalUrl } from "../features/entityTicket/ExternalLinksEditor";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const logger = createLogger("entity-detail");

function EntityDetailPage() {
  const { entityType, entityId } = useParams(); const { state } = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [changed, setChanged] = useState(false); const [deleted, setDeleted] = useState(false); const [message, setMessage] = useState("");
  const root = state?.path;
  const [workspaceState, setWorkspaceState] = useState(state);
  const lifecycleRef = useRef(null);
  useLayoutEffect(() => {
    const lifecycle = { active: true };
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
    setChanged(false);
    setDeleted(false);
    setMessage("");
    setWorkspaceState(state);
    const load = async () => {
      try {
        const value = await loadEntityDetail(root, entityType, entityId);
        if (!active) return;
        setTicket(value);
        setForm({ name: value.name, link: value.detail.link ?? [] });
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
  if (!ticket || !form) {
    return (
      <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
        <section className="panel-card">Loading ticket...</section>
      </Container>
    );
  }
  const save = async (event) => { 
    const lifecycle = lifecycleRef.current;
    event.preventDefault();
    if (form.link.some((url) => !isExternalUrl(url))) {
      setMessage("Each external link must be an absolute HTTP(S) URL without credentials or whitespace.");
      return;
    }
    setSaving(true);
    try { 
      const detail = { ...ticket.detail }; 
      const key = entityType === "PERSON" ? "personName" : entityType === "EXPERIENCE" ? "experienceName" : entityType === "FACT" ? "factName" : "linkName"; 
      detail[key] = form.name; 
      detail.link = [...form.link];
      await saveEntityDetail(entityType, root, detail); 
      if (!lifecycle.active) return;
      setMessage("Metadata saved. Workspace requires re-verification."); 
      setTicket({ ...ticket, name: form.name, detail }); 
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
      setMessage(error?.message || "Save failed"); 
    } 
    finally { 
      if (lifecycle.active) setSaving(false);
    } 
  };
  const refresh = async () => { 
    const lifecycle = lifecycleRef.current;
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
        setMessage(error?.message || "Refresh failed"); 
      } 
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
        <h1>{ticket.name}</h1>
      </header>
      <Row className="g-3 ticket-grid">
        <Col md={5}>
          <section className="panel-card h-100">
            <h2>Details</h2>
            <TicketForm value={form} onChange={setForm} onSave={save} onCancel={() => setForm({ name: ticket.name, link: ticket.detail.link ?? [] })} saving={saving} />
            {message ? <p role="status">{message}</p> : null}
          </section>
        </Col>
        <Col md={7}>
          <MarkdownPanel markdown={ticket.markdownBody} refresh={refresh} edit={editMarkdown} changed={changed} deleted={deleted} loading={saving} />
        </Col>
      </Row>
    </Container>
  );
}
export default EntityDetailPage;