# One-click push script (Windows PowerShell)
# Usage:
#   .\一键推送.ps1 "commit message"             # default target is vault
#   .\一键推送.ps1 "commit message" "vault"     # explicit target directory
#   .\一键推送.ps1                               # auto timestamp message

param(
    [Parameter(Position = 0)]
    [string]$Message,
    [Parameter(Position = 1)]
    [string]$TargetPath = "vault"
)

$ErrorActionPreference = "Stop"

function Fail-And-Exit {
    param([string]$Text)
    Write-Host ""
    Write-Host "Failed: $Text" -ForegroundColor Red
    Write-Host "Stopped safely. Your local changes are still preserved." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Useful rollback commands:" -ForegroundColor Cyan
    Write-Host "1) Undo last local commit (keep changes): git reset --soft HEAD~1"
    Write-Host "2) Safe rollback after push:             git revert <commit-hash>"
    Write-Host "3) View operation history:               git reflog"
    exit 1
}

try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null).Trim()
    if (-not $repoRoot) {
        Fail-And-Exit "Current directory is not a Git repository."
    }

    Set-Location $repoRoot

    $branch = (git branch --show-current).Trim()
    if (-not $branch) {
        Fail-And-Exit "Cannot detect current branch."
    }

    if (-not $Message -or -not $Message.Trim()) {
        $Message = "chore: quick update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    } else {
        $Message = $Message.Trim()
    }

    $normalizedTarget = $TargetPath.Trim().Replace('\', '/').Trim('/')
    if (-not $normalizedTarget) {
        Fail-And-Exit "TargetPath cannot be empty."
    }
    if (-not (Test-Path (Join-Path $repoRoot $normalizedTarget))) {
        Fail-And-Exit "Target directory does not exist: $normalizedTarget"
    }

    # Prevent accidental commits outside target directory.
    $stagedFiles = git diff --cached --name-only
    if ($stagedFiles) {
        $outsideStaged = @($stagedFiles | Where-Object {
            $_ -and -not (($_ -replace '\\', '/').StartsWith("$normalizedTarget/"))
        })
        if ($outsideStaged.Count -gt 0) {
            Write-Host "Detected staged files outside target directory:" -ForegroundColor Yellow
            $outsideStaged | ForEach-Object { Write-Host "  - $_" }
            Fail-And-Exit "Please clean the staging area first, then retry."
        }
    }

    $status = git status --porcelain -- "$normalizedTarget"
    if (-not $status) {
        Write-Host "No changes found in target directory: $normalizedTarget" -ForegroundColor Yellow
        exit 0
    }

    Write-Host "Repository: $repoRoot" -ForegroundColor Cyan
    Write-Host "Branch: $branch" -ForegroundColor Cyan
    Write-Host "Target directory: $normalizedTarget" -ForegroundColor Cyan
    Write-Host "Commit message: $Message" -ForegroundColor Cyan
    Write-Host ""

    git add -A -- "$normalizedTarget"
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git add failed." }

    git commit -m "$Message"
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git commit failed." }

    $upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
    if ($LASTEXITCODE -eq 0 -and $upstream) {
        git push
    } else {
        git push -u origin $branch
    }
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git push failed (network, permission, or remote config issue)." }

    Write-Host ""
    Write-Host "Done: committed and pushed to origin/$branch" -ForegroundColor Green
} catch {
    Fail-And-Exit $_.Exception.Message
}
