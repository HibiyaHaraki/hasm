import { useEffect, useState } from "react";
import { Dropdown, Form } from "react-bootstrap";
import { dismissEntityPreview } from "../../entityTicket/EntityInfoPreview";
import "./EntityPicker.css";

function EntityPicker({ controlId, label, options, value, onChange, multiple = false,
  placeholder, emptyMessage, describedBy, show, onToggle, disabled = false }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = show ?? expanded;
  const toggle = (next, metadata) => {
    const event = metadata?.originalEvent;
    // SEQ-MD-08: the shared preview sits outside the menu but must stay selectable.
    if (!next && metadata?.source === "rootClose" && event?.key !== "Escape"
      && event?.target instanceof Element && event.target.closest(".entity-info-preview")) return;
    dismissEntityPreview();
    if (onToggle) onToggle(next);
    else setExpanded(next);
  };
  useEffect(() => {
    dismissEntityPreview();
    return () => dismissEntityPreview();
  }, [options, isOpen]);
  const selected = options.filter((option) => value.includes(option.value));
  const choose = (option) => {
    onChange(multiple
      ? value.includes(option.value) ? value.filter((id) => id !== option.value) : [...value, option.value]
      : [option.value]);
    if (!multiple) toggle(false);
  };
  return (
    <Form.Group className="mb-2" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <Dropdown show={isOpen} onToggle={toggle} autoClose="outside" className="entity-picker">
        <Dropdown.Toggle id={controlId} type="button" className="btn-hasm-outline entity-picker-toggle"
          variant="outline-secondary" aria-label={label} aria-haspopup="listbox"
          aria-controls={`${controlId}-choices`} aria-describedby={describedBy} disabled={disabled}>
          {selected.length ? selected.map((option) => option.label).join(", ") : placeholder}
        </Dropdown.Toggle>
        <Dropdown.Menu id={`${controlId}-choices`} role="listbox"
          aria-multiselectable={multiple || undefined}>
          {!multiple ? <Dropdown.Item as="button" type="button" role="option" aria-selected={value.length === 0}
            onClick={() => { onChange([]); toggle(false); }}>{placeholder}</Dropdown.Item> : null}
          {!options.length ? <Dropdown.ItemText>{emptyMessage}</Dropdown.ItemText> : null}
          {options.map((option) => (
            <Dropdown.Item as="button" type="button" role="option" key={option.value}
              active={value.includes(option.value)} aria-selected={value.includes(option.value)}
              data-entity-type={option.type} data-entity-id={option.id}
              onClick={() => choose(option)}>
              {option.retained ? <span className="entity-picker-retained">Current selection (outside search results): </span> : null}
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </Form.Group>
  );
}

export default EntityPicker;
