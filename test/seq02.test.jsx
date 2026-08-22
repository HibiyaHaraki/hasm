import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoadingModelPage from "../src/pages/LoadingModelPage";
import App from "../src/App";
import * as api from "../src/features/hasm/api";

vi.mock("../src/features/hasm/api", () => ({
  checkWorkspaceLock: vi.fn(),
  loadHasmModelDb: vi.fn(),
  releaseWorkspaceLock: vi.fn(),
  subscribeToTauriEvent: vi.fn(),
  verifyHasmStorage: vi.fn(),
  validateAppVersion: vi.fn(),
  validateHasmFolderPath: vi.fn(),
  validateHasmMarkdownApp: vi.fn(),
  withTimeout: (promise) => promise,
}));

const fixtureModel = {
  people: [{ personId: "11111111-1111-1111-1111-111111111111" }],
  experiences: [{ experienceId: "22222222-2222-2222-2222-222222222222" }],
  facts: [{ factId: "33333333-3333-3333-3333-333333333333" }],
  links: [{ linkId: "44444444-4444-4444-4444-444444444444" }],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderLoading(path = "C:/fixture.hasm") {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/loading-model", state: { path } }]}>
      <Routes>
        <Route path="/loading-model" element={<LoadingModelPage />} />
        <Route path="/visualizer" element={<LocationProbe />} />
        <Route path="/error-model" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("SEQ-02 model loading and storage verification", () => {
  it("TC-02-REACT-001 and TC-02-REACT-005 load a populated workspace after subscribing to progress", async () => {
    const progressHandlers = [];
    api.subscribeToTauriEvent.mockImplementation((_name, handler) => {
      progressHandlers.push(handler);
      return Promise.resolve(() => {});
    });
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: true });
    api.loadHasmModelDb.mockResolvedValue(fixtureModel);
    api.verifyHasmStorage.mockResolvedValue({ missingEntities: [], unreferencedEntities: [] });

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
    expect(api.subscribeToTauriEvent).toHaveBeenCalledWith("model-load-progress", expect.any(Function));
    expect(api.subscribeToTauriEvent).toHaveBeenCalledWith("model-verify-progress", expect.any(Function));
    expect(api.checkWorkspaceLock).toHaveBeenCalledWith("C:/fixture.hasm");
    expect(api.loadHasmModelDb).toHaveBeenCalledWith("C:/fixture.hasm");
    expect(api.verifyHasmStorage).toHaveBeenCalledWith("C:/fixture.hasm", fixtureModel);
    expect(progressHandlers).toHaveLength(2);
  });

  it("TC-02-REACT-003 routes a lock failure to the model error page", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockRejectedValue(new Error("Lock check timed out"));

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/error-model");
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
  });

  it("TC-02-REACT-001 displays stale-lock recovery while the populated model loads", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: true });
    api.loadHasmModelDb.mockReturnValue(new Promise(() => {}));

    renderLoading();

    expect(await screen.findByText("Recovered stale lock file from previous process crash.")).toBeInTheDocument();
  });

  it("TC-02-E2E-004 displays read-only mode for an active workspace lock", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: true, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise(() => {}));

    renderLoading();

    expect(await screen.findByText("Opened in Read-Only Mode")).toBeInTheDocument();
  });

  it("TC-02-E2E-005 routes missing populated workspace storage to the model error page", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockResolvedValue(fixtureModel);
    api.verifyHasmStorage.mockRejectedValue(new Error("ERR_MISSING_STORAGE_FOLDER: FACT/fixture/main.md"));

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/error-model");
  });

  it("TC-02-REACT-004 routes a stalled database load to the model error page", async () => {
    vi.useFakeTimers();
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise(() => {}));

    renderLoading();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.loadHasmModelDb).toHaveBeenCalledWith("C:/fixture.hasm");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("location")).toHaveTextContent("/error-model");
  });

  it("TC-02-REACT-005 renders progress emitted while a populated model is loading", async () => {
    let loadProgressHandler;
    api.subscribeToTauriEvent.mockImplementation((eventName, handler) => {
      if (eventName === "model-load-progress") loadProgressHandler = handler;
      return Promise.resolve(() => {});
    });
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise(() => {}));

    renderLoading();
    await vi.waitFor(() => expect(loadProgressHandler).toBeTypeOf("function"));
    loadProgressHandler({ payload: { step: "DB_LOAD", current: 2, total: 4, percentage: 50, message: "Loaded fixture metadata" } });

    expect(await screen.findByText("Loaded fixture metadata")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
  });

  it("TC-02-REACT-002 releases a writable workspace lock on the close event", async () => {
    let closeHandler;
    api.subscribeToTauriEvent.mockImplementation((eventName, handler) => {
      if (eventName === "tauri://close-requested") closeHandler = handler;
      return Promise.resolve(() => {});
    });
    api.validateHasmMarkdownApp.mockResolvedValue();
    api.validateAppVersion.mockResolvedValue({ isModelSelected: false, path: null });
    api.releaseWorkspaceLock.mockResolvedValue();
    window.history.pushState({}, "", "/select");

    render(<App />);
    await vi.waitFor(() => expect(closeHandler).toBeTypeOf("function"));
    window.sessionStorage.setItem("hasm-active-workspace", "C:/fixture.hasm");
    window.sessionStorage.setItem("hasm-workspace-read-only", "false");
    await closeHandler();

    expect(api.releaseWorkspaceLock).toHaveBeenCalledWith("C:/fixture.hasm");
  });
});