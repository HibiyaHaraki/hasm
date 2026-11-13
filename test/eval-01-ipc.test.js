import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const api = await import("../src/features/hasm/api.js");

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const syncSplashSource = readFileSync(join(process.cwd(), "scripts", "sync-splash.mjs"), "utf8");

describe("EVAL-01 Tauri IPC bridge contracts", () => {
  it("TC-01-IPC-001 invokes documented app validation commands", () => {
    api.validateHasmMarkdownApp();
    api.validateAppVersion();
    api.validateHasmFolderPath("C:/workspace");

    expect(invoke).toHaveBeenNthCalledWith(1, "validate_hasm_markdown_app");
    expect(invoke).toHaveBeenNthCalledWith(2, "validate_app_version");
    expect(invoke).toHaveBeenNthCalledWith(3, "validate_hasm_folder_path", { path: "C:/workspace" });
  });

  it("TC-01-IPC-002 invokes the splash handoff command with the boot outcome", () => {
    invoke.mockClear();
    api.completeAppLaunch("select");

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("complete_app_launch", { outcome: "select" });
  });

  it("TC-01-IPC-003 wires the HASM splash bundle sync into dev and build", () => {
    // npm run dev / npm run build must copy the generated splash bundle first.
    expect(packageJson.scripts.dev).toContain("sync:splash");
    expect(packageJson.scripts.build).toContain("sync:splash");
    expect(packageJson.scripts["sync:splash"]).toContain("scripts/sync-splash.mjs");
    // The sync script targets public/splash with the full hasm_logo HASM bundle.
    expect(syncSplashSource).toContain("'public', 'splash'");
    for (const bundledFile of [
      "sprash_animation.html",
      "sprash_animation.css",
      "sprash_animation.js",
      "hasm_logo_transparent.png",
    ]) {
      expect(syncSplashSource).toContain(bundledFile);
    }
  });

  it("TC-01-IPC-004 splash sync regenerates missing bundles and never uses the hasm_markdown variant", () => {
    // Fault path: absent generated files trigger regeneration into a temp directory.
    expect(syncSplashSource).toContain("generate_splash.py");
    expect(syncSplashSource).toMatch(/!hasAllFiles\(generatedDir\)/);
    expect(syncSplashSource).toContain("Splash generator not found");
    // Only the `hasm` splash family may be the copy source; never `hasm_markdown`.
    expect(syncSplashSource).toContain("'logo', 'hasm'");
    expect(syncSplashSource).not.toContain("'logo', 'hasm_markdown'");
    expect(syncSplashSource).not.toContain("join(tempRoot, 'hasm_markdown')");
  });
});