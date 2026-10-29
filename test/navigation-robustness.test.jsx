import { StrictMode } from "react";
import { Button } from "react-bootstrap";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import LoadingModelPage from "../src/pages/LoadingModelPage";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";

const bridge = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: bridge.listen }));
vi.mock("../src/hasm_visualizer/threeCommitGraph.js", async () => ({
  ...await vi.importActual("../src/hasm_visualizer/threeCommitGraph.js"),
  createCommitGraph: vi.fn(() => () => {}),
}));

const path = "C:\\fixture.hasm";
const id = "33333333-3333-3333-3333-333333333333";
const fact = { factId: id, factName: "Publication", occurredAt: "2026-01-15", experienceIds: [], personIds: [], linkIds: [], link: [], markdown: "", markdownPath: "" };
const model = { people: [], experiences: [], facts: [fact], links: [] };
const ticket = { entityType: "FACT", entityId: id, name: fact.factName, markdownBody: "# Publication", loadedMtimeMs: 1, detail: fact };
const geometry = { nodes3d: [{ id, entityType: "FACT", label: "Publication", x: 0, y: 0, z: 0 }], lines3d: [], warnings: [] };
let listeners;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="route">{location.pathname}</output>
    <Button onClick={() => navigate("/visualizer", { state: { path, model, isVerified: true } })}>Visit graph</Button>
    <Button onClick={() => navigate(`/entity-detail/FACT/${id}`, { state: { path, model, isVerified: true } })}>Visit ticket</Button>
  </>;
}

function renderFlow(start = "/visualizer", strict = false) {
  const tree = <MemoryRouter initialEntries={[{ pathname: start, state: { path, model, isVerified: true } }]}>
    <NavigationProbe />
    <Routes>
      <Route element={<ProtectedRoute requireVerified />}>
        <Route path="/visualizer" element={<VisualizerPage />} />
        <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} />
      </Route>
      <Route path="/loading-model" element={<LoadingModelPage />} />
      <Route path="/error-model" element={<h1>Model loading error</h1>} />
      <Route path="/error-markdown" element={<h1>Markdown error</h1>} />
    </Routes>
  </MemoryRouter>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

async function flush() {
  await act(async () => { for (let index = 0; index < 15; index += 1) await Promise.resolve(); });
}

async function emit(name) {
  await act(async () => {
    for (const entry of [...listeners]) {
      if (entry.name === name && !entry.disposed) entry.handler({ payload: { percentage: 100, message: "Finished", step: "DB_LOAD" } });
    }
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners = [];
  bridge.listen.mockImplementation(async (name, handler) => {
    const entry = { name, handler, disposed: false };
    listeners.push(entry);
    return () => { entry.disposed = true; };
  });
  bridge.invoke.mockImplementation(async (command) => {
    switch (command) {
      case "compute_visualizer_layout": return geometry;
      case "load_entity_detail":
      case "reload_entity_markdown": return ticket;
      case "save_fact_detail": return {};
      case "check_workspace_lock": return { isReadOnly: false, isStaleRecovered: false };
      case "load_hasm_model_db": return model;
      case "verify_hasm_storage": return { missingEntities: [], unreferencedEntities: [] };
      default: throw new Error(`Unexpected invoke: ${command}`);
    }
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe("bounded graph-ticket navigation robustness", () => {
  it("TC-NAV-001 ignores progress after layout completion instead of rearming its watchdog", async () => {
    renderFlow();
    await flush();
    await emit("visualizer-layout-progress");
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(screen.queryByText("Model loading error")).not.toBeInTheDocument();
  });

  it("TC-NAV-002 repeated graph-ticket returns release every subscription under StrictMode", async () => {
    const view = renderFlow("/visualizer", true);
    for (let cycle = 0; cycle < 12; cycle += 1) {
      await flush();
      // Click the real FACT table row, rather than replacing either page with a route stub.
      fireEvent.click(screen.getByText("Publication", { selector: "td" }));
      await flush();
      expect(screen.getByRole("button", { name: "Edit summary" })).toHaveTextContent("Publication");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
      await flush();
      await emit("visualizer-layout-progress");
      await act(async () => vi.advanceTimersByTimeAsync(10001));
      expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    }
    view.unmount();
    await flush();
    expect(listeners.filter((entry) => !entry.disposed)).toEqual([]);
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_hasm_model_db")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TC-NAV-003 a late ticket rejection cannot replace the graph with an error", async () => {
    const pending = deferred();
    bridge.invoke.mockImplementation((command) => command === "load_entity_detail" ? pending.promise : Promise.resolve(geometry));
    renderFlow(`/entity-detail/FACT/${id}`);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Visit graph" }));
    await flush();
    await act(async () => pending.reject(new Error("Database is locked")));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
  });

  it("TC-NAV-004 a late layout rejection cannot replace an open ticket with an error", async () => {
    const pending = deferred();
    bridge.invoke.mockImplementation((command) => command === "compute_visualizer_layout" ? pending.promise : Promise.resolve(ticket));
    renderFlow();
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Visit ticket" }));
    await flush();
    await act(async () => pending.reject(new Error("Layout failed")));
    expect(screen.getByTestId("route")).toHaveTextContent(`/entity-detail/FACT/${id}`);
  });

  it("TC-NAV-005 late layout-listener registration is disposed when its page has left", async () => {
    const pending = deferred();
    const dispose = vi.fn();
    bridge.listen.mockReturnValue(pending.promise);
    renderFlow();
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Visit ticket" }));
    await flush();
    await act(async () => pending.resolve(dispose));
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("TC-NAV-006 late loader subscriptions do not check locks or leak listeners", async () => {
    const pending = [deferred(), deferred()];
    const dispose = [vi.fn(), vi.fn()];
    bridge.listen.mockImplementation((name) => name === "model-load-progress" ? pending[0].promise
      : name === "model-verify-progress" ? pending[1].promise : Promise.resolve(() => {}));
    renderFlow("/loading-model");
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Visit graph" }));
    await flush();
    await act(async () => pending.forEach((value, index) => value.resolve(dispose[index])));
    expect(dispose.every((fn) => fn.mock.calls.length === 1)).toBe(true);
    expect(bridge.invoke.mock.calls.some(([command]) => command === "check_workspace_lock")).toBe(false);
  });

  it("TC-NAV-007 partial subscription failure releases the other listener and reports the error", async () => {
    const pending = deferred();
    const dispose = vi.fn();
    bridge.listen.mockImplementation((name) => name === "model-load-progress" ? pending.promise : Promise.reject(new Error("Event bridge unavailable")));
    renderFlow("/loading-model");
    await flush();
    await act(async () => pending.resolve(dispose));
    expect(screen.getByText("Model loading error")).toBeInTheDocument();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(bridge.invoke.mock.calls.some(([command]) => command === "check_workspace_lock")).toBe(false);
  });

  it("TC-NAV-008 save-return revalidates through real routes and API wrappers without listener leaks", async () => {
    const view = renderFlow(`/entity-detail/FACT/${id}`, true);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(bridge.invoke).toHaveBeenCalledWith("save_fact_detail", { modelRoot: path, detail: { ...fact, factName: "Updated" } });
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_hasm_model_db")).toHaveLength(1);
    await emit("visualizer-layout-progress");
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    view.unmount();
    await flush();
    expect(listeners.filter((entry) => !entry.disposed)).toEqual([]);
  });

  it("TC-NAV-INLINE-001 clicked detail content saves through the real typed invoke wrapper", async () => {
    renderFlow(`/entity-detail/FACT/${id}`);
    await flush();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Occurred at"), { target: { value: "2026-10-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("save_fact_detail", {
      modelRoot: path, detail: { ...fact, occurredAt: "2026-10-29" },
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveTextContent("2026-10-29");
  });

  it("TC-NAV-009 an active stalled layout still fails after progress stops", async () => {
    bridge.invoke.mockReturnValue(new Promise(() => {}));
    renderFlow();
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    await emit("visualizer-layout-progress");
    await act(async () => vi.advanceTimersByTimeAsync(9000));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(screen.getByText("Model loading error")).toBeInTheDocument();
  });

  it("TC-NAV-010 a load completing after its watchdog cannot leave the error page", async () => {
    const pending = deferred();
    const invoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "load_hasm_model_db" ? pending.promise : invoke(command, args));
    renderFlow("/loading-model");
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByText("Model loading error")).toBeInTheDocument();
    await act(async () => pending.resolve(model));
    expect(screen.getByText("Model loading error")).toBeInTheDocument();
    expect(bridge.invoke.mock.calls.some(([command]) => command === "verify_hasm_storage")).toBe(false);
    expect(listeners.filter((entry) => !entry.disposed)).toEqual([]);
  });

  it("TC-NAV-011 superseded layout failures do not invalidate the newer successful graph", async () => {
    const pending = deferred();
    bridge.invoke.mockReturnValueOnce(pending.promise).mockResolvedValue(geometry);
    renderFlow();
    await flush();
    fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "SequentialIndex" } });
    await flush();
    await act(async () => pending.reject(new Error("Old layout failed")));
    await act(async () => vi.advanceTimersByTimeAsync(10001));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(screen.queryByText("Filter update timed out. Reverting view.")).not.toBeInTheDocument();
  });

  it("TC-NAV-012 late Markdown refresh failures cannot redirect the returned graph", async () => {
    const pending = deferred();
    const invoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "reload_entity_markdown" ? pending.promise : invoke(command, args));
    renderFlow(`/entity-detail/FACT/${id}`);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    await flush();
    await act(async () => pending.reject(new Error("ERR_MARKDOWN_FILE_NOT_FOUND")));
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
  });

  it("TC-NAV-013 active storage errors still route to the model error page", async () => {
    const invoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "verify_hasm_storage"
      ? Promise.reject(new Error("ERR_MISSING_STORAGE_FOLDER")) : invoke(command, args));
    renderFlow("/loading-model");
    await flush();
    expect(screen.getByText("Model loading error")).toBeInTheDocument();
    expect(listeners.filter((entry) => !entry.disposed)).toEqual([]);
  });
});
