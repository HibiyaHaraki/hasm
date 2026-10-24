import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

const api = await import("../src/features/hasm/api.js");
const { default: VisualizerPage } = await import("../src/pages/VisualizerPage.jsx");

afterEach(() => { cleanup(); invoke.mockReset(); });

describe("EVAL-03 Tauri IPC bridge contract", () => {
  it("TC-03-IPC-001 invokes compute_visualizer_layout with model and filter", () => {
    const model = { people: [], experiences: [], facts: [], links: [] };
    const filter = { timeScaleMode: "SequentialIndex", zScaleFactor: 1.7 };
    api.computeVisualizerLayout(model, filter);
    expect(invoke).toHaveBeenCalledWith("compute_visualizer_layout", { model, filter });
  });

  it("TC-03-IPC-002 sends GUI EXPERIENCE and Z scale changes through the real API to invoke", async () => {
    const model = {
      people: [{ personId: "person-1", personName: "Ada" }],
      experiences: [
        { experienceId: "exp-1", personId: "person-1", experienceName: "Research" },
        { experienceId: "exp-2", personId: "person-1", experienceName: "Teaching" },
      ],
      facts: [
        { factId: "fact-1", experienceIds: ["exp-1"], personIds: ["person-1"] },
        { factId: "fact-2", experienceIds: ["exp-2"], personIds: ["person-1"] },
      ],
      links: [],
    };
    invoke.mockResolvedValue({ nodes3d: [], lines3d: [], warnings: [] });
    render(React.createElement(MemoryRouter, {
      initialEntries: [{ pathname: "/visualizer", state: { model, path: "fixture.hasm", isVerified: true } }],
    }, React.createElement(VisualizerPage)));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("compute_visualizer_layout", expect.any(Object)));
    const select = screen.getByLabelText("EXPERIENCE scope");
    fireEvent.mouseDown(select.options[1], { button: 0 });
    fireEvent.change(screen.getByLabelText("Z scale"), { target: { value: "1.7" } });
    await waitFor(() => expect(invoke).toHaveBeenLastCalledWith("compute_visualizer_layout", {
      model: { ...model, experiences: [model.experiences[1]], facts: [model.facts[1]] },
      filter: { timeScaleMode: "SequentialIndex", zScaleFactor: 1.7 },
    }));
  });
});