import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const api = await import("../src/features/hasm/api.js");

describe("EVAL-03 Tauri IPC bridge contract", () => {
  it("TC-03-IPC-001 invokes compute_visualizer_layout with model and filter", () => {
    const model = { people: [], experiences: [], facts: [], links: [] };
    const filter = { timeScaleMode: "SequentialIndex", zScaleFactor: 1 };
    api.computeVisualizerLayout(model, filter);
    expect(invoke).toHaveBeenCalledWith("compute_visualizer_layout", { model, filter });
  });
});