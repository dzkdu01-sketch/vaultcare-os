param(
  [Parameter(Mandatory = $true)]
  [string]$From,

  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TemplateDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\docs\_template-new-project")).Path,

  # Default: only promote collab core files (AI + rules + roundtable + flywheel).
  [switch]$IncludeProjectDocs
)

$ErrorActionPreference = "Stop"

function Ensure-ParentDir([string]$Path) {
  $parent = Split-Path -Parent $Path
  if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

function ShouldPromote([string]$RelPath) {
  if ($IncludeProjectDocs) { return $true }

  if ($RelPath -eq "AI.md") { return $true }
  if ($RelPath -like ".cursor/rules/*") { return $true }
  if ($RelPath -like "docs/roundtable/*") { return $true }
  if ($RelPath -like "docs/flywheel/*") { return $true }

  return $false
}

if (-not (Test-Path -LiteralPath $TemplateDir -PathType Container)) {
  throw "Template directory not found: $TemplateDir"
}

$projectRoot = Join-Path $RepoRoot $From
if (-not (Test-Path -LiteralPath $projectRoot -PathType Container)) {
  throw "Subproject not found: $projectRoot"
}

$manifestPath = Join-Path $projectRoot "collab.manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Manifest not found in subproject: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $manifest.managed -or -not $manifest.managed.paths) {
  throw "Invalid manifest (missing managed.paths): $manifestPath"
}

Write-Host "Promoting from subproject: $From"
Write-Host "Template dir: $TemplateDir"

foreach ($relPath in $manifest.managed.paths) {
  if (-not (ShouldPromote $relPath)) {
    continue
  }

  $srcPath = Join-Path $projectRoot $relPath
  $dstPath = Join-Path $TemplateDir $relPath

  if (-not (Test-Path -LiteralPath $srcPath -PathType Leaf)) {
    Write-Host "  - SKIP (missing in subproject): $relPath"
    continue
  }

  Ensure-ParentDir $dstPath
  Copy-Item -LiteralPath $srcPath -Destination $dstPath -Force
  Write-Host "  - PROMOTE: $relPath"
}

Write-Host "Done. (Default behavior: updated template only; no auto-sync to other subprojects.)"

