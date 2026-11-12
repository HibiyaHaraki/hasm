import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EntityInfoPreview, { previewGraphEntity } from "../src/features/entityTicket/EntityInfoPreview";
import EntityCreatePage from "../src/pages/EntityCreatePage";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const personId = "11111111-1111-1111-1111-111111111111";
const experienceId = "22222222-2222-2222-2222-222222222222";
const factId = "33333333-3333-3333-3333-333333333333";
const linkId = "44444444-4444-4444-4444-444444444444";
const model = {
  people: [{ personId, personName: "Ada" }],
  experiences: [{ experienceId, experienceName: "Life", personId }],
  facts: [{ factId, factName: "Birth", experienceIds: [experienceId], personIds: [personId] }],
  links: [{ linkId, linkName: "Supports", linkType: "supports", relatedIds: [personId, factId] }],
};
const details = {
  PERSON: { name: "Ada", detail: { ...model.people[0], birthday: "1815-12-10" } },
  EXPERIENCE: { name: "Life", detail: model.experiences[0] },
  FACT: { name: "Birth", detail: { ...model.facts[0], occurredAt: "1815-12-10" } },
  LINK: { name: "Supports", detail: model.links[0] },
};

function setup(pathname = "/visualizer") {
  return render(<MemoryRouter initialEntries={[{ pathname, state: { path: "C:\\fixture.hasm", model } }]}>
    <EntityInfoPreview />
    <Routes>
      <Route path="*" element={<>
        <Link to={`/entity-detail/PERSON/${personId}`} state={{ path: "C:\\fixture.hasm", model }} aria-describedby="existing-description">Ada reference</Link>
        <Link to={`/entity-detail/EXPERIENCE/${experienceId}`}>Life reference</Link>
        <Link to={`/entity-detail/FACT/${factId}`}>Birth reference</Link>
        <button data-entity-type="LINK" data-entity-id={linkId}>Related LINK</button>
        <a href={`https://example.org/entity-detail/PERSON/${personId}`}>External</a>
        <div data-testid="graph">Graph</div>
      </>} />
    </Routes>
  </MemoryRouter>);
}

async function open(element, focus = false) {
  if (focus) fireEvent.focusIn(element);
  else fireEvent.pointerOver(element);
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
}

beforeEach(() => {
  vi.useFakeTimers();
  invoke.mockImplementation((command, { entityType }) => {
    if (command !== "load_entity_detail") throw new Error(`Unexpected invoke: ${command}`);
    return Promise.resolve({
      ...details[entityType],
      markdownBody: "---\nentity_type: test\n---\n\nA short description.",
    });
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Shared entity information card", () => {
  it.each([
    ["FACT", "Belonging EXPERIENCE"],
    ["EXPERIENCE", "Parent EXPERIENCE"],
  ])("TC-08-PREVIEW-001 %s dropdown choices show cards before multi-selection", async (type, label) => {
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { path: "C:\\fixture.hasm", model } }]}>
      <EntityInfoPreview /><EntityCreatePage />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: type }));
    fireEvent.click(screen.getByLabelText(label));
    const option = screen.getByRole("option", { name: `Life (${experienceId})` });
    await open(option);
    expect(screen.getByRole("tooltip")).toHaveTextContent(`EXPERIENCE/${experienceId}`);
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("load_entity_detail", {
      modelRoot: "C:\\fixture.hasm", entityType: "EXPERIENCE", entityId: experienceId,
    });
    fireEvent.pointerOver(screen.getByRole("tooltip"));
    fireEvent.mouseDown(screen.getByRole("tooltip"));
    fireEvent.click(screen.getByRole("tooltip"));
    expect(screen.getByRole("tooltip")).toBeVisible();
    expect(screen.getByRole("listbox")).toBeVisible();
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).toBeVisible();
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(option, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it.each(["origin", "target"])("TC-08-PREVIEW-002 LINK %s search results show cards and clear stale previews", async (endpoint) => {
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { path: "C:\\fixture.hasm", model } }]}>
      <EntityInfoPreview /><EntityCreatePage />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    const search = screen.getByLabelText(`Search ${endpoint} entities`);
    fireEvent.change(search, { target: { value: "Ada" } });
    const option = screen.getByRole("option", { name: `PERSON Ada (${personId})` });
    await open(option, true);
    expect(screen.getByRole("tooltip")).toHaveTextContent(`PERSON/${personId}`);
    expect(option).toHaveAttribute("aria-selected", "false");
    fireEvent.change(search, { target: { value: "no match" } });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: `PERSON Ada (${personId})` })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("option", { name: `PERSON Ada (${personId})` }));
    expect(screen.getByLabelText(endpoint === "origin" ? "Origin" : "Target")).toHaveTextContent("Ada");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("TC-08-PREVIEW-003 retained LINK choices preview and closing ignores late reads", async () => {
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-create", state: { path: "C:\\fixture.hasm", model } }]}>
      <EntityInfoPreview /><EntityCreatePage />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "LINK" }));
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "Birth" } });
    fireEvent.click(screen.getByRole("option", { name: `FACT Birth (${factId})` }));
    fireEvent.change(screen.getByLabelText("Search origin entities"), { target: { value: "Life" } });
    const retained = screen.getByRole("option", { name: /Current selection.*FACT Birth/ });
    await open(retained);
    expect(screen.getByRole("tooltip")).toHaveTextContent(`FACT/${factId}`);
    expect(retained).toHaveAttribute("aria-selected", "true");
    let resolve;
    invoke.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await open(screen.getByRole("option", { name: `EXPERIENCE Life (${experienceId})` }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Loading entity information");
    fireEvent.click(screen.getByRole("button", { name: "Origin", exact: true }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await act(async () => { resolve({ ...details.EXPERIENCE, markdownBody: "Late description" }); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Origin", exact: true })).toHaveTextContent("Birth");
  });

  it.each([
    ["PERSON", personId, "Ada reference", "Birthday", "1815-12-10"],
    ["EXPERIENCE", experienceId, "Life reference", "Owner", "Ada"],
    ["FACT", factId, "Birth reference", "Experiences", "Life"],
    ["LINK", linkId, "Related LINK", "Relationship type", "supports"],
  ])("TC-04-PREVIEW-001 %s hover shows typed details via the real JS invoke wrapper", async (type, id, label, field, value) => {
    setup();
    await open(screen.getByText(label));
    const card = screen.getByRole("tooltip");
    expect(card).toHaveClass("card", "entity-info-preview");
    expect(card).toHaveTextContent(`${type}/${id}`);
    expect(card).toHaveTextContent(field);
    expect(card).toHaveTextContent(value);
    expect(card).toHaveTextContent("A short description.");
    expect(card).not.toHaveTextContent("entity_type: test");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("load_entity_detail", {
      modelRoot: "C:\\fixture.hasm", entityType: type, entityId: id,
    });
  });

  it("TC-04-PREVIEW-002 supports keyboard focus, Escape, and restores existing descriptions", async () => {
    setup("/entity-create");
    const link = screen.getByText("Ada reference");
    await open(link, true);
    expect(link.getAttribute("aria-describedby")).toContain(screen.getByRole("tooltip").id);
    expect(link.getAttribute("aria-describedby")).toContain("existing-description");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(link).toHaveAttribute("aria-describedby", "existing-description");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("TC-04-PREVIEW-003 debounces brief hovers and lets the pointer enter the card", async () => {
    setup();
    const link = screen.getByText("Ada reference");
    fireEvent.pointerOver(link);
    fireEvent.pointerOut(link);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(invoke).not.toHaveBeenCalled();
    await open(link);
    const card = screen.getByRole("tooltip");
    fireEvent.pointerOut(link, { relatedTarget: card });
    fireEvent.pointerOver(card);
    fireEvent.scroll(card);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByRole("tooltip")).toBe(card);
    fireEvent.pointerOut(card);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("TC-04-PREVIEW-008 dismisses on viewport changes and unmounts without stale results", async () => {
    const view = setup();
    await open(screen.getByText("Ada reference"));
    fireEvent.resize(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await open(screen.getByText("Ada reference"));
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    let resolve;
    invoke.mockImplementationOnce(() => new Promise((complete) => { resolve = complete; }));
    await open(screen.getByText("Birth reference"));
    view.unmount();
    await act(async () => { resolve({ ...details.FACT, markdownBody: "Late" }); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("TC-04-PREVIEW-004 ignores late results after switching entities or routes", async () => {
    let resolvePerson;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { resolvePerson = resolve; }));
    setup();
    await open(screen.getByText("Ada reference"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading entity information");
    await open(screen.getByText("Birth reference"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(`FACT/${factId}`);
    await act(async () => { resolvePerson({ ...details.PERSON, markdownBody: "Stale result" }); });
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("Stale result");
    fireEvent.click(screen.getByText("Ada reference"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("TC-04-PREVIEW-005 displays errors and bounds stalled IPC", async () => {
    setup();
    invoke.mockRejectedValueOnce(new Error("Description missing"));
    await open(screen.getByText("Ada reference"));
    expect(screen.getByRole("alert")).toHaveTextContent("Description missing");
    invoke.mockImplementationOnce(() => new Promise(() => {}));
    await open(screen.getByText("Birth reference"));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Entity information timed out.");
  });

  it("TC-04-PREVIEW-006 handles host graph hover and ignores external links", async () => {
    setup();
    await open(screen.getByText("External"));
    expect(invoke).not.toHaveBeenCalled();
    const graph = screen.getByTestId("graph");
    act(() => previewGraphEntity({ entityType: "FACT", id: factId }, { clientX: 9999, clientY: 9999 }, graph));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("Birth");
    expect(parseFloat(card.style.left)).toBeLessThan(window.innerWidth);
    expect(parseFloat(card.style.top)).toBeLessThan(window.innerHeight);
    act(() => previewGraphEntity(null));
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("TC-04-PREVIEW-007 treats document contents as text and limits the excerpt", async () => {
    setup();
    invoke.mockResolvedValueOnce({ ...details.PERSON, markdownBody: "<script>unsafe()</script>" + "x".repeat(500) });
    await open(screen.getByText("Ada reference"));
    const card = screen.getByRole("tooltip");
    expect(card.querySelector("script")).toBeNull();
    expect(within(card).getByText(/<script>unsafe/).textContent).toHaveLength(403);
  });
});
