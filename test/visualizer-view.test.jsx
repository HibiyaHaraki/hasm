import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import { computeVisualizerLayoutJS } from "../src/hasm_visualizer/layoutCalculator.js";
import { createCommitGraph2D } from "../src/hasm_visualizer/twoCommitGraph.js";
import { getPatternById } from "../src/hasm_color_pattern/src/index.js";
import { buildExperienceColorMaps, positionKey } from "../src/hasm_visualizer/threeCommitGraph.js";
import * as renderer3D from "../src/hasm_visualizer/threeCommitGraph.js";
import ProtectedRoute from "../src/features/navigation/ProtectedRoute";
import LoadingModelPage from "../src/pages/LoadingModelPage";

const bridge = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: bridge.listen }));
const model = { people: [], experiences: [
  { experienceId: "root", experienceName: "Life" },
  { experienceId: "child", experienceName: "Research", parentExperienceIds: ["root"] },
], facts: [{ factId: "fact", factName: "Paper", experienceIds: ["child"], occurredAt: "2026-01-01" }], links: [] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("TC-03-VIEW-001 removes repeated same-lane FACTs while retaining ancestor reflections", () => {
  const payload = computeVisualizerLayoutJS(model, { timeScaleMode: "SequentialIndex" });
  const direct = payload.nodes3d.find((node) => node.entityType === "FACT" && node.isDirectFact);
  payload.nodes3d.push({ ...direct }, { ...direct, isDirectFact: false });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = createCommitGraph2D(container, payload, getPatternById("classic").colors, null, null, null, null,
    { timeScaleMode: "SequentialIndex" });
  expect(container.querySelectorAll("circle")).toHaveLength(2);
  expect(container.querySelectorAll('circle[fill="none"]')).toHaveLength(1);
  dispose();
  container.remove();
});

function Ticket() {
  const { state } = useLocation();
  const navigate = useNavigate();
  return <button onClick={() => navigate("/visualizer", { state })}>Return</button>;
}
function ExperienceTicket() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  return <>
    <p>{pathname}</p>
    <p>{state.path}</p>
    <button onClick={() => navigate("/visualizer", { state })}>Return</button>
  </>;
}
it("TC-03-VIEW-006 opens the table EXPERIENCE badge rather than its FACT and retains view state", async () => {
  bridge.invoke.mockImplementation(async (_, args) => {
    const payload = computeVisualizerLayoutJS(args.model, args.filter);
    payload.nodes3d.forEach((node) => { node.label = node.entityType === "FACT" ? "Paper" : node.id === "root" ? "Life" : "Research"; });
    return payload;
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <Routes><Route path="/visualizer" element={<VisualizerPage />} />
      <Route path="/entity-detail/:type/:id" element={<ExperienceTicket />} /></Routes>
  </MemoryRouter>);
  await screen.findByText("Paper");
  const badge = document.querySelector(".HasmVisualizer_FactTable .HasmVisualizer_ExperienceBadge");
  expect(badge).toHaveAttribute("href", "/entity-detail/EXPERIENCE/child");
  fireEvent.click(badge);
  expect(await screen.findByText("/entity-detail/EXPERIENCE/child")).toBeInTheDocument();
  expect(screen.getByText("fixture.hasm")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Return"));
  expect(await screen.findByLabelText("Time scale")).toHaveValue("SequentialIndex");
  expect(await screen.findByText("Paper")).toBeInTheDocument();
});
it("TC-03-VIEW-002 retains scope, time scale and Z scale through graph-ticket-return with real IPC", async () => {
  bridge.invoke.mockImplementation(async (command, args) => {
    if (command === "compute_visualizer_layout") {
      const payload = computeVisualizerLayoutJS(args.model, args.filter);
      payload.nodes3d.forEach((node) => { node.label = node.entityType === "FACT" ? "Paper" : node.id === "root" ? "Life" : "Research"; });
      return payload;
    }
    throw new Error(`Unexpected invoke ${command}`);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <Routes><Route path="/visualizer" element={<VisualizerPage />} /><Route path="/entity-detail/:type/:id" element={<Ticket />} /></Routes>
  </MemoryRouter>);
  await screen.findByText("Paper");
  const scope = screen.getByLabelText("EXPERIENCE scope");
  scope.options[1].selected = true;
  fireEvent.change(scope);
  fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "Logarithmic" } });
  fireEvent.change(screen.getByLabelText("Z scale"), { target: { value: "1.7" } });
  await waitFor(() => expect(bridge.invoke).toHaveBeenLastCalledWith("compute_visualizer_layout", {
    model, filter: { timeScaleMode: "Logarithmic", zScaleFactor: 1.7 },
  }));
  await waitFor(() => {
    const circle = document.querySelector("circle");
    expect(circle).not.toBeNull();
    fireEvent.click(circle);
  });
  fireEvent.click(await screen.findByText("Return"));
  expect(await screen.findByLabelText("Time scale")).toHaveValue("Logarithmic");
  expect(screen.getByLabelText("Z scale")).toHaveValue("1.7");
  expect([...screen.getByLabelText("EXPERIENCE scope").selectedOptions].map((option) => option.value)).toEqual(["child"]);
});

it("TC-03-VIEW-004 restores 3D mode and renderer camera state on return", async () => {
  const camera = { position: [1, 2, 3], quaternion: [0, 0, 0, 1], target: [4, 5, 6] };
  let select;
  const renderer = vi.spyOn(renderer3D, "createCommitGraph").mockImplementation((_, __, ___, onSelect) => {
    select = onSelect;
    const dispose = () => {};
    dispose.getViewState = () => camera;
    return dispose;
  });
  bridge.invoke.mockImplementation(async (_, args) => computeVisualizerLayoutJS(args.model, args.filter));
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <Routes><Route path="/visualizer" element={<VisualizerPage />} /><Route path="/entity-detail/:type/:id" element={<Ticket />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  await waitFor(() => expect(select).toBeTypeOf("function"));
  await act(async () => select({ id: "fact", entityType: "FACT" }));
  fireEvent.click(await screen.findByText("Return"));
  await waitFor(() => expect(renderer).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "3D" })).toHaveClass("is-active");
  expect(renderer.mock.calls.at(-1)[6]).toEqual(camera);
});

it("TC-03-VIEW-005 retains view settings through save re-verification guard", async () => {
  const visualizerView = { viewMode: "2d", filter: { timeScaleMode: "Logarithmic", zScaleFactor: 1.4 },
    scope: { personIds: [], experienceIds: ["child"] }, views: {} };
  bridge.invoke.mockImplementation(async (command, args) => {
    if (command === "check_workspace_lock") return { isReadOnly: false };
    if (command === "load_hasm_model_db") return model;
    if (command === "verify_hasm_storage") return { missingEntities: [], unreferencedEntities: [] };
    if (command === "compute_visualizer_layout") return computeVisualizerLayoutJS(args.model, args.filter);
    throw new Error(`Unexpected invoke ${command}`);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: false, visualizerView } }]}>
    <Routes><Route element={<ProtectedRoute requireVerified />}>
      <Route path="/visualizer" element={<VisualizerPage />} />
    </Route><Route path="/loading-model" element={<LoadingModelPage />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Go to visualization" }));
  expect(await screen.findByLabelText("Time scale")).toHaveValue("Logarithmic");
  expect(screen.getByLabelText("Z scale")).toHaveValue("1.4");
  expect([...screen.getByLabelText("EXPERIENCE scope").selectedOptions].map((option) => option.value)).toEqual(["child"]);
});

it("TC-03-VIEW-003 shows exactly the hovered EXPERIENCE badge and its line color", async () => {
  bridge.invoke.mockImplementation(async (_, args) => {
    const payload = computeVisualizerLayoutJS(args.model, args.filter);
    payload.nodes3d.forEach((node) => { node.label = node.entityType === "FACT" ? "Paper" : node.id === "root" ? "Life" : "Research"; });
    return payload;
  });
  const { container } = render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <VisualizerPage />
  </MemoryRouter>);
  await screen.findByText("Paper");
  const payload = computeVisualizerLayoutJS(model, { timeScaleMode: "SequentialIndex" });
  const colors = buildExperienceColorMaps(payload, getPatternById("classic").colors);
  const nodes = payload.nodes3d.filter((node) => node.entityType === "FACT");
  await waitFor(() => expect(container.querySelectorAll("circle")).toHaveLength(2));
  const dots = container.querySelectorAll("circle");
  for (let i = 0; i < dots.length; i++) {
    fireEvent.pointerEnter(dots[i], { clientX: 5, clientY: 5 });
    const tooltip = container.querySelector(".HasmVisualizer_Tooltip");
    const badge = tooltip.querySelector(".HasmVisualizer_ExperienceBadge");
    expect(tooltip.querySelectorAll(".HasmVisualizer_ExperienceBadge")).toHaveLength(1);
    expect(badge).toHaveTextContent(nodes[i].isDirectFact ? "Research" : "Life");
    const color = colors.trunkColorByPositionKey.get(positionKey(nodes[i].x, nodes[i].y));
    const probe = document.createElement("span");
    probe.style.backgroundColor = color;
    expect(badge.style.backgroundColor).toBe(probe.style.backgroundColor);
    fireEvent.pointerLeave(dots[i]);
  }
  const table = container.querySelector(".HasmVisualizer_FactTable");
  expect(table.querySelector(".HasmVisualizer_ExperienceBadge")).toHaveTextContent("Research");
  expect(table.querySelector(".HasmVisualizer_ExperienceBadge")).toHaveClass("HasmVisualizer_ExperienceBadgeInline");
  expect(table.querySelector(".HasmVisualizer_ExperienceBadge").nextSibling.textContent).toBe(" ");
  expect(table.querySelector(".HasmVisualizer_FactDot")).toBeNull();
  expect(container.querySelectorAll("circle")).toHaveLength(2);
  expect(within(table).getByText("Paper")).toBeInTheDocument();
});
