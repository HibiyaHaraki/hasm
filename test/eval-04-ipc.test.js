import { describe, expect, it, vi } from "vitest";
const invoke = vi.fn(); vi.mock("@tauri-apps/api/core", () => ({ invoke })); vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
const api = await import("../src/features/hasm/api.js");
it("TC-04-IPC-LINK-002 sends URL arrays unchanged through every typed save invoke", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const registration = readFileSync(resolve("src-tauri", "src", "lib.rs"), "utf8");
  for (const type of ["PERSON", "EXPERIENCE", "FACT", "LINK"]) {
    const command = `save_${type.toLowerCase()}_detail`;
    const detail = { link: ["https://x.com/test/status/1", "https://example.org/?q=one%20two#part"] };
    api.saveEntityDetail(type, "C:/demo", detail);
    expect(invoke).toHaveBeenCalledWith(command, { modelRoot: "C:/demo", detail });
    expect(registration).toContain(`hasm::commands::${command}`);
  }
});
describe("EVAL-04 IPC", () => { it("TC-04-IPC-001 connects all entity ticket commands", () => { const commands = { PERSON: "save_person_detail", EXPERIENCE: "save_experience_detail", FACT: "save_fact_detail", LINK: "save_link_detail" }; for (const [type, command] of Object.entries(commands)) { api.saveEntityDetail(type, "C:/demo", {}); expect(invoke).toHaveBeenCalledWith(command, { modelRoot: "C:/demo", detail: {} }); } api.loadEntityDetail("C:/demo", "PERSON", "id"); api.checkEntityMtime("C:/demo", "PERSON", "id", 1); api.reloadEntityMarkdown("C:/demo", "PERSON", "id"); expect(invoke).toHaveBeenCalledWith("load_entity_detail", { modelRoot: "C:/demo", entityType: "PERSON", entityId: "id" }); expect(invoke).toHaveBeenCalledWith("check_entity_mtime", { modelRoot: "C:/demo", entityType: "PERSON", entityId: "id", lastLoadedMtimeMs: 1 }); expect(invoke).toHaveBeenCalledWith("reload_entity_markdown", { modelRoot: "C:/demo", entityType: "PERSON", entityId: "id" }); }); });