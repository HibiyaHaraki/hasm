import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityDetailPage from "../src/pages/EntityDetailPage";

const api = vi.hoisted(() => ({ loadEntityDetail: vi.fn(), checkEntityMtime: vi.fn(), reloadEntityMarkdown: vi.fn(), saveEntityDetail: vi.fn(), switchWorkspaceCleanly: vi.fn(), loadHasmModelDb: vi.fn() }));
vi.mock("../src/features/hasm/api", () => api);
const detail = { name: "Original", markdownBody: "# Detail", loadedMtimeMs: 10, detail: { personName: "Original" } };
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.state?.model ? ":model" : ""}</output>; }
function renderTicket(entityType = "PERSON", state = { path: "C:/demo" }) { return render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${entityType}/id-1`, state }]}><Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /><Route path="/error-model" element={<LocationProbe />} /><Route path="/error-markdown" element={<LocationProbe />} /><Route path="/visualizer" element={<LocationProbe />} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("SEQ-04 entity ticket", () => {
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