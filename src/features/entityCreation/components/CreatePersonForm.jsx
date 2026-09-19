import { Form } from "react-bootstrap";

function CreatePersonForm({ value, onChange }) {
  return (
    <>
      <Form.Group className="mb-2" controlId="person-name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="person-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="person-security-level">
        <Form.Label>Security level</Form.Label>
        <Form.Control
          type="number"
          min="0"
          max="5"
          value={value.securityLevel}
          onChange={(event) => onChange({ ...value, securityLevel: event.target.value })}
        />
      </Form.Group>
      <Form.Check
        className="mb-2"
        label="Create Root Stream"
        checked={value.createRootStream}
        onChange={(event) => onChange({ ...value, createRootStream: event.target.checked })}
      />
    </>
  );
}

export default CreatePersonForm;
