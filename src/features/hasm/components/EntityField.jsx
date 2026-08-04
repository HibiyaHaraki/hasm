// ###################################################
// File Name : EntityField.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Reusable field renderer for entity forms
// Description : Maps field definitions to concrete input controls.
// ###################################################

function EntityField({ field, value, onChange }) {
  const className = field.className || "";
  const commonProps = {
    value: value ?? "",
    placeholder: field.placeholder || "",
    readOnly: field.readOnly,
    onChange: (event) => onChange(field.key, event.currentTarget.value),
  };

  return (
    <label className={className}>
      <span>{field.label}</span>
      {field.multiline ? <textarea {...commonProps} /> : <input {...commonProps} />}
    </label>
  );
}

export default EntityField;