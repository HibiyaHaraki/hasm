import { Form } from "react-bootstrap";
import ExperienceSelect from "./ExperienceSelect";
import DateInput from "../../../components/DateInput";

// [REQ-08-012][REQ-08-014][REQ-08-017][REQ-08-018][REQ-08-022] Dedicated FACT creation form:
// required name, calendar-only start/end dates, Belonging EXPERIENCE multi-select.
function CreateFactForm({ value, onChange, experiences }) {
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
        <Form.Label>Start date</Form.Label>
        <DateInput id="fact-start-time" value={value.startTime}
          onChange={(startTime) => onChange({ ...value, startTime })} />
      </Form.Group>
      <Form.Group className="mb-2" controlId="fact-end-time">
        <Form.Label>End date</Form.Label>
        <DateInput id="fact-end-time" value={value.endTime}
          onChange={(endTime) => onChange({ ...value, endTime })} />
      </Form.Group>
      <ExperienceSelect controlId="fact-experience-id" label="Belonging EXPERIENCE"
        value={value.experienceIds} experiences={experiences}
        onChange={(experienceIds) => onChange({ ...value, experienceIds })} />
    </>
  );
}

export default CreateFactForm;
