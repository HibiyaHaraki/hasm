import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntityMtime, launchExternalMarkdownApp, loadEntityDetail, reloadEntityMarkdown, saveEntityDetail } from "../features/hasm/api";
import { TicketForm } from "../features/entityTicket/TicketForm";
import { MarkdownPanel } from "../features/entityTicket/MarkdownPanel";
import { Button, Col, Container, Row } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityDetailPage.css";

function EntityDetailPage() {
  const { entityType, entityId } = useParams(); const { state } = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [changed, setChanged] = useState(false); const [deleted, setDeleted] = useState(false); const [message, setMessage] = useState("");
  const root = state?.path;
  const load = async () => { 
    try { const value = await loadEntityDetail(root, entityType, entityId);
      setTicket(value);
      setForm({ name: value.name }); 
    } 
    catch (error) { 
      navigate(error?.message?.includes("MARKDOWN") ? "/error-markdown" : "/error-model", { state: { error: error?.message } }); 
    } 
  };
  useEffect(() => { 
    if (!root) { 
      navigate("/select", { replace: true }); 
      return; 
    } 
    load(); 
  }, [entityId, entityType, root]);
  useEffect(() => { 
    const focused = async () => { 
      if (!ticket) return; 
      const result = await checkEntityMtime(root, entityType, entityId, ticket.loadedMtimeMs); 
      setChanged(result.isModified || result.isDeleted); 
      setDeleted(result.isDeleted); 
      if (result.isDeleted) setMessage("Markdown file deleted on disk"); 
    }; 
    window.addEventListener("focus", focused); return () => window.removeEventListener("focus", focused); 
  }, [ticket, root, entityType, entityId]);
  if (!ticket || !form) {
    return (
      <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
        <section className="panel-card">Loading ticket...</section>
      </Container>
    );
  }
  const save = async (event) => { 
    event.preventDefault();
    setSaving(true);
    try { 
      const detail = { ...ticket.detail }; 
      const key = entityType === "PERSON" ? "personName" : entityType === "EXPERIENCE" ? "experienceName" : entityType === "FACT" ? "factName" : "linkName"; 
      detail[key] = form.name; 
      await saveEntityDetail(entityType, root, detail); 
      setMessage("Metadata saved. Workspace requires re-verification."); 
      setTicket({ ...ticket, name: form.name, detail }); 
    } 
    catch (error) { 
      setMessage(error?.message || "Save failed"); 
    } 
    finally { 
      setSaving(false); 
    } 
  };
  const refresh = async () => { 
    try { 
      const value = await reloadEntityMarkdown(root, entityType, entityId); 
      setTicket(value); 
      setChanged(false); 
      setDeleted(false); 
      setMessage("Markdown refreshed."); 
    } 
    catch (error) { 
      if (error?.message?.includes("MARKDOWN")) {
        navigate("/error-markdown", { state: { error: error.message } })
      } 
      else {
        setMessage(error?.message || "Refresh failed"); 
      } 
    }
  };
  const editMarkdown = async () => { 
    try { 
      await launchExternalMarkdownApp(root, entityType, entityId); 
      setMessage("Opened HASM Markdown App. Click 'Refresh Markdown' after saving."); 
    } 
    catch (error) { 
      const text = error?.message || "Failed to launch hasm_markdown.exe process."; 
      setMessage(text.includes("EXECUTABLE_NOT_FOUND") ? "hasm_markdown.exe application binary is missing." : text.includes("DIRECTORY_NOT_FOUND") ? "Entity folder does not exist on disk." : text.includes("LAUNCH_TIMEOUT") ? "Launching HASM Markdown App timed out." : text.includes("PROCESS_SPAWN_FAILED") ? "Failed to launch hasm_markdown.exe process." : text); 
    } 
  };
  return (
    <Container as="main" fluid className="ticket-page">
      <header className="ticket-header">
        <div className="d-flex flex-wrap gap-2 mb-2">
          <Button className="btn-hasm-outline" variant="outline-secondary" onClick={() => navigate("/visualizer", { state })}>Back to Visualizer</Button>
          <Button className="btn-hasm-primary" onClick={editMarkdown}>Edit Markdown in HASM App</Button>
        </div>
        <p className="mb-0">{entityType} / {entityId}</p>
        <h1>{ticket.name}</h1>
      </header>
      <Row className="g-3 ticket-grid">
        <Col md={5}>
          <section className="panel-card h-100">
            <h2>Details</h2>
            <TicketForm value={form} onChange={setForm} onSave={save} onCancel={() => setForm({ name: ticket.name })} saving={saving} />
            {message ? <p role="status">{message}</p> : null}
          </section>
        </Col>
        <Col md={7}>
          <MarkdownPanel markdown={ticket.markdownBody} refresh={refresh} changed={changed} deleted={deleted} loading={saving} />
        </Col>
      </Row>
    </Container>
  );
}
export default EntityDetailPage;