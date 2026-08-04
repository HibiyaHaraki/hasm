// ###################################################
// File Name : ColorPatternSelector.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Theme palette selector component
// Description : Renders available color patterns and handles selection.
// ###################################################

function ColorPatternSelector({ id, patterns, activePatternId, onChange, onClose }) {
  return (
    <section id={id} className="color-pattern-panel card-surface" role="dialog" aria-label="Theme selector">
      <div className="color-pattern-header">
        <div>
          <p className="eyebrow">Color Pattern</p>
          <h2>Theme Selection</h2>
        </div>
        <button type="button" className="theme-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="path-row">
        <label className="color-pattern-label" htmlFor="color-pattern-select">
          Pattern
        </label>
        <select
          id="color-pattern-select"
          value={activePatternId}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {patterns.map((pattern) => (
            <option key={pattern.id} value={pattern.id}>
              {pattern.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pattern-swatches">
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            className={pattern.id === activePatternId ? "pattern-chip active" : "pattern-chip"}
            onClick={() => onChange(pattern.id)}
          >
            <span className="pattern-name">{pattern.label}</span>
            <span className="swatch-row">
              <span style={{ background: pattern.colors.mainColor }} />
              <span style={{ background: pattern.colors.textColor }} />
              <span style={{ background: pattern.colors.textBackgroundColor }} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default ColorPatternSelector;