// ###################################################
// File Name : EntityListPanel.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Entity list panel component
// Description : Displays selectable entity items by current type filter.
// ###################################################

function EntityListPanel({ entities, selectedId, onSelect }) {
  if (entities.length === 0) {
    return <div className="empty-state">No entities found.</div>;
  }

  return (
    <div className="list-stack">
      {entities.map((item) => (
        <button
          key={item.id}
          type="button"
          className={selectedId === item.id ? "list-item active" : "list-item"}
          onClick={() => onSelect(item.id)}
        >
          <strong>{item.title}</strong>
          <span>{item.subtitle || item.id}</span>
        </button>
      ))}
    </div>
  );
}

export default EntityListPanel;