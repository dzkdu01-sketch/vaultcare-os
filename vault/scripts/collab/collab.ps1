param(
    [ValidateSet("start", "develop", "bug", "close", "help", "bridge", "bridge-zh")]
    [string]$Command,
    [string]$Mode,
    [string]$Goal,
    [string]$Priority = "P1",
    [string]$NotDo,
    [string]$Acceptance,
    [string]$BacklogId,
    [string]$Symptom,
    [string]$Repro,
    [string]$Expected,
    [string]$Impact,
    [string]$Result,
    [string]$Summary,
    [string]$Changed,
    [string]$Docs,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Set-ConsoleCodePageUtf8 {
    try {
        Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class CollabConsoleCodePage {
    [DllImport("kernel32.dll")]
    public static extern bool SetConsoleCP(uint wCodePageID);
    [DllImport("kernel32.dll")]
    public static extern bool SetConsoleOutputCP(uint wCodePageID);
}
"@ -ErrorAction SilentlyContinue | Out-Null
        [CollabConsoleCodePage]::SetConsoleCP(65001) | Out-Null
        [CollabConsoleCodePage]::SetConsoleOutputCP(65001) | Out-Null
    }
    catch {
        # ignore code page setup failure and keep defaults
    }
}

function Initialize-ConsoleUtf8 {
    try {
        Set-ConsoleCodePageUtf8
        $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [Console]::InputEncoding = $utf8NoBom
        [Console]::OutputEncoding = $utf8NoBom
        $global:OutputEncoding = $utf8NoBom
    }
    catch {
        # ignore encoding setup failure and keep defaults
    }
}

Initialize-ConsoleUtf8

function Get-RepoRoot {
    return (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
}

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        return ""
    }
    return Get-Content -Path $Path -Raw -Encoding UTF8
}

function Write-Text([string]$Path, [string]$Content) {
    Set-Content -Path $Path -Value $Content -Encoding UTF8
}

function New-BacklogId {
    $date = Get-Date -Format "yyyyMMdd"
    $seq = Get-Date -Format "HHmmss"
    return "BL-$date-$seq"
}

function Get-BacklogRows([string]$BacklogPath) {
    $content = Read-Text $BacklogPath
    $pattern = '(?m)^\|\s*(BL-\d{8}-\d+)\s*\|\s*([^|]+)\|\s*(P[0-2])\s*\|\s*(pending|in_progress|blocked|done)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|'
    $matches = [regex]::Matches($content, $pattern)
    $rows = @()
    foreach ($m in $matches) {
        $rows += [pscustomobject]@{
            Id         = $m.Groups[1].Value.Trim()
            Type       = $m.Groups[2].Value.Trim()
            Priority   = $m.Groups[3].Value.Trim()
            Status     = $m.Groups[4].Value.Trim()
            Goal       = $m.Groups[5].Value.Trim()
            NotDo      = $m.Groups[6].Value.Trim()
            Acceptance = $m.Groups[7].Value.Trim()
            Related    = $m.Groups[8].Value.Trim()
        }
    }
    return $rows
}

function Add-BacklogRow(
    [string]$BacklogPath,
    [string]$Id,
    [string]$Type,
    [string]$Priority,
    [string]$Status,
    [string]$Goal,
    [string]$NotDo,
    [string]$Acceptance,
    [string]$Related
) {
    $lines = Get-Content -Path $BacklogPath -Encoding UTF8
    $insertIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -like "## *Template*") {
            $insertIdx = $i
            break
        }
        if ($lines[$i] -like "## 新增事项模板*") {
            $insertIdx = $i
            break
        }
    }
    if ($insertIdx -lt 0) {
        $insertIdx = $lines.Count
    }

    $safeGoal = $Goal.Replace("|", "/")
    $safeNotDo = $NotDo.Replace("|", "/")
    $safeAcceptance = $Acceptance.Replace("|", "/")
    $safeRelated = $Related.Replace("|", "/")

    $row = "| $Id | $Type | $Priority | $Status | $safeGoal | $safeNotDo | $safeAcceptance | $safeRelated |"
    $newLines = @()
    if ($insertIdx -gt 0) {
        $newLines += $lines[0..($insertIdx - 1)]
    }
    $newLines += $row
    if ($insertIdx -lt $lines.Count) {
        $newLines += $lines[$insertIdx..($lines.Count - 1)]
    }
    Set-Content -Path $BacklogPath -Value $newLines -Encoding UTF8
}

function Update-BacklogStatus([string]$BacklogPath, [string]$Id, [string]$Status) {
    $content = Read-Text $BacklogPath
    $escapedId = [regex]::Escape($Id)
    $pattern = "(?m)^(\|\s*$escapedId\s*\|\s*[^|]+\|\s*[^|]+\|\s*)(pending|in_progress|blocked|done)(\s*\|.*)$"
    $updated = [regex]::Replace($content, $pattern, "`$1$Status`$3")
    Write-Text $BacklogPath $updated
}

function Append-BugIntake([string]$StatusPath, [string]$Symptom, [string]$Repro, [string]$Expected, [string]$Impact, [string]$BacklogId) {
    $content = Read-Text $StatusPath
    $sectionTitle = "## Bug Quick Intake (Cross IDE)"
    $time = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $entry = "- [$time] [$BacklogId] Symptom: $Symptom; Repro: $Repro; Expected: $Expected; Impact: $Impact"

    if ($content -notmatch [regex]::Escape($sectionTitle)) {
        $content = $content.TrimEnd() + "`r`n`r`n---`r`n`r`n$sectionTitle`r`n`r`n$entry`r`n"
    }
    else {
        $content = $content.TrimEnd() + "`r`n$entry`r`n"
    }
    Write-Text $StatusPath $content
}

function New-CloseLog([string]$AutoDir, [string]$BacklogId, [string]$Result, [string]$Summary, [string]$Changed, [string]$Docs) {
    if (-not (Test-Path $AutoDir)) {
        New-Item -ItemType Directory -Path $AutoDir | Out-Null
    }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $path = Join-Path $AutoDir "session-$stamp-close.md"
    $closedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $body = @"
# Development Close Record (Cross IDE)

- backlog_id: $BacklogId
- closed_at: $closedAt
- result: $Result

## Validation Result

$Summary

## Change List

$Changed

## Docs Backfill

$Docs
"@
    Set-Content -Path $path -Value $body -Encoding UTF8
    return $path
}

function Show-StartInfo {
    Write-Host ""
    Write-Host "=== Cross IDE Collaboration Start ===" -ForegroundColor Cyan
    Write-Host "1) Read docs/status/current-status.md"
    Write-Host "2) Read docs/handover.md"
    Write-Host "3) Rules in AI.md"
    Write-Host "4) Backlog in docs/plans/development-backlog.md"
    Write-Host ""
    Write-Host "Suggested first chat message: /start or /启动"
}

function Show-Help {
    Write-Host ""
    Write-Host "=== collab help ===" -ForegroundColor Cyan
    Write-Host "Cross-IDE collaboration executor commands:"
    Write-Host ""
    Write-Host "1) Start"
    Write-Host "   collab start"
    Write-Host ""
    Write-Host "2) Develop (interactive)"
    Write-Host "   collab develop"
    Write-Host ""
    Write-Host "3) Develop (non-interactive)"
    Write-Host "   collab develop -Mode new -Goal `"One-line goal`" -Priority P1 -NotDo `"Out of scope`" -Acceptance `"Acceptance summary`""
    Write-Host "   collab develop -Mode continue -BacklogId BL-YYYYMMDD-XXXXXX"
    Write-Host "   collab develop -Mode summary"
    Write-Host ""
    Write-Host "4) Bug"
    Write-Host "   collab bug -Symptom `"Issue summary`" -Repro `"Steps`" -Expected `"Expected behavior`" -Impact `"Scope`""
    Write-Host ""
    Write-Host "5) Close"
    Write-Host "   collab close -BacklogId BL-YYYYMMDD-XXXXXX -Result pass -Summary `"Validation`" -Changed `"Changes`" -Docs `"status,matrix,consensus`""
    Write-Host ""
    Write-Host "6) Bridge (for other IDE chat)"
    Write-Host "   collab bridge"
    Write-Host "   collab bridge-zh"
    Write-Host ""
    Write-Host "Docs:"
    Write-Host "   docs/governance/cross-ide-executor-v1.md"
}

function Show-BridgePrompt([switch]$QuietMode) {
    $prompt = @"
Follow these rules strictly for the Vault project:
1) If I type "develop", ask me to choose: new development / continue unfinished / view progress.
2) For new development, run roundtable-style evaluation first (requirement -> acceptance draft -> risk), then gate confirmation.
3) Development gate must be complete: one-line goal, at least one out-of-scope item, 3-5 acceptance criteria (at least one page behavior).
4) After gate confirmation, add item to docs/plans/development-backlog.md before implementation.
5) If my request conflicts with collaboration rules, show conflict point + impact scope + alternative, then wait for my confirmation.
6) After development or bugfix, auto-close with: validation result, change list, docs backfill list (max 3), backlog status update, next action.
7) In a new session, read in order: docs/status/current-status.md -> docs/handover.md -> docs/process-registry.md -> docs/roundtable/INTENTS-GUIDE.md
"@

    if (-not $QuietMode) {
        Write-Host ""
        Write-Host "=== Bridge Prompt (copy to other IDE chat) ===" -ForegroundColor Cyan
        Write-Host $prompt
    }

    try {
        Set-Clipboard -Value $prompt
        if (-not $QuietMode) {
            Write-Host ""
            Write-Host "Bridge prompt copied to clipboard." -ForegroundColor Green
        }
    }
    catch {
        if (-not $QuietMode) {
            Write-Host ""
            Write-Host "Clipboard copy failed. Please copy manually."
        }
    }
}

function Show-BridgePromptZh([switch]$QuietMode) {
    $promptPath = Join-Path $PSScriptRoot "bridge-zh.prompt.txt"
    $prompt = Read-Text $promptPath
    if ([string]::IsNullOrWhiteSpace($prompt)) {
        $prompt = "Bridge ZH prompt file missing: $promptPath"
    }

    if (-not $QuietMode) {
        Write-Host ""
        Write-Host "=== Bridge Prompt ZH (copy to other IDE chat) ===" -ForegroundColor Cyan
        Write-Host $prompt
    }

    try {
        Set-Clipboard -Value $prompt
        if (-not $QuietMode) {
            Write-Host ""
            Write-Host "Bridge ZH prompt copied to clipboard." -ForegroundColor Green
        }
    }
    catch {
        if (-not $QuietMode) {
            Write-Host ""
            Write-Host "Clipboard copy failed. Please copy manually."
        }
    }
}

function Run-Develop(
    [string]$BacklogPath,
    [string]$ModeArg,
    [string]$GoalArg,
    [string]$PriorityArg,
    [string]$NotDoArg,
    [string]$AcceptanceArg,
    [string]$BacklogIdArg
) {
    if (-not [string]::IsNullOrWhiteSpace($ModeArg)) {
        $modeLower = $ModeArg.ToLower()
        if ($modeLower -eq "new") {
            if ([string]::IsNullOrWhiteSpace($GoalArg)) {
                Write-Host "For mode=new, -Goal is required."
                return
            }
            $id = New-BacklogId
            $finalNotDo = if ([string]::IsNullOrWhiteSpace($NotDoArg)) { "keep existing roles" } else { $NotDoArg }
            $finalAcceptance = if ([string]::IsNullOrWhiteSpace($AcceptanceArg)) { "visible page behavior; usable flow; regression pass" } else { $AcceptanceArg }
            $finalPriority = if ([string]::IsNullOrWhiteSpace($PriorityArg)) { "P1" } else { $PriorityArg }
            Add-BacklogRow -BacklogPath $BacklogPath -Id $id -Type "feature" -Priority $finalPriority -Status "pending" -Goal $GoalArg -NotDo $finalNotDo -Acceptance $finalAcceptance -Related "AI.md"
            Write-Host "Backlog item created: $id" -ForegroundColor Green
            Write-Host "Suggested next chat message: /roundtable $GoalArg"
            return
        }
        if ($modeLower -eq "continue") {
            if ([string]::IsNullOrWhiteSpace($BacklogIdArg)) {
                Write-Host "For mode=continue, -BacklogId is required."
                return
            }
            Update-BacklogStatus -BacklogPath $BacklogPath -Id $BacklogIdArg -Status "in_progress"
            Write-Host "Updated to in_progress: $BacklogIdArg" -ForegroundColor Green
            return
        }
        if ($modeLower -eq "summary") {
            $rows = Get-BacklogRows $BacklogPath
            $pending = ($rows | Where-Object { $_.Status -eq "pending" }).Count
            $inprogress = ($rows | Where-Object { $_.Status -eq "in_progress" }).Count
            $blocked = ($rows | Where-Object { $_.Status -eq "blocked" }).Count
            $done = ($rows | Where-Object { $_.Status -eq "done" }).Count
            Write-Host "Backlog summary: pending=$pending, in_progress=$inprogress, blocked=$blocked, done=$done"
            return
        }
        Write-Host "Unsupported mode for develop: $ModeArg (use new|continue|summary)"
        return
    }

    Write-Host ""
    Write-Host "Select develop mode:" -ForegroundColor Cyan
    Write-Host "1) New development"
    Write-Host "2) Continue unfinished"
    Write-Host "3) Show backlog summary"
    $choice = Read-Host "Input number"

    if ($choice -eq "1") {
        $requirement = Read-Host "One-line requirement"
        if ([string]::IsNullOrWhiteSpace($requirement)) {
            Write-Host "Requirement is empty. Cancelled."
            return
        }
        $priority = Read-Host "Priority (P0/P1/P2, default P1)"
        if ([string]::IsNullOrWhiteSpace($priority)) { $priority = "P1" }
        $notDo = Read-Host "Out of scope (default: keep existing roles)"
        if ([string]::IsNullOrWhiteSpace($notDo)) { $notDo = "keep existing roles" }
        $acceptance = Read-Host "Acceptance summary (default: visible + usable + regression pass)"
        if ([string]::IsNullOrWhiteSpace($acceptance)) { $acceptance = "visible page behavior; usable flow; regression pass" }

        $id = New-BacklogId
        Add-BacklogRow -BacklogPath $BacklogPath -Id $id -Type "feature" -Priority $priority -Status "pending" -Goal $requirement -NotDo $notDo -Acceptance $acceptance -Related "AI.md"

        Write-Host ""
        Write-Host "Backlog item created: $id" -ForegroundColor Green
        Write-Host "Suggested next chat message:"
        Write-Host "/roundtable $requirement"
        Write-Host "/develop $requirement"
        return
    }

    if ($choice -eq "2") {
        $rows = Get-BacklogRows $BacklogPath | Where-Object { $_.Status -in @("pending", "in_progress", "blocked") }
        if ($rows.Count -eq 0) {
            Write-Host "No unfinished items."
            return
        }
        Write-Host ""
        for ($i = 0; $i -lt $rows.Count; $i++) {
            Write-Host ("{0}) {1} [{2}] {3}" -f ($i + 1), $rows[$i].Id, $rows[$i].Status, $rows[$i].Goal)
        }
        $pick = Read-Host "Input number"
        $idx = [int]$pick - 1
        if ($idx -lt 0 -or $idx -ge $rows.Count) {
            Write-Host "Invalid selection."
            return
        }
        $target = $rows[$idx]
        Update-BacklogStatus -BacklogPath $BacklogPath -Id $target.Id -Status "in_progress"
        Write-Host "Updated to in_progress: $($target.Id)" -ForegroundColor Green
        Write-Host "Suggested next chat message: /develop continue $($target.Id) - $($target.Goal)"
        return
    }

    if ($choice -eq "3") {
        $rows = Get-BacklogRows $BacklogPath
        $pending = ($rows | Where-Object { $_.Status -eq "pending" }).Count
        $inprogress = ($rows | Where-Object { $_.Status -eq "in_progress" }).Count
        $blocked = ($rows | Where-Object { $_.Status -eq "blocked" }).Count
        $done = ($rows | Where-Object { $_.Status -eq "done" }).Count
        Write-Host ""
        Write-Host "Backlog summary: pending=$pending, in_progress=$inprogress, blocked=$blocked, done=$done"
        return
    }

    Write-Host "Unknown option."
}

function Run-Bug(
    [string]$BacklogPath,
    [string]$StatusPath,
    [string]$SymptomArg,
    [string]$ReproArg,
    [string]$ExpectedArg,
    [string]$ImpactArg
) {
    $symptom = $SymptomArg
    if ([string]::IsNullOrWhiteSpace($symptom)) {
        $symptom = Read-Host "Symptom (one line)"
    }
    if ([string]::IsNullOrWhiteSpace($symptom)) {
        Write-Host "Symptom is empty. Cancelled."
        return
    }
    $repro = $ReproArg
    if ([string]::IsNullOrWhiteSpace($repro)) {
        $repro = Read-Host "Repro steps"
    }
    if ([string]::IsNullOrWhiteSpace($repro)) { $repro = "TBD" }
    $expected = $ExpectedArg
    if ([string]::IsNullOrWhiteSpace($expected)) {
        $expected = Read-Host "Expected result"
    }
    if ([string]::IsNullOrWhiteSpace($expected)) { $expected = "TBD" }
    $impact = $ImpactArg
    if ([string]::IsNullOrWhiteSpace($impact)) {
        $impact = Read-Host "Impact scope"
    }
    if ([string]::IsNullOrWhiteSpace($impact)) { $impact = "TBD" }

    $id = New-BacklogId
    Add-BacklogRow -BacklogPath $BacklogPath -Id $id -Type "bugfix" -Priority "P1" -Status "pending" -Goal "Fix bug: $symptom" -NotDo "no new tools; keep scope tight" -Acceptance "issue fixed; at least one page behavior passes; regression pass" -Related "docs/status/current-status.md"
    Append-BugIntake -StatusPath $StatusPath -Symptom $symptom -Repro $repro -Expected $expected -Impact $impact -BacklogId $id

    Write-Host ""
    Write-Host "Bug saved. Backlog ID: $id" -ForegroundColor Green
    Write-Host "Suggested next chat message: /bug $symptom"
}

function Run-Close(
    [string]$BacklogPath,
    [string]$AutoDir,
    [string]$BacklogIdArg,
    [string]$ResultArg,
    [string]$SummaryArg,
    [string]$ChangedArg,
    [string]$DocsArg
) {
    $id = $BacklogIdArg
    if ([string]::IsNullOrWhiteSpace($id)) {
        $id = Read-Host "Backlog ID (example BL-20260305-123456)"
    }
    if ([string]::IsNullOrWhiteSpace($id)) {
        Write-Host "Backlog ID is empty."
        return
    }
    $rows = Get-BacklogRows $BacklogPath
    $target = $rows | Where-Object { $_.Id -eq $id } | Select-Object -First 1
    if (-not $target) {
        Write-Host "Backlog ID not found: $id"
        return
    }

    $result = $ResultArg
    if ([string]::IsNullOrWhiteSpace($result)) {
        $result = Read-Host "Result (pass/fail, default pass)"
    }
    if ([string]::IsNullOrWhiteSpace($result)) { $result = "pass" }
    $newStatus = if ($result -eq "pass") { "done" } else { "blocked" }
    Update-BacklogStatus -BacklogPath $BacklogPath -Id $id -Status $newStatus

    $summary = $SummaryArg
    if ([string]::IsNullOrWhiteSpace($summary)) {
        $summary = Read-Host "Validation summary"
    }
    if ([string]::IsNullOrWhiteSpace($summary)) { $summary = "closed" }
    $changed = $ChangedArg
    if ([string]::IsNullOrWhiteSpace($changed)) {
        $changed = Read-Host "Change list"
    }
    if ([string]::IsNullOrWhiteSpace($changed)) { $changed = "TBD" }
    $docs = $DocsArg
    if ([string]::IsNullOrWhiteSpace($docs)) {
        $docs = Read-Host "Docs backfill list (max 3)"
    }
    if ([string]::IsNullOrWhiteSpace($docs)) { $docs = "TBD" }

    $logPath = New-CloseLog -AutoDir $AutoDir -BacklogId $id -Result $result -Summary $summary -Changed $changed -Docs $docs
    Write-Host ""
    Write-Host "Updated $id -> $newStatus" -ForegroundColor Green
    Write-Host "Close log created: $logPath"
}

$repoRoot = Get-RepoRoot
$backlogPath = Join-Path $repoRoot "docs/plans/development-backlog.md"
$statusPath = Join-Path $repoRoot "docs/status/current-status.md"
$autoDir = Join-Path $repoRoot "docs/handover/auto"

if (-not $Command) {
    Write-Host "Select command: start / develop / bug / close / help / bridge / bridge-zh"
    $Command = Read-Host "Command"
}

switch ($Command) {
    "start"   { Show-StartInfo }
    "develop" { Run-Develop $backlogPath $Mode $Goal $Priority $NotDo $Acceptance $BacklogId }
    "bug"     { Run-Bug $backlogPath $statusPath $Symptom $Repro $Expected $Impact }
    "close"   { Run-Close $backlogPath $autoDir $BacklogId $Result $Summary $Changed $Docs }
    "help"    { Show-Help }
    "bridge"  { Show-BridgePrompt -QuietMode:$Quiet }
    "bridge-zh" { Show-BridgePromptZh -QuietMode:$Quiet }
    default   { Write-Host "Unsupported command: $Command" }
}
