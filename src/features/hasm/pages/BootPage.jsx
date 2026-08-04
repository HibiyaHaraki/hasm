// ###################################################
// File Name : BootPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Initial boot screen for HASM workspace
// Description : Provides model-open and flow-entry actions.
// ###################################################

function BootPage({ modelLoaded, modelRoot, totalCount, onContinue, onOpenModel, onViewDraft }) {
  return (
    <section className="boot-page card-surface">
      <p className="eyebrow">Boot HASM</p>
      <h1>HASM Model Workspace</h1>
      <p>
        This app follows your flowchart: boot, decide model selection, open model, then visualize and
        edit details for PERSON, EXPERIENCE, FACT, and LINK.
      </p>

      <div className="meta-row">
        <span>Model Selected: {modelLoaded ? "Yes" : "No"}</span>
        {modelLoaded ? <span>Root: {modelRoot}</span> : null}
        <span>Total Entities: {totalCount}</span>
      </div>

      <div className="button-cluster">
        <button type="button" className="primary-button" onClick={onContinue}>
          Continue Boot Flow
        </button>
        <button type="button" onClick={onOpenModel}>
          Open HASM Model
        </button>
        <button type="button" onClick={onViewDraft}>
          Temporal Draft Page
        </button>
      </div>
    </section>
  );
}

export default BootPage;