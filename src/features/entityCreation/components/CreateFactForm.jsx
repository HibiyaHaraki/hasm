import { Form } from "react-bootstrap";

function CreateFactForm({ value, onChange }) {
  return (
    <>
      <Form.Group className="mb-2" controlId="fact-name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-security-level">
        <Form.Label>Security level</Form.Label>
        <Form.Control
          type="number"
          min="0"
          max="5"
          value={value.securityLevel}
          onChange={(event) => onChange({ ...value, securityLevel: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-start-time">
        <Form.Label>Start time (ISO8601)</Form.Label>
        <Form.Control
          value={value.startTime}
          onChange={(event) => onChange({ ...value, startTime: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-end-time">
        <Form.Label>End time (ISO8601)</Form.Label>
        <Form.Control
          value={value.endTime}
          onChange={(event) => onChange({ ...value, endTime: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-experience-ids">
        <Form.Label>EXPERIENCE IDs (comma-separated)</Form.Label>
        <Form.Control
          value={value.experienceIds}
          onChange={(event) => onChange({ ...value, experienceIds: event.target.value })}
        />
      </Form.Group>
    </>
  );
}

export default CreateFactForm;
