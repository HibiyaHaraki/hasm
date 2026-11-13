import { StrictMode } from "react";
import { Button } from "react-bootstrap";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import LoadingModelPage from "../src/pages/LoadingModelPage";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";
import SelectModelPage from "../src/pages/SelectModelPage";

const bridge = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: bridge.listen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: bridge.open }));
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
    {location.state?.error ? <output data-testid="route-error">{location.state.error}</output> : null}
    <Button onClick={() => navigate("/visualizer", { state: { path, model, isVerified: true } })}>Visit graph</Button>
    <Button onClick={() => navigate(`/entity-detail/FACT/${id}`, { state: { path, model, isVerified: true } })}>Visit ticket</Button>
  </>;
}

function renderFlow(start = "/visualizer", strict = false, workspaceModel = model) {
  const tree = <MemoryRouter initialEntries={[{ pathname: start, state: { path, model: workspaceModel, isVerified: true } }]}>
    <NavigationProbe />
    <Routes>
      <Route element={<ProtectedRoute requireVerified />}>
        <Route path="/visualizer" element={<VisualizerPage />} />
        <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} />
      </Route>
      <Route path="/loading-model" element={<LoadingModelPage />} />
      <Route path="/select" element={<SelectModelPage />} />
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
      case "validate_hasm_folder_path": return undefined;
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
  it.each(["C:\\workspace", path])("TC-NAV-BROWSE-001 browses %s through the native dialog wrapper and real load invokes", async (selectedPath) => {
    bridge.open.mockResolvedValue(selectedPath);
    renderFlow("/select");
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    await flush();
    expect(bridge.open).toHaveBeenCalledWith({ directory: true, multiple: false, title: "Open a HASM workspace folder (.hasm)" });
    expect(screen.getByLabelText("Workspace folder")).toHaveValue(selectedPath);
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(bridge.invoke).toHaveBeenCalledWith("validate_hasm_folder_path", { path: selectedPath });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("check_workspace_lock", { path: selectedPath });
    expect(bridge.invoke).toHaveBeenCalledWith("load_hasm_model_db", { path: selectedPath });
    expect(bridge.invoke).toHaveBeenCalledWith("verify_hasm_storage", { path: selectedPath, model });
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
  });
  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-NAV-REF-002 opens a Details %s reference through the real load invoke", async (target) => {
    const person = { personId: "person-ada", personName: "Ada Lovelace" };
    const experience = { experienceId: "exp-life", experienceName: "Life in London" };
    const otherLink = { linkId: "link-other", linkName: "Further reading", relatedIds: [], linkType: "references" };
    const relationship = { linkId: "link-source", linkName: "References", relatedIds: [person.personId, experience.experienceId, id, otherLink.linkId], linkType: "references" };
    const targets = { PERSON: person, EXPERIENCE: experience, FACT: fact, LINK: otherLink };
    const targetId = targets[target][`${target.toLowerCase()}Id`];
    const title = targets[target][`${target.toLowerCase()}Name`];
    const originalInvoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "load_entity_detail"
      ? Promise.resolve({ ...ticket, name: args.entityId === relationship.linkId ? relationship.linkName : title, detail: args.entityId === relationship.linkId ? relationship : targets[target] })
      : originalInvoke(command, args));
    renderFlow(`/entity-detail/LINK/${relationship.linkId}`, false, { ...model, people: [person], experiences: [experience], links: [relationship, otherLink] });
    await flush();
    fireEvent.click(screen.getByRole("link", { name: `Open ${target}: ${title}` }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", { modelRoot: path, entityType: target, entityId: targetId });
    expect(screen.getByRole("button", { name: "Edit summary" })).toHaveTextContent(title);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_hasm_model_db")).toHaveLength(0);
  });
  it("TC-NAV-REF-001 opens a related LINK via the real load invoke with reader-friendly endpoint titles", async () => {
    const person = { personId: "11111111-1111-1111-1111-111111111111", personName: "Ada Lovelace" };
    const relationship = { linkId: "44444444-4444-4444-4444-444444444444", linkName: "Ada published notes", linkType: "published", relatedIds: [person.personId, id], link: [] };
    const originalInvoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "load_entity_detail" && args.entityType === "LINK"
      ? Promise.resolve({ ...ticket, entityType: "LINK", entityId: relationship.linkId, name: relationship.linkName, detail: relationship })
      : originalInvoke(command, args));
    renderFlow(`/entity-detail/FACT/${id}`, false, { ...model, people: [person], links: [relationship] });
    await flush();
    const open = screen.getByRole("button", { name: "Open LINK: Ada published notes" });
    expect(open).toHaveTextContent(relationship.linkName);
    const disclosure = screen.getByText("Relationship details").closest("details");
    fireEvent.click(screen.getByText("Relationship details"));
    expect(within(disclosure).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(disclosure).getByText("Publication")).toBeInTheDocument();
    fireEvent.click(open);
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", { modelRoot: path, entityType: "LINK", entityId: relationship.linkId });
    const details = within(screen.getByRole("region", { name: "Details" }));
    expect(details.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(details.getByText("Publication")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_hasm_model_db")).toHaveLength(0);
  });
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
      fireEvent.click(screen.getByText("Publication", { selector: ".HasmVisualizer_FactTitle" }));
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
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
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

  it.each([
    ["PERSON", "people", { personId: id, personName: "Original", birthday: "", die: "", linkIds: [], link: [] }],
    ["EXPERIENCE", "experiences", { experienceId: id, experienceName: "Original", personId: "", parentExperienceIds: [], linkIds: [], link: [] }],
    ["FACT", "facts", { ...fact, factName: "Original" }],
    ["LINK", "links", { linkId: id, linkName: "Original", linkType: "references", relatedIds: [], link: [] }],
  ])("TC-NAV-EDIT-001 saves %s, re-verifies, and opens the updated model", async (type, collection, entity) => {
    const verification = deferred();
    const initialModel = { people: [], experiences: [], facts: [], links: [], [collection]: [entity] };
    const nameKey = `${type.toLowerCase()}Name`;
    const savedEntity = { ...entity, [nameKey]: "Updated title" };
    const updatedModel = { ...initialModel, [collection]: [savedEntity] };
    const command = `save_${type.toLowerCase()}_detail`;
    let persistedModel = initialModel;
    bridge.invoke.mockImplementation(async (name, args) => {
      if (name === "load_entity_detail") return { entityType: type, entityId: id, name: "Original", detail: entity, markdownBody: "", loadedMtimeMs: 1 };
      if (name === command) {
        persistedModel = { ...initialModel, [collection]: [args.detail] };
        return {};
      }
      if (name === "check_workspace_lock") return { isReadOnly: type === "PERSON", isStaleRecovered: false };
      if (name === "load_hasm_model_db") return persistedModel;
      if (name === "verify_hasm_storage") return verification.promise;
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/${type}/${id}`, false, initialModel);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith(command, { modelRoot: path, detail: savedEntity });
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    expect(screen.getByText("Reloading and verifying the workspace before returning to visualization.")).toBeInTheDocument();
    if (type === "PERSON") expect(screen.getByText("Opened in Read-Only Mode")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to visualization" })).not.toBeInTheDocument();
    expect(bridge.invoke).toHaveBeenCalledWith("check_workspace_lock", { path });
    expect(bridge.invoke).toHaveBeenCalledWith("load_hasm_model_db", { path });
    expect(bridge.invoke).toHaveBeenCalledWith("verify_hasm_storage", { path, model: updatedModel });
    await act(async () => verification.resolve({ missingEntities: [], unreferencedEntities: [] }));
    await flush();
    expect(screen.getByRole("heading", { name: "Workspace ready" })).toBeInTheDocument();
    expect(screen.queryByText("Reloading and verifying the workspace before returning to visualization.")).not.toBeInTheDocument();
    expect(screen.getByText("Loading complete. Choose Go to visualization when you are ready.")).toBeInTheDocument();
    if (type === "PERSON") expect(screen.getByText("Opened in Read-Only Mode")).toBeInTheDocument();
    expect(listeners.filter((entry) => !entry.disposed)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(bridge.invoke).toHaveBeenCalledWith("compute_visualizer_layout", { model: updatedModel, filter: expect.any(Object) });
    expect(bridge.invoke.mock.calls.filter(([name]) => name === "load_hasm_model_db")).toHaveLength(1);
    expect(bridge.invoke.mock.calls.filter(([name]) => name === "verify_hasm_storage")).toHaveLength(1);
  });

  it("TC-NAV-EDIT-002 reports re-verification failure after saving without offering visualization", async () => {
    const verification = deferred();
    const originalInvoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((name, args) => name === "verify_hasm_storage"
      ? verification.promise : originalInvoke(name, args));
    renderFlow(`/entity-detail/FACT/${id}`);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    await flush();
    expect(screen.getByText("Reloading and verifying the workspace before returning to visualization.")).toBeInTheDocument();
    await act(async () => verification.reject(new Error("Storage verification failed")));
    await flush();
    expect(screen.getByRole("heading", { name: "Model loading error" })).toBeInTheDocument();
    expect(screen.getByTestId("route-error")).toHaveTextContent("Storage verification failed");
    expect(screen.queryByRole("button", { name: "Go to visualization" })).not.toBeInTheDocument();
  });

  it("TC-NAV-DELETE-001 confirms EXPERIENCE reassignment, child parents and individual LINK choices through IPC", async () => {
    const target = "22222222-2222-2222-2222-222222222222";
    const replacement = "22222222-2222-2222-2222-222222222221";
    const child = "22222222-2222-2222-2222-222222222223";
    const link1 = "44444444-4444-4444-4444-444444444441";
    const link2 = "44444444-4444-4444-4444-444444444442";
    const experience = { experienceId: target, experienceName: "Research", parentExperienceIds: [], linkIds: [link1], link: [] };
    const workspace = { people: [], experiences: [
      experience, { experienceId: replacement, experienceName: "Life", parentExperienceIds: [] },
      { experienceId: child, experienceName: "Writing", parentExperienceIds: [target] },
    ], facts: [{ ...fact, experienceIds: [target] }], links: [
      { linkId: link1, linkName: "Keep relation", linkType: "references", relatedIds: [target, id] },
      { linkId: link2, linkName: "Remove relation", linkType: "references", relatedIds: [target, id] },
    ] };
    const updated = { ...workspace, experiences: workspace.experiences.filter((item) => item.experienceId !== target)
      .map((item) => item.experienceId === child ? { ...item, parentExperienceIds: [replacement] } : item),
    facts: [{ ...fact, experienceIds: [replacement] }], links: [{ ...workspace.links[0], relatedIds: [id] }] };
    const deletion = deferred();
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: "Research", detail: experience, markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      if (name === "delete_entity") return deletion.promise;
      if (name === "check_workspace_lock") return { isReadOnly: true };
      if (name === "load_hasm_model_db") return updated;
      if (name === "verify_hasm_storage") return { missingEntities: [], unreferencedEntities: [] };
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/EXPERIENCE/${target}`, false, workspace);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Delete EXPERIENCE" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Are you sure you want to delete Research?")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm deletion" })).toBeDisabled();
    expect(bridge.invoke.mock.calls.filter(([name]) => name === "delete_entity")).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Replacement EXPERIENCE (required)"), { target: { value: replacement } });
    fireEvent.change(within(dialog).getByLabelText("Parent for Writing"), { target: { value: replacement } });
    fireEvent.click(within(dialog).getByLabelText("Remove relation"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm deletion" }));
    expect(bridge.invoke).toHaveBeenCalledWith("delete_entity", { path, request: {
      entityType: "EXPERIENCE", entityId: target, factIds: [id], replacementExperienceId: replacement,
      childParents: [{ childId: child, parentId: replacement }],
      linkDecisions: [{ linkId: link1, delete: false }, { linkId: link2, delete: true }],
    } });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => deletion.resolve({ archivePath: "archive", warning: "Archive finalization needs attention." }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    expect(bridge.invoke).toHaveBeenCalledWith("verify_hasm_storage", { path, model: updated });
    expect(screen.getByText("Archive finalization needs attention.")).toBeInTheDocument();
    expect(screen.getByText("Opened in Read-Only Mode")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
  });

  it.each(["FACT", "LINK"])("TC-NAV-DELETE-002 confirms %s deletion and reports IPC failure without leaving the ticket", async (type) => {
    const entity = type === "FACT" ? fact : { linkId: id, linkName: "Relation", linkType: "references", relatedIds: [] };
    const collection = type === "FACT" ? "facts" : "links";
    const workspace = { people: [], experiences: [], facts: [], links: [], [collection]: [entity] };
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: type === "FACT" ? "Publication" : "Relation", detail: entity, markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      if (name === "delete_entity") throw new Error("Archive failed");
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/${type}/${id}`, false, workspace);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: `Delete ${type}` }));
    expect(bridge.invoke.mock.calls.filter(([name]) => name === "delete_entity")).toHaveLength(0);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm deletion" }));
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Archive failed");
    expect(screen.getByTestId("route")).toHaveTextContent(`/entity-detail/${type}/${id}`);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("TC-NAV-DELETE-003 allows optional FACT reassignment and asks about FACT-related LINKs", async () => {
    const target = "22222222-2222-2222-2222-222222222222";
    const other = "22222222-2222-2222-2222-222222222221";
    const link = "44444444-4444-4444-4444-444444444444";
    const experience = { experienceId: target, experienceName: "Research", parentExperienceIds: [], linkIds: [], link: [] };
    const workspace = { people: [], experiences: [experience, { experienceId: other, experienceName: "Life", parentExperienceIds: [] }],
      facts: [{ ...fact, experienceIds: [target, other] }],
      links: [{ linkId: link, linkName: "FACT relation", relatedIds: [id], linkType: "references" }] };
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: "Research", detail: experience, markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/EXPERIENCE/${target}`, false, workspace);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Delete EXPERIENCE" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Replacement EXPERIENCE (optional)")).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Confirm deletion" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(bridge.invoke.mock.calls.filter(([name]) => name === "delete_entity")).toHaveLength(0);

    cleanup();
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: fact.factName, detail: workspace.facts[0], markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      if (name === "delete_entity") throw new Error("Not deleted");
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/FACT/${id}`, false, workspace);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Delete FACT" }));
    fireEvent.click(screen.getByLabelText("FACT relation"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm deletion" }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("delete_entity", { path, request: {
      entityType: "FACT", entityId: id, factIds: [], replacementExperienceId: null,
      childParents: [], linkDecisions: [{ linkId: link, delete: true }],
    } });
  });

  it.each([["PERSON", false], ["FACT", true]])("TC-NAV-DELETE-004 restricts %s deletion when unavailable", async (type, readOnly) => {
    const entity = type === "PERSON" ? { personId: id, personName: "Ada", linkIds: [], link: [] } : fact;
    const workspace = { people: type === "PERSON" ? [entity] : [], experiences: [], facts: type === "FACT" ? [entity] : [], links: [] };
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: type === "PERSON" ? "Ada" : fact.factName, detail: entity, markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      throw new Error(`Unexpected invoke: ${name}`);
    });
    render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${type}/${id}`, state: { path, model: workspace, isVerified: true, isReadOnly: readOnly } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
    </MemoryRouter>);
    await flush();
    if (type === "PERSON") expect(screen.queryByRole("button", { name: "Delete PERSON" })).not.toBeInTheDocument();
    else expect(screen.getByRole("button", { name: "Delete FACT" })).toBeDisabled();
  });

  it("TC-NAV-DELETE-005 explains when no replacement EXPERIENCE is available", async () => {
    const target = "22222222-2222-2222-2222-222222222222";
    const experience = { experienceId: target, experienceName: "Only timeline", parentExperienceIds: [], linkIds: [], link: [] };
    const workspace = { people: [], experiences: [experience], facts: [{ ...fact, experienceIds: [target] }], links: [] };
    bridge.invoke.mockImplementation(async (name) => {
      if (name === "load_entity_detail") return { name: experience.experienceName, detail: experience, markdownBody: "", loadedMtimeMs: 1 };
      if (name === "compute_visualizer_layout") return { nodes3d: [], lines3d: [], warnings: [] };
      throw new Error(`Unexpected invoke: ${name}`);
    });
    renderFlow(`/entity-detail/EXPERIENCE/${target}`, false, workspace);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Delete EXPERIENCE" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Create another EXPERIENCE before deleting this one.");
    expect(screen.getByRole("button", { name: "Confirm deletion" })).toBeDisabled();
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
    expect(screen.getByRole("region", { name: "Details" })).toHaveTextContent(
      new Intl.DateTimeFormat("en-US", {
        year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
      }).format(new Date("2026-10-29T00:00:00.000Z")),
    );
  });

  it("TC-NAV-DISPLAY-001 Japanese controls preserve typed IPC data and Markdown through save-return", async () => {
    renderFlow(`/entity-detail/FACT/${id}`);
    await flush();
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
    fireEvent.change(screen.getByLabelText("文字サイズ"), { target: { value: "small" } });
    expect(screen.getByRole("main")).toHaveClass("ticket-text-small");
    expect(screen.getByRole("region", { name: "詳細" })).toHaveTextContent("2026年1月15日");
    expect(screen.getByRole("article", { name: "Markdownプレビュー" })).toHaveTextContent("Publication");
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_entity_detail")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "詳細を編集" }));
    fireEvent.change(screen.getByLabelText("発生日時"), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("save_fact_detail", {
      modelRoot: path, detail: { ...fact, occurredAt: "2026-11-01" },
    });
    expect(within(screen.getByRole("main")).getByText(/メタデータを保存しました。/)).toHaveAttribute("role", "status");
    expect(screen.getByRole("article", { name: "Markdownプレビュー" })).toHaveTextContent("Publication");
    fireEvent.click(screen.getByRole("button", { name: "ビジュアライザーに戻る" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_hasm_model_db")).toHaveLength(1);
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

  it("TC-NAV-PROGRESS-001 real load and verify invokes update separate bars and retain completed steps", async () => {
    const locking = deferred();
    const loading = deferred();
    const verifying = deferred();
    const invoke = bridge.invoke.getMockImplementation();
    bridge.invoke.mockImplementation((command, args) => command === "check_workspace_lock" ? locking.promise
      : command === "load_hasm_model_db" ? loading.promise
      : command === "verify_hasm_storage" ? verifying.promise : invoke(command, args));
    renderFlow("/loading-model");
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(screen.getByRole("progressbar", { name: "Check workspace lock" })).toHaveAttribute("aria-valuenow", "0");
    fireEvent.click(screen.getByRole("button", { name: "Hide detail" }));
    await act(async () => locking.resolve({ isReadOnly: false, isStaleRecovered: false }));
    await flush();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(screen.getAllByRole("progressbar")).toHaveLength(9);
    expect(screen.getByRole("progressbar", { name: "Check workspace lock" })).toHaveAttribute("aria-valuenow", "100");
    await act(async () => {
      listeners.find((entry) => entry.name === "model-load-progress").handler({
        payload: { step: "DB_LOAD", current: 1, total: 2, percentage: 50, message: "Loading FACT records" },
      });
    });
    expect(screen.getByRole("progressbar", { name: "Load database metadata" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("progressbar", { name: "Verify workspace storage" })).toHaveAttribute("aria-valuenow", "0");
    await act(async () => {
      const progress = listeners.find((entry) => entry.name === "model-load-progress").handler;
      progress({ payload: { step: "DB_LOAD_PERSON", current: 0, total: 0, percentage: 100, message: "No PERSON records" } });
      progress({ payload: { step: "DB_LOAD_EXPERIENCE", current: 0, total: 0, percentage: 100, message: "No EXPERIENCE records" } });
      progress({ payload: { step: "DB_LOAD_FACT", current: 1, total: 2, percentage: 50, message: "Loading FACT records" } });
    });
    expect(screen.getByRole("progressbar", { name: "Load PERSON entities" })).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(screen.getByRole("progressbar", { name: "Load FACT entities" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("progressbar", { name: "Load LINK entities" })).toHaveAttribute("aria-valuetext", "Waiting, 0%");
    fireEvent.click(screen.getByRole("button", { name: "Hide detail" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(screen.getByRole("progressbar", { name: "Load FACT entities" })).toHaveAttribute("aria-valuenow", "50");
    await act(async () => loading.resolve(model));
    await flush();
    expect(bridge.invoke).toHaveBeenCalledWith("verify_hasm_storage", { path, model });
    await act(async () => {
      listeners.find((entry) => entry.name === "model-verify-progress").handler({
        payload: { step: "STORAGE_VERIFY", current: 1, total: 2, percentage: 50, message: "Checking files" },
      });
    });
    expect(screen.getByRole("progressbar", { name: "Load database metadata" })).toHaveAttribute("aria-valuetext", "Complete, 100%");
    expect(screen.getByRole("progressbar", { name: "Verify workspace storage" })).toHaveAttribute("aria-valuenow", "50");
    fireEvent.click(screen.getByRole("button", { name: "Hide detail" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));
    expect(screen.getByRole("progressbar", { name: "Verify workspace storage" })).toHaveAttribute("aria-valuenow", "50");
    await act(async () => verifying.resolve({ missingEntities: [], unreferencedEntities: [] }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    expect(listeners.filter((entry) => !entry.disposed && entry.name.startsWith("model-"))).toEqual([]);
    await emit("model-load-progress");
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(screen.getByTestId("route")).toHaveTextContent("/loading-model");
    fireEvent.click(screen.getByRole("button", { name: "Go to visualization" }));
    await flush();
    expect(screen.getByTestId("route")).toHaveTextContent("/visualizer");
    expect(listeners.filter((entry) => !entry.disposed && entry.name.startsWith("model-"))).toEqual([]);
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
