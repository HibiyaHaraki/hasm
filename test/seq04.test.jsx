import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityDetailPage from "../src/pages/EntityDetailPage";
import { externalLinkSite, isExternalUrl } from "../src/features/entityTicket/ExternalLinksEditor";

const openUrl = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));
const api = vi.hoisted(() => ({ loadEntityDetail: vi.fn(), checkEntityMtime: vi.fn(), reloadEntityMarkdown: vi.fn(), saveEntityDetail: vi.fn(), switchWorkspaceCleanly: vi.fn(), loadHasmModelDb: vi.fn() }));
vi.mock("../src/features/hasm/api", () => api);
const detail = { name: "Original", markdownBody: "# Detail", loadedMtimeMs: 10, detail: { personName: "Original" } };
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.state?.model ? ":model" : ""}</output>; }
function SavedStateProbe() { const location = useLocation(); return <output data-testid="saved-state">{JSON.stringify(location.state)}</output>; }
function renderTicket(entityType = "PERSON", state = { path: "C:/demo" }) { return render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${entityType}/id-1`, state }]}><Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /><Route path="/error-model" element={<LocationProbe />} /><Route path="/error-markdown" element={<LocationProbe />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("SEQ-04 entity ticket", () => {
  const referenceModel = {
    people: [{ personId: "person-ada", personName: "Ada Lovelace" }],
    experiences: [
      { experienceId: "exp-life", experienceName: "Life in London" },
      { experienceId: "exp-research", experienceName: "Analytical Engine research" },
    ],
    facts: [{ factId: "fact-notes", factName: "Published notes" }],
    links: [
      { linkId: "link-out", linkName: "Inspired research", linkType: "inspires", relatedIds: ["id-1", "exp-research"] },
      { linkId: "link-in", linkName: "Documented by Ada", linkType: "documents", relatedIds: ["person-ada", "id-1"] },
      { linkId: "link-explicit", linkName: "Further reading", linkType: "references", relatedIds: ["person-ada", "exp-life"] },
      { linkId: "link-unrelated", linkName: "Unrelated relationship", linkType: "references", relatedIds: ["person-ada", "fact-notes"] },
    ],
  };
  it.each([
    ["EXPERIENCE", { personId: "person-ada", parentExperienceIds: ["exp-life"] }, ["Ada Lovelace", "Life in London"]],
    ["FACT", { personIds: ["person-ada"], experienceIds: ["exp-life", "exp-research"] }, ["Ada Lovelace", "Life in London", "Analytical Engine research"]],
    ["LINK", { relatedIds: ["person-ada", "exp-research"] }, ["Ada Lovelace", "Analytical Engine research"]],
  ])("TC-04-REACT-REF-001 displays titles instead of IDs in %s reference information", async (type, fields, titles) => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: fields });
    const view = renderTicket(type, { path: "C:/demo", model: referenceModel });
    const values = await screen.findByRole("button", { name: "Edit details" });
    for (const title of titles) expect(values).toHaveTextContent(title);
    for (const id of ["person-ada", "exp-life", "exp-research", "id-1"]) expect(view.container).not.toHaveTextContent(id);
    expect(view.container.querySelector("form, input, select, textarea")).toBeNull();
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
  });
  it.each(["PERSON", "EXPERIENCE", "FACT"])("TC-04-REACT-REF-002 lists incoming, outgoing and explicit LINK entities once for %s", async (type) => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { linkIds: ["link-out", "link-out", "link-explicit"], link: ["https://example.org"] } });
    renderTicket(type, { path: "C:/demo", model: referenceModel });
    const links = within(await screen.findByRole("region", { name: "Related LINK entities" }));
    expect(links.getAllByRole("listitem")).toHaveLength(3);
    expect(links.getByRole("button", { name: "Open LINK: Inspired research" })).toHaveTextContent("inspires");
    expect(links.getByRole("button", { name: "Open LINK: Inspired research" })).toHaveTextContent("Original -> Analytical Engine research");
    expect(links.getByRole("button", { name: "Open LINK: Documented by Ada" })).toHaveTextContent("Ada Lovelace -> Original");
    expect(links.getByRole("button", { name: "Open LINK: Further reading" })).toHaveTextContent("Ada Lovelace -> Life in London");
    expect(links.queryByText("Unrelated relationship")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "External links" })).toHaveTextContent("https://example.org");
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    expect(links.getByRole("button", { name: "Open LINK: Inspired research" })).toBeDisabled();
  });
  it("TC-04-REACT-REF-003 handles unavailable references without displaying opaque IDs", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { personIds: ["missing-person"], experienceIds: ["missing-experience"], linkIds: ["missing-link"] } });
    const view = renderTicket("FACT", { path: "C:/demo", model: referenceModel });
    const values = await screen.findByRole("button", { name: "Edit details" });
    expect(values).toHaveTextContent("Unavailable PERSON");
    expect(values).toHaveTextContent("Unavailable EXPERIENCE");
    expect(values).toHaveTextContent("Unavailable LINK");
    expect(screen.getByText("Referenced LINK information is unavailable.")).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent("missing-person");
    expect(view.container).not.toHaveTextContent("missing-experience");
    expect(view.container).not.toHaveTextContent("missing-link");
  });
  it("TC-04-REACT-REF-004 shows empty and missing-workspace relationship states explicitly", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    renderTicket("PERSON", { path: "C:/demo", model: { people: [], experiences: [], facts: [], links: [] } });
    expect(await screen.findByText("No related LINK entities.")).toBeInTheDocument();
    cleanup();
    renderTicket();
    expect(await screen.findByText("Workspace relationship information is unavailable.")).toBeInTheDocument();
  });
  it("TC-04-REACT-REF-005 opens a related LINK with the workspace context", async () => {
    api.loadEntityDetail.mockImplementation(async (_root, type, id) => type === "LINK"
      ? { ...detail, name: "Inspired research", detail: referenceModel.links.find((link) => link.linkId === id) }
      : detail);
    renderTicket("PERSON", { path: "C:/demo", model: referenceModel, isVerified: true });
    fireEvent.click(await screen.findByRole("button", { name: "Open LINK: Inspired research" }));
    expect(await screen.findByRole("heading", { name: "Inspired research" })).toBeInTheDocument();
    expect(api.loadEntityDetail).toHaveBeenLastCalledWith("C:/demo", "LINK", "link-out");
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveTextContent("Analytical Engine research");
    expect(screen.queryByRole("region", { name: "Related LINK entities" })).not.toBeInTheDocument();
  });
  it("TC-04-REACT-REF-006 updates endpoint titles after save and preserves re-verification before related navigation", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    api.saveEntityDetail.mockResolvedValue({});
    renderTicket("PERSON", { path: "C:/demo", model: referenceModel, isVerified: true });
    fireEvent.click(await screen.findByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Updated title" });
    const link = screen.getByRole("button", { name: "Open LINK: Inspired research" });
    expect(link).toHaveTextContent("Updated title -> Analytical Engine research");
    expect(link).toBeDisabled();
    expect(screen.getByText("Return to Visualizer to re-verify before opening related entities.")).toBeInTheDocument();
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
  });
  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-04-REACT-INLINE-001 opens %s in reading mode without editing forms", async (type) => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { ...detail.detail, link: ["https://example.org"] } });
    const view = renderTicket(type);
    expect(await screen.findByRole("heading", { name: "Original" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Markdown preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit external link 1" })).toHaveTextContent("https://example.org");
    expect(view.container.querySelector("form, input, textarea, select")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(api.saveEntityDetail).not.toHaveBeenCalled();
  });
  it("TC-04-REACT-INLINE-002 edits only the clicked summary, cancels with Escape and saves explicitly", async () => {
    const loaded = { ...detail, detail: { personName: "Original", birthday: "1815-12-10", link: ["https://example.org"] } };
    api.loadEntityDetail.mockResolvedValue(loaded);
    api.saveEntityDetail.mockResolvedValue({});
    renderTicket();
    const summary = await screen.findByRole("button", { name: "Edit summary" });
    fireEvent.click(summary);
    const input = screen.getByRole("textbox", { name: "Summary" });
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Not saved" } });
    fireEvent.blur(input);
    expect(api.saveEntityDetail).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Original" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit summary" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Edit summary" }));
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Updated" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.saveEntityDetail).toHaveBeenCalledWith("PERSON", "C:/demo", { ...loaded.detail, personName: "Updated" });
  });
  it.each([
    ["PERSON", { personName: "Original", birthday: "", die: "", linkIds: [] }, "Birthday", "1815-12-10", { birthday: "1815-12-10", die: "", linkIds: [] }],
    ["EXPERIENCE", { experienceName: "Original", personId: "11111111-1111-1111-1111-111111111111", parentExperienceIds: [], linkIds: [] }, "Parent experiences", "22222222-2222-2222-2222-222222222222", { personId: "11111111-1111-1111-1111-111111111111", parentExperienceIds: ["22222222-2222-2222-2222-222222222222"], linkIds: [] }],
    ["FACT", { factName: "Original", occurredAt: "", experienceIds: [], personIds: [], linkIds: [] }, "Occurred at", "2026-10-29", { occurredAt: "2026-10-29", experienceIds: [], personIds: [], linkIds: [] }],
    ["LINK", { linkName: "Original", linkType: "references", relatedIds: [] }, "Relationship type", "supports", { linkType: "supports", relatedIds: [] }],
  ])("TC-04-REACT-INLINE-003 edits typed %s details without changing summary, Markdown or external links", async (type, metadata, label, value, patch) => {
    const stored = { ...metadata, link: ["https://example.org"], markdown: "# Unchanged", markdownPath: "entity/main.md" };
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: stored });
    api.saveEntityDetail.mockResolvedValue({});
    renderTicket(type);
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    expect(screen.queryByRole("textbox", { name: "Summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Metadata saved. Workspace requires re-verification.");
    expect(api.saveEntityDetail).toHaveBeenCalledWith(type, "C:/demo", { ...stored, ...patch });
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveTextContent(type === "EXPERIENCE" ? "Unavailable EXPERIENCE" : value);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("TC-04-REACT-INLINE-004 keeps the editor on validation/save failure and prevents duplicate saves", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { ...detail.detail, linkIds: [] } });
    let rejectSave;
    api.saveEntityDetail.mockImplementation(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    const ids = screen.getByLabelText("Graph links");
    fireEvent.change(ids, { target: { value: "not-a-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Graph links must contain valid entity UUIDs");
    expect(ids).toHaveValue("not-a-uuid");
    expect(api.saveEntityDetail).not.toHaveBeenCalled();
    fireEvent.change(ids, { target: { value: "11111111-1111-1111-1111-111111111111" } });
    const form = ids.closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.saveEntityDetail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh Markdown" })).toBeDisabled();
    rejectSave(new Error("Database is locked"));
    expect(await screen.findByRole("status")).toHaveTextContent("Database is locked");
    expect(ids).toHaveValue("11111111-1111-1111-1111-111111111111");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveTextContent("None");
  });
  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-04-REACT-PREVIEW-001 renders formatted Markdown for %s", async (type) => {
    api.loadEntityDetail.mockResolvedValue({
      ...detail,
      markdownBody: "# Reading\n\nA **strong** and *quiet* page.\n\n- First item\n- Second item\n\n> Quotation\n\n```js\nconst value = 1;\n```\n\n| Name | Value |\n| --- | --- |\n| Ink | Paper |",
    });
    renderTicket(type);
    const preview = within(await screen.findByRole("article", { name: "Markdown preview" }));
    expect(preview.getByRole("heading", { name: "Reading", level: 1 })).toBeInTheDocument();
    expect(preview.getByText("strong").tagName).toBe("STRONG");
    expect(preview.getByText("quiet").tagName).toBe("EM");
    expect(preview.getAllByRole("listitem")).toHaveLength(2);
    expect(preview.getByText("Quotation").closest("blockquote")).toBeInTheDocument();
    expect(preview.getByText("const value = 1;").closest("pre")).toBeInTheDocument();
    expect(preview.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Markdown in HASM App" }).closest(".markdown-panel")).toBeInTheDocument();
  });
  it("TC-04-REACT-PREVIEW-002 escapes raw HTML and rejects executable Markdown URLs", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, markdownBody: '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[Unsafe](javascript:alert(1))' });
    renderTicket();
    const preview = await screen.findByRole("article", { name: "Markdown preview" });
    expect(preview.querySelector("script, img, [onerror]")).toBeNull();
    expect(within(preview).queryByRole("link")).not.toBeInTheDocument();
    expect(preview).toHaveTextContent("<script>alert(1)</script>");
  });
  it("TC-04-REACT-PREVIEW-003 opens preview links through the OS and displays failures", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, markdownBody: "[Reference](https://example.org/page)\n\n[Relative](other.md)" });
    openUrl.mockRejectedValue(new Error("Browser unavailable"));
    renderTicket();
    fireEvent.click(await screen.findByRole("link", { name: "Reference" }));
    expect(openUrl).toHaveBeenCalledWith("https://example.org/page");
    expect(await screen.findByRole("alert")).toHaveTextContent("Browser unavailable");
    fireEvent.click(screen.getByRole("link", { name: "Relative" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only absolute HTTP(S)");
    expect(openUrl).toHaveBeenCalledTimes(1);
  });
  it("TC-04-REACT-LINK-001 edits, saves, cancels and clears external links for every entity", async () => {
    for (const type of ["PERSON", "EXPERIENCE", "FACT", "LINK"]) {
      const original = ["https://x.com/ada/status/1", "https://www.google.com/maps/place/Tokyo"];
      api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { link: original, [`${type.toLowerCase()}Name`]: "Original" } });
      api.saveEntityDetail.mockResolvedValue({});
      renderTicket(type);
      await screen.findByRole("button", { name: "Edit summary" });
      expect(screen.getByRole("img", { name: "X icon" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Google Maps icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Edit external link 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Add link" }));
      fireEvent.change(screen.getByLabelText("Link 3"), { target: { value: "https://example.org/page?a=1#part" } });
      expect(screen.getByRole("img", { name: "Web page icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenCalledWith(type, "C:/demo", {
        link: [...original, "https://example.org/page?a=1#part"], [`${type.toLowerCase()}Name`]: "Original",
      }));
      fireEvent.click(await screen.findByRole("button", { name: "Edit external link 1" }));
      fireEvent.change(screen.getByLabelText("Link 1"), { target: { value: "https://google.com/search?q=HASM" } });
      expect(screen.getByRole("img", { name: "Google icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Edit external link 1" }));
      expect(screen.getByLabelText("Link 1")).toHaveValue(original[0]);
      for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole("button", { name: "Remove link 1" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenLastCalledWith(type, "C:/demo", expect.objectContaining({ link: [] })));
      cleanup(); vi.resetAllMocks();
    }
  });
  it("TC-04-REACT-LINK-002 preserves links when saving fails and rejects unsafe URLs", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { link: [] } });
    api.saveEntityDetail.mockRejectedValue(new Error("Database is locked"));
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Edit external links" }));
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    const input = screen.getByLabelText("Link 1");
    fireEvent.change(input, { target: { value: "https://example.org" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form"));
    expect(await screen.findByText("Database is locked")).toBeInTheDocument();
    expect(input).toHaveValue("https://example.org");
    api.saveEntityDetail.mockClear();
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.submit(input.closest("form"));
    expect(api.saveEntityDetail).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("absolute HTTP(S)");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("TC-04-REACT-LINK-003 opens URLs through the OS opener and surfaces failures", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { link: ["https://x.com/ada/status/1"] } });
    openUrl.mockRejectedValue(new Error("Browser unavailable"));
    renderTicket();
    const link = await screen.findByRole("link", { name: /Open link 1:/ });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(link);
    expect(openUrl).toHaveBeenCalledWith("https://x.com/ada/status/1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Browser unavailable");
  });
  it("TC-04-REACT-LINK-004 classifies real hosts only and validates URL schemes", () => {
    for (const value of ["javascript:alert(1)", "file:///secret", "https:example.org", "https://user:pass@example.org", "https://example.org/a b", "example.org"]) {
      expect(isExternalUrl(value)).toBe(false);
    }
    expect(isExternalUrl("http://example.org/?q=a%20b#fragment")).toBe(true);
    expect(externalLinkSite("https://x.com.evil.org")).toEqual({ name: "Web page", icon: "web" });
    expect(externalLinkSite("https://maps.app.goo.gl/example").name).toBe("Google Maps");
    expect(externalLinkSite("https://twitter.com/ada").name).toBe("X");
  });
  it("TC-04-REACT-LINK-005 keeps unsaved URL edits through Markdown refresh", async () => {
    const loaded = { ...detail, detail: { link: ["https://example.org/original"] } };
    api.loadEntityDetail.mockResolvedValue(loaded);
    api.reloadEntityMarkdown.mockResolvedValue({ ...loaded, markdownBody: "# Refreshed" });
    renderTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Edit external link 1" }));
    const input = screen.getByLabelText("Link 1");
    fireEvent.change(input, { target: { value: "https://example.org/unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Markdown" }));
    await screen.findByText("Markdown refreshed.");
    expect(input).toHaveValue("https://example.org/unsaved");
    expect(within(screen.getByRole("article", { name: "Markdown preview" })).getByRole("heading", { name: "Refreshed" })).toBeInTheDocument();
  });
  it("TC-04-REACT-LINK-006 patches route model URLs and invalidates verification on save", async () => {
    const model = { people: [{ personId: "id-1", personName: "Original", link: [] }], experiences: [], facts: [], links: [] };
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { personId: "id-1", personName: "Original", link: [] } });
    api.saveEntityDetail.mockResolvedValue({});
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-detail/PERSON/id-1", state: { path: "C:/demo", model, isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /><Route path="/visualizer" element={<SavedStateProbe />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit external links" }));
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    fireEvent.change(screen.getByLabelText("Link 1"), { target: { value: "https://example.org/source" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Metadata saved. Workspace requires re-verification.");
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    const state = JSON.parse((await screen.findByTestId("saved-state")).textContent);
    expect(state.isVerified).toBe(false);
    expect(state.model.people[0].link).toEqual(["https://example.org/source"]);
    expect(state.model.experiences).toEqual([]);
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
  });
  it("TC-04-REACT-001 loads and saves every entity type", async () => {
    for (const type of ["PERSON", "EXPERIENCE", "FACT", "LINK"]) {
      api.loadEntityDetail.mockResolvedValue({ ...detail, entityType: type, detail: { [`${type.toLowerCase()}Name`]: "Original" } }); api.saveEntityDetail.mockResolvedValue({}); renderTicket(type);
      fireEvent.click(await screen.findByRole("button", { name: "Edit summary" }));
      const input = screen.getByRole("textbox", { name: "Summary" }); fireEvent.change(input, { target: { value: "Updated" } }); fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenCalled()); cleanup(); vi.resetAllMocks();
    }
  });
  it("TC-04-REACT-007 and TC-04-REACT-009 highlight deletion and route refresh failure", async () => {
    api.loadEntityDetail.mockResolvedValue(detail); api.checkEntityMtime.mockResolvedValue({ isModified: false, isDeleted: true }); api.reloadEntityMarkdown.mockRejectedValue(new Error("ERR_MARKDOWN_FILE_NOT_FOUND")); renderTicket(); await screen.findByRole("button", { name: "Edit summary" }); window.dispatchEvent(new Event("focus")); await vi.waitFor(() => expect(api.checkEntityMtime).toHaveBeenCalled()); fireEvent.click(screen.getByRole("button", { name: "Refresh Markdown" })); expect(await screen.findByTestId("location")).toHaveTextContent("/error-markdown");
  });
  it("TC-04-E2E-004 returns to the visualizer without losing model state", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    renderTicket("PERSON", { path: "C:/demo", model: { people: [{}], experiences: [], facts: [], links: [] }, isVerified: true });
    await screen.findByRole("button", { name: "Edit summary" });
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer:model");
  });
  it("TC-04-REACT-PERF-001 saves a ticket without reloading the whole package", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    api.saveEntityDetail.mockResolvedValue({});
    renderTicket("PERSON", { path: "C:/demo", model: { people: [{}], experiences: [], facts: [], links: [] }, isVerified: true });
    fireEvent.click(await screen.findByRole("button", { name: "Edit summary" }));
    const input = screen.getByRole("textbox", { name: "Summary" });
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenCalledTimes(1));
    // A 60k-entity package must not be re-read because one ticket was saved.
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
    expect(api.loadEntityDetail).toHaveBeenCalledTimes(1);
  });
  it("TC-04-REACT-PERF-002 polls freshness on focus without reloading the package", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    api.checkEntityMtime.mockResolvedValue({ isModified: false, isDeleted: false, currentMtimeMs: 10 });
    renderTicket();
    await screen.findByRole("button", { name: "Edit summary" });
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(api.checkEntityMtime).toHaveBeenCalledTimes(1));
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
    expect(api.reloadEntityMarkdown).not.toHaveBeenCalled();
  });
});