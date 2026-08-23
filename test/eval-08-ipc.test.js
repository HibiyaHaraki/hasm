import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const api = await import("../src/features/hasm/api.js");

describe("EVAL-08 IPC bridge", () => {
  it("TC-08-IPC-001 connects workspace and entity creation commands", () => {
    api.createHasmWorkspace("C:/NewLife.hasm");
    api.createPerson("C:/NewLife.hasm", { personName: "John" });
    api.createExperience("C:/NewLife.hasm", { experienceName: "Research" });
    api.createFact("C:/NewLife.hasm", { factName: "First Commit" });
    api.createLink("C:/NewLife.hasm", { linkType: "references" });

    expect(invoke).toHaveBeenNthCalledWith(1, "create_hasm_workspace", {
      targetDirectoryPath: "C:/NewLife.hasm",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "create_person", {
      path: "C:/NewLife.hasm",
      payload: { personName: "John" },
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "create_experience", {
      path: "C:/NewLife.hasm",
      payload: { experienceName: "Research" },
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "create_fact", {
      path: "C:/NewLife.hasm",
      payload: { factName: "First Commit" },
    });
    expect(invoke).toHaveBeenNthCalledWith(5, "create_link", {
      path: "C:/NewLife.hasm",
      payload: { linkType: "references" },
    });
  });
});
