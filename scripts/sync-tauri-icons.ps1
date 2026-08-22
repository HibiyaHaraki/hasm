$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $repoRoot "hasm_logo\logo\hasm"
$targetDir = Join-Path $repoRoot "src-tauri\icons"

if (-not (Test-Path $sourceDir)) {
  throw "[SEQ-MD-01][ICON] Source logo directory not found: $sourceDir"
}

$requiredFiles = @(
  "hasm_favicon.png",
  "hasm_logo_transparent.png",
  "hasm_logo_light_bg.png",
  "hasm_logo_dark_bg.png"
)

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

foreach ($fileName in $requiredFiles) {
  $sourcePath = Join-Path $sourceDir $fileName
  if (-not (Test-Path $sourcePath)) {
    throw "[SEQ-MD-01][ICON] Required logo file missing: $sourcePath"
  }

  $targetPath = Join-Path $targetDir $fileName
  Copy-Item -Force $sourcePath $targetPath
}

$iconSource = Join-Path $sourceDir "hasm_favicon.png"
Push-Location $repoRoot
try {
  # Generate Tauri-required platform icon files (e.g. icon.ico/icon.icns) from HASM source art.
  & npx tauri icon $iconSource --output $targetDir
  if ($LASTEXITCODE -ne 0) {
    throw "[SEQ-MD-01][ICON] Failed to generate Tauri icon set from $iconSource"
  }

  $keepFiles = @(
    "hasm_favicon.png",
    "hasm_logo_transparent.png",
    "hasm_logo_light_bg.png",
    "hasm_logo_dark_bg.png",
    "icon.ico",
    "icon.icns"
  )

  Get-ChildItem -Path $targetDir -File | Where-Object { $keepFiles -notcontains $_.Name } | Remove-Item -Force
  Get-ChildItem -Path $targetDir -Directory | Remove-Item -Recurse -Force
}
finally {
  Pop-Location
}

Write-Host "[SEQ-MD-01][ICON] Synced and generated HASM icons in $targetDir"
