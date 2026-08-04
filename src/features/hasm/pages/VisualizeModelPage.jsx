// ###################################################
// File Name : VisualizeModelPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Model visualization and selection page
// Description : Presents entity type tabs, entity lists, and selection actions.
// ###################################################

import { useMemo, useState } from "react";
import EntityListPanel from "../components/EntityListPanel";
import EntityTypeTabs from "../components/EntityTypeTabs";
import { ENTITY_LABELS } from "../constants";

function VisualizeModelPage({ workspace, onBack, onOpenModel, onSelectEntity, onRefresh, statusMessage, errorMessage }) {
  const [activeType, setActiveType] = useState("PERSON");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [search, setSearch] = useState("");

  const activeEntities = workspace.sections[activeType] || [];

  const filteredEntities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return activeEntities;
    }

    return activeEntities.filter((item) => {
      const text = `${item.id} ${item.title} ${item.subtitle}`.toLowerCase();
      return text.includes(query);
    });
  }, [activeEntities, search]);

  const selectedEntity = filteredEntities.find((item) => item.id === selectedEntityId) || null;

  return (
    <section className="visualize-page card-surface">
      <p className="eyebrow">Visualize HASM Model</p>
      <h2>Model Graph Workspace (Entity Selection)</h2>
      <p>
        EXPERIENCE is handled as branch-like structure, FACT as commit-like records, and LINK/PERSON as
        relationship entities. Select one record and open its detail page.
      </p>

      <div className="meta-row">
        <span>Model Root: {workspace.modelRoot || "Not opened"}</span>
      </div>

      <EntityTypeTabs activeType={activeType} counts={workspace.counts} onSelect={setActiveType} />

      <input
        className="search-input"
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder={`Filter ${ENTITY_LABELS[activeType]} entities`}
      />

      <EntityListPanel
        entities={filteredEntities}
        selectedId={selectedEntityId}
        onSelect={setSelectedEntityId}
      />

      <div className="toolbar">
        <div className="button-cluster">
          <button type="button" onClick={onBack}>
            Back
          </button>
          <button type="button" onClick={onOpenModel}>
            Open Another Model
          </button>
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!selectedEntity}
            onClick={() => {
              if (selectedEntity) {
                onSelectEntity(activeType, selectedEntity.id);
              }
            }}
          >
            Select {ENTITY_LABELS[activeType]}
          </button>
        </div>

        <div className="status-row">
          {statusMessage ? <span className="status-pill">{statusMessage}</span> : null}
          {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
        </div>
      </div>
    </section>
  );
}

export default VisualizeModelPage;