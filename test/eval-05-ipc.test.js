import { describe, expect, it, vi } from "vitest";
const invoke = vi.fn(); vi.mock("@tauri-apps/api/core", () => ({ invoke })); vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const api = await import("../src/features/hasm/api.js");
describe("EVAL-05 IPC", () => { it("TC-05-IPC-001 invokes the external Markdown editor with its target directory identity", () => { api.launchExternalMarkdownApp("C:/demo", "FACT", "id-1"); expect(invoke).toHaveBeenCalledWith("launch_external_markdown_app", { modelRoot: "C:/demo", entityType: "FACT", entityId: "id-1" }); }); });