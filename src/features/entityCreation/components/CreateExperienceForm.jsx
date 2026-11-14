import { useMemo } from "react";
import { Button, Form } from "react-bootstrap";
import ExperienceSelect from "./ExperienceSelect";
import { ExperienceMultiSelect } from "../../../hasm_visualizer/ExperienceMultiSelect";
import { dismissEntityPreview } from "../../entityTicket/EntityInfoPreview";
import SecurityLevelField from "./SecurityLevelField";

// [REQ-08-011][REQ-08-014][REQ-08-017][REQ-08-018] Dedicated EXPERIENCE creation form:
// [REQ-08-023] Optional searchable existing FACT memberships preserve selections outside search.
function CreateExperienceForm({ value, onChange, experiences, facts = [] }) {
  const query = value.factSearch || "";
  const selectedIds = value.factIds || [];
  const options = useMemo(() => facts.map((fact) => ({
    id: fact.factId,
    label: `FACT ${fact.factName?.trim() || "Untitled FACT"} (${fact.factId})`,
  })), [facts]);
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
      <ExperienceMultiSelect id="experience-facts" label="Belonging FACT"
        options={options} value={selectedIds} entityPreview entityType="FACT"
        onChange={(factIds) => onChange({ ...value, factIds })}
        searchValue={query} onSearchChange={(factSearch) => onChange({ ...value, factSearch })}
        searchLabel="Search belonging FACTs" searchPlaceholder="Search by name, entity type, or UUID"
        placeholder="Select FACTs (optional)" emptyLabel="No FACT available"
        noMatchesLabel="No matching FACTs." unavailableLabel="Unavailable FACT"
        onDismiss={dismissEntityPreview} />
      <p className="selection-copy mb-1">
        {facts.length ? "Search FACTs, then select or remove them. Hover or focus a choice for entity information."
          : "No FACT available. You can create an EXPERIENCE without FACTs."}
      </p>
      <Button type="button" variant="outline-secondary" className="btn-hasm-outline"
        disabled={!selectedIds.length} onClick={() => onChange({ ...value, factIds: [] })}>
        Clear Belonging FACT
      </Button>
    </>
  );
}

export default CreateExperienceForm;
