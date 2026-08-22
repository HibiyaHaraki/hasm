import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

const api = await import("../src/features/hasm/api.js");

describe("EVAL-02 Tauri IPC bridge contracts", () => {
  it("TC-02-IPC-001 invokes documented workspace commands", () => {
    const model = { people: [], experiences: [], facts: [], links: [] };
    api.checkWorkspaceLock("C:/workspace");
    api.releaseWorkspaceLock("C:/workspace");
    api.loadHasmModelDb("C:/workspace");
    api.verifyHasmStorage("C:/workspace", model);
    api.subscribeToTauriEvent("model-load-progress", () => {});

    expect(invoke).toHaveBeenNthCalledWith(1, "check_workspace_lock", { path: "C:/workspace" });
    expect(invoke).toHaveBeenNthCalledWith(2, "release_workspace_lock", { path: "C:/workspace" });
    expect(invoke).toHaveBeenNthCalledWith(3, "load_hasm_model_db", { path: "C:/workspace" });
    expect(invoke).toHaveBeenNthCalledWith(4, "verify_hasm_storage", { path: "C:/workspace", model });
    expect(listen).toHaveBeenCalledWith("model-load-progress", expect.any(Function));
  });
});