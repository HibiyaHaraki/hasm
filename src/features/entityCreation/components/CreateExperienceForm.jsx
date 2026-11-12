import { Form } from "react-bootstrap";
import ExperienceSelect from "./ExperienceSelect";

function CreateExperienceForm({ value, onChange, experiences }) {
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
      <ExperienceSelect controlId="experience-parent-id" label="Parent EXPERIENCE"
        value={value.parentExperienceIds} experiences={experiences}
        onChange={(parentExperienceIds) => onChange({ ...value, parentExperienceIds })} />
    </>
  );
}

export default CreateExperienceForm;
