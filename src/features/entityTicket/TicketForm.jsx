import { Button, Form } from "react-bootstrap";
import "./TicketForm.css";
import { ExternalLinksEditor } from "./ExternalLinksEditor";
import { translateTicket } from "./ticketLanguage";
import ExperienceSelect from "../entityCreation/components/ExperienceSelect";
import DateInput from "../../components/DateInput";

// [REQ-04-RULE-017] Typed detail field definitions per entity type (PERSON birthday/death/
// graph links, EXPERIENCE owner/parents/graph links, FACT occurrence/experiences/people/
// graph links, LINK relationship type/related entities).
export const DETAIL_FIELDS = {
  PERSON: [
    { key: "birthday", label: "Birthday", date: true },
    { key: "die", label: "Date of death", date: true },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  EXPERIENCE: [
    { key: "personId", label: "Owner person", uuid: true },
    { key: "parentExperienceIds", label: "Parent experiences", list: true },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  FACT: [
    { key: "occurredAt", label: "Occurred at", date: true },
    { key: "experienceIds", label: "Experiences", list: true },
    { key: "personIds", label: "People", list: true },
    { key: "linkIds", label: "Graph links", list: true },
  ],
  LINK: [
    { key: "linkType", label: "Relationship type", required: true },
    { key: "relatedIds", label: "Related entities", list: true },
  ],
};

// [REQ-04-RULE-017] Builds the editable details draft; list fields become comma-separated
// UUID text that serializes back to UUID arrays on save.
export function createDetailsDraft(detail, entityType) {
  return Object.fromEntries(DETAIL_FIELDS[entityType].map(({ key, list }) => [
    key, list ? (detail[key] ?? []).join(", ") : (detail[key] ?? ""),
  ]));
}

// [REQ-04-RULE-016] Single-section editor form with Save/Cancel controls; Escape discards
// the draft without IPC and Cancel stays disabled while persisting.
// [REQ-04-RULE-017] Renders typed detail editors, including the shared searchable
// EXPERIENCE selector and accessible native date calendars.
export function TicketForm({ field, entityType, value, onChange, onSave, onCancel, saving, experiences = [], t = translateTicket }) {
  return (
    <Form className="ticket-form" aria-label={t(`Edit ${field}`)} onSubmit={onSave}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) {
          event.preventDefault();
          onCancel();
        }
      }}>
      {field === "summary" ? (
        <Form.Group className="mb-2" controlId="ticket-summary">
          <Form.Label>{t("Summary")}</Form.Label>
          <Form.Control autoFocus required disabled={saving} value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </Form.Group>
      ) : field === "links" ? (
        <ExternalLinksEditor value={value.link} onChange={(link) => onChange({ ...value, link })} disabled={saving} autoFocus t={t} />
      ) : (
        DETAIL_FIELDS[entityType].map(({ key, label, list, uuid, required, date }, index) => (
          key === "experienceIds" || key === "parentExperienceIds" ? (
            <ExperienceSelect key={key} controlId={`ticket-${key}`} label={t(label)} experiences={experiences}
              value={value.details[key].trim() ? value.details[key].split(",").map((id) => id.trim()) : []}
              onChange={(ids) => onChange({ ...value, details: { ...value.details, [key]: ids.join(", ") } })}
              disabled={saving} t={t} />
          ) : (
          <Form.Group key={key} controlId={`ticket-${key}`}>
            <Form.Label>{t(label)}</Form.Label>
            {date ? <DateInput id={`ticket-${key}`} t={t} autoFocus={index === 0} disabled={saving}
              value={value.details[key]}
              onChange={(next) => onChange({ ...value, details: { ...value.details, [key]: next } })} /> :
            <Form.Control autoFocus={index === 0} disabled={saving} required={required || uuid}
              value={value.details[key]}
              aria-describedby={list || uuid ? `ticket-${key}-help` : undefined}
              onChange={(event) => onChange({ ...value, details: { ...value.details, [key]: event.target.value } })} />}
            {list || uuid ? <Form.Text id={`ticket-${key}-help`}>
              {t(list ? "Comma-separated entity UUIDs. Leave empty for none." : "Entity UUID.")}
            </Form.Text> : null}
          </Form.Group>
          )
        ))
      )}
      <div className="ticket-actions d-flex gap-2">
        <Button type="submit" className="btn-hasm-primary" disabled={saving}>{t("Save")}</Button>
        <Button type="button" variant="outline-secondary" className="btn-hasm-outline" onClick={onCancel} disabled={saving}>{t("Cancel")}</Button>
      </div>
    </Form>
  );
}