$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $repoRoot "hasm_logo\logo\hasm"
$targetDir_tauri = Join-Path $repoRoot "src-tauri\icons"
$targetDir_jsx = Join-Path $repoRoot "src\icons"

if (-not (Test-Path $sourceDir)) {
  throw "[SEQ-MD-01][ICON] Source logo directory not found: $sourceDir"
}

$requiredFiles = @(
  "hasm_favicon.png",
  "hasm_logo_transparent.png",
  "hasm_logo_light_bg.png",
  "hasm_logo_dark_bg.png"
)

New-Item -ItemType Directory -Force -Path $targetDir_tauri | Out-Null
New-Item -ItemType Directory -Force -Path $targetDir_jsx | Out-Null

foreach ($fileName in $requiredFiles) {
  $sourcePath = Join-Path $sourceDir $fileName
  if (-not (Test-Path $sourcePath)) {
    throw "[SEQ-MD-01][ICON] Required logo file missing: $sourcePath"
  }

  $targetPath_tauri = Join-Path $targetDir_tauri $fileName
  Copy-Item -Force $sourcePath $targetPath_tauri

  $targetPath_jsx = Join-Path $targetDir_jsx $fileName
  Copy-Item -Force $sourcePath $targetPath_jsx
}

$iconSource = Join-Path $sourceDir "hasm_favicon.png"
Push-Location $repoRoot
try {
  # Generate Tauri-required platform icon files (e.g. icon.ico/icon.icns) from HASM source art.
  & npx tauri icon $iconSource --output $targetDir_tauri
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

  Get-ChildItem -Path $targetDir_tauri -File | Where-Object { $keepFiles -notcontains $_.Name } | Remove-Item -Force
  Get-ChildItem -Path $targetDir_tauri -Directory | Remove-Item -Recurse -Force
}
finally {
  Pop-Location
}

Write-Host "[SEQ-MD-01][ICON] Synced and generated HASM icons in $targetDir_tauri"

New-Item -ItemType Directory -Force -Path $targetDir_jsx | Out-Null

foreach ($fileName in $requiredFiles) {
  $sourcePath = Join-Path $sourceDir $fileName
  if (-not (Test-Path $sourcePath)) {
    throw "[SEQ-MD-01][ICON] Required logo file missing: $sourcePath"
  }

  $targetPath_jsx = Join-Path $targetDir_jsx $fileName
  Copy-Item -Force $sourcePath $targetPath_jsx
}

try {
  # Generate Tauri-required platform icon files (e.g. icon.ico/icon.icns) from HASM source art.
  & npx tauri icon $iconSource --output $targetDir_jsx
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

  Get-ChildItem -Path $targetDir_jsx -File | Where-Object { $keepFiles -notcontains $_.Name } | Remove-Item -Force
  Get-ChildItem -Path $targetDir_jsx -Directory | Remove-Item -Recurse -Force
}
finally {
  Pop-Location
}

Write-Host "[SEQ-MD-01][ICON] Synced and generated HASM icons in $targetDir_jsx"
