import { Button, Form } from "react-bootstrap";
import "./TicketForm.css";
import { ExternalLinksEditor } from "./ExternalLinksEditor";

export const DETAIL_FIELDS = {
  PERSON: [
    { key: "birthday", label: "Birthday" },
    { key: "die", label: "Date of death" },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  EXPERIENCE: [
    { key: "personId", label: "Owner person", uuid: true },
    { key: "parentExperienceIds", label: "Parent experiences", list: true },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  FACT: [
    { key: "occurredAt", label: "Occurred at" },
    { key: "experienceIds", label: "Experiences", list: true },
    { key: "personIds", label: "People", list: true },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  LINK: [
    { key: "linkType", label: "Relationship type", required: true },
    { key: "relatedIds", label: "Related entities", list: true },
  ],
};

export function createDetailsDraft(detail, entityType) {
  return Object.fromEntries(DETAIL_FIELDS[entityType].map(({ key, list }) => [
    key, list ? (detail[key] ?? []).join(", ") : (detail[key] ?? ""),
  ]));
}

export function TicketForm({ field, entityType, value, onChange, onSave, onCancel, saving }) {
  return (
    <Form className="ticket-form" aria-label={`Edit ${field}`} onSubmit={onSave}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) {
          event.preventDefault();
          onCancel();
        }
      }}>
      {field === "summary" ? (
        <Form.Group className="mb-2" controlId="ticket-summary">
          <Form.Label>Summary</Form.Label>
          <Form.Control autoFocus required disabled={saving} value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </Form.Group>
      ) : field === "links" ? (
        <ExternalLinksEditor value={value.link} onChange={(link) => onChange({ ...value, link })} disabled={saving} autoFocus />
      ) : (
        DETAIL_FIELDS[entityType].map(({ key, label, list, uuid, required }, index) => (
          <Form.Group key={key} controlId={`ticket-${key}`}>
            <Form.Label>{label}</Form.Label>
            <Form.Control autoFocus={index === 0} disabled={saving} required={required || uuid}
              value={value.details[key]}
              aria-describedby={list || uuid ? `ticket-${key}-help` : undefined}
              onChange={(event) => onChange({ ...value, details: { ...value.details, [key]: event.target.value } })} />
            {list || uuid ? <Form.Text id={`ticket-${key}-help`}>
              {list ? "Comma-separated entity UUIDs. Leave empty for none." : "Entity UUID."}
            </Form.Text> : null}
          </Form.Group>
        ))
      )}
      <div className="ticket-actions d-flex gap-2">
        <Button type="submit" className="btn-hasm-primary" disabled={saving}>Save</Button>
        <Button type="button" variant="outline-secondary" className="btn-hasm-outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </Form>
  );
}