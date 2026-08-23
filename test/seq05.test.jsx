import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityDetailPage from "../src/pages/EntityDetailPage";

const api = vi.hoisted(() => ({ loadEntityDetail: vi.fn(), checkEntityMtime: vi.fn(), reloadEntityMarkdown: vi.fn(), saveEntityDetail: vi.fn(), launchExternalMarkdownApp: vi.fn(), switchWorkspaceCleanly: vi.fn() }));
vi.mock("../src/features/hasm/api", () => api);
const detail = { name: "Original", markdownBody: "# Detail", loadedMtimeMs: 10, detail: { factName: "Original" } };
function renderTicket() { return render(<MemoryRouter initialEntries={[{ pathname: "/entity-detail/FACT/id-1", state: { path: "C:/demo", model: {}, isVerified: true } }]}><Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("SEQ-05 external Markdown invocation", () => {
  it("TC-05-REACT-001 invokes the editor and displays refresh guidance", async () => { api.loadEntityDetail.mockResolvedValue(detail); api.launchExternalMarkdownApp.mockResolvedValue({}); renderTicket(); await screen.findByDisplayValue("Original"); fireEvent.click(screen.getByRole("button", { name: "Edit Markdown in HASM App" })); expect(await screen.findByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")).toBeInTheDocument(); expect(api.launchExternalMarkdownApp).toHaveBeenCalledWith("C:/demo", "FACT", "id-1"); });
  it.each([
    ["TC-05-REACT-002", "ERR_ENTITY_DIRECTORY_NOT_FOUND", "Entity folder does not exist on disk."],
    ["TC-05-REACT-003", "ERR_MARKDOWN_EXECUTABLE_NOT_FOUND", "hasm_markdown.exe application binary is missing."],
    ["TC-05-REACT-004", "ERR_LAUNCH_TIMEOUT", "Launching HASM Markdown App timed out."],
    ["TC-05-REACT-005", "ERR_PROCESS_SPAWN_FAILED", "Failed to launch hasm_markdown.exe process."],
  ])("%s displays the documented launch error", async (_id, errorCode, message) => { api.loadEntityDetail.mockResolvedValue(detail); api.launchExternalMarkdownApp.mockRejectedValue(new Error(errorCode)); renderTicket(); await screen.findByDisplayValue("Original"); fireEvent.click(screen.getByRole("button", { name: "Edit Markdown in HASM App" })); expect(await screen.findByText(message)).toBeInTheDocument(); });
});