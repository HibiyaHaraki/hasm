import { Form } from "react-bootstrap";
import LinkEntitySelect from "./LinkEntitySelect";
import SecurityLevelField from "./SecurityLevelField";

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
      <SecurityLevelField id="link-security-level" value={value.securityLevel}
        onChange={(securityLevel) => onChange({ ...value, securityLevel })} />
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
