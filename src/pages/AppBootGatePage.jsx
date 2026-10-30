import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  completeAppLaunch,
  validateAppVersion,
  validateHasmFolderPath,
  validateHasmMarkdownApp,
  withTimeout,
} from "../features/hasm/api";
import { createLogger } from "../hasm_logger/src/react/logger.js";
import { Container } from "react-bootstrap";
import "./PanelCard.css";

const logger = createLogger("app-boot");

function messageFrom(error) {
  return error?.message || "Application validation failed.";
}

// [SEQ-MD-01][SPLASH] Every terminal boot outcome hands off from the splash window.
// Failures are logged only: Rust's fallback timer still reveals the main window.
function reportLaunchComplete(outcome) {
  Promise.resolve()
    .then(() => completeAppLaunch(outcome))
    .then(() => logger.info(`[SEQ-MD-01][SPLASH] launch completion reported; outcome=${outcome}`))
    .catch((error) => logger.warn("[SEQ-MD-01][SPLASH] launch completion report failed", error));
}

function AppBootGatePage() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState(0);
  useEffect(() => {
    let active = true;

    function finish(outcome, path, options) {
      reportLaunchComplete(outcome);
      navigate(path, options);
    }

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
              finish("loading-model", "/loading-model", { replace: true, state: { path: launch.path } });
            }
            return;
          } catch (error) {
            if (active) {
              logger.warn("[SEQ-MD-01][BOOT] CLI workspace rejected", error);
              finish("select-invalid-path", "/select", { replace: true, state: { validationError: "Specified HASM path does not exist." } });
            }
            return;
          }
        }

        if (active) {
          setLoadState(3);
          finish("select", "/select", { replace: true });
        }
      } catch (error) {
        if (active) {
          logger.error("[SEQ-MD-01][BOOT] app validation failed", error);
          finish("error-app", "/error-app", { replace: true, state: { error: messageFrom(error) } });
        }
      }
    }

    boot();
    return () => { active = false; };
  }, [navigate]);

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center" aria-busy="true">
      <section className="panel-card" aria-live="polite">
        <h1>Preparing workspace</h1>
        <p>Validating the HASM Markdown application and workspace launch context.</p>
        <ol className="validation-steps">
          <li data-active={loadState === 0}>HASM Markdown application</li>
          <li data-active={loadState === 1}>Application version and launch path</li>
          <li data-active={loadState >= 2}>Workspace path</li>
        </ol>
      </section>
    </Container>
  );
}

export default AppBootGatePage;