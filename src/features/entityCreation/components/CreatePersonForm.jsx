function CreatePersonForm({ value, onChange }) {
  return (
    <>
      <label>
        Name
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
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
      <label className="entity-create-checkbox">
        <input
          type="checkbox"
          checked={value.createRootStream}
          onChange={(event) => onChange({ ...value, createRootStream: event.target.checked })}
        />
        Create Root Stream
      </label>
    </>
  );
}

export default CreatePersonForm;
