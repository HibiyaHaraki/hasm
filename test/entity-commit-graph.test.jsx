import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import { extractEntityGraphModel } from "../src/features/entityTicket/entityGraphModel";
import { computeVisualizerLayoutJS } from "../src/hasm_visualizer/layoutCalculator.js";
import * as graphRenderer from "../src/hasm_visualizer/twoCommitGraph.js";
import { DEFAULT_COLOR_PATTERN, getPatternById } from "../src/hasm_color_pattern/src/index.js";
import { ensureReadableColor } from "../src/hasm_visualizer/threeCommitGraph.js";

const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const experience = (id, parents = [], owner = "p") => ({
  experienceId: id, experienceName: id, parentExperienceIds: parents, personId: owner,
});
const fact = (id, date, experienceIds) => ({
  factId: id, factName: id, occurredAt: date, experienceIds, personIds: ["p"], linkIds: [],
});
const model = {
  people: [{ personId: "p", personName: "Person", lifeExperienceId: "root" }, { personId: "other", personName: "Other" }],
  experiences: [
    experience("root"), experience("child", ["root"]), experience("leaf", ["child"], "other"),
    experience("shared", [], "other"), experience("linked", [], "other"), experience("unrelated", [], "other"),
  ],
  facts: [
    fact("old", "2026-01-01", ["leaf"]), fact("before", "2026-01-02", ["leaf"]),
    fact("focus", "2026-01-03", ["leaf", "shared"]), fact("after", "2026-01-04", ["leaf"]),
    fact("late", "2026-01-05", ["leaf"]), fact("linked-fact", "2026-01-06", ["linked"]),
    fact("unrelated-fact", "2026-01-07", ["unrelated"]),
  ],
  links: [
    { linkId: "incoming", linkName: "Incoming", relatedIds: ["linked-fact", "focus"] },
    { linkId: "outgoing", linkName: "Outgoing", relatedIds: ["focus", "linked"] },
    { linkId: "exp-link", linkName: "Experience link", relatedIds: ["child", "linked-fact"] },
    { linkId: "unrelated-link", relatedIds: ["linked-fact", "unrelated-fact"] },
  ],
};
const ids = (entities, type) => entities.map((entity) => entity[`${type}Id`]).sort();
const detailFor = (type, id) => {
  const collection = { PERSON: "people", EXPERIENCE: "experiences", FACT: "facts", LINK: "links" }[type];
  return model[collection].find((entity) => entity[`${type.toLowerCase()}Id`] === id);
};
function renderTicket(type = "FACT", id = "focus", state = { path: "fixture.hasm", model, isVerified: true }) {
  return render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${type}/${id}`, state }]}>
    <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes>
  </MemoryRouter>);
}
beforeEach(() => {
  bridge.invoke.mockImplementation(async (command, args) => {
    if (command === "compute_visualizer_layout") {
      const payload = computeVisualizerLayoutJS(args.model, args.filter);
      for (const node of payload.nodes3d) node.label = node.id;
      return payload;
    }
    if (command === "load_entity_detail" || command === "reload_entity_markdown") {
      const detail = detailFor(args.entityType, args.entityId);
      return { name: detail[`${args.entityType.toLowerCase()}Name`], detail, markdownBody: "# Ticket", loadedMtimeMs: 1 };
    }
    if (command.startsWith("save_")) return undefined;
    throw new Error(`Unexpected command: ${command}`);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.useRealTimers(); });

describe("Entity graph extraction", () => {
  it("TC-04-GRAPH-001 extracts FACT branches, reflections, adjacent events and incoming/outgoing LINK endpoints only", () => {
    const snapshot = JSON.stringify(model);
    const result = extractEntityGraphModel(model, "FACT", "focus", detailFor("FACT", "focus"));
    expect(ids(result.experiences, "experience")).toEqual(["child", "leaf", "linked", "root", "shared"]);
    expect(ids(result.facts, "fact")).toEqual(["after", "before", "focus", "linked-fact"]);
    expect(ids(result.links, "link")).toEqual(["incoming", "outgoing"]);
    const payload = computeVisualizerLayoutJS(result, { timeScaleMode: "SequentialIndex" });
    expect(payload.nodes3d.filter((node) => node.id === "focus" && node.isDirectFact)).toHaveLength(2);
    expect(payload.nodes3d.filter((node) => node.id === "focus" && !node.isDirectFact)).toHaveLength(2);
    expect(JSON.stringify(model)).toBe(snapshot);
  });
  it("TC-04-GRAPH-002 extracts EXPERIENCE facts, immediate children, ancestors and linked entities", () => {
    const result = extractEntityGraphModel(model, "EXPERIENCE", "child", detailFor("EXPERIENCE", "child"));
    expect(ids(result.experiences, "experience")).toEqual(["child", "leaf", "linked", "root"]);
    expect(ids(result.links, "link")).toEqual(["exp-link"]);
    expect(ids(result.facts, "fact")).toEqual(["late", "linked-fact"]);
  });
  it("TC-04-GRAPH-003 extracts LINK endpoints and all FACT placements without unrelated LINK expansion", () => {
    const result = extractEntityGraphModel(model, "LINK", "incoming", detailFor("LINK", "incoming"));
    expect(ids(result.facts, "fact")).toEqual(["focus", "linked-fact"]);
    expect(ids(result.experiences, "experience")).toEqual(["child", "leaf", "linked", "root", "shared"]);
    expect(ids(result.links, "link")).toEqual(["incoming"]);
  });
  it("TC-04-GRAPH-004 extracts owned EXPERIENCEs and all descendant EXPERIENCEs even with a different owner", () => {
    const result = extractEntityGraphModel(model, "PERSON", "p", detailFor("PERSON", "p"));
    expect(ids(result.experiences, "experience")).toEqual(["child", "leaf", "root", "shared"]);
    expect(ids(result.facts, "fact")).toEqual(["after", "before", "focus", "late", "old"]);
    expect(result.links).toEqual([]);
  });
  it("TC-04-GRAPH-005 terminates on cycles, ignores missing references and handles absent models", () => {
    const cyclic = { ...model, experiences: [experience("root", ["child", "missing"]), experience("child", ["root"])] };
    expect(ids(extractEntityGraphModel(cyclic, "PERSON", "p", detailFor("PERSON", "p")).experiences, "experience")).toEqual(["child", "root"]);
    expect(extractEntityGraphModel(null, "FACT", "focus", {})).toBeNull();
  });
  it("TC-04-GRAPH-006 uses deterministic UUID ordering for simultaneous neighbors and current metadata", () => {
    const sameTime = { ...model, facts: ["c", "a", "b"].map((id) => fact(id, "2026-01-01", ["leaf"])) };
    const result = extractEntityGraphModel(sameTime, "FACT", "b", { experienceIds: ["leaf"], factName: "Edited" });
    expect(ids(result.facts, "fact")).toEqual(["a", "b", "c"]);
    expect(result.facts.find((entity) => entity.factId === "b")).toMatchObject({ factName: "Edited", occurredAt: "2026-01-01" });
  });
});

describe("Entity graph GUI and real IPC wrapper", () => {
  it("TC-04-GRAPH-SEQUENTIAL-001 aligns unique newest-first FACT rows and bolds only the addressed FACT title", async () => {
    const rendererSpy = vi.spyOn(graphRenderer, "createCommitGraph2D");
    renderTicket();
    const table = await screen.findByRole("table", { name: "FACT titles" });
    await waitFor(() => expect(table.querySelectorAll("tbody tr")).toHaveLength(4));
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows.map((row) => row.cells[0].querySelector('a[href*="/FACT/"]').textContent)).toEqual(["linked-fact", "after", "focus", "before"]);
    expect(table.querySelectorAll("strong")).toHaveLength(1);
    expect(table.querySelector("strong")).toHaveTextContent("focus");
    expect(table.querySelector(".HasmVisualizer_ExperienceBadge")).toHaveClass("HasmVisualizer_ExperienceBadgeInline");
    expect(table.querySelector(".HasmVisualizer_ExperienceBadge").nextSibling.textContent).toBe(" ");
    expect(table.querySelector('a[aria-current="page"]')).toHaveAttribute("href", "/entity-detail/FACT/focus");
    expect(rendererSpy.mock.calls.at(-1)[7]).toMatchObject({
      timeScaleMode: "SequentialIndex", rowHeightPx: 30, headerHeightPx: 37,
    });
    const viewport = table.parentElement;
    const renderer = rendererSpy.mock.results.at(-1).value;
    const setScrollTop = vi.spyOn(renderer, "setScrollTop");
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 300 },
    });
    fireEvent.scroll(viewport, { target: { scrollTop: 60 } });
    expect(setScrollTop).toHaveBeenLastCalledWith(60);
    fireEvent.wheel(screen.getByRole("group", { name: "Extended commit graph" }), { deltaY: 45 });
    expect(viewport.scrollTop).toBe(105);
    expect(setScrollTop).toHaveBeenLastCalledWith(105);
    fireEvent.wheel(screen.getByRole("group", { name: "Extended commit graph" }), { deltaY: 1000 });
    expect(viewport.scrollTop).toBe(300);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
    expect(screen.getByRole("table", { name: "FACTのタイトル" }).querySelector("strong")).toHaveTextContent("focus");
    fireEvent.click(screen.getByRole("button", { name: "概要を編集" }));
    expect(table.querySelector("strong")).toHaveTextContent("focus");
    expect(within(table).queryByRole("link")).toBeNull();
  });
  it.each([["PERSON", "p"], ["EXPERIENCE", "child"], ["LINK", "incoming"]])(
    "TC-04-GRAPH-SEQUENTIAL-002 does not bold a FACT title on a %s ticket",
    async (type, id) => {
      renderTicket(type, id);
      const table = await screen.findByRole("table", { name: "FACT titles" });
      expect(table.querySelector("strong")).toBeNull();
      expect(table.querySelector('[aria-current="page"]')).toBeNull();
    },
  );
  it("TC-04-GRAPH-SEQUENTIAL-003 opens a FACT title through the real detail invoke", async () => {
    renderTicket();
    const table = await screen.findByRole("table", { name: "FACT titles" });
    fireEvent.click(within(table).getByRole("link", { name: "after" }));
    await waitFor(() => expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", {
      modelRoot: "fixture.hasm", entityType: "FACT", entityId: "after",
    }));
    await waitFor(() => expect(screen.getByRole("table", { name: "FACT titles" }).querySelector("strong")).toHaveTextContent("after"));
    expect(bridge.invoke.mock.calls.some(([command]) => command === "load_hasm_model_db")).toBe(false);
  });
  it("TC-04-GRAPH-SEQUENTIAL-004 opens the EXPERIENCE badge through the real detail invoke", async () => {
    renderTicket();
    const table = await screen.findByRole("table", { name: "FACT titles" });
    const badge = table.querySelector(".HasmVisualizer_ExperienceBadge");
    expect(badge).toHaveAttribute("href", "/entity-detail/EXPERIENCE/linked");
    fireEvent.click(badge);
    await waitFor(() => expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", {
      modelRoot: "fixture.hasm", entityType: "EXPERIENCE", entityId: "linked",
    }));
  });
  it.each([["FACT", "focus"], ["EXPERIENCE", "child"], ["LINK", "incoming"], ["PERSON", "p"]])(
    "TC-04-GRAPH-EMPHASIS-001 persistently emphasizes the current %s across hover, redraw and editing",
    async (type, id) => {
      const rendererSpy = vi.spyOn(graphRenderer, "createCommitGraph2D");
      renderTicket(type, id);
      const region = await screen.findByRole("region", { name: "Extended commit graph" });
      await waitFor(() => expect(region.querySelector("svg")).not.toBeNull());
      const theme = getPatternById(DEFAULT_COLOR_PATTERN).colors;
      const highlight = ensureReadableColor(theme.textColor, theme.textBackgroundColor);
      const assertEmphasis = () => {
        const payload = rendererSpy.mock.calls.at(-1)[1];
        let markers;
        let attribute;
        if (type === "FACT") {
          markers = [...region.querySelectorAll("circle")].filter((_, position) =>
            payload.nodes3d.filter((node) => node.entityType === "FACT")[position].id === id);
          expect(markers.length).toBeGreaterThan(1);
          markers.forEach((marker) => expect(marker).toHaveAttribute("fill", highlight));
          return;
        }
        if (type === "LINK") {
          markers = [...region.querySelectorAll("path[stroke-dasharray]")];
          expect(markers.length).toBeGreaterThan(0);
          markers.forEach((marker) => expect(marker).toHaveAttribute("opacity", "1"));
          attribute = "stroke";
        } else {
          markers = [...region.querySelectorAll("svg path:not([stroke-dasharray])")].filter((_, position) => {
            const line = payload.lines3d.filter((entry) => entry.lineType !== "LINK")[position];
            return line.lineType === "BRANCH" && (type === "PERSON" || line.id === `branch-${id}`);
          });
          attribute = "stroke";
        }
        expect(markers.length).toBeGreaterThan(0);
        markers.forEach((marker) => expect(marker).toHaveAttribute(attribute, highlight));
      };
      assertEmphasis();
      expect(region.querySelector(".ticket-graph-current strong")).toHaveTextContent(`${type}:`);
      expect(region.querySelector('a[aria-current="page"]')).toHaveAttribute("href", `/entity-detail/${type}/${id}`);
      const hoverTarget = region.querySelector("circle");
      fireEvent.pointerEnter(hoverTarget);
      assertEmphasis();
      fireEvent.pointerLeave(hoverTarget);
      assertEmphasis();
      const calls = bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout").length;
      fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
      expect(region).toHaveTextContent("現在のエンティティ");
      assertEmphasis();
      expect(bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout")).toHaveLength(calls);
      fireEvent.click(screen.getByRole("button", { name: "概要を編集" }));
      assertEmphasis();
      expect(region.querySelector('a[aria-current="page"]')).toBeNull();
      expect(region.querySelector(".ticket-graph-entities .ticket-graph-current")).toHaveTextContent(`${type}:`);
    },
  );
  it("TC-04-GRAPH-EMPHASIS-002 never invents PERSON nodes or emphasizes unaddressed FACT markers", async () => {
    const rendererSpy = vi.spyOn(graphRenderer, "createCommitGraph2D");
    renderTicket("PERSON", "p");
    const region = await screen.findByRole("region", { name: "Extended commit graph" });
    await waitFor(() => expect(region.querySelector("svg")).not.toBeNull());
    expect(rendererSpy).toHaveBeenCalled();
    const theme = getPatternById(DEFAULT_COLOR_PATTERN).colors;
    const highlight = ensureReadableColor(theme.textColor, theme.textBackgroundColor);
    // [REQ-04-RULE-024] PERSON tickets emphasize retained timelines, never FACT markers.
    for (const marker of region.querySelectorAll("circle")) {
      expect(marker.getAttribute("fill")).not.toBe(highlight);
    }
    const layoutCalls = bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout").length;
    fireEvent.pointerEnter(region.querySelector("circle"));
    fireEvent.pointerLeave(region.querySelector("circle"));
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout")).toHaveLength(layoutCalls);
    expect(region.querySelector(".ticket-graph-current strong")).toHaveTextContent("PERSON:");
    expect(region.querySelector('a[aria-current="page"]')).toHaveAttribute("href", "/entity-detail/PERSON/p");
  });
  it.each([["FACT", "focus"], ["EXPERIENCE", "child"], ["LINK", "incoming"], ["PERSON", "p"]])(
    "TC-04-GRAPH-IPC-001 displays %s graph at the bottom and invokes layout with the exact extracted model",
    async (type, id) => {
      const view = renderTicket(type, id);
      const region = await screen.findByRole("region", { name: "Extended commit graph" });
      await waitFor(() => expect(region.querySelector("svg")).not.toBeNull());
      expect(view.container.querySelector("main").lastElementChild).toBe(region);
      expect(bridge.invoke).toHaveBeenCalledWith("compute_visualizer_layout", {
        model: extractEntityGraphModel(model, type, id, detailFor(type, id)),
        filter: { timeScaleMode: "SequentialIndex", zScaleFactor: 1 },
      });
      expect(bridge.invoke.mock.calls.some(([command]) => command === "load_hasm_model_db")).toBe(false);
    },
  );
  it("TC-04-GRAPH-IPC-002 opens a rendered FACT through the real load invoke and disables graph navigation while editing", async () => {
    renderTicket();
    const region = await screen.findByRole("region", { name: "Extended commit graph" });
    await waitFor(() => expect(region.querySelector("circle")).not.toBeNull());
    expect(within(region).getAllByRole("button", { name: /^Open EXPERIENCE:/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    expect(within(region).queryByRole("link")).toBeNull();
    expect(within(region).queryByRole("button", { name: /^Open EXPERIENCE:/ })).not.toBeInTheDocument();
    fireEvent.click(region.querySelector("circle"));
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_entity_detail")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const node = region.querySelector("circle");
    fireEvent.click(node);
    await waitFor(() => expect(bridge.invoke.mock.calls.filter(([command]) => command === "load_entity_detail")).toHaveLength(2));
    const destination = bridge.invoke.mock.calls.filter(([command]) => command === "load_entity_detail")[1][1];
    expect(destination).toMatchObject({ modelRoot: "fixture.hasm", entityType: "FACT" });
    expect(model.facts.some((entity) => entity.factId === destination.entityId)).toBe(true);
  });
  it("TC-04-GRAPH-007 displays missing model and explicit layout failures without losing the ticket", async () => {
    const view = renderTicket("FACT", "focus", { path: "fixture.hasm" });
    const region = await screen.findByRole("region", { name: "Extended commit graph" });
    expect(region).toHaveTextContent("Workspace relationship information is unavailable.");
    view.unmount();
    bridge.invoke.mockImplementation(async (command) => {
      if (command === "compute_visualizer_layout") throw new Error("Native layout unavailable");
      return { name: "focus", detail: detailFor("FACT", "focus"), markdownBody: "# Ticket" };
    });
    renderTicket();
    expect(await screen.findByRole("alert")).toHaveTextContent("Native layout unavailable");
    expect(screen.getByRole("article", { name: "Markdown preview" })).toBeInTheDocument();
  });
  it("TC-04-GRAPH-008 translates graph chrome without another layout invoke and disables links after save", async () => {
    renderTicket();
    const region = await screen.findByRole("region", { name: "Extended commit graph" });
    await waitFor(() => expect(region.querySelector("svg")).not.toBeNull());
    const calls = bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout").length;
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
    expect(screen.getByRole("region", { name: "拡張コミットグラフ" })).toBeInTheDocument();
    expect(bridge.invoke.mock.calls.filter(([command]) => command === "compute_visualizer_layout")).toHaveLength(calls);
    fireEvent.change(screen.getByLabelText("言語"), { target: { value: "en" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Edited focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Metadata saved. Workspace requires re-verification.");
    expect(within(region).queryByRole("link")).toBeNull();
    expect(region).toHaveTextContent("Edited focus");
  });
  it("TC-04-GRAPH-009 ignores an abandoned layout failure", async () => {
    let rejectLayout;
    bridge.invoke.mockImplementation((command) => command === "compute_visualizer_layout"
      ? new Promise((_, reject) => { rejectLayout = reject; })
      : Promise.resolve({ name: "focus", detail: detailFor("FACT", "focus"), markdownBody: "# Ticket" }));
    const view = renderTicket();
    await waitFor(() => expect(rejectLayout).toBeTypeOf("function"));
    view.unmount();
    await act(async () => rejectLayout(new Error("Abandoned layout")));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each([
    ["LINK", "path[stroke-dasharray]", "incoming"],
    ["EXPERIENCE", "path.HasmVisualizer_GraphHoverable2D:not([stroke-dasharray])", "root"],
  ])("TC-04-GRAPH-IPC-003 selects a rendered %s and opens the exact typed ticket", async (type, selector, id) => {
    renderTicket();
    const region = await screen.findByRole("region", { name: "Extended commit graph" });
    await waitFor(() => expect(region.querySelector(selector)).not.toBeNull());
    fireEvent.pointerEnter(region.querySelector(selector));
    expect(within(region).getByRole("status")).toHaveTextContent(type);
    fireEvent.pointerLeave(region.querySelector(selector));
    fireEvent.click(region.querySelector(selector));
    await waitFor(() => expect(bridge.invoke).toHaveBeenCalledWith("load_entity_detail", {
      modelRoot: "fixture.hasm", entityType: type, entityId: id,
    }));
  });
  it("TC-04-GRAPH-010 displays renderer failures explicitly", async () => {
    vi.spyOn(graphRenderer, "createCommitGraph2D").mockImplementation(() => { throw new Error("SVG initialization failed"); });
    renderTicket();
    expect(await screen.findByRole("alert")).toHaveTextContent("SVG initialization failed");
    expect(screen.getByRole("article", { name: "Markdown preview" })).toBeInTheDocument();
  });
  it("TC-04-GRAPH-011 reports a layout timeout at exactly ten seconds and ignores later success", async () => {
    let resolveLayout;
    bridge.invoke.mockImplementation((command) => command === "compute_visualizer_layout"
      ? new Promise((resolve) => { resolveLayout = resolve; })
      : Promise.resolve({ name: "focus", detail: detailFor("FACT", "focus"), markdownBody: "# Ticket" }));
    vi.useFakeTimers();
    renderTicket();
    await act(async () => { for (let count = 0; count < 5; count += 1) await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("alert")).toHaveTextContent("Graph layout timed out.");
    await act(async () => { resolveLayout({ nodes3d: [], lines3d: [], warnings: [] }); });
    expect(screen.getByRole("alert")).toHaveTextContent("Graph layout timed out.");
    expect(screen.queryByRole("group", { name: "Extended commit graph" })).toBeNull();
  });
});
