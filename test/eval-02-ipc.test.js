import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();
const dialog = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("@tauri-apps/plugin-dialog", () => dialog);

const api = await import("../src/features/hasm/api.js");

describe("EVAL-02 Tauri IPC bridge contracts", () => {
  it("TC-02-DIALOG-001 opens a single-folder picker, including .hasm workspace folders", async () => {
    dialog.open.mockResolvedValueOnce("C:\\Life.hasm").mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Native dialog unavailable"));
    await expect(api.browseWorkspaceDirectory()).resolves.toBe("C:\\Life.hasm");
    expect(dialog.open).toHaveBeenCalledWith({
      directory: true, multiple: false, title: "Open a HASM workspace folder (.hasm)",
    });
    await expect(api.browseWorkspaceDirectory()).resolves.toBeNull();
    await expect(api.browseWorkspaceDirectory()).rejects.toThrow("Native dialog unavailable");
  });
  it("TC-02-DIALOG-002 leaves workspace commands untouched on picker cancellation or native failure", async () => {
    invoke.mockClear();
    dialog.open.mockResolvedValueOnce(null);
    await expect(api.browseWorkspaceDirectory()).resolves.toBeNull();
    dialog.open.mockRejectedValueOnce(new Error("Native dialog unavailable"));
    await expect(api.browseWorkspaceDirectory()).rejects.toThrow("Native dialog unavailable");
    // A cancelled or failed Browse action must not create, open, or modify a workspace.
    expect(invoke).not.toHaveBeenCalled();
  });
  it("TC-02-IPC-002 resolves the lock check inside the 3,000ms hard boundary and stops stalls at it", async () => {
    vi.useFakeTimers();
    try {
      const lock = { isLocked: false, isReadOnly: false };
      await expect(api.withTimeout(Promise.resolve(lock), 3000, "Lock check timed out")).resolves.toBe(lock);
      const stalled = expect(api.withTimeout(new Promise(() => {}), 3000, "Lock check timed out"))
        .rejects.toThrow("Lock check timed out");
      await vi.advanceTimersByTimeAsync(3000);
      await stalled;
    } finally {
      vi.useRealTimers();
    }
  });
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