function CreateLinkForm({ value, onChange, entityOptions }) {
  return (
    <>
      <label>
        Link type
        <input
          value={value.linkType}
          onChange={(event) => onChange({ ...value, linkType: event.target.value })}
          required
        />
      </label>
      <label>
        Description
        <input
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </label>
      <label>
        Security level
        <input
          type="number"
          min="0"
          max="5"
          value={value.securityLevel}
          onChange={(event) => onChange({ ...value, securityLevel: event.target.value })}
        />
      </label>
      <label>
        Origin
        <select
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
          required
        >
          <option value="">Select origin</option>
          {entityOptions.map((option) => (
            <option key={`origin-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Target
        <select
          value={value.target}
          onChange={(event) => onChange({ ...value, target: event.target.value })}
          required
        >
          <option value="">Select target</option>
          {entityOptions.map((option) => (
            <option key={`target-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export default CreateLinkForm;
