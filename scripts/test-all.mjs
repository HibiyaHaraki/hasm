import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(root, "test-results");
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function rustResults(text) {
  const results = [];
  let pending;
  for (const line of text.split(/\r?\n/)) {
    const start = line.match(/^test (.+?) \.\.\. (.*)$/);
    if (start) {
      if (pending) throw new Error(`Missing native result for ${pending}`);
      pending = start[1];
    }
    const status = (start ? start[2] : line).match(/^(ok|FAILED|ignored)(?:$|[ ,])/);
    if (pending && status) {
      results.push({ name: pending, source: "Rust", status: { ok: "passed", FAILED: "failed", ignored: "skipped" }[status[1]] });
      pending = undefined;
    }
  }
  if (pending) throw new Error(`Missing native result for ${pending}`);
  return results;
}

export function linkedResults(testCase, results) {
  return results.filter((result) => {
    if (result.source === "Vitest") {
      return result.name.match(/TC-[A-Za-z0-9-]+/g)?.includes(testCase.id);
    }
    // Rust tests usually use function names instead of TC IDs. Only accept an
    // explicitly documented full name or leaf name, not a suite-level association.
    const leaf = result.name.split("::").at(-1);
    return [result.name, leaf].some((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(testCase.evidence ?? "");
    });
  });
}

export function resultStatus(results) {
  if (!results.length) return "unmapped";
  if (results.some((result) => result.status === "failed")) return "failed";
  if (results.some((result) => result.status === "unmapped")) return "unmapped";
  if (results.some((result) => result.status !== "passed")) return "skipped";
  return "passed";
}

export function renderReport(trace, results, commands) {
  const sourceLink = (item) => `<a href="${escape(pathToFileURL(path.join(root, item.file)).href)}">${escape(`${item.file}:${item.line}`)}</a>`;
  const badge = (status) => `<span class="badge ${escape(status)}">${escape(status.toUpperCase())}</span>`;
  const requirements = trace.requirements.map((requirement) => {
    const cases = trace.testCases.filter((tc) => tc.reqs.includes(requirement.id));
    const linked = cases.map((tc) => ({ tc, matches: linkedResults(tc, results) }));
    const status = resultStatus(linked.map(({ matches }) => ({ status: resultStatus(matches) })));
    const code = trace.codeItems.filter((item) => item.reqs.includes(requirement.id));
    return `<article class="trace-row" data-requirement data-status="${status}">
      <svg class="connections" aria-hidden="true"></svg>
      <section class="trace-column"><h3>Requirement</h3><div class="node requirement">
        <div class="node-heading"><strong>${escape(requirement.id)}</strong>${badge(status)}</div>${sourceLink(requirement)}
      </div></section>
      <section class="trace-column"><h3>Code <span>${code.length}</span></h3>
        ${code.map((item) => `<div class="node code"><strong>${escape(item.name)}</strong>${item.kind ? ` <span class="meta">(${escape(item.kind)})</span>` : ""}<div>${sourceLink(item)}</div></div>`).join("") || '<div class="empty">No code tag</div>'}
      </section>
      <section class="trace-column"><h3>Documented tests <span>${linked.length}</span></h3>
        ${linked.map(({ tc, matches }) => `<div class="node test" data-case data-status="${resultStatus(matches)}">
          <div class="node-heading"><strong>${escape(tc.id)}</strong>${badge(resultStatus(matches))}</div>
          <div>${escape(tc.type)} &middot; ${sourceLink(tc)}</div>
          <ul>${matches.map((item) => `<li>${badge(item.status)} ${escape(item.source)}: ${escape(item.name)}${item.error ? `<pre>${escape(item.error)}</pre>` : ""}</li>`).join("") || "<li>No exact executed-test match</li>"}</ul>
        </div>`).join("") || '<div class="empty">No documented test</div>'}
      </section></article>`;
  }).join("");
  const count = (status) => results.filter((result) => result.status === status).length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HASM test and traceability report</title><style>
  :root{color-scheme:light;--ink:#24313b;--muted:#51616d;--paper:#f6f5f0;--panel:#fffefa;--border:#cbd2d1;--accent:#285b72}
  *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.55 system-ui,sans-serif}
  header{background:#e8edeb;border-bottom:1px solid var(--border)}.wrap{max-width:1500px;margin:auto;padding:1.5rem}
  h1,h2,h3,p{margin:0}h1{font-size:1.5rem}h2{font-size:1.15rem}h3{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.55rem}
  h3 span{font-weight:normal}.subtitle,.meta{color:var(--muted)}.subtitle{margin-top:.25rem}
  .summary{display:flex;flex-wrap:wrap;gap:.65rem;margin:1.2rem 0}.metric{background:var(--panel);border:1px solid var(--border);padding:.6rem .9rem;min-width:8rem}
  .metric strong{display:block;font-size:1.25rem}.metric span{color:var(--muted);font-size:.8rem}
  .notice{border-left:3px solid #a48b56;padding:.6rem 1rem;background:#efeee5;margin-bottom:1.25rem}
  .toolbar{display:flex;flex-wrap:wrap;gap:.8rem;align-items:end;margin:1rem 0}.search{flex:1;min-width:15rem}
  label{display:block;font-weight:600;margin-bottom:.3rem}input{width:100%;padding:.55rem;border:1px solid #8a9a9e;background:var(--panel);color:var(--ink);font:inherit}
  .filters{display:flex;flex-wrap:wrap;gap:.3rem}button{font:inherit;padding:.45rem .7rem;border:1px solid #8a9a9e;background:var(--panel);color:var(--ink);cursor:pointer}
  button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fffefa}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #a67525;outline-offset:2px}
  a{color:#20566d;overflow-wrap:anywhere}.trace-row{position:relative;display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:2.5rem;border-top:1px solid var(--border);padding:1rem 0}
  .connections{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
  .connections path{fill:none;stroke-width:2}.connections .passed{stroke:#25613b}.connections .failed{stroke:#a12626}
  .connections .skipped,.connections .unmapped{stroke:#785400;stroke-dasharray:4 3}
  .trace-column{position:relative;min-width:0;pointer-events:none}.trace-column>*{pointer-events:auto}
  .node{background:var(--panel);border:1px solid var(--border);border-left:3px solid #77919a;padding:.7rem;margin-bottom:.5rem;overflow-wrap:anywhere}
  .requirement{border-left-color:#536e84}.code{border-left-color:#537c81}.test{border-left-color:#7d8d6a}.node-heading{display:flex;justify-content:space-between;align-items:start;gap:.5rem}
  .badge{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.03em;padding:.1rem .4rem;border:1px solid currentColor;white-space:nowrap}
  .passed{color:#25613b}.failed{color:#a12626}.skipped,.unmapped{color:#785400}.empty{color:var(--muted);font-style:italic}
  ul{padding-left:1.2rem;margin:.5rem 0}li{margin:.35rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem}
  details{margin:1rem 0}summary{cursor:pointer;font-weight:600}table{border-collapse:collapse;width:100%;margin:1rem 0;background:var(--panel)}
  td,th{border:1px solid var(--border);padding:.6rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}
  [hidden]{display:none!important}@media(max-width:800px){.wrap{padding:1rem}.trace-row{grid-template-columns:1fr;gap:.5rem;padding-left:1.5rem}table{display:block;overflow-x:auto}}
  </style></head><body><header><div class="wrap"><h1>HASM test &amp; traceability dashboard</h1>
  <p class="subtitle">Requirements, associated code and documented tests, with actual execution results</p>
  <p class="meta">Generated ${escape(new Date().toISOString())}</p></div></header><main class="wrap">
  <div class="summary" aria-label="Execution summary">
    <div class="metric"><strong>${trace.requirements.length}</strong><span>Requirements</span></div>
    <div class="metric"><strong>${count("passed")}</strong><span>Tests passed</span></div>
    <div class="metric"><strong>${count("failed")}</strong><span>Tests failed</span></div>
    <div class="metric"><strong>${count("skipped")}</strong><span>Tests skipped</span></div>
  </div>
  <p class="notice">Lines connect items through their shared requirement; they do not assert a direct code-to-test dependency.
  Unmapped means no exact executed-test match, not a pass. Requirement status summarizes documented test matches, not code coverage.
  Frontend IPC mocks do not prove native IPC execution; Rust matches are listed separately.
  Manual/browser acceptance and submodule-owned suites are not executed.</p>
  <details open><summary>Commands and diagnostics</summary><ul>${commands.map((command) =>
    `<li>${badge(command.status)} ${escape(command.name)} (exit ${escape(command.exitCode)}) -
    <a href="${escape(command.log)}">full log</a>${command.error ? `: ${escape(command.error)}` : ""}</li>`).join("")}</ul>
  <details><summary>Traceability diagnostics (${trace.failures.length} errors, ${trace.warnings.length} warnings)</summary>
  <pre>${escape([...trace.failures, ...trace.warnings].join("\n"))}</pre></details></details>
  <h2>Requirement → code → documented tests</h2>
  <div class="toolbar"><div class="search"><label for="search">Search traceability and executed tests</label><input id="search" type="search" placeholder="Requirement, code, test or runner"></div>
  <div><label id="filter-label">Test result</label><div class="filters" role="group" aria-labelledby="filter-label">
  ${["all", "passed", "failed", "skipped", "unmapped"].map((status) => `<button type="button" data-filter="${status}" aria-pressed="${status === "all"}">${status[0].toUpperCase() + status.slice(1)}</button>`).join("")}
  </div></div></div>
  <p class="meta">Lines: <span class="passed">green = passed</span>, <span class="failed">red = failed</span>,
  <span class="unmapped">dashed ochre = skipped or unmapped</span>. Test branches show each case's result;
  shared lines summarize visible cases (failed takes precedence, then unmapped, then skipped).
  Requirement badges retain their overall status when filtered. Search matches the whole requirement group.</p>
  <div id="traceability">${requirements}</div>
  <p id="no-requirements" class="empty" hidden>No matching requirements.</p>
  <h2>All executed tests (including tests without documentation mappings)</h2>
  <table><thead><tr><th>Result</th><th>Runner</th><th>Test name / ID</th></tr></thead><tbody>${results.map((result) =>
    `<tr data-result data-status="${escape(result.status)}"><td>${badge(result.status)}</td><td>${escape(result.source)}</td><td>${escape(result.name)}${result.error ? `<pre>${escape(result.error)}</pre>` : ""}</td></tr>`).join("")}</tbody></table>
  <script>
  const search = document.getElementById("search");
  const buttons = document.querySelectorAll("[data-filter]");
  const groups = document.querySelectorAll("[data-requirement]");
  const executed = document.querySelectorAll("[data-result]");
  let filter = "all";
  let pendingDraw;
  function scheduleDraw() {
    cancelAnimationFrame(pendingDraw);
    pendingDraw = requestAnimationFrame(drawConnections);
  }
  function drawConnections() {
    const mobile = window.matchMedia("(max-width: 800px)").matches;
    const drawings = [];
    groups.forEach(group => {
      const svg = group.querySelector(".connections");
      if (group.hidden) { drawings.push([svg, []]); return; }
      const base = group.getBoundingClientRect();
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left - base.left, right: r.right - base.left, middle: (r.top + r.bottom) / 2 - base.top };
      };
      const requirement = rect(group.querySelector(".requirement"));
      const codes = Array.from(group.querySelectorAll(".code"), rect);
      const tests = Array.from(group.querySelectorAll("[data-case]")).filter(test => !test.hidden);
      const statuses = tests.map(test => test.dataset.status);
      const aggregate = statuses.includes("failed") ? "failed" : statuses.includes("unmapped") ? "unmapped" :
        statuses.includes("skipped") ? "skipped" : statuses.length ? "passed" : "unmapped";
      const paths = [];
      const connect = (a, b, status, rail) => {
        let d;
        if (mobile) {
          d = "M " + a.left + " " + a.middle + " H " + rail + " V " + b.middle + " H " + b.left;
        } else {
          const x = (a.right + b.left) / 2;
          d = "M " + a.right + " " + a.middle + " C " + x + " " + a.middle + " " + x + " " + b.middle + " " + b.left + " " + b.middle;
        }
        paths.push({ d, status });
      };
      codes.forEach(code => connect(requirement, code, aggregate, 6));
      if (tests.length) {
        const testRects = tests.map(rect);
        if (codes.length) {
          if (mobile) {
            const junction = { left: 14, middle: (codes[codes.length - 1].middle + testRects[0].middle) / 2 };
            codes.forEach(code => connect(code, junction, aggregate, 14));
            testRects.forEach((test, i) => connect(junction, test, statuses[i], 14));
          } else {
            const junctionX = (codes[0].right + testRects[0].left) / 2;
            const junction = { left: junctionX, right: junctionX, middle: (codes[0].middle + testRects[0].middle) / 2 };
            codes.forEach(code => connect(code, junction, aggregate));
            testRects.forEach((test, i) => connect(junction, test, statuses[i]));
          }
        } else {
          testRects.forEach((test, i) => connect(requirement, test, statuses[i], 14));
        }
      }
      drawings.push([svg, paths]);
    });
    drawings.forEach(([svg, paths]) => {
      svg.replaceChildren(...paths.map(({ d, status }) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", status);
        return path;
      }));
    });
  }
  function update() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    groups.forEach(group => {
      const cases = group.querySelectorAll("[data-case]");
      cases.forEach(test => { test.hidden = filter !== "all" && test.dataset.status !== filter; });
      const statusMatch = filter === "all" || (cases.length ? Array.from(cases).some(test => !test.hidden) : filter === "unmapped");
      group.hidden = !statusMatch || !group.textContent.toLowerCase().includes(query);
      if (!group.hidden) visible++;
    });
    document.getElementById("no-requirements").hidden = visible !== 0;
    executed.forEach(row => {
      row.hidden = (filter !== "all" && row.dataset.status !== filter) || !row.textContent.toLowerCase().includes(query);
    });
    scheduleDraw();
  }
  search.addEventListener("input", update);
  buttons.forEach(button => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    update();
  }));
  window.addEventListener("resize", scheduleDraw);
  if (document.fonts) document.fonts.ready.then(scheduleDraw);
  scheduleDraw();
  </script></main></body></html>`;
}

async function run(name, executable, args, log, cwd = root) {
  const file = fs.createWriteStream(path.join(output, log));
  console.log(`RUN: ${name}`);
  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, env: { ...process.env, NO_COLOR: "1" }, windowsHide: true });
    let stdout = "";
    let error = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; file.write(chunk); });
    child.stderr.on("data", (chunk) => file.write(chunk));
    child.on("error", (failure) => { error = failure.message; file.write(`\n${error}\n`); });
    child.on("close", (code, signal) => {
      file.end(() => {
        const status = code === 0 && !error ? "passed" : "failed";
        console.log(`${status.toUpperCase()}: ${name} (exit ${code}${signal ? `, ${signal}` : ""}) - ${log}`);
        resolve({ name, status, exitCode: code, error: error || signal, log, stdout });
      });
    });
  });
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  // Remove only this runner's previous machine results, never a user's directory.
  for (const name of ["vitest.json", "traceability.json"]) {
    fs.rmSync(path.join(output, name), { force: true });
  }
  const commands = [];
  commands.push(await run("All frontend / IPC / robustness tests", process.execPath, [
    path.join(root, "node_modules", "vitest", "vitest.mjs"), "run", "--dir", "test",
    "--maxWorkers=1", "--reporter=json", `--outputFile=${path.join(output, "vitest.json")}`,
  ], "vitest.log"));
  commands.push(await run("All native Rust tests", "cargo", [
    "test", "--no-fail-fast", "--", "--format", "pretty", "--test-threads=1",
  ], "rust.log", path.join(root, "src-tauri")));
  commands.push(await run("Requirement / test / code traceability", process.execPath, [
    path.join(root, "scripts", "check-traceability.mjs"), "--json", path.join(output, "traceability.json"),
  ], "traceability.log"));
  const results = [];
  try { results.push(...rustResults(commands[1].stdout)); }
  catch (error) {
    console.error(error.message);
    commands.push({ name: "Native result parsing", status: "failed", exitCode: null, log: "rust.log", error: error.message });
  }
  let trace = { requirements: [], testCases: [], codeItems: [], failures: [], warnings: [] };
  for (const [name, consume] of [
    ["vitest.json", (data) => {
      for (const suite of data.testResults) {
        if (suite.status === "failed" && !suite.assertionResults.some((test) => test.status === "failed")) {
          results.push({ name: suite.name, source: "Vitest", status: "failed", error: suite.message || "Suite failed before reporting test results" });
        }
        for (const test of suite.assertionResults) {
          results.push({
            name: test.fullName, source: "Vitest",
            status: test.status === "passed" ? "passed" : test.status === "failed" ? "failed" : "skipped",
            error: test.failureMessages?.join("\n"),
          });
        }
      }
    }],
    ["traceability.json", (data) => { trace = data; }],
  ]) {
    try { consume(JSON.parse(fs.readFileSync(path.join(output, name), "utf8"))); }
    catch (error) {
      const message = `Could not read ${name}: ${error.message}`;
      console.error(message);
      commands.push({ name: message, status: "failed", exitCode: null, log: name, error: error.message });
    }
  }
  fs.writeFileSync(path.join(output, "index.html"), renderReport(trace, results, commands));
  for (const result of results) {
    console.log(`RESULT: ${result.status.toUpperCase()} | TEST ID: ${result.name.match(/TC-[A-Za-z0-9-]+/)?.[0] ?? result.name} | TEST NAME: ${result.name}`);
    if (result.error) console.error(result.error);
  }
  console.log(`Report: ${path.join(output, "index.html")}`);
  process.exitCode = commands.some((command) => command.status !== "passed") ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
