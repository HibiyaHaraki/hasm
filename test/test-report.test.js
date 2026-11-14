// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
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

  it("draws status-colored links and filters cases without changing aggregate requirement status", async () => {
    const trace = {
      requirements: [
        { id: "REQ-ONE", file: "docs/traceability.md", line: 1 },
        { id: "REQ-EMPTY", file: "docs/traceability.md", line: 2 },
      ],
      testCases: [
        { id: "TC-PASS", reqs: ["REQ-ONE"], file: "docs/traceability.md", line: 3, type: "Positive" },
        { id: "TC-FAIL", reqs: ["REQ-ONE"], file: "docs/traceability.md", line: 4, type: "Negative" },
        { id: "TC-MISSING", reqs: ["REQ-ONE"], file: "docs/traceability.md", line: 5, type: "Negative" },
        { id: "TC-SKIP", reqs: ["REQ-ONE"], file: "docs/traceability.md", line: 6, type: "Negative" },
      ],
      codeItems: [{ name: "save", kind: "function", reqs: ["REQ-ONE"], file: "src/App.jsx", line: 1 }],
      failures: [], warnings: [],
    };
    const results = [
      { source: "Vitest", name: "TC-PASS saves", status: "passed" },
      { source: "Vitest", name: "TC-FAIL rejects", status: "failed", error: "<unsafe failure>" },
      { source: "Vitest", name: "TC-SKIP optional", status: "skipped" },
      { source: "Rust", name: "other", status: "skipped" },
    ];
    const dom = new JSDOM(renderReport(trace, results, []), {
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) { window.matchMedia = () => ({ matches: false }); },
    });
    const document = dom.window.document;
    const groups = document.querySelectorAll("[data-requirement]");
    const cases = groups[0].querySelectorAll("[data-case]");
    const executed = document.querySelectorAll("[data-result]");
    const select = (status) => document.querySelector(`[data-filter="${status}"]`).click();
    const drawn = () => new Promise((resolve) => dom.window.requestAnimationFrame(resolve));

    await drawn();
    expect([...groups[0].querySelectorAll("svg path")].map((path) => path.getAttribute("class")))
      .toEqual(["failed", "failed", "passed", "failed", "unmapped", "skipped"]);
    expect(groups[1].querySelectorAll("svg path")).toHaveLength(0);
    expect(groups[0].querySelector(".code").textContent).toContain("save (function)");
    expect(groups[0].dataset.status).toBe("failed");
    expect(groups[0].textContent).toContain("<unsafe failure>");
    select("passed");
    await drawn();
    expect([...groups[0].querySelectorAll("svg path")].map((path) => path.getAttribute("class")))
      .toEqual(["passed", "passed", "passed"]);
    expect([...cases].map((item) => item.hidden)).toEqual([false, true, true, true]);
    expect(groups[0].hidden).toBe(false);
    expect(groups[1].hidden).toBe(true);
    expect(groups[0].querySelector(".requirement .badge").textContent).toBe("FAILED");
    expect([...executed].map((item) => item.hidden)).toEqual([false, true, true, true]);
    expect(document.querySelector('[data-filter="passed"]').getAttribute("aria-pressed")).toBe("true");

    select("unmapped");
    await drawn();
    expect([...groups[0].querySelectorAll("svg path")].map((path) => path.getAttribute("class")))
      .toEqual(["unmapped", "unmapped", "unmapped"]);
    expect([...cases].map((item) => item.hidden)).toEqual([true, true, false, true]);
    expect(groups[1].hidden).toBe(false);
    expect([...executed].every((item) => item.hidden)).toBe(true);
    const search = document.getElementById("search");
    search.value = "save";
    search.dispatchEvent(new dom.window.Event("input"));
    expect(groups[0].hidden).toBe(false);
    expect(groups[1].hidden).toBe(true);
    search.value = "does not exist";
    search.dispatchEvent(new dom.window.Event("input"));
    expect(document.getElementById("no-requirements").hidden).toBe(false);
    select("all");
    search.value = "";
    search.dispatchEvent(new dom.window.Event("input"));
    expect([...cases].every((item) => !item.hidden)).toBe(true);
    expect([...executed].every((item) => !item.hidden)).toBe(true);
    dom.window.close();
  });

  it("connects documented tests directly to their requirement when no code is tagged", async () => {
    const html = renderReport({
      requirements: [{ id: "REQ-TEST", file: "docs/traceability.md", line: 1 }],
      testCases: [{ id: "TC-MISSING", reqs: ["REQ-TEST"], file: "docs/traceability.md", line: 1, type: "Negative" }],
      codeItems: [], failures: [], warnings: [],
    }, [], []);
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) { window.matchMedia = () => ({ matches: true }); },
    });
    await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
    const paths = dom.window.document.querySelectorAll("svg path");
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute("class")).toBe("unmapped");
    expect(paths[0].getAttribute("d")).toContain(" H 14 V ");
    dom.window.close();
  });
});
