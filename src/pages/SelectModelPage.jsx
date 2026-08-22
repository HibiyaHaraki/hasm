import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { validateHasmFolderPath, withTimeout } from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const logger = createLogger("select-model");

function SelectModelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [inputPath, setInputPath] = useState("");
  const [validation, setValidation] = useState({ status: "idle", message: location.state?.validationError || "" });
  const submittingRef = useRef(false);

  useEffect(() => {
    const path = inputPath.trim();
    if (!path) {
      setValidation({ status: "idle", message: "" });
      return undefined;
    }

    let active = true;
    const debounceId = window.setTimeout(async () => {
      setValidation({ status: "checking", message: "Checking workspace path..." });
      try {
        await withTimeout(validateHasmFolderPath(path), 2000, "Path verification timed out.");
        if (active) setValidation({ status: "valid", message: "" });
      } catch (error) {
        if (active) {
          const message = error?.message === "Path verification timed out." ? error.message : "Invalid HASM workspace folder.";
          setValidation({ status: "invalid", message });
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(debounceId);
    };
  }, [inputPath]);

  function submit(event) {
    event.preventDefault();
    if (validation.status !== "valid" || submittingRef.current) return;

    submittingRef.current = true;
    logger.info("[SEQ-MD-01][SELECT] workspace selected manually");
    navigate("/loading-model", { state: { path: inputPath.trim() } });
  }

  return (
    <main className="selection-layout">
      <section className="selection-panel">
        <p className="sequence-label">HASM WORKSPACE</p>
        <h1>Open a workspace</h1>
        <p className="selection-copy">Enter the folder containing the HASM workspace you want to load.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="workspace-path">Workspace folder</label>
          <div className="path-control">
            <input id="workspace-path" value={inputPath} onChange={(event) => setInputPath(event.target.value)} placeholder="C:\\HASM\\MyLife" autoComplete="off" />
            <button type="submit" disabled={validation.status !== "valid" || submittingRef.current}>Open</button>
          </div>
          <p className="validation-message" role="status" data-status={validation.status}>{validation.message}</p>
        </form>
      </section>
    </main>
  );
}

export default SelectModelPage;