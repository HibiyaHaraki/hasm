// ###################################################
// File Name : ExperienceDetailPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Experience detail editor page
// Description : Loads, edits, and saves EXPERIENCE records.
// ###################################################

import EntityField from "../../components/EntityField";
import useEntityDetailForm from "../../hooks/useEntityDetailForm";
import { errorLog, infoLog } from "../../../../hasm_logger/src/react/logger.js";

function ExperienceDetailPage({ modelRoot, entityId, onBack, onSaveSuccess, onSaveFailure }) {
  const { definition, detail, draft, loading, saving, updateDraft, saveDraft } = useEntityDetailForm({
    entityType: "EXPERIENCE",
    modelRoot,
    entityId,
    onError: onSaveFailure,
  });

  async function handleSave() {
    try {
      const message = await saveDraft();
      infoLog("Saved EXPERIENCE detail", entityId);
      await onSaveSuccess(message || "Saved EXPERIENCE");
    } catch (error) {
      // Keep detailed save failure trace for EXPERIENCE updates.
      errorLog("Failed to save EXPERIENCE detail", entityId, error);
      onSaveFailure(String(error));
    }
  }

  return (
    <section className="detail-page card-surface">
      <p className="eyebrow">Experience Detail</p>
      <h2>EXPERIENCE: {entityId}</h2>
      <p className="muted">Edit EXPERIENCE branch-like data and save EXPERIENCE information.</p>

      {loading ? <p>Loading EXPERIENCE detail...</p> : null}

      {draft ? (
        <div className="detail-layout">
          <section className="card">
            <h3>Edit EXPERIENCE Information (Database)</h3>
            <div className="field-grid">
              {definition.fieldSet.map((field) => (
                <EntityField key={field.key} field={field} value={draft[field.key]} onChange={updateDraft} />
              ))}
            </div>
          </section>

          <section className="card markdown-panel">
            <label>
              <span>EXPERIENCE HASM Markdown</span>
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
        <div className="empty-state">No EXPERIENCE detail loaded.</div>
      )}

      <div className="toolbar">
        <div className="button-cluster">
          <button type="button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={!draft || saving}>
            {saving ? "Saving..." : "Save EXPERIENCE Information"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ExperienceDetailPage;