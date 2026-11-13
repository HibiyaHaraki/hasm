// @vitest-environment node
import { describe, expect, it } from "vitest";
import { linkedResults, renderReport, resultStatus, rustResults } from "../scripts/test-all.mjs";

describe("Unified test report", () => {
  it("parses native outcomes and links only exact documented test identities", () => {
    const results = rustResults("test module::saves_entity ... ok\r\ntest module::rejects_entity ... FAILED\r\ntest optional ... ignored\r\n");
    expect(results.map((result) => result.status)).toEqual(["passed", "failed", "skipped"]);
    expect(linkedResults({ evidence: "`saves_entity`" }, results)).toEqual([results[0]]);
    expect(linkedResults({ evidence: "`never_saves_entity`" }, results)).toEqual([]);
    const frontend = [{ source: "Vitest", name: "TC-04-GRAPH-001 opens ticket", status: "passed" }];
    expect(linkedResults({ id: "TC-04-GRAPH-001" }, frontend)).toEqual(frontend);
    expect(linkedResults({ id: "TC-04-GRAPH-00" }, frontend)).toEqual([]);
    expect(resultStatus([])).toBe("unmapped");
    expect(resultStatus(results)).toBe("failed");
    expect(resultStatus([{ status: "passed" }, { status: "unmapped" }])).toBe("unmapped");
    expect(resultStatus([{ status: "passed" }, { status: "skipped" }])).toBe("skipped");
    expect(rustResults("test logs_during_run ... log output\nmore output\nok\n")).toEqual([
      { name: "logs_during_run", source: "Rust", status: "passed" },
    ]);
    expect(() => rustResults("test incomplete ... \n")).toThrow("Missing native result");
  });

  it("escapes report data and never labels unexecuted documented cases as passed", () => {
    const html = renderReport({
      requirements: [{ id: "REQ-TEST", file: "docs/traceability.md", line: 1 }],
      testCases: [{ id: "TC-NOT-RUN", reqs: ["REQ-TEST"], file: "docs/traceability.md", line: 1, type: "Positive" }],
      codeItems: [], failures: ["<script>unsafe</script>"], warnings: [],
    }, [], [{ name: "cargo test", status: "failed", exitCode: 1, log: "rust.log" }]);
    expect(html).toContain("UNMAPPED");
    expect(html).toContain("No exact executed-test match");
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
    expect(html).toContain('href="rust.log"');
  });
});
