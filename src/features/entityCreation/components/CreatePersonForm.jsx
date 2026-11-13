import { Form } from "react-bootstrap";
import SecurityLevelField from "./SecurityLevelField";

// [REQ-08-010][REQ-08-014][REQ-08-018] Dedicated PERSON creation form: required name,
// security level 0-5, optional root EXPERIENCE stream toggle, no description input.
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
      <SecurityLevelField id="person-security-level" value={value.securityLevel}
        onChange={(securityLevel) => onChange({ ...value, securityLevel })} />
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
