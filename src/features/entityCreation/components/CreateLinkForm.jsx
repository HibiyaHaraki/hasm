import { Form } from "react-bootstrap";

function CreateLinkForm({ value, onChange, entityOptions }) {
  return (
    <>
      <Form.Group className="mb-2" controlId="link-type">
        <Form.Label>Link type</Form.Label>
        <Form.Control
          value={value.linkType}
          onChange={(event) => onChange({ ...value, linkType: event.target.value })}
          required
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="link-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="link-security-level">
        <Form.Label>Security level</Form.Label>
        <Form.Control
          type="number"
          min="0"
          max="5"
          value={value.securityLevel}
          onChange={(event) => onChange({ ...value, securityLevel: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="link-origin">
        <Form.Label>Origin</Form.Label>
        <Form.Select
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
          required
        >
          <option value="">Select origin</option>
          {entityOptions.map((option) => (
            <option key={`origin-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-2" controlId="link-target">
        <Form.Label>Target</Form.Label>
        <Form.Select
          value={value.target}
          onChange={(event) => onChange({ ...value, target: event.target.value })}
          required
        >
          <option value="">Select target</option>
          {entityOptions.map((option) => (
            <option key={`target-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </>
  );
}

export default CreateLinkForm;
