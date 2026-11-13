import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoadingModelPage from "../src/pages/LoadingModelPage";
import App from "../src/App";
import * as api from "../src/features/hasm/api";
import { getThemeVariables } from "../src/hasm_color_pattern/src/index.js";

vi.mock("../src/features/hasm/api", () => ({
  browseWorkspaceDirectory: vi.fn(),
  checkWorkspaceLock: vi.fn(),
  createHasmWorkspace: vi.fn(),
  createPerson: vi.fn(),
  createExperience: vi.fn(),
  createFact: vi.fn(),
  createLink: vi.fn(),
  loadHasmModelDb: vi.fn(),
  pickWorkspaceDirectory: vi.fn(),
  releaseWorkspaceLock: vi.fn(),
  switchWorkspaceCleanly: vi.fn(),
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
  return <>
    <output data-testid="location">{location.pathname}</output>
    <output data-testid="route-state">{JSON.stringify(location.state)}</output>
  </>;
}

function renderLoading(path = "C:/fixture.hasm") {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/loading-model", state: { path } }]}>
      <Routes>
        <Route path="/loading-model" element={<LoadingModelPage />} />
        <Route path="/visualizer" element={<LocationProbe />} />
        <Route path="/initialize-model" element={<LocationProbe />} />
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
  it("TC-02-REACT-PROGRESS-001 defaults to a stepper and expands all loading bars without restarting", async () => {
    let connect;
    let unlock;
    let loaded;
    let verified;
    const handlers = {};
    const subscriptions = new Promise((resolve) => { connect = resolve; });
    api.subscribeToTauriEvent.mockImplementation((name, handler) => {
      handlers[name] = handler;
      return subscriptions;
    });
    api.checkWorkspaceLock.mockReturnValue(new Promise((resolve) => { unlock = resolve; }));
    api.loadHasmModelDb.mockReturnValue(new Promise((resolve) => { loaded = resolve; }));
    api.verifyHasmStorage.mockReturnValue(new Promise((resolve) => { verified = resolve; }));
    renderLoading();

    const bar = (name) => screen.getByRole("progressbar", { name });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Workspace loading steps" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to visualization" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(screen.getAllByRole("progressbar")).toHaveLength(9);
    expect(bar("Prepare progress listeners")).toHaveAttribute("aria-valuetext", "In progress, 0%");
    expect(bar("Check workspace lock")).toHaveAttribute("aria-valuetext", "Waiting, 0%");
    expect(api.checkWorkspaceLock).not.toHaveBeenCalled();

    await act(async () => connect(() => {}));
    expect(bar("Prepare progress listeners")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(bar("Check workspace lock")).toHaveAttribute("aria-valuetext", "In progress, 0%");
    await act(async () => unlock({ isReadOnly: false, isStaleRecovered: false }));
    expect(bar("Check workspace lock")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuetext", "In progress, 0%");
    expect(bar("Verify workspace storage")).toHaveAttribute("aria-valuetext", "Waiting, 0%");

    await act(async () => {
      for (const percentage of [NaN, -1, 101]) {
        handlers["model-load-progress"]({ payload: { percentage, message: "Invalid progress" } });
      }
      handlers["model-verify-progress"]({ payload: { percentage: 80, message: "Premature verification event" } });
    });
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuenow", "0");
    expect(bar("Verify workspace storage")).toHaveAttribute("aria-valuetext", "Waiting, 0%");
    expect(screen.queryByText("Invalid progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Premature verification event")).not.toBeInTheDocument();
    await act(async () => handlers["model-load-progress"]({
      payload: { percentage: 50, current: 2, total: 4, message: "Loading FACT records" },
    }));
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Loading FACT records (2 / 4)")).toBeInTheDocument();
    await act(async () => handlers["model-load-progress"]({
      payload: { percentage: 100, current: 4, total: 4, message: "Metadata ready" },
    }));
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuetext", "In progress, 100%");
    expect(api.verifyHasmStorage).not.toHaveBeenCalled();

    await act(async () => loaded(fixtureModel));
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(bar("Verify workspace storage")).toHaveAttribute("aria-valuetext", "In progress, 0%");
    await act(async () => {
      handlers["model-load-progress"]({ payload: { percentage: 10, message: "Late database event" } });
      handlers["model-verify-progress"]({
        payload: { percentage: 75, current: 3, total: 4, message: "Verifying workspace storage" },
      });
    });
    expect(screen.queryByText("Late database event")).not.toBeInTheDocument();
    expect(bar("Load database metadata")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(bar("Verify workspace storage")).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getAllByRole("progressbar")).toHaveLength(9);
    await act(async () => verified({ missingEntities: [], unreferencedEntities: [] }));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace ready" })).toBeInTheDocument();
    for (const entity of ["PERSON", "EXPERIENCE", "FACT", "LINK"]) {
      expect(bar(`Load ${entity} entities`)).toHaveAttribute("aria-valuetext", "Complete, 100%");
    }
    fireEvent.click(screen.getByRole("button", { name: "Hide detail" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(bar("Verify workspace storage")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/visualizer");
  });

  it("TC-02-REACT-PROGRESS-002 late database events cannot extend the storage watchdog", async () => {
    vi.useFakeTimers();
    const handlers = {};
    api.subscribeToTauriEvent.mockImplementation(async (name, handler) => {
      handlers[name] = handler;
      return () => {};
    });
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockResolvedValue(fixtureModel);
    api.verifyHasmStorage.mockReturnValue(new Promise(() => {}));
    renderLoading();
    await act(async () => { for (let index = 0; index < 15; index += 1) await Promise.resolve(); });
    expect(api.verifyHasmStorage).toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    await act(async () => handlers["model-load-progress"]({ payload: { percentage: 50, message: "Late progress" } }));
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(screen.getByTestId("location")).toHaveTextContent("/error-model");
  });

  it("TC-02-REACT-PROGRESS-003 tracks each entity type independently while details are collapsed", async () => {
    const handlers = {};
    let loaded;
    api.subscribeToTauriEvent.mockImplementation(async (name, handler) => {
      handlers[name] = handler;
      return () => {};
    });
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise((resolve) => { loaded = resolve; }));
    api.verifyHasmStorage.mockReturnValue(new Promise(() => {}));
    renderLoading();
    await vi.waitFor(() => expect(api.loadHasmModelDb).toHaveBeenCalled());
    const emit = async (step, current, total, percentage) => act(async () => handlers["model-load-progress"]({
      payload: { step, current, total, percentage, message: step },
    }));
    await emit("DB_SYNC", 1, 1, 100);
    await emit("DB_LOAD_PERSON", 1, 2, 50);
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    const bar = (type) => screen.getByRole("progressbar", { name: `Load ${type} entities` });
    expect(bar("PERSON")).toHaveAttribute("aria-valuenow", "50");
    expect(bar("EXPERIENCE")).toHaveAttribute("aria-valuenow", "0");
    fireEvent.click(screen.getByRole("button", { name: "Hide detail" }));
    await emit("DB_LOAD_PERSON", 2, 2, 100);
    await emit("DB_LOAD_EXPERIENCE", 0, 0, 100);
    await emit("DB_LOAD_FACT", 1, 4, 25);
    await emit("DB_LOAD_PERSON", 1, 2, 50);
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(bar("PERSON")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(bar("EXPERIENCE")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(screen.getByText("DB_LOAD_EXPERIENCE (0 / 0)")).toBeInTheDocument();
    expect(bar("FACT")).toHaveAttribute("aria-valuenow", "25");
    expect(bar("LINK")).toHaveAttribute("aria-valuetext", "Waiting, 0%");
    await emit("DB_LOAD_FACT", 4, 4, 100);
    await emit("DB_LOAD_LINK", 0, 0, 100);
    await act(async () => loaded(fixtureModel));
    expect(bar("LINK")).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Go to visualization" })).not.toBeInTheDocument();
  });

  it("TC-02-REACT-CONTINUE-001 waits for user confirmation and forwards verified read-only and warning context", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: true, isStaleRecovered: false });
    api.loadHasmModelDb.mockResolvedValue(fixtureModel);
    api.verifyHasmStorage.mockResolvedValue({ missingEntities: [], unreferencedEntities: ["PERSON/extra/main.md"] });
    renderLoading();
    const proceed = await screen.findByRole("button", { name: "Go to visualization" });
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(screen.getByText("Opened in Read-Only Mode")).toBeInTheDocument();
    fireEvent.click(proceed);
    expect(screen.getByTestId("location")).toHaveTextContent("/visualizer");
    expect(JSON.parse(screen.getByTestId("route-state").textContent)).toEqual({
      path: "C:/fixture.hasm", model: fixtureModel, isVerified: true, isReadOnly: true,
      warnings: ["PERSON/extra/main.md"],
    });
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
    expect(api.verifyHasmStorage).toHaveBeenCalledTimes(1);
  });

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

    fireEvent.click(await screen.findByRole("button", { name: "Go to visualization" }));
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

  it("TC-02-REACT-006 shows no stale-recovery or read-only notice when the lock is clean", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise(() => {}));

    renderLoading();

    await vi.waitFor(() => expect(api.loadHasmModelDb).toHaveBeenCalled());
    expect(screen.queryByText("Recovered stale lock file from previous process crash.")).not.toBeInTheDocument();
    expect(screen.queryByText("Opened in Read-Only Mode")).not.toBeInTheDocument();
  });

  it("TC-02-REACT-007 keeps a read-only workspace lock untouched on the close event", async () => {
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
    window.sessionStorage.setItem("hasm-workspace-read-only", "true");
    await closeHandler();

    expect(api.releaseWorkspaceLock).not.toHaveBeenCalled();
  });

  it("TC-02-REACT-008 routes a corrupted database load failure to the model error page", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockRejectedValue(new Error("ERR_DB_CORRUPTED: file is not a database"));

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/error-model");
    expect(JSON.parse(screen.getByTestId("route-state").textContent)).toEqual({
      error: "ERR_DB_CORRUPTED: file is not a database",
    });
    expect(api.verifyHasmStorage).not.toHaveBeenCalled();
  });

  it("TC-02-REACT-009 keeps loading alive while events reset the load and verify watchdogs", async () => {
    vi.useFakeTimers();
    const handlers = {};
    let loaded;
    let verified;
    api.subscribeToTauriEvent.mockImplementation(async (name, handler) => {
      handlers[name] = handler;
      return () => {};
    });
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise((resolve) => { loaded = resolve; }));
    api.verifyHasmStorage.mockReturnValue(new Promise((resolve) => { verified = resolve; }));
    renderLoading();
    await act(async () => { for (let index = 0; index < 15; index += 1) await Promise.resolve(); });
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);

    // REQ-02-FUNC-203/204/205: each valid event restarts the 10,000ms database watchdog.
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    await act(async () => handlers["model-load-progress"]({
      payload: { step: "DB_LOAD_PERSON", current: 1, total: 2, percentage: 50, message: "Loading PERSON records" },
    }));
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();

    await act(async () => loaded(fixtureModel));
    await act(async () => { for (let index = 0; index < 15; index += 1) await Promise.resolve(); });
    expect(api.verifyHasmStorage).toHaveBeenCalledTimes(1);

    // REQ-02-FUNC-302: the storage verification stage owns the same watchdog protection.
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    await act(async () => handlers["model-verify-progress"]({
      payload: { percentage: 40, message: "Verifying workspace storage" },
    }));
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();

    await act(async () => verified({ missingEntities: [], unreferencedEntities: [] }));
    expect(screen.getByRole("heading", { name: "Workspace ready" })).toBeInTheDocument();
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
  });

  it("TC-02-REACT-010 keeps the error route terminal after a load watchdog expiry", async () => {
    vi.useFakeTimers();
    let loaded;
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockReturnValue(new Promise((resolve) => { loaded = resolve; }));
    renderLoading();
    await act(async () => { for (let index = 0; index < 15; index += 1) await Promise.resolve(); });
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByTestId("location")).toHaveTextContent("/error-model");
    expect(JSON.parse(screen.getByTestId("route-state").textContent)).toEqual({ error: "DB loading stalled" });

    // REQ-02-RULE-011/014: the abandoned attempt must not start new IPC or leave the error page.
    await act(async () => loaded(fixtureModel));
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(screen.getByTestId("location")).toHaveTextContent("/error-model");
    expect(screen.queryByRole("button", { name: "Go to visualization" })).not.toBeInTheDocument();
    expect(api.verifyHasmStorage).not.toHaveBeenCalled();
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
  });

  it("TC-02-REACT-011 subscribes before any IPC and disposes listeners on unmount, including late subscriptions", async () => {
    const unlistens = [];
    let resolveSecond;
    api.subscribeToTauriEvent.mockImplementation((name) => {
      const unlisten = vi.fn();
      unlistens.push(unlisten);
      if (name === "model-load-progress") return Promise.resolve(unlisten);
      return new Promise((resolve) => { resolveSecond = () => resolve(unlisten); });
    });
    api.checkWorkspaceLock.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderLoading();
    await vi.waitFor(() => expect(api.subscribeToTauriEvent).toHaveBeenCalledTimes(2));
    // REQ-02-FUNC-201: no lock or load command may run before both listeners resolve.
    expect(api.checkWorkspaceLock).not.toHaveBeenCalled();
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();

    unmount();
    await act(async () => resolveSecond());
    expect(unlistens[0]).toHaveBeenCalled();
    expect(unlistens[1]).toHaveBeenCalled();
    expect(api.checkWorkspaceLock).not.toHaveBeenCalled();
  });

  it("TC-02-REACT-012 routes a failed progress listener subscription to the model error page", async () => {
    api.subscribeToTauriEvent.mockRejectedValue(new Error("Event bridge unavailable"));

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/error-model");
    expect(api.checkWorkspaceLock).not.toHaveBeenCalled();
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

  it("TC-08-E2E-INIT-001 routes an empty new model to initialization before visualizer", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockResolvedValue({ people: [], experiences: [], facts: [], links: [] });
    api.verifyHasmStorage.mockResolvedValue({ missingEntities: [], unreferencedEntities: [] });

    renderLoading();

    expect(await screen.findByTestId("location")).toHaveTextContent("/initialize-model");
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
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    await vi.waitFor(() => expect(api.loadHasmModelDb).toHaveBeenCalled());
    await act(async () => loadProgressHandler({ payload: { step: "DB_LOAD", current: 2, total: 4, percentage: 50, message: "Loaded fixture metadata" } }));

    expect(await screen.findByText("Loaded fixture metadata (2 / 4)")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Load database metadata" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("TC-02-REACT-PERF-001 loads metadata-only entities exactly once and forwards them to verification", async () => {
    const metadataOnlyModel = {
      people: [
        {
          personId: "11111111-1111-1111-1111-111111111111",
          markdown: "",
          markdownPath: "C:/fixture.hasm/PERSON/11111111-1111-1111-1111-111111111111/main.md",
        },
      ],
      experiences: [],
      facts: [],
      links: [],
    };
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.checkWorkspaceLock.mockResolvedValue({ isReadOnly: false, isStaleRecovered: false });
    api.loadHasmModelDb.mockResolvedValue(metadataOnlyModel);
    api.verifyHasmStorage.mockResolvedValue({ missingEntities: [], unreferencedEntities: [] });

    renderLoading();

    fireEvent.click(await screen.findByRole("button", { name: "Go to visualization" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer");
    // SEQ-02 must never re-read the package to fill in the Markdown bodies it skipped.
    expect(api.loadHasmModelDb).toHaveBeenCalledTimes(1);
    expect(api.verifyHasmStorage).toHaveBeenCalledWith("C:/fixture.hasm", metadataOnlyModel);
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

  it("TC-02-REACT-THEME-001 applies and updates theme variables on the document root for portals", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    window.localStorage.setItem("hasm-theme-pattern", "classic-light");
    window.history.pushState({}, "", "/select");
    const { unmount } = render(<App />);

    expect(document.documentElement.style.getPropertyValue("--theme-surface")).toBe(getThemeVariables("classic-light")["--theme-surface"]);
    expect(document.documentElement.style.getPropertyValue("--theme-text")).toBe(getThemeVariables("classic-light")["--theme-text"]);
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "classic" } });
    expect(document.documentElement.style.getPropertyValue("--theme-surface")).toBe(getThemeVariables("classic")["--theme-surface"]);
    expect(document.documentElement.style.getPropertyValue("--theme-text")).toBe(getThemeVariables("classic")["--theme-text"]);
    unmount();
    expect(document.documentElement.style.getPropertyValue("--theme-surface")).toBe("");
    window.localStorage.removeItem("hasm-theme-pattern");
  });
});