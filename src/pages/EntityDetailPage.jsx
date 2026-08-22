import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntityMtime, loadEntityDetail, reloadEntityMarkdown, saveEntityDetail } from "../features/hasm/api";
import { TicketForm } from "../features/entityTicket/TicketForm";
import { MarkdownPanel } from "../features/entityTicket/MarkdownPanel";

function EntityDetailPage() {
  const { entityType, entityId } = useParams(); const { state } = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [changed, setChanged] = useState(false); const [deleted, setDeleted] = useState(false); const [message, setMessage] = useState("");
  const root = state?.path;
  const load = async () => { try { const value = await loadEntityDetail(root, entityType, entityId); setTicket(value); setForm({ name: value.name }); } catch (error) { navigate(error?.message?.includes("MARKDOWN") ? "/error-markdown" : "/error-model", { state: { error: error?.message } }); } };
  useEffect(() => { if (!root) { navigate("/select", { replace: true }); return; } load(); }, [entityId, entityType, root]);
  useEffect(() => { const focused = async () => { if (!ticket) return; const result = await checkEntityMtime(root, entityType, entityId, ticket.loadedMtimeMs); setChanged(result.isModified || result.isDeleted); setDeleted(result.isDeleted); if (result.isDeleted) setMessage("Markdown file deleted on disk"); }; window.addEventListener("focus", focused); return () => window.removeEventListener("focus", focused); }, [ticket, root, entityType, entityId]);
  if (!ticket || !form) return <main className="boot-layout"><section className="boot-panel">Loading ticket...</section></main>;
  const save = async (event) => { event.preventDefault(); setSaving(true); try { const detail = { ...ticket.detail }; const key = entityType === "PERSON" ? "personName" : entityType === "EXPERIENCE" ? "experienceName" : entityType === "FACT" ? "factName" : "linkName"; detail[key] = form.name; await saveEntityDetail(entityType, root, detail); setMessage("Metadata saved. Workspace requires re-verification."); setTicket({ ...ticket, name: form.name, detail }); } catch (error) { setMessage(error?.message || "Save failed"); } finally { setSaving(false); } };
  const refresh = async () => { try { const value = await reloadEntityMarkdown(root, entityType, entityId); setTicket(value); setChanged(false); setDeleted(false); setMessage("Markdown refreshed."); } catch (error) { if (error?.message?.includes("MARKDOWN")) navigate("/error-markdown", { state: { error: error.message } }); else setMessage(error?.message || "Refresh failed"); } };
  return <main className="ticket-page"><header className="ticket-header"><button type="button" onClick={() => navigate("/visualizer", { state })}>Back to Visualizer</button><p>{entityType} / {entityId}</p><h1>{ticket.name}</h1></header><div className="ticket-grid"><section className="ticket-card"><h2>Details</h2><TicketForm value={form} onChange={setForm} onSave={save} onCancel={() => setForm({ name: ticket.name })} saving={saving} />{message ? <p role="status">{message}</p> : null}</section><MarkdownPanel markdown={ticket.markdownBody} refresh={refresh} changed={changed} deleted={deleted} loading={saving} /></div></main>;
}
export default EntityDetailPage;