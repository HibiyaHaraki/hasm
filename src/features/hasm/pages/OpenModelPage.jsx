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

function OpenModelPage({ initialPath, statusMessage, errorMessage, onBack, onOpenSuccess, onOpenFailure }) {
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

  // Step 4. Render path input, status messages, and flow navigation controls.
  return (
    <section className="open-page card-surface">
      <p className="eyebrow">Open HASM Model</p>
      <h2>Select HASM Model</h2>
      <p>Input a folder path such as D:/models/my.hasm and open it.</p>

      <div className="path-row">
        <input value={path} onChange={(event) => setPath(event.currentTarget.value)} placeholder="D:/models/my.hasm" />
        <button type="button" className="primary-button" onClick={handleOpen} disabled={opening}>
          {opening ? "Opening..." : "Open"}
        </button>
      </div>

      <div className="status-row">
        {statusMessage ? <span className="status-pill">{statusMessage}</span> : null}
        {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
      </div>

      <button type="button" onClick={onBack}>
        Back
      </button>
    </section>
  );
}

export default OpenModelPage;