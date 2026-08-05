// ###################################################
// File Name : FactDetailPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Fact detail editor page
// Description : Loads, edits, and saves FACT records.
// ###################################################

import EntityField from "../../components/EntityField";
import useEntityDetailForm from "../../hooks/useEntityDetailForm";
import { errorLog, infoLog } from "../../../../hasm_logger/src/react/logger.js";

function FactDetailPage({ modelRoot, entityId, onBack, onSaveSuccess, onSaveFailure }) {
  const { definition, detail, draft, loading, saving, updateDraft, saveDraft } = useEntityDetailForm({
    entityType: "FACT",
    modelRoot,
    entityId,
    onError: onSaveFailure,
  });

  async function handleSave() {
    try {
      const message = await saveDraft();
      infoLog("Saved FACT detail", entityId);
      await onSaveSuccess(message || "Saved FACT");
    } catch (error) {
      // Keep detailed save failure trace for FACT updates.
      errorLog("Failed to save FACT detail", entityId, error);
      onSaveFailure(String(error));
    }
  }

  return (
    <section className="detail-page card-surface">
      <p className="eyebrow">Fact Detail</p>
      <h2>FACT: {entityId}</h2>
      <p className="muted">Edit FACT commit-like data and save FACT information.</p>

      {loading ? <p>Loading FACT detail...</p> : null}

      {draft ? (
        <div className="detail-layout">
          <section className="card">
            <h3>Edit FACT Information (Database)</h3>
            <div className="field-grid">
              {definition.fieldSet.map((field) => (
                <EntityField key={field.key} field={field} value={draft[field.key]} onChange={updateDraft} />
              ))}
            </div>
          </section>

          <section className="card markdown-panel">
            <label>
              <span>FACT HASM Markdown</span>
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
        <div className="empty-state">No FACT detail loaded.</div>
      )}

      <div className="toolbar">
        <div className="button-cluster">
          <button type="button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={!draft || saving}>
            {saving ? "Saving..." : "Save FACT Information"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default FactDetailPage;