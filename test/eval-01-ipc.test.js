import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const api = await import("../src/features/hasm/api.js");

describe("EVAL-01 Tauri IPC bridge contracts", () => {
  it("TC-01-IPC-001 invokes documented app validation commands", () => {
    api.validateHasmMarkdownApp();
    api.validateAppVersion();
    api.validateHasmFolderPath("C:/workspace");

    expect(invoke).toHaveBeenNthCalledWith(1, "validate_hasm_markdown_app");
    expect(invoke).toHaveBeenNthCalledWith(2, "validate_app_version");
    expect(invoke).toHaveBeenNthCalledWith(3, "validate_hasm_folder_path", { path: "C:/workspace" });
  });
});