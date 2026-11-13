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
import EntityInfoPreview from "../src/features/entityTicket/EntityInfoPreview";
import EntityDetailPage from "../src/pages/EntityDetailPage";

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
  expect(container.querySelector("button")).toBeNull();
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
it.each([["child", "Research"], ["empty", "Empty timeline"], ["unnamed", "Untitled EXPERIENCE"]])("TC-03-VIEW-007 opens 2D EXPERIENCE %s through the real ticket invoke", async (experienceId, title) => {
  const experience = { experienceId, experienceName: title, parentExperienceIds: ["root"], linkIds: [], link: [] };
  const workspace = { ...model, experiences: [...model.experiences, { experienceId: "empty", experienceName: "Empty timeline" },
    { experienceId: "unnamed", experienceName: "" }] };
  bridge.invoke.mockImplementation(async (command, args) => {
    if (command === "compute_visualizer_layout") {
      const payload = computeVisualizerLayoutJS(args.model, args.filter);
      payload.nodes3d.forEach((node) => { node.label = node.entityType === "FACT" ? "Paper" : node.id === "root" ? "Life" : node.id === "child" ? "Research" : node.id === "empty" ? "Empty timeline" : ""; });
      return payload;
    }
    if (command === "load_entity_detail") return { name: title, detail: experience, markdownBody: "", loadedMtimeMs: 1 };
    throw new Error(`Unexpected invoke: ${command}`);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model: workspace, isVerified: true } }]}>
    <Routes><Route path="/visualizer" element={<VisualizerPage />} />
      <Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: `Open EXPERIENCE: ${title}` }));
  expect(await screen.findByRole("button", { name: "Edit summary" })).toHaveTextContent(title);
  expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", {
    modelRoot: "fixture.hasm", entityType: "EXPERIENCE", entityId: experienceId,
  });
});
it("TC-03-VIEW-PREVIEW-001 real visualizer badge shows the common card without modifying the submodule", async () => {
  const personId = "11111111-1111-1111-1111-111111111111";
  const experienceId = "22222222-2222-2222-2222-222222222222";
  const factId = "33333333-3333-3333-3333-333333333333";
  const previewModel = {
    people: [{ personId, personName: "Ada" }],
    experiences: [{ experienceId, experienceName: "Life", personId, parentExperienceIds: [] }],
    facts: [{ factId, factName: "Birth", experienceIds: [experienceId], personIds: [personId], occurredAt: "1815-12-10" }],
    links: [],
  };
  bridge.listen.mockResolvedValue(() => {});
  bridge.invoke.mockImplementation(async (command, args) => {
    if (command === "compute_visualizer_layout") {
      const payload = computeVisualizerLayoutJS(args.model, args.filter);
      payload.nodes3d.forEach((node) => { node.label = node.entityType === "FACT" ? "Birth" : "Life"; });
      return payload;
    }
    if (command === "load_entity_detail") return {
      name: "Life", detail: previewModel.experiences[0], markdownBody: "A life timeline.",
    };
    throw new Error(`Unexpected invoke: ${command}`);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model: previewModel, isVerified: true } }]}>
    <EntityInfoPreview />
    <Routes><Route path="/visualizer" element={<VisualizerPage />} /><Route path="/entity-detail/:type/:id" element={<ExperienceTicket />} /></Routes>
  </MemoryRouter>);
  const badge = await screen.findByRole("link", { name: "Life" });
  fireEvent.pointerOver(badge);
  const card = await screen.findByRole("tooltip");
  expect(card).toHaveTextContent(`EXPERIENCE/${experienceId}`);
  expect(card).toHaveTextContent("A life timeline.");
  expect(card).toHaveTextContent("Ada");
  expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", {
    modelRoot: "fixture.hasm", entityType: "EXPERIENCE", entityId: experienceId,
  });
  fireEvent.click(badge);
  expect(await screen.findByText(`/entity-detail/EXPERIENCE/${experienceId}`)).toBeInTheDocument();
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
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
  fireEvent.click(screen.getByRole("button", { name: /^Scope:/ }));
  const scope = screen.getByLabelText("EXPERIENCE scope");
  fireEvent.focus(scope);
  fireEvent.click(screen.getByRole("option", { name: "Research" }));
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
  fireEvent.click(screen.getByRole("button", { name: /^Scope:/ }));
  expect(screen.getByRole("button", { name: "Remove Research" })).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("button", { name: /^Scope:/ }));
  expect(screen.getByRole("button", { name: "Remove Research" })).toBeInTheDocument();
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

// Shared fixtures for the 2D hover-highlight tests: two trunks, two linked FACTs, one unlinked FACT.
const hoverPayload = {
  nodes3d: [
    { id: "exp-parent", entityType: "EXPERIENCE", label: "Life", x: 0, y: 0, z: 0 },
    { id: "exp-child", entityType: "EXPERIENCE", label: "Research", x: 6, y: 4, z: 0 },
    { id: "fact-a", entityType: "FACT", label: "A", x: 6, y: 4, z: 3, isDirectFact: true, linkedEntityIds: ["fact-b"], parentExperienceIds: ["exp-parent"] },
    { id: "fact-b", entityType: "FACT", label: "B", x: 0, y: 0, z: 6, isDirectFact: true, linkedEntityIds: ["fact-a"] },
    { id: "fact-c", entityType: "FACT", label: "C", x: 6, y: 4, z: 9, isDirectFact: true },
  ],
  lines3d: [
    { id: "branch-exp-parent", lineType: "BRANCH", from: [0, 0, 3], to: [0, 0, 6] },
    { id: "branch-exp-child", lineType: "BRANCH", from: [6, 4, 3], to: [6, 4, 9] },
    { id: "link-1", lineType: "LINK", fromId: "fact-a", toId: "fact-b" },
  ],
  warnings: [],
};

it("TC-03-HOVER-001 highlights the hovered FACT, its linked FACT, and parent trunks", () => {
  const theme = getPatternById("classic").colors;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = createCommitGraph2D(container, hoverPayload, theme, null, null, null, null, { timeScaleMode: "SequentialIndex" });
  const highlightColor = renderer3D.ensureReadableColor(theme.textColor, theme.textBackgroundColor);
  const [factA, factB] = [...container.querySelectorAll("circle")];
  const trunks = [...container.querySelectorAll("path")].filter((path) => !path.getAttribute("stroke-dasharray"));
  expect(trunks).toHaveLength(2);
  fireEvent.pointerEnter(factA);
  // Hovered FACT, its linked FACT, its own trunk, and its parent trunk all take the highlight color.
  expect(factA.getAttribute("fill")).toBe(highlightColor);
  expect(factB.getAttribute("fill")).toBe(highlightColor);
  trunks.forEach((trunk) => expect(trunk.getAttribute("stroke")).toBe(highlightColor));
  expect(container.querySelector("path[stroke-dasharray]").getAttribute("opacity")).toBe("1");
  dispose();
  container.remove();
});

it("TC-03-HOVER-002 leaves unrelated geometry unemphasized and restores base state on leave", () => {
  const theme = getPatternById("classic").colors;
  const onHover = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = createCommitGraph2D(container, hoverPayload, theme, null, onHover, null, null, { timeScaleMode: "SequentialIndex" });
  const colors = buildExperienceColorMaps(hoverPayload, theme);
  const highlightColor = renderer3D.ensureReadableColor(theme.textColor, theme.textBackgroundColor);
  const [factA, factB, factC] = [...container.querySelectorAll("circle")];
  const link = container.querySelector("path[stroke-dasharray]");
  fireEvent.pointerEnter(factC);
  expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ id: "fact-c" }), expect.anything());
  expect(factC.getAttribute("fill")).toBe(highlightColor);
  // The LINK does not touch fact-c, so its segment and endpoints keep their base emphasis.
  expect(link.getAttribute("opacity")).toBe("0.7");
  expect(factA.getAttribute("fill")).toBe(colors.factColorByPositionKey.get(positionKey(6, 4)));
  expect(factB.getAttribute("fill")).toBe(colors.factColorByPositionKey.get(positionKey(0, 0)));
  fireEvent.pointerLeave(factC);
  expect(onHover).toHaveBeenLastCalledWith(null, expect.anything());
  expect(factC.getAttribute("fill")).toBe(colors.factColorByPositionKey.get(positionKey(6, 4)));
  expect(link.getAttribute("opacity")).toBe("0.7");
  dispose();
  container.remove();
});

// WCAG relative luminance / contrast, computed independently of the implementation under test.
function wcagContrast(firstHex, secondHex) {
  const luminance = (hex) => {
    const value = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4]
      .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(firstHex), luminance(secondHex)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const colorPayload = (laneCount) => ({
  nodes3d: Array.from({ length: laneCount }, (_value, index) => (
    { id: `exp-${index}`, entityType: "EXPERIENCE", label: `Lane ${index}`, x: index * 6, y: 0, z: 0 }
  )),
  lines3d: [],
  warnings: [],
});

it("TC-03-COLOR-001 derives distinguishable, related, AA-readable trunk and FACT colors", () => {
  const theme = getPatternById("classic").colors;
  const { trunkColorByPositionKey, factColorByPositionKey } = buildExperienceColorMaps(colorPayload(12), theme);
  expect(new Set(trunkColorByPositionKey.values()).size).toBe(12);
  for (const [key, trunkColor] of trunkColorByPositionKey) {
    const factColor = factColorByPositionKey.get(key);
    expect(factColor).not.toBe(trunkColor);
    expect(wcagContrast(trunkColor, theme.textBackgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(factColor, theme.textBackgroundColor)).toBeGreaterThanOrEqual(4.5);
  }
});

it("TC-03-COLOR-002 adjusts clashing hues up to AA contrast on a dark surface", () => {
  // A hostile theme whose anchors all sit on the dark background pulls every derived color
  // toward an unreadable clash; the maps must still return AA-contrast colors, never the surface.
  const theme = { textBackgroundColor: "#20232a", mainColor: "#20232a", textColor: "#20232a" };
  const { trunkColorByPositionKey, factColorByPositionKey } = buildExperienceColorMaps(colorPayload(6), theme);
  expect(trunkColorByPositionKey.size).toBe(6);
  for (const [key, trunkColor] of trunkColorByPositionKey) {
    const factColor = factColorByPositionKey.get(key);
    for (const color of [trunkColor, factColor]) {
      expect(color.toLowerCase()).not.toBe(theme.textBackgroundColor);
      expect(wcagContrast(color, theme.textBackgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
