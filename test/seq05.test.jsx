import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntityDetailPage from "../src/pages/EntityDetailPage";

const api = vi.hoisted(() => ({ loadEntityDetail: vi.fn(), checkEntityMtime: vi.fn(), reloadEntityMarkdown: vi.fn(), saveEntityDetail: vi.fn(), launchExternalMarkdownApp: vi.fn(), switchWorkspaceCleanly: vi.fn() }));
const invoke = vi.hoisted(() => vi.fn());
const openUrl = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("../src/features/hasm/api", () => api);
const detail = { name: "Original", markdownBody: "# Detail", loadedMtimeMs: 10, detail: { factName: "Original" } };
function renderTicket(type = "FACT") { return render(<MemoryRouter initialEntries={[{ pathname: `/entity-detail/${type}/id-1`, state: { path: "C:/demo", model: {}, isVerified: true } }]}><Routes><Route path="/entity-detail/:entityType/:entityId" element={<EntityDetailPage />} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("SEQ-05 external Markdown invocation", () => {
  it("TC-05-REACT-007 clicking or keyboard-activating Markdown content launches the existing editor", async () => {
    api.loadEntityDetail.mockResolvedValue(detail);
    api.launchExternalMarkdownApp.mockResolvedValue({});
    renderTicket();
    fireEvent.click(await screen.findByRole("heading", { name: "Detail" }));
    await screen.findByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.");
    expect(api.launchExternalMarkdownApp).toHaveBeenCalledWith("C:/demo", "FACT", "id-1");
    const preview = screen.getByRole("article", { name: "Markdown preview" });
    fireEvent.keyDown(preview, { key: "Enter" });
    await vi.waitFor(() => expect(api.launchExternalMarkdownApp).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(preview, { key: " " });
    await vi.waitFor(() => expect(api.launchExternalMarkdownApp).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("TC-05-REACT-008 selecting text or activating document links does not launch the editor", async () => {
    api.loadEntityDetail.mockResolvedValue({ ...detail, markdownBody: "# Detail\n\n[Reference](https://example.org)" });
    renderTicket();
    const preview = await screen.findByRole("article", { name: "Markdown preview" });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(preview);
    selection.addRange(range);
    fireEvent.click(screen.getByRole("heading", { name: "Detail" }));
    expect(api.launchExternalMarkdownApp).not.toHaveBeenCalled();
    selection.removeAllRanges();
    fireEvent.click(screen.getByRole("link", { name: "Reference" }));
    expect(api.launchExternalMarkdownApp).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledWith("https://example.org");
  });
  it.each(["PERSON", "EXPERIENCE", "FACT", "LINK"])("TC-05-REACT-006 preview Edit button reaches the real invoke wrapper for %s", async (type) => {
    const realApi = await vi.importActual("../src/features/hasm/api");
    api.loadEntityDetail.mockImplementation(realApi.loadEntityDetail);
    api.launchExternalMarkdownApp.mockImplementation(realApi.launchExternalMarkdownApp);
    invoke.mockImplementation(async (command) => {
      if (command === "load_entity_detail") return detail;
      if (command === "launch_external_markdown_app") return { targetDirPath: `C:/demo/${type}/id-1`, executablePath: "C:/hasm_markdown.exe" };
      throw new Error(`Unexpected command: ${command}`);
    });
    renderTicket(type);
    await screen.findByRole("heading", { name: "Detail" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown in HASM App" }));
    expect(await screen.findByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")).toBeInTheDocument();
    expect(invoke).toHaveBeenLastCalledWith("launch_external_markdown_app", { modelRoot: "C:/demo", entityType: type, entityId: "id-1" });
    fireEvent.click(screen.getByRole("heading", { name: "Detail" }));
    await vi.waitFor(() => expect(invoke.mock.calls.filter(([command]) => command === "launch_external_markdown_app")).toHaveLength(2));
  });
  it("TC-05-REACT-001 invokes the editor and displays refresh guidance", async () => { api.loadEntityDetail.mockResolvedValue(detail); api.launchExternalMarkdownApp.mockResolvedValue({}); renderTicket(); await screen.findByRole("button", { name: "Edit summary" }); fireEvent.click(screen.getByRole("button", { name: "Edit Markdown in HASM App" })); expect(await screen.findByText("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")).toBeInTheDocument(); expect(api.launchExternalMarkdownApp).toHaveBeenCalledWith("C:/demo", "FACT", "id-1"); });
  it.each([
    ["TC-05-REACT-002", "ERR_ENTITY_DIRECTORY_NOT_FOUND", "Entity folder does not exist on disk."],
    ["TC-05-REACT-003", "ERR_MARKDOWN_EXECUTABLE_NOT_FOUND", "hasm_markdown.exe application binary is missing."],
    ["TC-05-REACT-004", "ERR_LAUNCH_TIMEOUT", "Launching HASM Markdown App timed out."],
    ["TC-05-REACT-005", "ERR_PROCESS_SPAWN_FAILED", "Failed to launch hasm_markdown.exe process."],
  ])("%s displays the documented launch error", async (_id, errorCode, message) => { api.loadEntityDetail.mockResolvedValue(detail); api.launchExternalMarkdownApp.mockRejectedValue(new Error(errorCode)); renderTicket(); await screen.findByRole("button", { name: "Edit summary" }); fireEvent.click(screen.getByRole("button", { name: "Edit Markdown in HASM App" })); expect(await screen.findByText(message)).toBeInTheDocument(); });
});