import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

const api = await import("../src/features/hasm/api.js");
const { default: VisualizerPage } = await import("../src/pages/VisualizerPage.jsx");
const { computeVisualizerLayoutJS } = await import("../src/hasm_visualizer/layoutCalculator.js");

afterEach(() => { cleanup(); invoke.mockReset(); vi.restoreAllMocks(); });

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

  it("TC-03-IPC-003 renders all six mixed-type IPC LINK segments in 2D and opens their shared ticket", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const height = this.tagName === "TH" || this.tagName === "TR" ? 36 : 400;
      return { left: 0, top: 0, right: 600, bottom: height, width: 600, height };
    });
    const model = {
      people: [{ personId: "person-1", personName: "Ada" }],
      experiences: [
        { experienceId: "exp-1", personId: "person-1", experienceName: "Research" },
        { experienceId: "exp-2", personId: "person-1", experienceName: "Teaching" },
      ],
      facts: [
        { factId: "fact-1", factName: "First", experienceIds: ["exp-1"], occurredAt: "2026-01-01" },
        { factId: "fact-2", factName: "Second", experienceIds: ["exp-2"], occurredAt: "2026-01-02" },
      ],
      links: [{ linkId: "link-1", relatedIds: ["person-1", "fact-1", "fact-2", "exp-1", "exp-2"] }],
    };
    invoke.mockResolvedValue({
      nodes3d: [
        { id: "exp-1", entityType: "EXPERIENCE", label: "Research", x: 0, y: 0, z: 0 },
        { id: "exp-2", entityType: "EXPERIENCE", label: "Teaching", x: 6, y: 4, z: 0 },
        { id: "fact-1", entityType: "FACT", label: "First", x: 0, y: 0, z: 3, isDirectFact: true, linkedEntityIds: ["fact-2"] },
        { id: "fact-2", entityType: "FACT", label: "Second", x: 6, y: 4, z: 6, isDirectFact: true, linkedEntityIds: ["fact-1"] },
      ],
      lines3d: [
        { id: "branch-exp-1", lineType: "BRANCH", from: [0, 0, 3], to: [0, 0, 6] },
        { id: "branch-exp-2", lineType: "BRANCH", from: [6, 4, 3], to: [6, 4, 6] },
        ...[
          ["fact-1", "fact-2"], ["fact-1", "exp-1"], ["fact-1", "exp-2"],
          ["fact-2", "exp-1"], ["fact-2", "exp-2"], ["exp-1", "exp-2"],
        ].map(([fromId, toId]) => ({
          id: "link-1", lineType: "LINK", fromId, toId,
        })),
      ],
      warnings: [],
    });
    const { container } = render(React.createElement(MemoryRouter, {
      initialEntries: [{ pathname: "/visualizer", state: { model, path: "fixture.hasm", isVerified: true } }],
    }, React.createElement(Routes, null,
      React.createElement(Route, { path: "/visualizer", element: React.createElement(VisualizerPage) }),
      React.createElement(Route, { path: "/entity-detail/LINK/link-1", element: React.createElement("p", null, "LINK ticket opened") }),
    )));
    await waitFor(() => expect(container.querySelector('path[stroke-dasharray]')).not.toBeNull());
    const line = container.querySelector('path[stroke-dasharray]');
    const segments = [...container.querySelectorAll('path[stroke-dasharray]')];
    expect(segments).toHaveLength(6);
    for (const segment of segments) {
      expect(segment.style.display).not.toBe("none");
      expect(segment.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
      fireEvent.pointerEnter(segment);
      expect(segment.getAttribute("opacity")).toBe("1");
      fireEvent.pointerLeave(segment);
    }
    expect(line.style.display).not.toBe("none");
    expect(line.getAttribute("stroke-dasharray")).toBe("6 5");
    expect(line.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    const [, fromX, fromY, , toX, toY] = line.getAttribute("d").split(" ");
    expect([fromX, fromY]).not.toEqual([toX, toY]);
    fireEvent.pointerEnter(container.querySelector("circle"));
    expect(line.getAttribute("opacity")).toBe("1");
    fireEvent.pointerLeave(container.querySelector("circle"));
    expect(line.getAttribute("opacity")).toBe("0.7");
    fireEvent.click(segments[5]);
    expect(await screen.findByText("LINK ticket opened")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("compute_visualizer_layout", expect.objectContaining({ model }));
  });

  it("TC-03-IPC-005 switches real 2D time axes through invoke, aligns simultaneous FACTs, and restores sequential rows", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => (
      { left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 }
    ));
    const model = {
      people: [],
      experiences: [
        { experienceId: "parent", name: "Parent" },
        { experienceId: "child", name: "Child", parentExperienceIds: ["parent"] },
      ],
      // Deliberately unsorted, with simultaneous events and an ancestor reflection.
      facts: [
        { factId: "latest", name: "Latest", experienceIds: ["child"], occurredAt: "2026-11-01" },
        { factId: "early", name: "Early", experienceIds: ["parent"], occurredAt: "2026-01-01" },
        { factId: "middle", name: "Middle", experienceIds: ["child"], occurredAt: "2026-03-01" },
        { factId: "same", name: "Same time", experienceIds: ["parent"], occurredAt: "2026-03-01" },
      ],
      links: [{ linkId: "ff", relatedIds: ["early", "latest"] }],
    };
    invoke.mockImplementation((command, args) => {
      expect(command).toBe("compute_visualizer_layout");
      return Promise.resolve(computeVisualizerLayoutJS(args.model, args.filter));
    });
    const { container } = render(React.createElement(MemoryRouter, {
      initialEntries: [{ pathname: "/visualizer", state: { model, path: "fixture.hasm", isVerified: true } }],
    }, React.createElement(Routes, null,
      React.createElement(Route, { path: "/visualizer", element: React.createElement(VisualizerPage) }),
      React.createElement(Route, { path: "/entity-detail/FACT/latest", element: React.createElement("p", null, "FACT ticket opened") }),
    )));
    const graph = () => container.querySelector(".HasmVisualizer_GraphPane2D");
    const circles = () => [...graph().querySelectorAll("circle")];
    await waitFor(() => expect(circles()).toHaveLength(6));
    const sequentialYs = circles().map((circle) => circle.getAttribute("cy"));
    expect(container.querySelector("table")).not.toBeNull();
    expect(new Set(sequentialYs).size).toBe(4);
    for (const mode of ["Linear", "Logarithmic"]) {
      fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: mode } });
      await waitFor(() => expect(graph().textContent).toContain(`Time (${mode})`));
      expect(container.querySelector("table")).toBeNull();
      expect(invoke).toHaveBeenLastCalledWith("compute_visualizer_layout", {
        model, filter: { timeScaleMode: mode, zScaleFactor: 1 },
      });
      const payload = computeVisualizerLayoutJS(model, { timeScaleMode: mode, zScaleFactor: 1 });
      const facts = payload.nodes3d.filter((node) => node.entityType === "FACT");
      const ys = new Map(facts.map((node, index) => [node.id, Number(circles()[index].getAttribute("cy"))]));
      expect(ys.get("same")).toBe(ys.get("middle"));
      expect(ys.get("latest")).toBeLessThan(ys.get("middle"));
      expect(ys.get("middle")).toBeLessThan(ys.get("early"));
      // Preserve actual linear/logarithmic distances, not just chronological order.
      const zs = new Map(facts.map((node) => [node.id, node.z]));
      expect((ys.get("early") - ys.get("middle")) / (ys.get("early") - ys.get("latest")))
        .toBeCloseTo((zs.get("middle") - zs.get("early")) / (zs.get("latest") - zs.get("early")));
      expect(new Set(facts.filter((node) => node.id === "middle").map((node) => (
        circles()[facts.indexOf(node)].getAttribute("cy")
      ))).size).toBe(1);
      const labels = [...graph().querySelectorAll("text")];
      for (const node of facts) {
        const label = labels.find((element) => element.textContent === model.facts.find((fact) => fact.factId === node.id).occurredAt);
        expect(Number(label.getAttribute("y"))).toBe(ys.get(node.id));
      }
      const earlyCircle = circles()[facts.findIndex((node) => node.id === "early")];
      fireEvent.pointerEnter(earlyCircle, { clientX: 100, clientY: 100 });
      expect(container.querySelector(".HasmVisualizer_Tooltip")).toHaveTextContent("[FACT] Early");
      expect(container.querySelector(".HasmVisualizer_Tooltip")).toHaveTextContent("2026-01-01");
      fireEvent.pointerLeave(earlyCircle);
      expect(container.querySelector(".HasmVisualizer_Tooltip")).toBeNull();
      const link = graph().querySelector("path[stroke-dasharray]");
      expect(link.getAttribute("d")).toContain(String(ys.get("early")));
      const branches = [...graph().querySelectorAll('path:not([stroke-dasharray])')].slice(0, 2);
      for (const branch of branches) {
        const [, , firstY, , , lastY] = branch.getAttribute("d").split(" ");
        expect([ys.get("early"), ys.get("middle")]).toContain(Number(firstY));
        expect(Number(lastY)).toBe(ys.get("latest"));
      }
      const before = graph().querySelector("svg").parentElement.style.transform;
      graph().scrollTop = 100;
      fireEvent.scroll(graph());
      expect(graph().querySelector("svg").parentElement.style.transform).toBe(before);
      expect(graph().lastElementChild.style.top).toBe("100px");
      expect(graph().style.overflowY).toBe("auto");
    }
    fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "SequentialIndex" } });
    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    await waitFor(() => expect(circles().map((circle) => circle.getAttribute("cy"))).toEqual(sequentialYs));
    expect(graph().querySelector("text")).toBeNull();
    fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "Linear" } });
    await waitFor(() => expect(graph().textContent).toContain("Time (Linear)"));
    const linearYs = circles().map((circle) => circle.getAttribute("cy"));
    invoke.mockRejectedValueOnce(new Error("Layout calculation stalled"));
    fireEvent.change(screen.getByLabelText("Time scale"), { target: { value: "SequentialIndex" } });
    expect(await screen.findByText("Filter update timed out. Reverting view.")).toBeInTheDocument();
    expect(container.querySelector("table")).toBeNull();
    expect(graph().textContent).toContain("Time (Linear)");
    expect(circles().map((circle) => circle.getAttribute("cy"))).toEqual(linearYs);
    const latestIndex = computeVisualizerLayoutJS(model, { timeScaleMode: "Linear" }).nodes3d
      .filter((node) => node.entityType === "FACT").findIndex((node) => node.id === "latest");
    fireEvent.click(circles()[latestIndex]);
    expect(await screen.findByText("FACT ticket opened")).toBeInTheDocument();
  });
});