// [SEQ-MD-01][SPLASH] Copies the generated HASM splash bundle from hasm_logo into
// public/splash so Vite serves it in dev and bundles it into dist for the Tauri
// `splashscreen` window. Only the `hasm` family is used; `hasm_markdown` is untouched.
// The `sprash_*` spelling is defined by hasm_logo. When the generated files are absent
// (they are gitignored in hasm_logo, e.g. on fresh CI checkouts), they are regenerated
// into a temporary directory with hasm_logo/scripts/generate_splash.py.
// Pass --regenerate to always regenerate.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const logoRepo = join(repoRoot, 'hasm_logo');
const generator = join(logoRepo, 'scripts', 'generate_splash.py');
const generatedDir = join(logoRepo, 'logo', 'hasm');
const targetDir = join(repoRoot, 'public', 'splash');

const splashFiles = [
  'sprash_animation.html',
  'sprash_animation.css',
  'sprash_animation.js',
  'hasm_logo_transparent.png',
];

const hasAllFiles = (dir) => splashFiles.every((file) => existsSync(join(dir, file)));

function pythonCandidates() {
  if (process.env.HASM_PYTHON) return [process.env.HASM_PYTHON];
  return process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
}

function regenerate(outputRoot) {
  if (!existsSync(generator)) {
    throw new Error(`[SEQ-MD-01][SPLASH] Splash generator not found: ${generator}. Run: git submodule update --init --recursive`);
  }
  const failures = [];
  for (const python of pythonCandidates()) {
    const result = spawnSync(python, [generator, '--output-dir', outputRoot], { cwd: logoRepo, encoding: 'utf8' });
    if (result.status === 0) {
      console.log(`[SEQ-MD-01][SPLASH] Regenerated splash bundle with ${python}`);
      return;
    }
    failures.push(`${python}: ${result.error?.message || result.stderr?.trim() || `exit ${result.status}`}`);
  }
  throw new Error(
    '[SEQ-MD-01][SPLASH] Cannot generate splash bundle. Install Python 3.10+ and run '
      + '`python -m pip install ./hasm_logo` (Node.js 22.7+ is also required).\n'
      + failures.join('\n'),
  );
}

let sourceDir = generatedDir;
let tempRoot = null;
try {
  if (process.argv.includes('--regenerate') || !hasAllFiles(generatedDir)) {
    tempRoot = mkdtempSync(join(tmpdir(), 'hasm-splash-'));
    regenerate(tempRoot);
    sourceDir = join(tempRoot, 'hasm');
    if (!hasAllFiles(sourceDir)) {
      throw new Error(`[SEQ-MD-01][SPLASH] Generator did not produce: ${splashFiles.join(', ')}`);
    }
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  for (const file of splashFiles) {
    copyFileSync(join(sourceDir, file), join(targetDir, file));
  }
  console.log(`[SEQ-MD-01][SPLASH] Synced splash bundle to ${targetDir}`);
} finally {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
}
