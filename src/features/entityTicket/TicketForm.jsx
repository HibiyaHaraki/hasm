import { Button, Form } from "react-bootstrap";
import "./TicketForm.css";

export function TicketForm({ value, onChange, onSave, onCancel, saving }) {
  return (
    <Form className="ticket-form" onSubmit={onSave}>
      <Form.Group className="mb-2" controlId="ticket-summary">
        <Form.Label>Summary</Form.Label>
        <Form.Control value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      </Form.Group>
      <div className="ticket-actions d-flex gap-2">
        <Button type="submit" className="btn-hasm-primary" disabled={saving}>Save</Button>
        <Button variant="outline-secondary" className="btn-hasm-outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Form>
  );
}