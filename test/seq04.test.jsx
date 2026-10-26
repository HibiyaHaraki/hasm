import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("TC-04-REACT-LINK-001 edits, saves, cancels and clears external links for every entity", async () => {
    for (const type of ["PERSON", "EXPERIENCE", "FACT", "LINK"]) {
      const original = ["https://x.com/ada/status/1", "https://www.google.com/maps/place/Tokyo"];
      api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { link: original } });
      api.saveEntityDetail.mockResolvedValue({});
      renderTicket(type);
      await screen.findByDisplayValue("Original");
      expect(screen.getByRole("img", { name: "X icon" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Google Maps icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Add link" }));
      fireEvent.change(screen.getByLabelText("Link 3"), { target: { value: "https://example.org/page?a=1#part" } });
      expect(screen.getByRole("img", { name: "Web page icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenCalledWith(type, "C:/demo", {
        link: [...original, "https://example.org/page?a=1#part"], [`${type.toLowerCase()}Name`]: "Original",
      }));
      fireEvent.change(screen.getByLabelText("Link 1"), { target: { value: "https://google.com/search?q=HASM" } });
      expect(screen.getByRole("img", { name: "Google icon" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
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
    await screen.findByDisplayValue("Original");
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
    const link = await screen.findByRole("link", { name: /X: https:/ });
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
    const input = await screen.findByLabelText("Link 1");
    fireEvent.change(input, { target: { value: "https://example.org/unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Markdown" }));
    await screen.findByText("Markdown refreshed.");
    expect(input).toHaveValue("https://example.org/unsaved");
  });
  it("TC-04-REACT-LINK-006 patches route model URLs and invalidates verification on save", async () => {
    const model = { people: [{ personId: "id-1", personName: "Original", link: [] }], experiences: [], facts: [], links: [] };
    api.loadEntityDetail.mockResolvedValue({ ...detail, detail: { personId: "id-1", personName: "Original", link: [] } });
    api.saveEntityDetail.mockResolvedValue({});
    render(<MemoryRouter initialEntries={[{ pathname: "/entity-detail/PERSON/id-1", state: { path: "C:/demo", model, isVerified: true } }]}>
      <Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /><Route path="/visualizer" element={<SavedStateProbe />} /></Routes>
    </MemoryRouter>);
    await screen.findByDisplayValue("Original");
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
      const input = await screen.findByDisplayValue("Original"); fireEvent.change(input, { target: { value: "Updated" } }); fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await vi.waitFor(() => expect(api.saveEntityDetail).toHaveBeenCalled()); cleanup(); vi.resetAllMocks();
    }
  });
  it("TC-04-REACT-007 and TC-04-REACT-009 highlight deletion and route refresh failure", async () => {
    api.loadEntityDetail.mockResolvedValue(detail); api.checkEntityMtime.mockResolvedValue({ isModified: false, isDeleted: true }); api.reloadEntityMarkdown.mockRejectedValue(new Error("ERR_MARKDOWN_FILE_NOT_FOUND")); renderTicket(); await screen.findByDisplayValue("Original"); window.dispatchEvent(new Event("focus")); await vi.waitFor(() => expect(api.checkEntityMtime).toHaveBeenCalled()); fireEvent.click(screen.getByRole("button", { name: "Refresh Markdown" })); expect(await screen.findByTestId("location")).toHaveTextContent("/error-markdown");
  });
  it("TC-04-E2E-004 returns to the visualizer without losing model state", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    renderTicket("PERSON", { path: "C:/demo", model: { people: [{}], experiences: [], facts: [], links: [] }, isVerified: true });
    await screen.findByDisplayValue("Original");
    fireEvent.click(screen.getByRole("button", { name: "Back to Visualizer" }));
    expect(await screen.findByTestId("location")).toHaveTextContent("/visualizer:model");
  });
  it("TC-04-REACT-PERF-001 saves a ticket without reloading the whole package", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    api.saveEntityDetail.mockResolvedValue({});
    renderTicket("PERSON", { path: "C:/demo", model: { people: [{}], experiences: [], facts: [], links: [] }, isVerified: true });
    const input = await screen.findByDisplayValue("Original");
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
    await screen.findByDisplayValue("Original");
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(api.checkEntityMtime).toHaveBeenCalledTimes(1));
    expect(api.loadHasmModelDb).not.toHaveBeenCalled();
    expect(api.reloadEntityMarkdown).not.toHaveBeenCalled();
  });
});