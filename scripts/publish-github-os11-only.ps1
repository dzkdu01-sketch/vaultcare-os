#
# Publishes ONLY vault-os1.1 folder to GitHub with git push --force (replaces remote history).
#
# Usage:
#   cd D:\cursor\vault-os1.1\scripts
#   .\publish-github-os11-only.ps1
#
# Optional:
#   -RemoteUrl <url>   (default: vaultcare-os)
#   -SkipConfirm       skip YES prompt
#

param(
  [string] $RemoteUrl = 'https://github.com/dzkdu01-sketch/vaultcare-os.git',
  [switch] $SkipConfirm
)

$ErrorActionPreference = 'Stop'

$osRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$tempRoot = Join-Path $env:TEMP ("vaultcare-os11-only-{0}" -f [Guid]::NewGuid().ToString('N').Substring(0, 8))

if (-not $SkipConfirm) {
  Write-Host ""
  Write-Host "This will:" -ForegroundColor Yellow
  Write-Host "  1) Copy folder to temp: $osRoot -> $tempRoot"
  Write-Host "  2) git init, git add (respects .gitignore), commit"
  Write-Host "  3) git push --force to: $RemoteUrl"
  Write-Host "  Remote repo will be OVERWRITTEN." -ForegroundColor Red
  $ok = Read-Host "Type YES (uppercase) to continue"
  if ($ok -ne 'YES') { Write-Host "Cancelled."; exit 0 }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found. Install Git for Windows."
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

# Windows: file named "nul" breaks git add; remove if present (extended path)
$osFull = (Resolve-Path $osRoot).Path
$nulPath = "\\?\$osFull\nul"
if (Test-Path -LiteralPath $nulPath) {
  Remove-Item -LiteralPath $nulPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Copying (excluding node_modules, dist)..." -ForegroundColor Cyan
robocopy $osRoot $tempRoot /E /XD node_modules dist .git .worktrees `
  /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Error "robocopy failed with exit code: $LASTEXITCODE"
}

Push-Location $tempRoot
try {
  git init -b main
  # Local identity only for this temp repo (avoids failed commit when global user.name/email unset)
  git config user.email "publish@vault-os1.1.local"
  git config user.name "vault-os11-publish"
  git config core.longpaths true
  git add -A
  # Must check STAGED files only: porcelain includes ?? untracked; old check was wrong.
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Error "Nothing staged after git add. Remove/rename Windows reserved file 'nul' in vault-os1.1 if present, then retry."
  }
  git commit -m "chore: repository contains only vault-os1.1"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "git commit failed (exit $LASTEXITCODE). Check git output above."
  }
  $remotes = @(git remote 2>$null)
  if ($remotes -contains 'origin') {
    git remote set-url origin $RemoteUrl
  } else {
    git remote add origin $RemoteUrl
  }
  Write-Host "Pushing to GitHub (--force)..." -ForegroundColor Cyan
  git push -u origin main --force
  if ($LASTEXITCODE -ne 0) {
    Write-Error "git push failed (exit $LASTEXITCODE). Check auth (HTTPS token) and network."
  }
  Write-Host ""
  Write-Host "Done. Remote repo now only has this tree." -ForegroundColor Green
}
finally {
  Pop-Location
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
