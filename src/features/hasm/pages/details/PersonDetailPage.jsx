// ###################################################
// File Name : PersonDetailPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Person detail editor page
// Description : Loads, edits, and saves PERSON records.
// ###################################################

import EntityField from "../../components/EntityField";
import useEntityDetailForm from "../../hooks/useEntityDetailForm";
import { errorLog, infoLog } from "../../../../hasm_logger/src/react/logger.js";

function PersonDetailPage({ modelRoot, entityId, onBack, onSaveSuccess, onSaveFailure }) {
  const { definition, detail, draft, loading, saving, updateDraft, saveDraft } = useEntityDetailForm({
    entityType: "PERSON",
    modelRoot,
    entityId,
    onError: onSaveFailure,
  });

  async function handleSave() {
    try {
      const message = await saveDraft();
      infoLog("Saved PERSON detail", entityId);
      await onSaveSuccess(message || "Saved PERSON");
    } catch (error) {
      // Keep detailed save failure trace for PERSON updates.
      errorLog("Failed to save PERSON detail", entityId, error);
      onSaveFailure(String(error));
    }
  }

  return (
    <section className="detail-page card-surface">
      <p className="eyebrow">Person Detail</p>
      <h2>PERSON: {entityId}</h2>
      <p className="muted">Edit PERSON account data and linked IDs, then save PERSON information.</p>

      {loading ? <p>Loading PERSON detail...</p> : null}

      {draft ? (
        <div className="detail-layout">
          <section className="card">
            <h3>Edit PERSON Information (Database)</h3>
            <div className="field-grid">
              {definition.fieldSet.map((field) => (
                <EntityField key={field.key} field={field} value={draft[field.key]} onChange={updateDraft} />
              ))}
            </div>
          </section>

          <section className="card markdown-panel">
            <label>
              <span>PERSON HASM Markdown</span>
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
        <div className="empty-state">No PERSON detail loaded.</div>
      )}

      <div className="toolbar">
        <div className="button-cluster">
          <button type="button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={!draft || saving}>
            {saving ? "Saving..." : "Save PERSON Information"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default PersonDetailPage;