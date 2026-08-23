function CreateExperienceForm({ value, onChange }) {
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
        Parent EXPERIENCE IDs (comma-separated)
        <input
          value={value.parentExperienceIds}
          onChange={(event) => onChange({ ...value, parentExperienceIds: event.target.value })}
        />
      </label>
    </>
  );
}

export default CreateExperienceForm;
