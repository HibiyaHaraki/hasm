import { Form } from "react-bootstrap";
import { useMemo, useState } from "react";
import EntityPicker from "./EntityPicker";

// [REQ-04-RULE-027] Origin/Target LINK endpoint search with dropdown choices that
// participate in the shared entity information preview and retain hidden selections.
function LinkEntitySelect({ endpoint, value, query, onChange, onSearch, entityOptions }) {
  const label = endpoint === "origin" ? "Origin" : "Target";
  const [show, setShow] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const resultsId = `link-${endpoint}-results`;
  const { options, matchCount, hiddenSelection } = useMemo(() => {
    const filtered = entityOptions.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery));
    const current = entityOptions.find((option) => option.value === value);
    const retained = current && !filtered.some((option) => option.value === value);
    return {
      matchCount: filtered.length,
      hiddenSelection: retained,
      options: [...(retained ? [{ ...current, retained: true }] : []), ...filtered].map((option) => {
        const [type, id] = option.value.split(":");
        return { ...option, type, id, label: `${option.label} (${id})` };
      }),
    };
  }, [entityOptions, normalizedQuery, value]);

  return (
    <>
      <Form.Group className="mb-2" controlId={`link-${endpoint}-search`}>
        <Form.Label>Search {endpoint} entities</Form.Label>
        <Form.Control type="search" value={query} onChange={(event) => {
          onSearch(event.target.value);
          setShow(true);
        }}
          placeholder="Search by name, entity type, or UUID" aria-describedby={resultsId} />
      </Form.Group>
      <EntityPicker controlId={`link-${endpoint}`} label={label} options={options}
        value={value ? [value] : []} onChange={(ids) => onChange(ids[0] || "")}
        placeholder={`Select ${endpoint}`} emptyMessage="No matching entities."
        describedBy={resultsId} show={show} onToggle={setShow} />
      <p id={resultsId} className="selection-copy mb-1" role="status">
        {matchCount ? `${matchCount} matching entities.` : "No matching entities."}
        {hiddenSelection ? " Current selection is retained outside the search results." : ""}
      </p>
    </>
  );
}

export default LinkEntitySelect;
