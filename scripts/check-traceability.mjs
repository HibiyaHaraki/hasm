#!/usr/bin/env node
// ###################################################
// File Name : check-traceability.mjs
// Purpose : Requirement / test-case / code traceability checker
// Description :
//   - Collects every requirement ID ([REQ-xx-TYPE-nnn]) from docs/req/.
//   - Collects every test case (TC-*) with its traced requirement IDs and
//     Positive/Negative classification from docs/eval/.
//   - Collects requirement tags from code comments attached to exported
//     JS/JSX items, Rust pub fns, pub structs/enums, and Tauri commands.
//   - Fails when a requirement lacks a positive test, a negative test, or
//     has fewer than two test cases, when an exported code item carries no
//     requirement tag, or when a tag/TC references an unknown requirement.
//   - With --write, regenerates docs/traceability-matrix.md.
// Usage :
//   node ./scripts/check-traceability.mjs          # check only (CI gate)
//   node ./scripts/check-traceability.mjs --write  # check + regenerate matrix
// ###################################################

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const REQ_DIR = path.join(ROOT, "docs", "req");
const EVAL_DIR = path.join(ROOT, "docs", "eval");
const MATRIX_PATH = path.join(ROOT, "docs", "traceability-matrix.md");

// Typed IDs ([REQ-01-FUNC-503]) plus the legacy untyped REQ-08 style (REQ-08-016).
const REQ_ID_RE = /REQ-\d{2}-(?:(?:RULE|FUNC|DATA|NFR|UI|SEC)-)?\d+[A-Za-z]*/g;

// Git submodules and generated output are excluded from code scanning.
const SKIP_DIRS = [
  "node_modules",
  "hasm_color_pattern",
  "hasm_logger",
  "hasm_visualizer",
  "target",
  "dist",
];

function walk(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (SKIP_DIRS.some((s) => p.split(path.sep).includes(s))) continue;
    if (entry.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => entry.name.endsWith(x))) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// 1. Requirements from docs/req/
// ---------------------------------------------------------------------------
function collectRequirements() {
  const reqs = new Map(); // id -> { file, line }
  for (const file of walk(REQ_DIR, [".md"])) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      // Definitions appear either as **[REQ-...]** or as **`REQ-...`** (legacy REQ-08 style).
      for (const m of text.matchAll(/(?:\[|`)(REQ-\d{2}-(?:(?:RULE|FUNC|DATA|NFR|UI|SEC)-)?\d+[A-Za-z]*)(?:\]|`)/g)) {
        if (!reqs.has(m[1])) reqs.set(m[1], { file: rel(file), line: i + 1 });
      }
    });
  }
  return reqs;
}

// ---------------------------------------------------------------------------
// 2. Test cases from docs/eval/
//    A TC row is any markdown table line that contains a TC id and at least
//    one requirement id. Classification comes from the Test Type column text.
// ---------------------------------------------------------------------------
const NEGATIVE_RE = /Negative|Stress|Concurrency|Fault|Robustness|Timeout|Reject/i;
const POSITIVE_RE = /Positive/i;

function collectTestCases() {
  const tcs = []; // { id, file, line, type, reqs }
  for (const file of walk(EVAL_DIR, [".md"])) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      const tcMatch = text.match(/`?\*?\*?(TC-[A-Za-z0-9-]+)\*?\*?`?/);
      if (!tcMatch || !/REQ-\d{2}-/.test(text)) return;
      const reqs = [...new Set([...text.matchAll(REQ_ID_RE)].map((m) => m[0]))];
      let type = "Other";
      if (POSITIVE_RE.test(text)) type = "Positive";
      else if (NEGATIVE_RE.test(text)) type = "Negative";
      tcs.push({ id: tcMatch[1], file: rel(file), line: i + 1, type, reqs, evidence: text });
    });
  }
  return tcs;
}

// ---------------------------------------------------------------------------
// 3. Code items & requirement tags
// ---------------------------------------------------------------------------
function commentBlockAbove(lines, index, extraPrefixes) {
  // Collect the contiguous comment/attribute block immediately above a
  // declaration (plus the declaration line itself).
  const block = [lines[index]];
  for (let i = index - 1; i >= 0; i--) {
    const t = lines[i].trim();
    const isComment = t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.endsWith("*/");
    const isExtra = extraPrefixes.some((p) => t.startsWith(p));
    if (t.length > 0 && (isComment || isExtra)) block.unshift(lines[i]);
    else break;
  }
  return block.join("\n");
}

function tagsIn(text) {
  return [...new Set([...text.matchAll(REQ_ID_RE)].map((m) => m[0]))];
}

function collectJsItems() {
  const items = []; // { name, kind, file, line, reqs }
  for (const file of walk(path.join(ROOT, "src"), [".js", ".jsx"])) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const declared = new Map(); // name -> line index of top-level declaration
    lines.forEach((text, i) => {
      const decl = text.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/) ||
        text.match(/^(?:export\s+)?const\s+(\w+)\s*=/);
      if (decl && !declared.has(decl[1])) declared.set(decl[1], i);
    });
    lines.forEach((text, i) => {
      let name = null;
      let kind = null;
      let declLine = i;
      let m;
      if ((m = text.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/))) {
        name = m[1]; kind = "function";
      } else if ((m = text.match(/^export\s+(?:default\s+)?class\s+(\w+)/))) {
        name = m[1]; kind = "class";
      } else if ((m = text.match(/^export\s+const\s+(\w+)\s*=/))) {
        name = m[1]; kind = "const";
      } else if ((m = text.match(/^export\s+default\s+(\w+)\s*;/))) {
        // `export default Name;` referring to an earlier top-level declaration.
        if (declared.has(m[1])) {
          name = m[1]; kind = "default export"; declLine = declared.get(m[1]);
        }
      }
      if (!name) return;
      if (items.some((it) => it.file === rel(file) && it.name === name)) return;
      const block = commentBlockAbove(lines, declLine, []);
      items.push({ name, kind, file: rel(file), line: declLine + 1, reqs: tagsIn(block) });
    });
  }
  return items;
}

function stripRustTestMods(lines) {
  // Blank out #[cfg(test)] mod blocks so their items are not collected.
  const out = [...lines];
  for (let i = 0; i < out.length; i++) {
    if (!/^\s*#\[cfg\(test\)\]/.test(out[i])) continue;
    let j = i + 1;
    while (j < out.length && /^\s*(#\[|\/\/)/.test(out[j])) j++;
    if (j >= out.length || !/\bmod\s+\w+/.test(out[j])) continue;
    let depth = 0;
    let started = false;
    for (let k = i; k < out.length; k++) {
      for (const ch of out[k]) {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") depth--;
      }
      out[k] = "";
      if (started && depth <= 0) { i = k; break; }
    }
  }
  return out;
}

function collectRustItems() {
  const items = [];
  for (const file of walk(path.join(ROOT, "src-tauri", "src"), [".rs"])) {
    const raw = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const lines = stripRustTestMods(raw);
    lines.forEach((text, i) => {
      let m;
      let name = null;
      let kind = null;
      if ((m = text.match(/^\s*pub(?:\(crate\))?\s+(?:async\s+)?fn\s+(\w+)/))) {
        name = m[1]; kind = "pub fn";
      } else if ((m = text.match(/^\s*pub\s+(struct|enum)\s+(\w+)/))) {
        name = m[2]; kind = `pub ${m[1]}`;
      } else if ((m = text.match(/^\s*(?:async\s+)?fn\s+(\w+)/))) {
        // Non-pub fn counts only when exposed as a Tauri command.
        const above = commentBlockAbove(raw, i, ["#["]);
        if (!/#\[tauri::command\]/.test(above)) return;
        name = m[1]; kind = "tauri command";
      }
      if (!name) return;
      const block = commentBlockAbove(raw, i, ["#["]);
      if (/#\[tauri::command\]/.test(block) && kind === "pub fn") kind = "tauri command";
      items.push({ name, kind, file: rel(file), line: i + 1, reqs: tagsIn(block) });
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// 4. Checks
// ---------------------------------------------------------------------------
function main() {
  const write = process.argv.includes("--write");
  const reqs = collectRequirements();
  const tcs = collectTestCases();
  const codeItems = [...collectJsItems(), ...collectRustItems()];

  const tcByReq = new Map();
  for (const tc of tcs) {
    for (const r of tc.reqs) {
      if (!tcByReq.has(r)) tcByReq.set(r, []);
      tcByReq.get(r).push(tc);
    }
  }
  const codeByReq = new Map();
  for (const item of codeItems) {
    for (const r of item.reqs) {
      if (!codeByReq.has(r)) codeByReq.set(r, []);
      codeByReq.get(r).push(item);
    }
  }

  const failures = [];
  const warnings = [];

  for (const [id, where] of reqs) {
    const list = tcByReq.get(id) || [];
    const pos = list.filter((t) => t.type === "Positive").length;
    const neg = list.filter((t) => t.type === "Negative").length;
    if (list.length === 0) failures.push(`[NO-TC] ${id} (${where.file}:${where.line}) has no test case`);
    else {
      if (pos === 0) failures.push(`[NO-POSITIVE] ${id} (${where.file}:${where.line}) has no positive test case`);
      if (neg === 0) failures.push(`[NO-NEGATIVE] ${id} (${where.file}:${where.line}) has no negative test case`);
      if (list.length < 2) failures.push(`[SINGLE-TC] ${id} (${where.file}:${where.line}) has only one test case`);
    }
    if (!codeByReq.has(id)) warnings.push(`[NO-CODE-REF] ${id} (${where.file}:${where.line}) is not referenced from code`);
  }

  for (const item of codeItems) {
    if (item.reqs.length === 0) {
      failures.push(`[UNTAGGED] ${item.file}:${item.line} ${item.kind} ${item.name} has no [REQ-...] tag`);
    }
    for (const r of item.reqs) {
      if (!reqs.has(r)) failures.push(`[UNKNOWN-REQ] ${item.file}:${item.line} ${item.name} references unknown ${r}`);
    }
  }

  for (const tc of tcs) {
    for (const r of tc.reqs) {
      if (!reqs.has(r)) failures.push(`[UNKNOWN-REQ] ${tc.file}:${tc.line} ${tc.id} references unknown ${r}`);
    }
  }

  const jsonIndex = process.argv.indexOf("--json");
  if (jsonIndex !== -1) {
    const destination = process.argv[jsonIndex + 1];
    if (!destination || destination.startsWith("--")) throw new Error("--json requires an output path");
    fs.writeFileSync(path.resolve(destination), JSON.stringify({
      requirements: [...reqs].map(([id, where]) => ({ id, ...where })),
      testCases: tcs, codeItems, failures, warnings,
    }, null, 2));
  }

  if (write) {
    writeMatrix(reqs, tcs, codeItems, tcByReq, codeByReq);
    console.log(`Wrote ${rel(MATRIX_PATH)}`);
  }

  console.log(`Requirements: ${reqs.size} | Test cases: ${tcs.length} | Tagged code items: ${codeItems.filter((i) => i.reqs.length > 0).length}/${codeItems.length}`);
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log("  " + w);
  }
  if (failures.length) {
    console.error(`\nFAIL (${failures.length} issue(s)):`);
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log("\nPASS: full requirement/test/code traceability.");
}

// ---------------------------------------------------------------------------
// 5. Matrix generation
// ---------------------------------------------------------------------------
function writeMatrix(reqs, tcs, codeItems, tcByReq, codeByReq) {
  const byDoc = new Map();
  for (const [id, where] of reqs) {
    if (!byDoc.has(where.file)) byDoc.set(where.file, []);
    byDoc.get(where.file).push(id);
  }

  const lines = [];
  lines.push("# Traceability Matrix");
  lines.push("");
  lines.push("<!-- GENERATED FILE: do not edit by hand. -->");
  lines.push("<!-- Regenerate with: npm run build:traceability -->");
  lines.push("");
  lines.push("This matrix links every requirement in [docs/req/](./req/) to the code that");
  lines.push("implements it and the test cases in [docs/eval/](./eval/) that verify it.");
  lines.push("Code locations come from `[REQ-...]` comment tags on exported functions,");
  lines.push("classes, Rust `pub` items, and Tauri commands.");
  lines.push("");
  lines.push(`- Requirements: **${reqs.size}**`);
  lines.push(`- Test cases: **${tcs.length}**`);
  lines.push(`- Tagged code items: **${codeItems.filter((i) => i.reqs.length > 0).length} / ${codeItems.length}**`);
  lines.push("");

  const docs = [...byDoc.keys()].sort();
  for (const doc of docs) {
    lines.push(`## ${doc}`);
    lines.push("");
    lines.push("| Requirement | Code references | Positive tests | Negative tests |");
    lines.push("| --- | --- | --- | --- |");
    for (const id of byDoc.get(doc)) {
      const code = (codeByReq.get(id) || [])
        .map((c) => `\`${c.file}:${c.line}\` ${c.name}`)
        .join("<br/>") || "—";
      const list = tcByReq.get(id) || [];
      const pos = list.filter((t) => t.type === "Positive").map((t) => `\`${t.id}\``).join("<br/>") || "—";
      const neg = list.filter((t) => t.type !== "Positive").map((t) => `\`${t.id}\``).join("<br/>") || "—";
      lines.push(`| \`${id}\` | ${code} | ${pos} | ${neg} |`);
    }
    lines.push("");
  }

  lines.push("## Code item index");
  lines.push("");
  lines.push("| Source item | Requirements |");
  lines.push("| --- | --- |");
  const sorted = [...codeItems].sort((a, b) => (a.file + a.name).localeCompare(b.file + b.name));
  for (const item of sorted) {
    const tags = item.reqs.map((r) => `\`${r}\``).join(" ") || "—";
    lines.push(`| \`${item.file}:${item.line}\` ${item.kind} **${item.name}** | ${tags} |`);
  }
  lines.push("");

  fs.writeFileSync(MATRIX_PATH, lines.join("\n"), "utf8");
}

main();
