import { Form } from "react-bootstrap";
import LinkEntitySelect from "./LinkEntitySelect";

// [REQ-08-013][REQ-08-014][REQ-08-018][REQ-08-019] Dedicated LINK creation form: required
// link type and independently searchable Origin/Target endpoints serialized as typed UUIDs.
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
      {["origin", "target"].map((endpoint) => (
        <LinkEntitySelect key={endpoint} endpoint={endpoint} value={value[endpoint]}
          query={value[`${endpoint}Search`]} entityOptions={entityOptions}
          onChange={(selected) => onChange({ ...value, [endpoint]: selected })}
          onSearch={(query) => onChange({ ...value, [`${endpoint}Search`]: query })} />
      ))}
    </>
  );
}

export default CreateLinkForm;
