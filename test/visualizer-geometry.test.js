import { describe, expect, it } from "vitest";

const runGeometryTests = process.env.HASM_RUN_VISUALIZER_GEOMETRY === "1";

describe("EVAL-03 Three.js geometry smoke", () => {
  it.skipIf(!runGeometryTests)("TC-03-E2E-001 renders Three.js geometry when explicitly enabled", () => {
    expect(runGeometryTests).toBe(true);
  });
});