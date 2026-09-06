import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import * as api from "../src/features/hasm/api";

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

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

describe("SEQ-03 visualizer lifecycle", () => {
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
});