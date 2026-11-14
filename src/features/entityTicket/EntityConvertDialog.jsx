import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import ExperienceSelect from "../entityCreation/components/ExperienceSelect";
import DateInput from "../../components/DateInput";
import "./EntityConvertDialog.css";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// [REQ-04-RULE-030] Reviews conversion metadata and keep/archive choices; dependent
// EXPERIENCES can only be copied, never removed from the existing graph.
export function EntityConvertDialog({ entityType, entityId, ticket, model, busy, error, onCancel, onConfirm, t }) {
  const targetType = entityType === "FACT" ? "EXPERIENCE" : "FACT";
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [experienceIds, setExperienceIds] = useState([...(ticket.detail.experienceIds ?? ticket.detail.parentExperienceIds ?? [])]);
  const [personId, setPersonId] = useState(ticket.detail.personIds?.[0] || NIL_UUID);
  const [occurredAt, setOccurredAt] = useState("");
  const owner = ticket.detail.personId;
  const hasDependents = entityType === "EXPERIENCE" && (
    (owner && owner !== NIL_UUID)
    || model.facts.some((item) => item.experienceIds?.includes(entityId))
    || model.experiences.some((item) => item.parentExperienceIds?.includes(entityId))
  );
  const experiences = model.experiences.filter((item) => keepOriginal || item.experienceId !== entityId);
  return (
    <Modal show onHide={busy ? undefined : onCancel} backdrop={busy ? "static" : true} keyboard={!busy}
      centered scrollable className="entity-convert-dialog" aria-labelledby="entity-convert-title">
      <Modal.Header>
        <Modal.Title id="entity-convert-title">{t("Convert to {type}", { type: targetType })}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{ticket.name}</p>
        <Form.Check id="convert-keep-original" checked={keepOriginal} disabled={busy || hasDependents}
          label={t("Keep original entity")} onChange={(event) => {
            setKeepOriginal(event.target.checked);
            if (!event.target.checked) setExperienceIds((ids) => ids.filter((id) => id !== entityId));
          }} />
        <p>{keepOriginal
          ? t("Create a new UUID entity and keep the original unchanged. Existing LINKs will also connect the new entity.")
          : t("Archive the original Markdown, assets, and metadata; convert using the same UUID to preserve LINK connections.")}</p>
        {hasDependents ? <p role="status">
          {t("This EXPERIENCE has dependent FACTs, children, or PERSON ownership. Only keeping the original is allowed.")}
        </p> : null}
        <p>{t("The title, Markdown content, assets, and external URLs are preserved. Review the target relationships below.")}</p>
        <p>{t("Metadata without an equivalent field remains in the original entity or its recovery archive.")}</p>
        <ExperienceSelect controlId="convert-experiences" label={t(targetType === "FACT" ? "Experiences" : "Parent experiences")}
          value={experienceIds} experiences={experiences} onChange={setExperienceIds} disabled={busy} t={t} />
        {targetType === "FACT" ? (
          <Form.Group controlId="convert-occurred-at" className="mt-3">
            <Form.Label>{t("Occurred at")}</Form.Label>
            <DateInput id="convert-occurred-at" value={occurredAt} onChange={setOccurredAt} disabled={busy} t={t} />
            <Form.Text>{t("Optional date for the new FACT.")}</Form.Text>
          </Form.Group>
        ) : (
          <Form.Group controlId="convert-owner" className="mt-3">
            <Form.Label>{t("Owner person")}</Form.Label>
            <Form.Select value={personId} onChange={(event) => setPersonId(event.target.value)} disabled={busy}>
              <option value={NIL_UUID}>{t("None")}</option>
              {personId !== NIL_UUID && !model.people.some((person) => person.personId === personId)
                ? <option value={personId}>{t("Unavailable {type}", { type: "PERSON" })}</option> : null}
              {model.people.map((person) => <option key={person.personId} value={person.personId}>
                {person.personName || t("Untitled {type}", { type: "PERSON" })}
              </option>)}
            </Form.Select>
          </Form.Group>
        )}
        {error ? <p role="alert" className="mt-3">{error}</p> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button className="btn-hasm-outline" variant="outline-secondary" onClick={onCancel} disabled={busy}>{t("Cancel")}</Button>
        <Button className="btn-hasm-primary" disabled={busy} onClick={() => onConfirm({
          entityType, entityId, keepOriginal, experienceIds,
          personId: targetType === "EXPERIENCE" && personId !== NIL_UUID ? personId : null,
          occurredAt: targetType === "FACT" ? occurredAt : null,
          loadedMtimeMs: ticket.loadedMtimeMs,
        })}>{busy ? t("Converting...") : t("Confirm conversion")}</Button>
      </Modal.Footer>
    </Modal>
  );
}
