import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  validateAppVersion,
  validateHasmFolderPath,
  validateHasmMarkdownApp,
  withTimeout,
} from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const logger = createLogger("app-boot");

function messageFrom(error) {
  return error?.message || "Application validation failed.";
}

function AppBootGatePage() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState(0);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        await withTimeout(validateHasmMarkdownApp(), 5000, "IPC call timed out while validating HASM Markdown.");
        if (!active) return;
        setLoadState(1);

        const launch = await withTimeout(validateAppVersion(), 5000, "IPC call timed out while reading application launch information.");
        if (!active) return;
        setLoadState(2);

        if (launch.isModelSelected && launch.path) {
          try {
            await withTimeout(validateHasmFolderPath(launch.path), 3000, "Specified HASM path does not exist.");
            if (active) {
              logger.info("[SEQ-MD-01][BOOT] CLI workspace accepted");
              navigate("/loading-model", { replace: true, state: { path: launch.path } });
            }
            return;
          } catch (error) {
            if (active) {
              logger.warn("[SEQ-MD-01][BOOT] CLI workspace rejected", error);
              navigate("/select", { replace: true, state: { validationError: "Specified HASM path does not exist." } });
            }
            return;
          }
        }

        if (active) {
          setLoadState(3);
          navigate("/select", { replace: true });
        }
      } catch (error) {
        if (active) {
          logger.error("[SEQ-MD-01][BOOT] app validation failed", error);
          navigate("/error-app", { replace: true, state: { error: messageFrom(error) } });
        }
      }
    }

    boot();
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="boot-layout" aria-busy="true">
      <section className="boot-panel" aria-live="polite">
        <p className="sequence-label">HASM / SEQ-01</p>
        <h1>Preparing workspace</h1>
        <p>Validating the HASM Markdown application and workspace launch context.</p>
        <ol className="validation-steps">
          <li data-active={loadState === 0}>HASM Markdown application</li>
          <li data-active={loadState === 1}>Application version and launch path</li>
          <li data-active={loadState >= 2}>Workspace path</li>
        </ol>
      </section>
    </main>
  );
}

export default AppBootGatePage;