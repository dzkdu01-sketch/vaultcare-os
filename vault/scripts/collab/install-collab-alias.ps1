param(
    [switch]$Force,
    [switch]$EnableAutoBridge,
    [string]$WorkspaceRoot = "D:\cursor"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$defaultEntryScript = Join-Path $repoRoot "collab.ps1"
if (-not (Test-Path $defaultEntryScript)) {
    throw "collab.ps1 not found: $defaultEntryScript"
}

$workspaceRootResolved = $WorkspaceRoot
if (-not (Test-Path $workspaceRootResolved)) {
    throw "WorkspaceRoot not found: $workspaceRootResolved"
}

$workspaceRootResolved = (Resolve-Path $workspaceRootResolved).Path

$profilePath = $PROFILE.CurrentUserCurrentHost
$profileDir = Split-Path -Parent $profilePath
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir | Out-Null
}
if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath | Out-Null
}

$startMarker = "# >>> collab alias start >>>"
$endMarker = "# <<< collab alias end <<<"
$autoBridgeLiteral = if ($EnableAutoBridge) { '$true' } else { '$false' }

$block = @"
$startMarker
`$global:COLLAB_AUTO_BRIDGE = $autoBridgeLiteral
`$global:COLLAB_WORKSPACE_ROOT = '$workspaceRootResolved'

function Resolve-CollabEntry {
    param([string]`$StartDir)
    if ([string]::IsNullOrWhiteSpace(`$StartDir)) {
        `$StartDir = (Get-Location).Path
    }

    `$current = (Resolve-Path `$StartDir).Path
    while (`$true) {
        `$candidate = Join-Path `$current "collab.ps1"
        if (Test-Path `$candidate) {
            return `$candidate
        }
        if (`$current -eq `$global:COLLAB_WORKSPACE_ROOT) {
            break
        }
        `$parent = Split-Path -Parent `$current
        if ([string]::IsNullOrWhiteSpace(`$parent) -or `$parent -eq `$current) {
            break
        }
        `$current = `$parent
    }
    return '$defaultEntryScript'
}

function collab {
    param([Parameter(ValueFromRemainingArguments=`$true)][string[]]`$Args)
    `$entry = Resolve-CollabEntry -StartDir (Get-Location).Path
    & `$entry @Args
}
if (`$global:COLLAB_AUTO_BRIDGE) {
    try {
        `$pwdPath = (Get-Location).Path
        if (`$pwdPath -like "`$(`$global:COLLAB_WORKSPACE_ROOT)*") {
            `$entry = Resolve-CollabEntry -StartDir `$pwdPath
            & `$entry bridge-zh -Quiet
        }
    }
    catch {
        # ignore auto-bridge failure at startup
    }
}
$endMarker
"@

$raw = Get-Content -Path $profilePath -Raw -Encoding UTF8
$hasBlock = ($raw -match [regex]::Escape($startMarker)) -and ($raw -match [regex]::Escape($endMarker))

if ($hasBlock -and -not $Force) {
    Write-Host "Alias block already exists in profile: $profilePath"
    Write-Host "Use -Force to overwrite."
    exit 0
}

if ($hasBlock -and $Force) {
    $pattern = "(?s)" + [regex]::Escape($startMarker) + ".*?" + [regex]::Escape($endMarker)
    $raw = [regex]::Replace($raw, $pattern, $block.TrimEnd())
    Set-Content -Path $profilePath -Value $raw -Encoding UTF8
}
else {
    if ([string]::IsNullOrWhiteSpace($raw)) {
        Set-Content -Path $profilePath -Value ($block.TrimEnd() + "`r`n") -Encoding UTF8
    }
    else {
        $newContent = $raw.TrimEnd() + "`r`n`r`n" + $block.TrimEnd() + "`r`n"
        Set-Content -Path $profilePath -Value $newContent -Encoding UTF8
    }
}

Write-Host "Installed collab alias to profile: $profilePath"
Write-Host "Workspace root: $workspaceRootResolved"
if ($EnableAutoBridge) {
    Write-Host "Auto bridge is enabled for new PowerShell sessions."
}
else {
    Write-Host "Auto bridge is disabled."
}
Write-Host "Open a new PowerShell session, then run: collab start"
