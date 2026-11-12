import { Button, Form } from "react-bootstrap";

function ExperienceSelect({ controlId, label, value, onChange, experiences }) {
  return (
    <Form.Group className="mb-2" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <Form.Select multiple value={value}
        aria-describedby={`${controlId}-help`}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        disabled={experiences.length === 0}>
        {experiences.length === 0 ? <option value="" disabled>No EXPERIENCE available</option> : null}
        {experiences.map((experience) => (
          <option key={experience.experienceId} value={experience.experienceId}>
            {experience.experienceName || "Untitled EXPERIENCE"} ({experience.experienceId})
          </option>
        ))}
      </Form.Select>
      <p id={`${controlId}-help`} className="selection-copy mb-1">
        Select multiple with Ctrl (Windows) or Command (Mac). Leave empty for no relationship.
      </p>
      <Button type="button" variant="outline-secondary" className="btn-hasm-outline"
        disabled={value.length === 0} onClick={() => onChange([])}>
        Clear {label}
      </Button>
    </Form.Group>
  );
}

export default ExperienceSelect;
