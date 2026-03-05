param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TemplateDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\docs\_template-new-project")).Path
)

$ErrorActionPreference = "Stop"

function Assert-DirExists([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    throw "$Label not found: $Path"
  }
}

Assert-DirExists $TemplateDir "Template directory"

$targetDir = Join-Path $RepoRoot $Name
if (Test-Path -LiteralPath $targetDir) {
  throw "Target already exists: $targetDir"
}

New-Item -ItemType Directory -Path $targetDir | Out-Null

Write-Host "Creating subproject at: $targetDir"

# Copy template skeleton (exclude tmp/.gitignore is fine to copy)
Copy-Item -Path (Join-Path $TemplateDir "*") -Destination $targetDir -Recurse -Force

# Ensure manifest exists (template provides it)
$manifestPath = Join-Path $targetDir "collab.manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Expected manifest missing after copy: $manifestPath"
}

# Best-effort: replace project name placeholder in manifest + docs
try {
  $manifestJson = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $manifestJson.project.name = $Name
  ($manifestJson | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $manifestPath -Encoding UTF8
} catch {
  Write-Warning "Failed to update manifest project.name (non-fatal): $_"
}

Write-Host "Done."
Write-Host "Next:"
Write-Host "  - Open $Name/AI.md"
Write-Host "  - Start a new chat with: /启动"

