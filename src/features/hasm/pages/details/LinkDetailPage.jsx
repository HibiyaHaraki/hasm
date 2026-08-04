// ###################################################
// File Name : LinkDetailPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Link detail editor page
// Description : Loads, edits, and saves LINK records.
// ###################################################

import EntityField from "../../components/EntityField";
import useEntityDetailForm from "../../hooks/useEntityDetailForm";

function LinkDetailPage({ modelRoot, entityId, onBack, onSaveSuccess, onSaveFailure }) {
  const { definition, detail, draft, loading, saving, updateDraft, saveDraft } = useEntityDetailForm({
    entityType: "LINK",
    modelRoot,
    entityId,
    onError: onSaveFailure,
  });

  async function handleSave() {
    try {
      const message = await saveDraft();
      await onSaveSuccess(message || "Saved LINK");
    } catch (error) {
      onSaveFailure(String(error));
    }
  }

  return (
    <section className="detail-page card-surface">
      <p className="eyebrow">Link Detail</p>
      <h2>LINK: {entityId}</h2>
      <p className="muted">Edit LINK relationship data and save LINK information.</p>

      {loading ? <p>Loading LINK detail...</p> : null}

      {draft ? (
        <div className="detail-layout">
          <section className="card">
            <h3>Edit LINK Information (Database)</h3>
            <div className="field-grid">
              {definition.fieldSet.map((field) => (
                <EntityField key={field.key} field={field} value={draft[field.key]} onChange={updateDraft} />
              ))}
            </div>
          </section>

          <section className="card markdown-panel">
            <label>
              <span>LINK HASM Markdown</span>
              <textarea
                className="markdown-editor"
                value={draft.markdown || ""}
                onChange={(event) => updateDraft("markdown", event.currentTarget.value)}
              />
            </label>
            {detail?.markdownPath ? <p className="muted">Path: {detail.markdownPath}</p> : null}
          </section>
        </div>
      ) : (
        <div className="empty-state">No LINK detail loaded.</div>
      )}

      <div className="toolbar">
        <div className="button-cluster">
          <button type="button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={!draft || saving}>
            {saving ? "Saving..." : "Save LINK Information"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default LinkDetailPage;