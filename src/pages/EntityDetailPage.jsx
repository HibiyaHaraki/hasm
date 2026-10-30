import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { checkEntityMtime, launchExternalMarkdownApp, loadEntityDetail, reloadEntityMarkdown, saveEntityDetail } from "../features/hasm/api";
import { createDetailsDraft, DETAIL_FIELDS, TicketForm } from "../features/entityTicket/TicketForm";
import { MarkdownPanel } from "../features/entityTicket/MarkdownPanel";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import "./PanelCard.css";
import "./EntityDetailPage.css";
import { ExternalLinksView, isExternalUrl } from "../features/entityTicket/ExternalLinksEditor";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import { createEntityReferenceIndex, detailEntityReferences, entityReferenceTitle, relatedLinkIds } from "../features/entityTicket/EntityReferences";
import { translateTicket } from "../features/entityTicket/ticketLanguage";

const logger = createLogger("entity-detail");

function formatOccurrence(value, language, t) {
  if (!value) return t("Not set");
  const locale = language === "ja" ? "ja-JP" : "en-US";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function EntityDetailPage() {
  const { entityType, entityId } = useParams(); const { state } = useLocation(); const navigate = useNavigate();
  const [ticket, setTicket] = useState(null); const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [changed, setChanged] = useState(false); const [deleted, setDeleted] = useState(false); const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState("en");
  const [textSize, setTextSize] = useState("medium");
  const t = (text, values) => translateTicket(text, values, language);
  const editTriggerRef = useRef(null);
  const root = state?.path;
  const [workspaceState, setWorkspaceState] = useState(state);
  const referenceIndex = useMemo(() => createEntityReferenceIndex(workspaceState?.model), [workspaceState?.model]);
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
      <Container as="main" fluid lang={language} className={`ticket-page ticket-text-${textSize} panel-layout d-flex align-items-center justify-content-center`}>
        <section className="panel-card">{t("Loading ticket...")}</section>
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
          setMessage({ key: "{label} must contain valid entity UUIDs.", label });
          return;
        }
        if (required && !raw.trim()) {
          setMessage({ key: "{label} must not be empty.", label });
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
  const currentEntity = { ...ticket, entityType, entityId };
  const relationshipIds = relatedLinkIds(referenceIndex, entityId, ticket.detail);
  const navigationDisabled = Boolean(editing) || saving || refreshing || workspaceState?.isVerified === false;
  const renderDetailValue = (field) => {
    if (["occurredAt", "birthday", "die"].includes(field.key)) return formatOccurrence(ticket.detail[field.key], language, t);
    const references = detailEntityReferences(referenceIndex, field, ticket.detail, currentEntity, t);
    if (!references) return ticket.detail[field.key] || t("Not set");
    if (!references.length) return t(field.list ? "None" : "Not set");
    if (field.key === "linkIds" || field.key === "relatedIds") {
      const renderReference = ({ id, type, title }) => type && !navigationDisabled ? (
        <Link className="ticket-entity-reference" to={`/entity-detail/${type}/${id}`} state={workspaceState}
          aria-label={t("Open {type}: {title}", { type, title })}>{title}</Link>
      ) : <span aria-disabled={type ? "true" : undefined}>{title}</span>;
      if (field.key === "relatedIds") {
        const groups = new Map();
        references.forEach((reference) => {
          const group = groups.get(reference.type) || [];
          group.push(reference);
          groups.set(reference.type, group);
        });
        return (
          <ul className="ticket-detail-references">
            {[...groups].map(([type, endpoints]) => (
              <li key={type || "unavailable"}>
                {type || t("Unavailable {type}", { type: t("entity") })}
                <ul className="ticket-detail-references">
                  {endpoints.map((reference) => <li key={reference.id}>{renderReference(reference)}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        );
      }
      return (
        <ul className="ticket-detail-references">
          {references.map((reference) => <li key={reference.id}>{renderReference(reference)}</li>)}
        </ul>
      );
    }
    return references.map(({ id, type, title }, index) => (
      <span key={`${id}-${index}`}>
        {index > 0 ? ", " : ""}
        {type && !navigationDisabled ? (
          <Link className="ticket-entity-reference" to={`/entity-detail/${type}/${id}`} state={workspaceState}
            aria-label={t("Open {type}: {title}", { type, title })}>{title}</Link>
        ) : <span aria-disabled={type ? "true" : undefined}>{title}</span>}
      </span>
    ));
  };
  return (
    <Container as="main" fluid lang={language} className={`ticket-page ticket-text-${textSize}`}>
      <header className="ticket-header">
        <div className="ticket-toolbar">
          <Button className="btn-hasm-outline" variant="outline-secondary" onClick={() => navigate("/visualizer", { state: workspaceState })}>{t("Back to Visualizer")}</Button>
          <Form.Group controlId="ticket-language" className="ticket-preference">
            <Form.Label>{t("Language")}</Form.Label>
            <Form.Select value={language} onChange={(event) => {
              setLanguage(event.target.value);
              logger.info("[SEQ-MD-04][DISPLAY] ticket language changed");
            }}>
              <option value="en" lang="en">English</option>
              <option value="ja" lang="ja">日本語</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="ticket-text-size" className="ticket-preference">
            <Form.Label>{t("Text size")}</Form.Label>
            <Form.Select value={textSize} onChange={(event) => {
              setTextSize(event.target.value);
              logger.info("[SEQ-MD-04][DISPLAY] ticket text size changed");
            }}>
              <option value="small">{t("Small")}</option>
              <option value="medium">{t("Medium")}</option>
              <option value="large">{t("Large")}</option>
            </Form.Select>
          </Form.Group>
        </div>
        <p className="ticket-entity-identity">{entityType}/{entityId}</p>
        <p className="ticket-reading-hint">{t("Click the summary or external links to edit, or choose Edit details. Save or cancel before editing another field.")}</p>
        {editing === "summary" ? (
          <TicketForm field="summary" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} t={t} />
        ) : (
          <h1 aria-label={ticket.name || t("Untitled")}><Button id="ticket-summary-read" className="ticket-content-trigger ticket-summary-trigger" aria-label={t("Edit summary")}
            disabled={Boolean(editing) || refreshing} onClick={(event) => beginEdit("summary", event)}>{ticket.name || t("Untitled")}</Button></h1>
        )}
      </header>
      {message ? <p role="status" className="ticket-status">{typeof message === "string" ? t(message) : t(message.key, { label: t(message.label) })}</p> : null}
      <Row className="g-3 ticket-grid">
        <Col lg={8}>
          <MarkdownPanel markdown={ticket.markdownBody} refresh={refresh} edit={editMarkdown} changed={changed} deleted={deleted} loading={saving || refreshing} t={t} />
        </Col>
        <Col lg={4}>
          <section className="ticket-section" aria-labelledby="ticket-details-heading">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <h2 id="ticket-details-heading" className="mb-0">{t("Details")}</h2>
              {editing !== "details" ? (
                <Button id="ticket-details-read" className="btn-hasm-outline" variant="outline-secondary"
                  disabled={Boolean(editing) || saving || refreshing} onClick={(event) => beginEdit("details", event)}>
                  {t("Edit details")}
                </Button>
              ) : null}
            </div>
            {workspaceState?.isVerified === false ? <p>{t("Return to Visualizer to re-verify before opening referenced entities.")}</p> : null}
            {editing === "details" ? (
              <TicketForm field="details" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} t={t} />
            ) : (
              <dl className="mb-0">
                {DETAIL_FIELDS[entityType].map((field) => (
                  <div className="ticket-detail-row" key={field.key}>
                    <dt className="ticket-detail-label">{t(field.label)}</dt>
                    <dd className="mb-0">{renderDetailValue(field)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          {entityType !== "LINK" ? (
            <section className="ticket-section" aria-labelledby="ticket-relationships-heading">
              <h2 id="ticket-relationships-heading">{t("Related LINK entities")}</h2>
              {!referenceIndex.available ? <p>{t("Workspace relationship information is unavailable.")}</p> : null}
              {workspaceState?.isVerified === false && relationshipIds.length ? <p>{t("Return to Visualizer to re-verify before opening related entities.")}</p> : null}
              {relationshipIds.length ? (
                <ul className="ticket-relationships">
                  {relationshipIds.map((id) => {
                    const match = referenceIndex.entities.get(id);
                    const relationship = match?.type === "LINK" ? match.entity : null;
                    const title = entityReferenceTitle(referenceIndex, id, "LINK", currentEntity, t);
                    return (
                      <li key={id}>
                        {relationship ? (
                          <Button className="ticket-content-trigger" disabled={Boolean(editing) || saving || refreshing || workspaceState?.isVerified === false}
                            aria-label={t("Open {type}: {title}", { type: "LINK", title })}
                            onClick={() => navigate(`/entity-detail/LINK/${id}`, { state: workspaceState })}>
                            <span className="ticket-relationship-title">{title}</span>
                          </Button>
                        ) : <p>{t("Referenced LINK information is unavailable.")}</p>}
                        {relationship ? (
                          <details className="ticket-relationship-disclosure">
                            <summary>{t("Relationship details")}</summary>
                            <ul className="ticket-relationship-details">
                              <li><strong>{t("Relationship type")}:</strong> {relationship.linkType || t("Not set")}</li>
                              <li>
                                <strong>{t("Connected entities:")}</strong>
                                {(relationship.relatedIds ?? []).length ? (
                                  <ul className="ticket-relationship-endpoints">
                                    {relationship.relatedIds.map((endpoint) => (
                                      <li key={endpoint}>{entityReferenceTitle(referenceIndex, endpoint, undefined, currentEntity, t)}</li>
                                    ))}
                                  </ul>
                                ) : <span> {t("No related entities.")}</span>}
                              </li>
                            </ul>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : referenceIndex.available ? <p>{t("No related LINK entities.")}</p> : null}
            </section>
          ) : null}
          <section className="ticket-section" aria-labelledby="ticket-links-heading">
            <h2 id="ticket-links-heading">{t("External links")}</h2>
            {editing === "links" ? (
              <TicketForm field="links" entityType={entityType} value={form} onChange={setForm} onSave={save} onCancel={cancelEdit} saving={saving || refreshing} t={t} />
            ) : (
              <ExternalLinksView value={ticket.detail.link ?? []} disabled={Boolean(editing) || refreshing} t={t}
                onEdit={(event) => beginEdit("links", event)} />
            )}
          </section>
        </Col>
      </Row>
    </Container>
  );
}
export default EntityDetailPage;