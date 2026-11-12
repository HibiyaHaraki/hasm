import { Form } from "react-bootstrap";

function LinkEntitySelect({ endpoint, value, query, onChange, onSearch, entityOptions }) {
  const label = endpoint === "origin" ? "Origin" : "Target";
  const normalizedQuery = query.trim().toLowerCase();
  const matches = entityOptions.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery));
  const selected = entityOptions.find((option) => option.value === value);
  const hiddenSelection = selected && !matches.some((option) => option.value === value);
  const resultsId = `link-${endpoint}-results`;

  return (
    <>
      <Form.Group className="mb-2" controlId={`link-${endpoint}-search`}>
        <Form.Label>Search {endpoint} entities</Form.Label>
        <Form.Control type="search" value={query} onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name, entity type, or UUID" aria-describedby={resultsId} />
      </Form.Group>
      <Form.Group className="mb-2" controlId={`link-${endpoint}`}>
        <Form.Label>{label}</Form.Label>
        <Form.Select value={value} onChange={(event) => onChange(event.target.value)} required
          aria-describedby={resultsId}>
          <option value="">Select {endpoint}</option>
          {hiddenSelection ? (
            <optgroup label="Current selection (outside search results)">
              <option value={selected.value}>{selected.label} ({selected.value.split(":")[1]})</option>
            </optgroup>
          ) : null}
          {matches.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.value.split(":")[1]})
            </option>
          ))}
        </Form.Select>
        <p id={resultsId} className="selection-copy mb-1" role="status">
          {matches.length ? `${matches.length} matching entities.` : "No matching entities."}
          {hiddenSelection ? " Current selection is retained outside the search results." : ""}
        </p>
      </Form.Group>
    </>
  );
}

export default LinkEntitySelect;
