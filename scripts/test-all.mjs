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
  const badge = (status) => `<span class="${status}">${escape(status.toUpperCase())}</span>`;
  const requirements = trace.requirements.map((requirement) => {
    const cases = trace.testCases.filter((tc) => tc.reqs.includes(requirement.id));
    const linked = cases.map((tc) => ({ tc, matches: linkedResults(tc, results) }));
    const status = resultStatus(linked.map(({ matches }) => ({ status: resultStatus(matches) })));
    const code = trace.codeItems.filter((item) => item.reqs.includes(requirement.id));
    return `<tr><td>${badge(status)}<br>${escape(requirement.id)}<br>${sourceLink(requirement)}</td>
      <td>${code.map((item) => `${sourceLink(item)} ${escape(item.name)}`).join("<br>") || "No code tag"}</td>
      <td>${linked.map(({ tc, matches }) => `${badge(resultStatus(matches))} ${escape(tc.id)} (${escape(tc.type)}) ${sourceLink(tc)}
        <ul>${matches.map((item) => `<li>${escape(item.source)}: ${escape(item.name)} ${badge(item.status)}</li>`).join("") || "<li>No exact executed-test match</li>"}</ul>`).join("") || "No documented test"}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>HASM test and traceability report</title><style>
  body{font:14px system-ui;margin:2rem;color:#24313b;background:#faf9f5}table{border-collapse:collapse;width:100%;margin:1rem 0}
  td,th{border:1px solid #bbb;padding:.6rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}
  a{color:#185583}.passed{color:#176035}.failed{color:#a12626}.skipped,.unmapped{color:#805600}
  span{font-weight:bold}input{padding:.5rem;width:90%;max-width:40rem}ul{padding-left:1.2rem}
  </style><h1>HASM test and traceability report</h1><p>${escape(new Date().toISOString())}</p>
  <p>${results.filter((r) => r.status === "passed").length} passed,
  ${results.filter((r) => r.status === "failed").length} failed,
  ${results.filter((r) => r.status === "skipped").length} skipped.
  ${trace.requirements.length} requirements.</p>
  <p>Unmapped means no exact executed-test match, not a pass. Requirement status summarizes documented test matches, not code coverage.
  Frontend IPC mocks do not prove native IPC execution; Rust matches are listed separately.
  Manual/browser acceptance and submodule-owned suites are not executed.</p>
  <h2>Commands and diagnostics</h2><ul>${commands.map((command) =>
    `<li>${badge(command.status)} ${escape(command.name)} (exit ${escape(command.exitCode)}) -
    <a href="${escape(command.log)}">full log</a>${command.error ? `: ${escape(command.error)}` : ""}</li>`).join("")}</ul>
  <details><summary>Traceability diagnostics (${trace.failures.length} errors, ${trace.warnings.length} warnings)</summary>
  <pre>${escape([...trace.failures, ...trace.warnings].join("\n"))}</pre></details>
  <label for="search">Filter requirements and test results</label><br><input id="search" type="search">
  <h2>Requirement → code → executed tests</h2><table><thead><tr><th>Requirement / result</th><th>Code</th><th>Documented tests / results</th></tr></thead><tbody>${requirements}</tbody></table>
  <h2>All executed tests (including tests without documentation mappings)</h2>
  <table><thead><tr><th>Result</th><th>Runner</th><th>Test name / ID</th></tr></thead><tbody>${results.map((result) =>
    `<tr><td>${badge(result.status)}</td><td>${escape(result.source)}</td><td>${escape(result.name)}${result.error ? `<pre>${escape(result.error)}</pre>` : ""}</td></tr>`).join("")}</tbody></table>
  <script>document.getElementById("search").addEventListener("input",event=>{
  const query=event.target.value.toLowerCase();document.querySelectorAll("tbody tr").forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query)});});</script></html>`;
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
