// ###################################################
// File Name : seq06.test.jsx
// Purpose : EVAL-06 error fallback & recovery flow tests (SEQ-MD-06)
// Description :
//   Automated React-level coverage for the error fallback screens
//   (/error-app, /error-model), the retry re-validation cycle through
//   the SEQ-01 boot gate (including CLI --path retention), the model
//   recovery reselect flow, and the Markdown repair/re-verification
//   flows on the entity ticket. Documented in
//   docs/eval/15-EVL-06_Error_Fallback.md.
// ###################################################
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppBootGatePage from "../src/pages/AppBootGatePage";
import ErrorAppPage from "../src/pages/ErrorAppPage";
import ErrorModelPage from "../src/pages/ErrorModelPage";
import SelectModelPage from "../src/pages/SelectModelPage";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";

const api = vi.hoisted(() => ({
  validateHasmMarkdownApp: vi.fn(),
  validateAppVersion: vi.fn(),
  validateHasmFolderPath: vi.fn(),
  completeAppLaunch: vi.fn(() => Promise.resolve()),
  browseWorkspaceDirectory: vi.fn(),
  pickWorkspaceDirectory: vi.fn(),
  createHasmWorkspace: vi.fn(),
  switchWorkspaceCleanly: vi.fn(() => Promise.resolve()),
  subscribeToTauriEvent: vi.fn(() => Promise.resolve(() => {})),
  withTimeout: vi.fn((promise) => promise),
  computeVisualizerLayout: vi.fn(() => Promise.resolve({ nodes3d: [], lines3d: [], warnings: [] })),
  loadEntityDetail: vi.fn(),
  reloadEntityMarkdown: vi.fn(),
  launchExternalMarkdownApp: vi.fn(),
  checkEntityMtime: vi.fn(() => Promise.resolve({ isModified: false, isDeleted: false, currentMtimeMs: 10 })),
  saveEntityDetail: vi.fn(),
  deleteEntity: vi.fn(),
}));
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../src/features/hasm/api", async (importOriginal) => ({ ...await importOriginal(), ...api }));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" data-state-error={location.state?.error ?? ""} data-state-path={location.state?.path ?? ""}>
      {location.pathname}
    </output>
  );
}

// SEQ-MD-06 recovery loop: /error-app Retry re-enters the SEQ-01 boot gate at "/".
function renderErrorApp(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/error-app", state }]}>
      <Routes>
        <Route path="/" element={<AppBootGatePage />} />
        <Route path="/error-app" element={<ErrorAppPage />} />
        <Route path="/select" element={<LocationProbe />} />
        <Route path="/loading-model" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderErrorModel(state, { realSelect = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/error-model", state }]}>
      <Routes>
        <Route path="/error-model" element={<ErrorModelPage />} />
        <Route path="/select" element={realSelect ? <SelectModelPage /> : <LocationProbe />} />
        <Route path="/loading-model" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ticket = { name: "Original", markdownBody: "# Old Heading", loadedMtimeMs: 10, detail: { factName: "Original" } };

function renderTicket(state = { path: "C:/demo", model: {}, isVerified: true }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/entity-detail/FACT/id-1", state }]}>
      <Routes>
        <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} />
        <Route path="/error-markdown" element={<LocationProbe />} />
        <Route path="/error-model" element={<LocationProbe />} />
        <Route path="/loading-model" element={<LocationProbe />} />
        <Route element={<ProtectedRoute requireVerified={true} />}>
          <Route path="/visualizer" element={<LocationProbe />} />
        </Route>
        <Route path="/select" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe("SEQ-06 app error fallback and retry re-validation (/error-app)", () => {
  it("TC-06-REACT-008 renders the preserved app error context from router state", () => {
    renderErrorApp({ error: "ERR_MARKDOWN_APP_INVALID: The HASM Markdown application is unavailable" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Application validation failed" })).toBeInTheDocument();
    expect(screen.getByText("ERR_MARKDOWN_APP_INVALID: The HASM Markdown application is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("TC-06-REACT-009 falls back to a defined default message when the error context payload is missing", () => {
    renderErrorApp(undefined);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("The HASM application could not complete startup validation.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("TC-06-REACT-010 retry re-invokes app validation and navigates to /select on success", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: false, path: null });
    renderErrorApp({ error: "Initial startup failure" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    expect(api.validateHasmMarkdownApp).toHaveBeenCalledTimes(1);
    expect(api.validateAppVersion).toHaveBeenCalledTimes(1);
  });

  it("TC-06-REACT-011 retry retains the CLI workspace path and reboots into /loading-model", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/retained.hasm" });
    api.validateHasmFolderPath.mockResolvedValue();
    renderErrorApp({ error: "Initial startup failure" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const probe = await screen.findByTestId("location");
    expect(probe).toHaveTextContent("/loading-model");
    expect(probe).toHaveAttribute("data-state-path", "C:/retained.hasm");
    expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:/retained.hasm");
  });

  it("TC-06-REACT-012 an invalid retained workspace path is not reused blindly and falls back to /select", async () => {
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: true, path: "C:/vanished.hasm" });
    api.validateHasmFolderPath.mockRejectedValue(new Error("Specified HASM path does not exist"));
    renderErrorApp({ error: "Initial startup failure" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const probe = await screen.findByTestId("location");
    expect(probe).toHaveTextContent("/select");
    expect(probe).toHaveAttribute("data-state-path", "");
  });

  it("TC-06-REACT-013 a failed retry updates the error display with the new failure cause", async () => {
    api.validateHasmMarkdownApp.mockRejectedValue(new Error("Markdown app still missing"));
    renderErrorApp({ error: "Initial startup failure" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Markdown app still missing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Application validation failed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("TC-06-REACT-014 repeated retry failures never reach /select and keep the error screen operable", async () => {
    api.validateHasmMarkdownApp.mockRejectedValue(new Error("Markdown app still missing"));
    renderErrorApp({ error: "Initial startup failure" });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(api.validateHasmMarkdownApp).toHaveBeenCalledTimes(attempt));
      expect(await screen.findByText("Markdown app still missing")).toBeInTheDocument();
    }
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("SEQ-06 model error fallback and reselect recovery (/error-model)", () => {
  it("TC-06-REACT-015 renders the preserved workspace failure cause from router state", () => {
    renderErrorModel({ error: "ERR_MISSING_STORAGE_FOLDER: FACT/33333333-3333-3333-3333-333333333331/main.md" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace could not load" })).toBeInTheDocument();
    expect(screen.getByText("ERR_MISSING_STORAGE_FOLDER: FACT/33333333-3333-3333-3333-333333333331/main.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose workspace" })).toBeEnabled();
  });

  it("TC-06-REACT-016 missing model error context renders the default message, offers no repair action, and still exits safely", async () => {
    renderErrorModel(undefined);
    expect(screen.getByText("The workspace is unavailable.")).toBeInTheDocument();
    // Without an appended missing-entity context no folder repair action may be offered.
    expect(screen.queryByRole("button", { name: /Create Missing Folders/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose workspace" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
  });

  it("TC-06-REACT-017 reselecting a workspace re-validates the path and retries loading through /loading-model", async () => {
    api.validateHasmFolderPath.mockResolvedValue();
    renderErrorModel({ error: "ERR_MISSING_STORAGE_FOLDER: FACT" }, { realSelect: true });
    fireEvent.click(screen.getByRole("button", { name: "Choose workspace" }));
    fireEvent.change(await screen.findByLabelText("Workspace folder"), { target: { value: "C:/repaired.hasm" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeEnabled());
    expect(api.validateHasmFolderPath).toHaveBeenCalledWith("C:/repaired.hasm");
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });

  it("TC-06-REACT-018 a workspace that fails re-validation blocks the model load retry", async () => {
    api.validateHasmFolderPath.mockRejectedValue(new Error("ERR_TARGET_PATH_NOT_FOUND"));
    renderErrorModel({ error: "ERR_MISSING_STORAGE_FOLDER: FACT" }, { realSelect: true });
    fireEvent.click(screen.getByRole("button", { name: "Choose workspace" }));
    fireEvent.change(await screen.findByLabelText("Workspace folder"), { target: { value: "C:/still-broken.hasm" } });
    expect(await screen.findByText("Invalid HASM workspace folder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });
});

describe("SEQ-06 Markdown error fallback and repair re-verification", () => {
  it("TC-06-REACT-019 a Markdown verification fault routes to /error-markdown carrying the parser error context", async () => {
    api.loadEntityDetail.mockRejectedValue(new Error("ERR_MARKDOWN_VERIFICATION_FAILED: broken front matter near line 3"));
    renderTicket();
    const probe = await screen.findByTestId("location");
    expect(probe).toHaveTextContent("/error-markdown");
    expect(probe).toHaveAttribute("data-state-error", "ERR_MARKDOWN_VERIFICATION_FAILED: broken front matter near line 3");
  });

  it("TC-06-REACT-020 Fix in HASM Markdown App launches the external editor and shows retry guidance", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    api.launchExternalMarkdownApp.mockResolvedValue({});
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Markdown in HASM App" }));
    expect(await screen.findByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")).toBeInTheDocument();
    expect(api.launchExternalMarkdownApp).toHaveBeenCalledWith("C:/demo", "FACT", "id-1");
  });

  it("TC-06-REACT-021 a failed external editor launch shows the failure cause instead of repair guidance", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    api.launchExternalMarkdownApp.mockRejectedValue(new Error("ERR_PROCESS_SPAWN_FAILED: os error 5"));
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Markdown in HASM App" }));
    expect(await screen.findByText("Failed to launch hasm_markdown.exe process.")).toBeInTheDocument();
    expect(screen.queryByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")).not.toBeInTheDocument();
  });

  it("TC-06-REACT-022 a successful re-verification refreshes the ticket and confirms the repair", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    api.reloadEntityMarkdown.mockResolvedValue({ ...ticket, markdownBody: "# Fixed Heading" });
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh Markdown" }));
    expect(await screen.findByText("Markdown refreshed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fixed Heading" })).toBeInTheDocument();
    expect(api.reloadEntityMarkdown).toHaveBeenCalledWith("C:/demo", "FACT", "id-1");
    // The user stays on the operational entity ticket after successful repair.
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("TC-06-REACT-023 a persistent non-fatal refresh failure resets the retry control and reports the cause", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    api.reloadEntityMarkdown.mockRejectedValue(new Error("Workspace storage unavailable"));
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh Markdown" }));
    expect(await screen.findByText("Workspace storage unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Markdown" })).toBeEnabled();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("TC-06-REACT-024 a fatal Markdown refresh fault routes to /error-markdown and never fakes a repaired state", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    api.reloadEntityMarkdown.mockRejectedValue(new Error("ERR_MARKDOWN_FILE_NOT_FOUND: C:/demo/FACT/id-1/main.md"));
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh Markdown" }));
    const probe = await screen.findByTestId("location");
    expect(probe).toHaveTextContent("/error-markdown");
    expect(probe).toHaveAttribute("data-state-error", "ERR_MARKDOWN_FILE_NOT_FOUND: C:/demo/FACT/id-1/main.md");
    expect(screen.queryByText("Markdown refreshed.")).not.toBeInTheDocument();
  });

  it("TC-06-REACT-025 Back to Visualizer returns a verified workspace to /visualizer", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    renderTicket({ path: "C:/demo", model: {}, isVerified: true });
    fireEvent.click(await screen.findByRole("button", { name: "Back to Visualizer" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
  });

  it("TC-06-REACT-026 Back to Visualizer with an unverified workspace is gated through /loading-model re-verification", async () => {
    api.loadEntityDetail.mockResolvedValue(ticket);
    renderTicket({ path: "C:/demo", model: {}, isVerified: false });
    fireEvent.click(await screen.findByRole("button", { name: "Back to Visualizer" }));
    const probe = await screen.findByTestId("location");
    expect(probe).toHaveTextContent("/loading-model");
    expect(probe).toHaveAttribute("data-state-path", "C:/demo");
  });
});
