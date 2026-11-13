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

// [SEQ-MD-01][REQ-01-RULE-001][REQ-01-RULE-002][REQ-01-RULE-003] Sequential boot gate: Check 1 -> Check 2 -> Check 3/4
// with fatal failures routing to /error-app and path failures falling back to /select.
// [REQ-01-FUNC-002] Reports boot completion once per terminal route via complete_app_launch.
// [REQ-01-FUNC-201][REQ-01-FUNC-203][REQ-01-FUNC-205][REQ-01-FUNC-206] Check 1: HASM Markdown app validation with 5,000ms timeout.
// [REQ-01-FUNC-301][REQ-01-FUNC-308][REQ-01-FUNC-309][REQ-01-FUNC-310] Check 2: app version / CLI launch path inspection.
// [REQ-01-FUNC-401][REQ-01-FUNC-403][REQ-01-FUNC-404][REQ-01-FUNC-405][REQ-01-FUNC-406] Check 3: CLI path existence with 3,000ms timeout and graceful fallback.
// [REQ-01-FUNC-502][REQ-01-FUNC-601][REQ-01-FUNC-602] Routes to /select or /loading-model transferring the verified path in route state.
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