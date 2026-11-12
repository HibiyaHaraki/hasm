import { useMemo } from "react";
import { Button } from "react-bootstrap";
import EntityPicker from "./EntityPicker";

function ExperienceSelect({ controlId, label, value, onChange, experiences }) {
  const options = useMemo(() => experiences.map((experience) => ({
    value: experience.experienceId, id: experience.experienceId, type: "EXPERIENCE",
    label: `${experience.experienceName || "Untitled EXPERIENCE"} (${experience.experienceId})`,
  })), [experiences]);
  return (
    <>
      <EntityPicker controlId={controlId} label={label} options={options} value={value} onChange={onChange}
        multiple describedBy={`${controlId}-help`} disabled={experiences.length === 0}
        placeholder={experiences.length ? "Select experiences" : "No EXPERIENCE available"} />
      <p id={`${controlId}-help`} className="selection-copy mb-1">
        Click or press Enter/Space to toggle each experience. Hover or focus a choice for entity information.
      </p>
      <Button type="button" variant="outline-secondary" className="btn-hasm-outline"
        disabled={value.length === 0} onClick={() => onChange([])}>
        Clear {label}
      </Button>
    </>
  );
}

export default ExperienceSelect;
