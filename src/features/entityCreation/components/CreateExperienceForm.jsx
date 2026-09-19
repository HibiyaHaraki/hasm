import { Form } from "react-bootstrap";

function CreateExperienceForm({ value, onChange }) {
  return (
    <>
      <Form.Group className="mb-2" controlId="experience-name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="experience-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="experience-security-level">
        <Form.Label>Security level</Form.Label>
        <Form.Control
          type="number"
          min="0"
          max="5"
          value={value.securityLevel}
          onChange={(event) => onChange({ ...value, securityLevel: event.target.value })}
        />
      </Form.Group>
      <Form.Group className="mb-2" controlId="experience-parent-ids">
        <Form.Label>Parent EXPERIENCE IDs (comma-separated)</Form.Label>
        <Form.Control
          value={value.parentExperienceIds}
          onChange={(event) => onChange({ ...value, parentExperienceIds: event.target.value })}
        />
      </Form.Group>
    </>
  );
}

export default CreateExperienceForm;
