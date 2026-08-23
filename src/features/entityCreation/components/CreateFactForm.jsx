function CreateFactForm({ value, onChange }) {
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
      <label>
        Start time (ISO8601)
        <input
          value={value.startTime}
          onChange={(event) => onChange({ ...value, startTime: event.target.value })}
        />
      </label>
      <label>
        End time (ISO8601)
        <input
          value={value.endTime}
          onChange={(event) => onChange({ ...value, endTime: event.target.value })}
        />
      </label>
      <label>
        EXPERIENCE IDs (comma-separated)
        <input
          value={value.experienceIds}
          onChange={(event) => onChange({ ...value, experienceIds: event.target.value })}
        />
      </label>
    </>
  );
}

export default CreateFactForm;
