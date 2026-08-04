// ###################################################
// File Name : EntityTypeTabs.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Entity type tab navigation
// Description : Lets users switch between PERSON, EXPERIENCE, FACT, and LINK views.
// ###################################################

import { ENTITY_LABELS, ENTITY_TYPES } from "../constants";

function EntityTypeTabs({ activeType, counts, onSelect }) {
  return (
    <div className="section-tabs">
      {ENTITY_TYPES.map((entityType) => (
        <button
          key={entityType}
          type="button"
          className={activeType === entityType ? "section-button active" : "section-button"}
          onClick={() => onSelect(entityType)}
        >
          {ENTITY_LABELS[entityType]} ({counts[entityType] || 0})
        </button>
      ))}
    </div>
  );
}

export default EntityTypeTabs;