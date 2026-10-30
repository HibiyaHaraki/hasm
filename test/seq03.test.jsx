import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import * as api from "../src/features/hasm/api";
import { computeVisualizerLayoutJS } from "../src/hasm_visualizer/layoutCalculator.js";
import { graphWidthForLaneCount, ROW_HEIGHT_PX, TABLE_HEADER_HEIGHT_PX } from "../src/hasm_visualizer/graph2DLayout.js";

const { createCommitGraph, selectNode } = vi.hoisted(() => ({ createCommitGraph: vi.fn(() => () => {}), selectNode: vi.fn() }));
vi.mock("../src/features/hasm/api", () => ({
  computeVisualizerLayout: vi.fn(),
  createVisualizerDemoWorkspace: vi.fn(),
  createPerson: vi.fn(),
  createExperience: vi.fn(),
  createFact: vi.fn(),
  createLink: vi.fn(),
  loadHasmModelDb: vi.fn(),
  switchWorkspaceCleanly: vi.fn(),
  subscribeToTauriEvent: vi.fn(),
}));
vi.mock("../src/hasm_visualizer/threeCommitGraph.js", async () => {
  const actual = await vi.importActual("../src/hasm_visualizer/threeCommitGraph.js");
  return { ...actual, createCommitGraph: (...args) => { selectNode(args[3]); return createCommitGraph(...args); } };
});

const model = { people: [{ personId: "person-1" }], experiences: [{ experienceId: "experience-1" }], facts: [{ factId: "fact-1" }], links: [] };
const payload = { nodes3d: [], lines3d: [], warnings: [] };

const scopeFixtureModel = {
  people: [
    { personId: "person-1", personName: "Ada" },
    { personId: "person-2", personName: "Bob" },
  ],
  experiences: [
    { experienceId: "exp-1", personId: "person-1", experienceName: "Research", parentExperienceIds: [] },
    { experienceId: "exp-2", personId: "person-2", experienceName: "Teaching", parentExperienceIds: [] },
  ],
  facts: [
    { factId: "fact-1", factName: "Paper", experienceIds: ["exp-1"], personIds: ["person-1"] },
    { factId: "fact-2", factName: "Lecture", experienceIds: ["exp-2"], personIds: ["person-2"] },
  ],
  links: [],
};

function largeFixtureModel(entityCount) {
  const perType = Math.ceil(entityCount / 3);
  return {
    people: Array.from({ length: perType }, (_value, index) => ({ personId: `person-${index}`, personName: `Person ${index}` })),
    experiences: Array.from({ length: perType }, (_value, index) => ({ experienceId: `exp-${index}`, personId: `person-${index}`, experienceName: `Experience ${index}`, parentExperienceIds: [] })),
    facts: Array.from({ length: perType }, (_value, index) => ({ factId: `fact-${index}`, factName: `Fact ${index}`, experienceIds: [`exp-${index}`], personIds: [`person-${index}`] })),
    links: [],
  };
}

// jsdom multi-selects are not driven by fireEvent.change's `target.value`, so the option
// selection state is set directly before the change event is dispatched.
function selectOptions(select, values) {
  Array.from(select.options).forEach((option) => { option.selected = values.includes(option.value); });
  fireEvent.change(select);
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.state?.model ? ":model" : ""}</output>;
}

function renderVisualizer(state = { model, path: "C:/fixture.hasm", isVerified: true }) {
  return render(<MemoryRouter initialEntries={[{ pathname: "/visualizer", state }]}><Routes><Route path="/visualizer" element={<VisualizerPage />} /><Route path="/entity-detail/:entityType/:entityId" element={<LocationProbe />} /><Route path="/select" element={<LocationProbe />} /><Route path="/loading-model" element={<LocationProbe />} /><Route path="/error-model" element={<LocationProbe />} /></Routes></MemoryRouter>);
}

function switchTo3D() {
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

describe("SEQ-03 visualizer lifecycle", () => {
  it("TC-03-REACT-TOOLBAR-001 keeps scope lists collapsed and preserves selection across dismissal", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    renderVisualizer({ model: scopeFixtureModel, path: "C:/fixture.hasm", isVerified: true });
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalledTimes(1));
    const toolbar = screen.getByRole("region", { name: "Graph controls" });
    const scopeButton = within(toolbar).getByRole("button", { name: /^Scope:/ });
    expect(scopeButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    expect(within(toolbar).getByLabelText("Time scale")).toBeVisible();
    expect(within(toolbar).getByLabelText("Z scale")).toBeVisible();
    fireEvent.click(scopeButton);
    const panel = screen.getByRole("region", { name: "Scope selection" });
    expect(panel).toBeVisible();
    expect(scopeButton).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getAllByRole("listbox")).toHaveLength(2);
    selectOptions(within(panel).getByLabelText("EXPERIENCE scope"), ["exp-2"]);
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(scopeButton).toHaveFocus();
    expect(scopeButton).toHaveAttribute("aria-expanded", "false");
    expect(scopeButton).toHaveTextContent("1 selected");
    fireEvent.click(scopeButton);
    expect(within(screen.getByRole("region", { name: "Scope selection" })).getByLabelText("EXPERIENCE scope")).toHaveValue(["exp-2"]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(scopeButton).toHaveFocus();
    fireEvent.click(scopeButton);
    fireEvent.pointerDown(screen.getByRole("heading", { name: "Commit graph" }));
    expect(scopeButton).toHaveAttribute("aria-expanded", "false");
    expect(api.computeVisualizerLayout).toHaveBeenCalledTimes(2);
  });

  it("TC-03-REACT-001 renders streamed layout progress and initializes the scene", async () => {
    let progressHandler;
    let resolveLayout;
    api.subscribeToTauriEvent.mockImplementation((_event, handler) => { progressHandler = handler; return Promise.resolve(() => {}); });
    api.computeVisualizerLayout.mockReturnValue(new Promise((resolve) => { resolveLayout = resolve; }));
    renderVisualizer();
    await vi.waitFor(() => expect(progressHandler).toBeTypeOf("function"));
    await act(async () => progressHandler({ payload: { percentage: 40, message: "Positioning EXPERIENCE..." } }));
    expect(screen.getByText("Positioning EXPERIENCE...")).toBeInTheDocument();
    await act(async () => resolveLayout(payload));
    switchTo3D();
    await vi.waitFor(() => expect(createCommitGraph).toHaveBeenCalled());
  });

  it("TC-03-REACT-002 routes a stalled layout to the model error page", async () => {
    vi.useFakeTimers();
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockReturnValue(new Promise(() => {}));
    renderVisualizer();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByTestId("location")).toHaveTextContent("/error-model");
  });

  it("TC-03-REACT-003 retains the scene and shows a filter timeout notice", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValueOnce(payload).mockRejectedValueOnce(new Error("Layout calculation stalled"));
    renderVisualizer();
    switchTo3D();
    await vi.waitFor(() => expect(createCommitGraph).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "SequentialIndex" } });
    expect(await screen.findByText("Filter update timed out. Reverting view.")).toBeInTheDocument();
    expect(createCommitGraph).toHaveBeenCalledTimes(1);
  });

  it("TC-03-REACT-004 displays render warnings", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue({ ...payload, warnings: ["Unreferenced folder detected"] });
    renderVisualizer();
    expect(await screen.findByText("Unreferenced folder detected")).toBeInTheDocument();
  });

  it("TC-03-E2E-002 and TC-03-E2E-003 route missing and unverified models safely", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    renderVisualizer({ model: null });
    expect(await screen.findByTestId("location")).toHaveTextContent("/select");
    cleanup();
    renderVisualizer({ model, path: "C:/fixture.hasm", isVerified: false });
    expect(await screen.findByTestId("location")).toHaveTextContent("/loading-model");
  });

  it("TC-04-E2E-001 navigates a visualizer node to its entity ticket", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {}); api.computeVisualizerLayout.mockResolvedValue(payload); renderVisualizer();
    switchTo3D();
    await vi.waitFor(() => expect(selectNode).toHaveBeenCalled()); selectNode.mock.calls.at(-1)[0]({ entityType: "FACT", id: "fact-1" });
    expect(await screen.findByTestId("location")).toHaveTextContent("/entity-detail/FACT/fact-1:model");
  });

  it("TC-03-REACT-SCOPE-001 narrows the laid-out model to the selected PERSON scope", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    renderVisualizer({ model: scopeFixtureModel, path: "C:/fixture.hasm", isVerified: true });
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalled());
    expect(api.computeVisualizerLayout.mock.calls.at(-1)[0].facts).toHaveLength(2);

    selectOptions(screen.getByLabelText("PERSON scope"), ["person-1"]);

    await vi.waitFor(() => {
      const scoped = api.computeVisualizerLayout.mock.calls.at(-1)[0];
      expect(scoped.people.map((person) => person.personId)).toEqual(["person-1"]);
      expect(scoped.experiences.map((experience) => experience.experienceId)).toEqual(["exp-1"]);
      expect(scoped.facts.map((fact) => fact.factId)).toEqual(["fact-1"]);
    });
    expect(screen.getByText("3 of 6 entities")).toBeInTheDocument();
  });

  it("TC-03-REACT-SCOPE-002 narrows further to a selected EXPERIENCE within the PERSON scope", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    renderVisualizer({ model: scopeFixtureModel, path: "C:/fixture.hasm", isVerified: true });
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalled());

    selectOptions(screen.getByLabelText("EXPERIENCE scope"), ["exp-2"]);

    await vi.waitFor(() => {
      const scoped = api.computeVisualizerLayout.mock.calls.at(-1)[0];
      expect(scoped.experiences.map((experience) => experience.experienceId)).toEqual(["exp-2"]);
      expect(scoped.facts.map((fact) => fact.factId)).toEqual(["fact-2"]);
    });
  });

  it("TC-03-REACT-SCOPE-003 refuses to lay out a large package until a scope is chosen", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    renderVisualizer({ model: largeFixtureModel(2400), path: "C:/fixture.hasm", isVerified: true });

    expect(await screen.findByText(/Select a PERSON or EXPERIENCE scope/)).toBeInTheDocument();
    expect(api.computeVisualizerLayout).not.toHaveBeenCalled();

    selectOptions(screen.getByLabelText("PERSON scope"), ["person-0"]);

    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalled());
  });

  it("TC-03-REACT-SCOPE-004 hides PERSON selection for a single PERSON", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    renderVisualizer();
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalled());
    expect(screen.queryByLabelText("PERSON scope")).not.toBeInTheDocument();
    expect(screen.getByLabelText("EXPERIENCE scope")).toBeInTheDocument();
  });

  it("TC-03-REACT-SCOPE-005 toggles EXPERIENCEs by plain click within a PERSON scope", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue(payload);
    const scopedFixture = {
      ...scopeFixtureModel,
      experiences: scopeFixtureModel.experiences.map((experience) => ({ ...experience, personId: "person-1" })),
      facts: scopeFixtureModel.facts.map((fact) => ({ ...fact, personIds: ["person-1"] })),
    };
    renderVisualizer({ model: scopedFixture, path: "C:/fixture.hasm", isVerified: true });
    await vi.waitFor(() => expect(api.computeVisualizerLayout).toHaveBeenCalled());
    selectOptions(screen.getByLabelText("PERSON scope"), ["person-1"]);
    const select = screen.getByLabelText("EXPERIENCE scope");
    fireEvent.mouseDown(select.options[1], { button: 0 });
    await vi.waitFor(() => expect(api.computeVisualizerLayout.mock.calls.at(-1)[0].facts.map((fact) => fact.factId)).toEqual(["fact-2"]));
    fireEvent.mouseDown(select.options[0], { button: 0 });
    await vi.waitFor(() => expect(api.computeVisualizerLayout.mock.calls.at(-1)[0].facts).toHaveLength(2));
    fireEvent.mouseDown(select.options[1], { button: 0 });
    await vi.waitFor(() => expect(api.computeVisualizerLayout.mock.calls.at(-1)[0].facts.map((fact) => fact.factId)).toEqual(["fact-1"]));
  });

  it("TC-03-REACT-2D-001 sizes the graph from lane count after EXPERIENCE selection", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    api.computeVisualizerLayout.mockResolvedValue({
      ...payload,
      nodes3d: [
        { id: "exp-1", entityType: "EXPERIENCE", x: 0, y: 0, z: 0 },
        { id: "exp-2", entityType: "EXPERIENCE", x: 0, y: 4, z: 0 },
      ],
    });
    const { container } = renderVisualizer({ model: scopeFixtureModel, path: "C:/fixture.hasm", isVerified: true });
    const graph = container.querySelector(".HasmVisualizer_GraphPane2D");
    await vi.waitFor(() => expect(graph.style.width).toBe(`${graphWidthForLaneCount(2)}px`));
    await vi.waitFor(() => expect(graph.querySelector("svg")?.getAttribute("width")).toBe(String(graphWidthForLaneCount(2))));
    api.computeVisualizerLayout.mockResolvedValue({
      ...payload,
      nodes3d: [{ id: "exp-2", entityType: "EXPERIENCE", x: 0, y: 4, z: 0 }],
    });
    selectOptions(screen.getByLabelText("EXPERIENCE scope"), ["exp-2"]);
    await vi.waitFor(() => expect(graph.style.width).toBe(`${graphWidthForLaneCount(1)}px`));
    await vi.waitFor(() => expect(graph.querySelector("svg")?.getAttribute("width")).toBe(String(graphWidthForLaneCount(1))));
  });

  it("TC-03-REACT-2D-002 applies Z scale to both SVG FACT spacing and table row height", async () => {
    api.subscribeToTauriEvent.mockResolvedValue(() => {});
    const graphPayload = {
      ...payload,
      nodes3d: [
        { id: "exp-1", entityType: "EXPERIENCE", label: "Research", x: 0, y: 0, z: 0 },
        { id: "fact-1", entityType: "FACT", label: "Paper", x: 0, y: 0, z: 1, isDirectFact: true },
        { id: "fact-2", entityType: "FACT", label: "Lecture", x: 0, y: 0, z: 2, isDirectFact: true },
      ],
    };
    api.computeVisualizerLayout.mockResolvedValue(graphPayload);
    const { container } = renderVisualizer();
    const split = container.querySelector(".HasmVisualizer_Split2D");
    const circles = () => Array.from(container.querySelectorAll("circle")).map((circle) => Number(circle.getAttribute("cy")));
    await vi.waitFor(() => expect(circles()).toEqual([TABLE_HEADER_HEIGHT_PX + 45, TABLE_HEADER_HEIGHT_PX + 15]));
    for (const scale of [2, 0.5]) {
      fireEvent.change(screen.getByLabelText("Z scale"), { target: { value: String(scale) } });
      await vi.waitFor(() => {
        expect(api.computeVisualizerLayout.mock.calls.at(-1)[1].zScaleFactor).toBe(scale);
        expect(split.style.getPropertyValue("--HasmVisualizer-row-height")).toBe(`${ROW_HEIGHT_PX * scale}px`);
        expect(circles()).toEqual([TABLE_HEADER_HEIGHT_PX + 45 * scale, TABLE_HEADER_HEIGHT_PX + 15 * scale]);
      });
    }
    api.computeVisualizerLayout.mockRejectedValueOnce(new Error("Layout calculation stalled"));
    fireEvent.change(screen.getByLabelText("Z scale"), { target: { value: "1.7" } });
    expect(await screen.findByText("Filter update timed out. Reverting view.")).toBeInTheDocument();
    expect(split.style.getPropertyValue("--HasmVisualizer-row-height")).toBe("15px");
    expect(circles()).toEqual([TABLE_HEADER_HEIGHT_PX + 22.5, TABLE_HEADER_HEIGHT_PX + 7.5]);
    switchTo3D();
    await vi.waitFor(() => expect(createCommitGraph).toHaveBeenCalled());
  });
});

describe("SEQ-03 Z scale geometry", () => {
  it("TC-03-ZSCALE-001 scales layout Z coordinates in every time mode", () => {
    const model = {
      people: [],
      experiences: [{ experience_id: "exp-1" }],
      facts: [
        { fact_id: "fact-1", experience_ids: ["exp-1"], occurred_at: "2024-01-01" },
        { fact_id: "fact-2", experience_ids: ["exp-1"], occurred_at: "2024-02-01" },
      ],
      links: [],
    };
    for (const timeScaleMode of ["Linear", "Logarithmic", "SequentialIndex"]) {
      const base = computeVisualizerLayoutJS(model, { timeScaleMode, zScaleFactor: 1 });
      for (const zScaleFactor of [0.5, 2]) {
        const scaled = computeVisualizerLayoutJS(model, { timeScaleMode, zScaleFactor });
        const fact = scaled.nodes3d.find((node) => node.id === "fact-2");
        expect(fact.z).toBeGreaterThan(0);
        expect(fact.z).toBeCloseTo(base.nodes3d.find((node) => node.id === fact.id).z * zScaleFactor);
      }
    }
  });
});