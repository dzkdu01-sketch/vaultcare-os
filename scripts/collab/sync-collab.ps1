param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TemplateDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\docs\_template-new-project")).Path,
  [switch]$Force,
  [string[]]$Only
)

$ErrorActionPreference = "Stop"

function Get-FileHashHex([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Ensure-ParentDir([string]$Path) {
  $parent = Split-Path -Parent $Path
  if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

function Copy-TemplateToDest([string]$TemplatePath, [string]$DestPath) {
  Ensure-ParentDir $DestPath
  Copy-Item -LiteralPath $TemplatePath -Destination $DestPath -Force
}

if (-not (Test-Path -LiteralPath $TemplateDir -PathType Container)) {
  throw "Template directory not found: $TemplateDir"
}

$manifests = Get-ChildItem -LiteralPath $RepoRoot -Filter "collab.manifest.json" -Recurse -File -Force
if ($manifests.Count -eq 0) {
  Write-Host "No collab.manifest.json found under: $RepoRoot"
  exit 0
}

Write-Host "Found manifests: $($manifests.Count)"

foreach ($manifestFile in $manifests) {
  $projectRoot = $manifestFile.Directory.FullName
  if ((Resolve-Path -LiteralPath $projectRoot).Path -eq (Resolve-Path -LiteralPath $TemplateDir).Path) {
    Write-Host ""
    Write-Host "== Skip template directory ==" 
    continue
  }
  $onlySet = @()
  if ($Only -and ($Only.Count -gt 0)) {
    foreach ($item in $Only) {
      if ($null -eq $item) { continue }
      $item.Split(",") | ForEach-Object {
        $trimmed = $_.Trim()
        if ($trimmed) { $onlySet += $trimmed }
      }
    }
  }
  if ($onlySet.Count -gt 0) {
    $projectName = $manifestFile.Directory.Name
    if (-not ($onlySet -contains $projectName)) {
      continue
    }
  }
  Write-Host ""
  Write-Host "== Sync subproject: $($manifestFile.Directory.Name) =="

  $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json

  if (-not $manifest.managed -or -not $manifest.managed.paths) {
    Write-Warning "Skipping (no managed.paths): $($manifestFile.FullName)"
    continue
  }

  if (-not $manifest.managed.last_synced_hash) {
    $manifest.managed | Add-Member -MemberType NoteProperty -Name last_synced_hash -Value (@{})
  }

  foreach ($relPath in $manifest.managed.paths) {
    $templatePath = Join-Path $TemplateDir $relPath
    $destPath = Join-Path $projectRoot $relPath

    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
      Write-Host "  - SKIP (no template source): $relPath"
      continue
    }

    $isTracked = $false
    $trackedHash = $null
    if ($manifest.managed.last_synced_hash.PSObject.Properties.Name -contains $relPath) {
      $isTracked = $true
      $trackedHash = [string]$manifest.managed.last_synced_hash.$relPath
    }

    if (-not (Test-Path -LiteralPath $destPath -PathType Leaf)) {
      Copy-TemplateToDest $templatePath $destPath
      $newHash = Get-FileHashHex $destPath
      $manifest.managed.last_synced_hash | Add-Member -MemberType NoteProperty -Name $relPath -Value $newHash -Force
      Write-Host "  - ADD  : $relPath"
      continue
    }

    if ($Force) {
      Copy-TemplateToDest $templatePath $destPath
      $newHash = Get-FileHashHex $destPath
      $manifest.managed.last_synced_hash | Add-Member -MemberType NoteProperty -Name $relPath -Value $newHash -Force
      Write-Host "  - FORCE: $relPath"
      continue
    }

    if ($isTracked) {
      $currentHash = Get-FileHashHex $destPath
      if ($currentHash -eq $trackedHash) {
        $tplHash = Get-FileHashHex $templatePath
        if ($tplHash -eq $currentHash) {
          Write-Host "  - OK   : $relPath"
        } else {
          Copy-TemplateToDest $templatePath $destPath
          $newHash = Get-FileHashHex $destPath
          $manifest.managed.last_synced_hash | Add-Member -MemberType NoteProperty -Name $relPath -Value $newHash -Force
          Write-Host "  - UPD  : $relPath"
        }
      } else {
        Write-Host "  - KEEP : $relPath (local modified)"
      }
      continue
    }

    # Not tracked yet: only start tracking if it's identical to template
    $destHash = Get-FileHashHex $destPath
    $tplHash = Get-FileHashHex $templatePath
    if ($destHash -eq $tplHash) {
      $manifest.managed.last_synced_hash | Add-Member -MemberType NoteProperty -Name $relPath -Value $destHash -Force
      Write-Host "  - TRACK: $relPath"
    } else {
      Write-Host "  - KEEP : $relPath (untracked)"
    }
  }

  ($manifest | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $manifestFile.FullName -Encoding UTF8
}

Write-Host ""
Write-Host "Done."

