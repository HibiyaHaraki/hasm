// Cross-platform port of sync-tauri-icons.ps1 so release builds run on Windows/macOS/Linux CI.
// [SEQ-MD-01][ICON] Copies HASM source art into src-tauri/icons and regenerates the Tauri icon set.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, 'hasm_logo', 'logo', 'hasm');
const targetDir_tauri = join(repoRoot, 'src-tauri', 'icons');

const requiredFiles = [
  'hasm_favicon.png',
  'hasm_logo_transparent.png',
  'hasm_logo_light_bg.png',
  'hasm_logo_dark_bg.png',
];

if (!existsSync(sourceDir)) {
  throw new Error(`[SEQ-MD-01][ICON] Source logo directory not found: ${sourceDir}`);
}

mkdirSync(targetDir_tauri, { recursive: true });

for (const fileName of requiredFiles) {
  const sourcePath = join(sourceDir, fileName);
  if (!existsSync(sourcePath)) {
    throw new Error(`[SEQ-MD-01][ICON] Required logo file missing: ${sourcePath}`);
  }
  copyFileSync(sourcePath, join(targetDir_tauri, fileName));
}

// Generate Tauri-required platform icon files (e.g. icon.ico/icon.icns) from HASM source art.
// Windows cannot spawn .cmd shims without a shell (CVE-2024-27980 hardening), so enable it there.
execFileSync(
  'npx',
  ['tauri', 'icon', join(sourceDir, 'hasm_favicon.png'), '--output', targetDir_tauri],
  { stdio: 'inherit', cwd: repoRoot, shell: process.platform === 'win32' }
);

var keepFiles = new Set([...requiredFiles, 'icon.ico', 'icon.icns']);
for (const entry of readdirSync(targetDir_tauri)) {
  const entryPath = join(targetDir_tauri, entry);
  if (statSync(entryPath).isDirectory()) {
    rmSync(entryPath, { recursive: true, force: true });
  } else if (!keepFiles.has(entry)) {
    rmSync(entryPath, { force: true });
  }
}

const targetDir_jsx = join(repoRoot, 'src', 'icons');

if (!existsSync(sourceDir)) {
  throw new Error(`[SEQ-MD-01][ICON] Source logo directory not found: ${sourceDir}`);
}

mkdirSync(targetDir_jsx, { recursive: true });

for (const fileName of requiredFiles) {
  const sourcePath = join(sourceDir, fileName);
  if (!existsSync(sourcePath)) {
    throw new Error(`[SEQ-MD-01][ICON] Required logo file missing: ${sourcePath}`);
  }
  copyFileSync(sourcePath, join(targetDir_tauri, fileName));
}

// Generate Tauri-required platform icon files (e.g. icon.ico/icon.icns) from HASM source art.
// Windows cannot spawn .cmd shims without a shell (CVE-2024-27980 hardening), so enable it there.
execFileSync(
  'npx',
  ['tauri', 'icon', join(sourceDir, 'hasm_favicon.png'), '--output', targetDir_jsx],
  { stdio: 'inherit', cwd: repoRoot, shell: process.platform === 'win32' }
);

keepFiles = new Set([...requiredFiles, 'icon.ico', 'icon.icns']);
for (const entry of readdirSync(targetDir_jsx)) {
  const entryPath = join(targetDir_jsx, entry);
  if (statSync(entryPath).isDirectory()) {
    rmSync(entryPath, { recursive: true, force: true });
  } else if (!keepFiles.has(entry)) {
    rmSync(entryPath, { force: true });
  }
}
