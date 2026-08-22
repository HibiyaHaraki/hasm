$ErrorActionPreference = "Stop"

$submoduleManifest = Join-Path $PSScriptRoot "..\src-tauri\hasm_markdown\src-tauri\Cargo.toml"
$outputDirectory = Join-Path $PSScriptRoot "..\src-tauri\binaries"
$sourceExecutable = Join-Path $PSScriptRoot "..\src-tauri\hasm_markdown\src-tauri\target\release\hasm_markdown.exe"
$targetExecutable = Join-Path $outputDirectory "hasm_markdown.exe"

cargo build --manifest-path $submoduleManifest --release
if ($LASTEXITCODE -ne 0) {
	throw "HASM Markdown release build failed."
}
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Copy-Item -Force $sourceExecutable $targetExecutable