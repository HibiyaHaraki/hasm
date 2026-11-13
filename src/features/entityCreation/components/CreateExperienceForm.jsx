import { Form } from "react-bootstrap";
import ExperienceSelect from "./ExperienceSelect";
import SecurityLevelField from "./SecurityLevelField";

// [REQ-08-011][REQ-08-014][REQ-08-017][REQ-08-018] Dedicated EXPERIENCE creation form:
// required name plus multi-selected parent EXPERIENCE UUIDs, no description input.
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
      <SecurityLevelField id="experience-security-level" value={value.securityLevel}
        onChange={(securityLevel) => onChange({ ...value, securityLevel })} />
      <ExperienceSelect controlId="experience-parent-id" label="Parent EXPERIENCE"
        value={value.parentExperienceIds} experiences={experiences}
        onChange={(parentExperienceIds) => onChange({ ...value, parentExperienceIds })} />
    </>
  );
}

export default CreateExperienceForm;
