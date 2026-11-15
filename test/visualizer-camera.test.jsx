import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import VisualizerPage from "../src/pages/VisualizerPage";
import { createCommitGraph } from "../src/hasm_visualizer/threeCommitGraph.js";
import { getPatternById } from "../src/hasm_color_pattern/src/index.js";
import ExperienceDistribution from "../src/hasm_visualizer/ExperienceDistribution.jsx";

const mocks = vi.hoisted(() => ({ cameras: [], invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() { this.domElement = document.createElement("canvas"); }
      setPixelRatio() {}
      setSize() {}
      render(_scene, camera) { mocks.cameras.push(camera); }
      dispose() {}
    },
  };
});

const payload = {
  nodes3d: [
    { id: "life", entityType: "EXPERIENCE", label: "Life", x: -180, y: 30, z: 0 },
    { id: "fact", entityType: "FACT", label: "Fact", x: 210, y: -70, z: 3500, isDirectFact: true },
  ],
  lines3d: [
    { id: "branch-life", lineType: "BRANCH", from: [-180, 30, 0], to: [-180, 30, 3500] },
    { id: "curve", lineType: "BRANCH_OUT", from: [-180, 30, 0], to: [210, -70, 3500], controlPoints: [[500, 300, 1800]] },
  ],
  warnings: [],
};
const theme = getPatternById("classic").colors;

function expectVisible(camera, points) {
  camera.updateMatrixWorld();
  points.forEach((point) => {
    const projected = new THREE.Vector3(...point).project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(1);
    expect(Math.abs(projected.y)).toBeLessThan(1);
    expect(projected.z).toBeGreaterThan(-1);
    expect(projected.z).toBeLessThan(1);
  });
}

function setupCanvas(width, height) {
  const widthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  const heightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillText() {} });
  return { widthSpy, heightSpy };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.cameras.length = 0;
});

it.each([[1000, 400], [320, 800]])("TC-03-CAMERA-001 fits large geometry in a %s x %s viewport and restores a saved camera", (width, height) => {
  const { widthSpy, heightSpy } = setupCanvas(width, height);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = createCommitGraph(container, payload, theme, vi.fn(), vi.fn());
  const camera = mocks.cameras.at(-1);
  expectVisible(camera, [...payload.lines3d.flatMap((line) => [line.from, line.to, ...(line.controlPoints || [])]), [-14.2, 0, 3500]]);
  const bottom = new THREE.Vector3(-180, 30, 0).project(camera);
  const top = new THREE.Vector3(-180, 30, 3500).project(camera);
  expect(top.y).toBeGreaterThan(bottom.y);
  if (width === 1000) expect(top.y - bottom.y).toBeGreaterThan(1.5);
  widthSpy.mockReturnValue(200);
  heightSpy.mockReturnValue(900);
  window.dispatchEvent(new Event("resize"));
  expectVisible(camera, payload.lines3d.flatMap((line) => [line.from, line.to, ...(line.controlPoints || [])]));
  const fittedPosition = camera.position.clone();
  container.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
  const navigatedPosition = camera.position.clone();
  expect(navigatedPosition.distanceTo(fittedPosition)).toBeGreaterThan(0.001);
  widthSpy.mockReturnValue(600);
  window.dispatchEvent(new Event("resize"));
  expect(camera.position.distanceTo(navigatedPosition)).toBeLessThan(0.001);
  const saved = dispose.getViewState();
  dispose();
  const restored = createCommitGraph(container, payload, theme, vi.fn(), vi.fn(), null, saved);
  expect(restored.getViewState().position.distanceTo(saved.position)).toBeLessThan(0.001);
  expect(restored.getViewState().target.distanceTo(saved.target)).toBeLessThan(0.001);
  expect(restored.getViewState().up.distanceTo(saved.up)).toBeLessThan(0.001);
  restored();
  container.remove();
});

it("TC-03-CAMERA-002 handles an empty graph without clipping or invalid camera values", () => {
  setupCanvas(320, 800);
  const container = document.createElement("div");
  const dispose = createCommitGraph(container, { nodes3d: [], lines3d: [] }, theme, vi.fn(), vi.fn());
  const camera = mocks.cameras.at(-1);
  expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
  dispose.setTopView();
  expectVisible(camera, [[0, 0, 0]]);
  dispose();
});

it("TC-03-CAMERA-003 switches the real IPC-backed 3D renderer to a fitted XY top view", async () => {
  setupCanvas(480, 700);
  mocks.invoke.mockImplementation(async (command) => {
    if (command === "compute_visualizer_layout") return payload;
    throw new Error(`Unexpected invoke: ${command}`);
  });
  const model = { people: [], experiences: [{ experienceId: "life", experienceName: "Life" }], facts: [], links: [] };
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <VisualizerPage />
  </MemoryRouter>);
  expect(screen.queryByRole("button", { name: "XY top view" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  const button = await screen.findByRole("button", { name: "XY top view" });
  await waitFor(() => expect(button).toBeEnabled());
  expect(mocks.invoke).toHaveBeenCalledWith("compute_visualizer_layout", expect.objectContaining({ model }));
  const camera = mocks.cameras.at(-1);
  fireEvent.click(button);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  expect(direction.x).toBeCloseTo(0, 5);
  expect(direction.y).toBeCloseTo(0, 5);
  expect(direction.z).toBeCloseTo(-1, 5);
  const xyOrigin = new THREE.Vector3(0, 0, 0).project(camera);
  expect(new THREE.Vector3(0, 10, 0).project(camera).y).toBeGreaterThan(xyOrigin.y);
  expect(new THREE.Vector3(10, 0, 0).project(camera).x).toBeGreaterThan(xyOrigin.x);
  expectVisible(camera, payload.lines3d.flatMap((line) => [line.from, line.to, ...(line.controlPoints || [])]));
  fireEvent.click(screen.getByRole("button", { name: "2D" }));
  expect(screen.queryByRole("button", { name: "XY top view" })).not.toBeInTheDocument();
});

it("TC-03-DISTRIBUTION-002 handles empty and unprojectable endpoints without showing FACTs", () => {
  const onSelect = vi.fn();
  const empty = { nodes3d: [], lines3d: [] };
  const model = { experiences: [], facts: [{ factId: "fact", experienceIds: [] }],
    links: [{ linkId: "link", relatedIds: ["fact", "missing"] }] };
  const { rerender } = render(<ExperienceDistribution payload={empty} model={model} theme={theme} onSelect={onSelect} onHover={vi.fn()} />);
  expect(screen.getByRole("group", { name: "EXPERIENCE distribution" })).toHaveAttribute("viewBox", "-9 -5 18 10");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  const experience = { id: "a", entityType: "EXPERIENCE", label: "A", x: 0, y: 0, z: 0 };
  rerender(<ExperienceDistribution payload={{ nodes3d: [experience], lines3d: [] }}
    model={{ ...model, links: [{ linkId: "link", relatedIds: ["fact", "a"] }] }}
    theme={theme} onSelect={onSelect} onHover={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Open EXPERIENCE: A" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Open LINK:/ })).not.toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});

function DistributionTicket() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  return <><p>{pathname}</p><p>{state.visualizerView.viewMode}</p>
    <button onClick={() => navigate("/visualizer", { state })}>Return to graph</button></>;
}

it("TC-03-DISTRIBUTION-001 projects FACT LINKs onto EXPERIENCEs through the real host IPC and retains navigation", async () => {
  setupCanvas(800, 600);
  const experiences = [
    { experienceId: "a", experienceName: "A", parentExperienceIds: [] },
    { experienceId: "b", experienceName: "B", parentExperienceIds: ["a"] },
    { experienceId: "c", experienceName: "C", parentExperienceIds: [] },
    { experienceId: "empty", experienceName: "Empty", parentExperienceIds: [] },
  ];
  const model = { people: [], experiences, facts: [
    { factId: "f1", experienceIds: ["a", "b"] },
    { factId: "f2", experienceIds: ["b", "c"] },
    { factId: "orphan", experienceIds: [] },
  ], links: [
    { linkId: "direct", linkName: "Direct", relatedIds: ["a", "b"] },
    { linkId: "projected", linkName: "Projected", relatedIds: ["f1", "f2", "f2"] },
    { linkId: "hidden", linkName: "Hidden", relatedIds: ["orphan", "a"] },
  ] };
  const graph = { nodes3d: [
    { id: "a", entityType: "EXPERIENCE", label: "A", x: 0, y: 0, z: 0 },
    { id: "b", entityType: "EXPERIENCE", label: "B", x: 6, y: 4, z: 0 },
    { id: "c", entityType: "EXPERIENCE", label: "C", x: 12, y: -4, z: 0 },
    { id: "empty", entityType: "EXPERIENCE", label: "Empty", x: 18, y: 0, z: 0 },
    { id: "f1", entityType: "FACT", label: "Hidden FACT", x: 0, y: 0, z: 5, isDirectFact: true },
  ], lines3d: [], warnings: [] };
  mocks.invoke.mockImplementation(async (command) => {
    if (command === "compute_visualizer_layout") return graph;
    throw new Error(`Unexpected invoke: ${command}`);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state: { path: "fixture.hasm", model, isVerified: true } }]}>
    <Routes><Route path="/visualizer" element={<VisualizerPage />} />
      <Route path="/entity-detail/:type/:id" element={<DistributionTicket />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "XY EXPERIENCE distribution" }));
  const svg = await screen.findByRole("group", { name: "EXPERIENCE distribution" });
  await waitFor(() => expect(within(svg).getAllByRole("button", { name: "Open LINK: Projected" })).toHaveLength(4));
  expect(within(svg).getAllByRole("button", { name: /^Open EXPERIENCE:/ })).toHaveLength(4);
  expect(within(svg).getByRole("button", { name: "Open EXPERIENCE: Empty" })).toBeInTheDocument();
  expect(within(svg).queryByText("Hidden FACT")).not.toBeInTheDocument();
  expect(within(svg).queryByRole("button", { name: "Open LINK: Hidden" })).not.toBeInTheDocument();
  expect(svg.querySelectorAll("line")).toHaveLength(1);
  const directPath = within(svg).getByRole("button", { name: "Open LINK: Direct" }).querySelector("path").getAttribute("d");
  const projectedPaths = within(svg).getAllByRole("button", { name: "Open LINK: Projected" })
    .map((item) => item.querySelector("path").getAttribute("d"));
  expect(new Set([directPath, ...projectedPaths]).size).toBe(5);
  expect(projectedPaths.some((path) => path.includes(" c "))).toBe(true);
  const bCircle = within(svg).getByRole("button", { name: "Open EXPERIENCE: B" }).querySelector("circle");
  expect(bCircle).toHaveAttribute("cx", "6");
  expect(bCircle).toHaveAttribute("cy", "-4");
  expect(mocks.invoke).toHaveBeenCalledWith("compute_visualizer_layout", expect.objectContaining({ model }));
  fireEvent.keyDown(within(svg).getAllByRole("button", { name: "Open LINK: Projected" })[0], { key: "Enter" });
  expect(await screen.findByText("/entity-detail/LINK/projected")).toBeInTheDocument();
  expect(screen.getByText("distribution")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Return to graph" }));
  expect(await screen.findByRole("button", { name: "XY EXPERIENCE distribution" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("button", { name: "Open EXPERIENCE: Empty" })).toBeInTheDocument();
});
