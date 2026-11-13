import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { relatedLinkIds } from "./EntityReferences";
import "./EntityDeleteDialog.css";

// [REQ-04-RULE-028] Explicit deletion confirmation with per-related-LINK delete/retain choices.
// [REQ-04-RULE-029] Collects replacement EXPERIENCE and child reparenting before deletion.
export function EntityDeleteDialog({ entityType, entityId, ticket, model, referenceIndex, busy, error, onCancel, onConfirm, t }) {
  const [replacement, setReplacement] = useState("");
  const [parents, setParents] = useState({});
  const [deleteLinks, setDeleteLinks] = useState([]);
  const experiences = model.experiences.filter((item) => item.experienceId !== entityId);
  const experienceIds = new Set(experiences.map((item) => item.experienceId));
  const facts = entityType === "EXPERIENCE"
    ? model.facts.filter((item) => (item.experienceIds ?? []).includes(entityId)) : [];
  const needsReplacement = facts.some((fact) => !(fact.experienceIds ?? []).some((id) => experienceIds.has(id)));
  const children = entityType === "EXPERIENCE"
    ? experiences.filter((item) => (item.parentExperienceIds ?? []).includes(entityId)) : [];
  const links = entityType === "LINK" ? [] : relatedLinkIds(referenceIndex, entityId, ticket.detail);
  const missingLinks = links.some((id) => referenceIndex.entities.get(id)?.type !== "LINK");
  const ready = (!needsReplacement || replacement) && children.every((child) => parents[child.experienceId]) && !missingLinks;
  const title = (item) => item.experienceName?.trim() || t("Untitled EXPERIENCE");

  return (
    <Modal show onHide={busy ? undefined : onCancel} backdrop={busy ? "static" : true} keyboard={!busy}
      centered scrollable className="entity-delete-dialog" aria-labelledby="entity-delete-title">
      <Modal.Header>
        <Modal.Title id="entity-delete-title">{t("Delete {type}?", { type: entityType })}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{t("Are you sure you want to delete {name}?", { name: ticket.name })}</p>
        <p>{t("Markdown and assets will be preserved in the workspace deletion archive.")}</p>
        {facts.length ? (
          <section aria-labelledby="delete-facts-heading">
            <h2 id="delete-facts-heading">{t("Belonging FACTs")}</h2>
            <ul>{facts.map((fact) => <li key={fact.factId}>{fact.factName || t("Untitled {type}", { type: "FACT" })}</li>)}</ul>
            <Form.Group controlId="delete-fact-replacement">
              <Form.Label>{needsReplacement ? t("Replacement EXPERIENCE (required)") : t("Replacement EXPERIENCE (optional)")}</Form.Label>
              <Form.Select value={replacement} onChange={(event) => setReplacement(event.target.value)} disabled={busy}>
                <option value="">{t("Select an EXPERIENCE")}</option>
                {experiences.map((item) => <option key={item.experienceId} value={item.experienceId}>{title(item)}</option>)}
              </Form.Select>
            </Form.Group>
            <p>{t("The selected EXPERIENCE is added to all listed FACTs; their other EXPERIENCES are retained.")}</p>
            {needsReplacement && !experiences.length ? <p role="alert">{t("Create another EXPERIENCE before deleting this one.")}</p> : null}
          </section>
        ) : null}
        {children.length ? (
          <section aria-labelledby="delete-children-heading">
            <h2 id="delete-children-heading">{t("Replacement parents for child EXPERIENCES")}</h2>
            {children.map((child) => (
              <Form.Group key={child.experienceId} controlId={`delete-parent-${child.experienceId}`}>
                <Form.Label>{t("Parent for {name}", { name: title(child) })}</Form.Label>
                <Form.Select value={parents[child.experienceId] || ""} disabled={busy}
                  onChange={(event) => setParents((current) => ({ ...current, [child.experienceId]: event.target.value }))}>
                  <option value="">{t("Select an EXPERIENCE")}</option>
                  {experiences.filter((item) => item.experienceId !== child.experienceId).map((item) => (
                    <option key={item.experienceId} value={item.experienceId}>{title(item)}</option>
                  ))}
                </Form.Select>
                {experiences.length === 1 ? <p role="alert">{t("Create another EXPERIENCE to use as a replacement parent.")}</p> : null}
              </Form.Group>
            ))}
          </section>
        ) : null}
        {links.length ? (
          <section aria-labelledby="delete-links-heading">
            <h2 id="delete-links-heading">{t("Related LINK entities")}</h2>
            <p>{t("Select LINKs to delete. Unselected LINKs are kept with their remaining endpoints.")}</p>
            {links.map((id) => {
              const link = referenceIndex.entities.get(id)?.entity;
              return <Form.Check key={id} id={`delete-link-${id}`} type="checkbox" disabled={busy || !link}
                label={link?.linkName || link?.linkType || t("Referenced LINK information is unavailable.")}
                checked={deleteLinks.includes(id)}
                onChange={(event) => setDeleteLinks((current) => event.target.checked
                  ? [...current, id] : current.filter((value) => value !== id))} />;
            })}
            {missingLinks ? <p role="alert">{t("Repair missing LINK references before deleting.")}</p> : null}
          </section>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button className="btn-hasm-outline" variant="outline-secondary" onClick={onCancel} disabled={busy}>{t("Cancel")}</Button>
        <Button className="btn-hasm-primary" onClick={() => onConfirm({
          entityType, entityId,
          factIds: facts.map((fact) => fact.factId),
          replacementExperienceId: replacement || null,
          childParents: children.map((child) => ({ childId: child.experienceId, parentId: parents[child.experienceId] })),
          linkDecisions: links.map((id) => ({ linkId: id, delete: deleteLinks.includes(id) })),
        })} disabled={busy || !ready}>{busy ? t("Deleting...") : t("Confirm deletion")}</Button>
      </Modal.Footer>
    </Modal>
  );
}
