// Cross-platform port of build-hasm-markdown.ps1 so release builds run on Windows/macOS/Linux CI.
// Builds the hasm_markdown submodule binary and stages it under src-tauri/binaries so the
// distribution bundle can include it via the "resources" entry in tauri.distribution.conf.json.
// NOTE: The output is always named hasm_markdown.exe because the Rust side resolves it via
// MARKDOWN_EXECUTABLE in src-tauri/src/hasm/app_commands.rs on every platform.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const submoduleManifest = join(repoRoot, 'src-tauri', 'hasm_markdown', 'src-tauri', 'Cargo.toml');
const builtName = process.platform === 'win32' ? 'hasm_markdown.exe' : 'hasm_markdown';
const sourceExecutable = join(repoRoot, 'src-tauri', 'hasm_markdown', 'src-tauri', 'target', 'release', builtName);
const outputDirectory = join(repoRoot, 'src-tauri', 'binaries');
const targetExecutable = join(outputDirectory, 'hasm_markdown.exe');

execFileSync('cargo', ['build', '--manifest-path', submoduleManifest, '--release'], { stdio: 'inherit' });

mkdirSync(outputDirectory, { recursive: true });
copyFileSync(sourceExecutable, targetExecutable);
if (process.platform !== 'win32') {
  // Resources copied into the bundle must stay executable on Unix-like systems.
  chmodSync(targetExecutable, 0o755);
}
