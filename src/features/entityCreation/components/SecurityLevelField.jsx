import { Form } from "react-bootstrap";

// [REQ-08-014] The build flag hides the control without changing the creation payload.
function SecurityLevelField({ id, value, onChange }) {
  if (import.meta.env.VITE_ENABLE_SECURITY_LEVEL === "false") return null;
  return (
    <Form.Group className="mb-2" controlId={id}>
      <Form.Label>Security level</Form.Label>
      <Form.Control type="number" min="0" max="5" value={value}
        onChange={(event) => onChange(event.target.value)} />
    </Form.Group>
  );
}

export default SecurityLevelField;
