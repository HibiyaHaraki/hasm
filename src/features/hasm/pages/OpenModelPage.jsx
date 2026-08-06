// ###################################################
// File Name : OpenModelPage.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Open-model input and execution page
// Description : Accepts model path input and opens HASM model workspace.
// ###################################################

import { useState } from "react";
import { openHasmModel } from "../api";
import { errorLog, infoLog } from "../../../hasm_logger/src/react/logger.js";

function OpenModelPage({
  initialPath,
  statusMessage,
  errorMessage,
  onBack,
  onOpenSuccess,
  onOpenFailure,
  onCreateNew,
}) {
  // Step 1. Initialize open-target path and opening state.
  const [path, setPath] = useState(initialPath || "");
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    // Step 2. Validate path input before invoking backend open command.
    if (!path.trim()) {
      onOpenFailure("Enter a local .hasm directory path.");
      return;
    }

    // Step 3. Try opening the model and emit success/failure callback.
    setOpening(true);
    try {
      const workspace = await openHasmModel(path.trim());
      infoLog("OpenModelPage opened model", path.trim());
      onOpenSuccess(workspace);
    } catch (error) {
      // Log backend open errors before forwarding them to page-level UI state.
      errorLog("OpenModelPage failed to open model", path.trim(), error);
      onOpenFailure(String(error));
    } finally {
      setOpening(false);
    }
  }

  function handleCreateNewClick(event) {
    event.preventDefault();

    if (onCreateNew) {
      onCreateNew();
      return;
    }

    onOpenFailure("Create new HASM flow is not available yet.");
  }

  // Step 4. Render path input, status messages, and flow navigation controls.
  return (
    <section className="open-page open-page-home card-surface">
      <div className="open-home-center">
        <p className="eyebrow">Open HASM Model</p>
        <h2>Select .hasm Folder</h2>
        <p className="open-home-subtitle">Enter a folder path like D:/models/my.hasm</p>

        <form
          className="open-home-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleOpen();
          }}
        >
          <label className="open-home-input-wrap" htmlFor="hasm-model-path">
            <input
              id="hasm-model-path"
              value={path}
              onChange={(event) => setPath(event.currentTarget.value)}
              placeholder="D:/models/my.hasm"
              autoComplete="off"
            />
          </label>

          <button type="submit" className="primary-button open-home-submit" disabled={opening}>
            {opening ? "Opening..." : "Open"}
          </button>
        </form>

        <button type="button" className="open-home-create-link" onClick={handleCreateNewClick}>
          Create new hasm
        </button>

        <div className="status-row open-home-status">
          {statusMessage ? <span className="status-pill">{statusMessage}</span> : null}
          {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
        </div>

        <button type="button" className="open-home-back" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

export default OpenModelPage;