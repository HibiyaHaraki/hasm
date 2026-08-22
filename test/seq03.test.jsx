import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VisualizerPage from "../src/pages/VisualizerPage";
import * as api from "../src/features/hasm/api";

const { createCommitGraph, selectNode } = vi.hoisted(() => ({ createCommitGraph: vi.fn(() => () => {}), selectNode: vi.fn() }));
vi.mock("../src/features/hasm/api", () => ({
  computeVisualizerLayout: vi.fn(),
  createVisualizerDemoWorkspace: vi.fn(),
  subscribeToTauriEvent: vi.fn(),
}));
vi.mock("../src/features/visualizer/threeCommitGraph", () => ({ createCommitGraph: (...args) => { selectNode(args[3]); return createCommitGraph(...args); } }));

const model = { people: [{ personId: "person-1" }], experiences: [{ experienceId: "experience-1" }], facts: [{ factId: "fact-1" }], links: [] };
const payload = { nodes3d: [], lines3d: [], warnings: [] };

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
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
    expect(await screen.findByTestId("location")).toHaveTextContent("/entity-detail/FACT/fact-1");
  });
});