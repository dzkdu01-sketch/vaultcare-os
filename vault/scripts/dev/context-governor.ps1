param(
    [string]$ConfigPath = "scripts/dev/context-governor.config.json",
    [switch]$RunOnce
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([string]$RelativePath)
    return Join-Path -Path (Get-Location).Path -ChildPath $RelativePath
}

function Ensure-ParentDirectory {
    param([string]$FilePath)
    $parent = Split-Path -Path $FilePath -Parent
    if (-not (Test-Path -Path $parent)) {
        New-Item -Path $parent -ItemType Directory -Force | Out-Null
    }
}

function Read-JsonFileOrDefault {
    param(
        [string]$Path,
        [object]$DefaultValue
    )
    if (-not (Test-Path -Path $Path)) {
        return $DefaultValue
    }
    try {
        $raw = Get-Content -Path $Path -Raw -Encoding UTF8
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $DefaultValue
        }
        return $raw | ConvertFrom-Json
    } catch {
        Write-Warning "Failed to parse JSON: $Path. Using default."
        return $DefaultValue
    }
}

function Write-JsonFile {
    param(
        [string]$Path,
        [object]$Data
    )
    Ensure-ParentDirectory -FilePath $Path
    $Data | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding UTF8
}

function New-InitialState {
    return @{
        started_at = (Get-Date).ToString("s")
        loop_count = 0
        rotation_count = 0
        last_warn_at = $null
        last_rotation_at = $null
        last_rotation_reason = @()
        last_session_id = $null
    }
}

function Get-RotationReasons {
    param(
        [object]$Telemetry,
        [object]$Config
    )
    $reasons = @()

    $contextPct = $Telemetry.estimated_context_pct
    if ($null -ne $contextPct -and [double]$contextPct -ge [double]$Config.rotate_context_pct) {
        $reasons += "context_pct"
    }

    $turnCount = $Telemetry.turn_count
    if ($null -ne $turnCount -and [int]$turnCount -ge [int]$Config.max_turn_count) {
        $reasons += "turn_count"
    }

    $elapsedMinutes = $Telemetry.session_elapsed_minutes
    if ($null -ne $elapsedMinutes -and [double]$elapsedMinutes -ge [double]$Config.max_session_minutes) {
        $reasons += "session_minutes"
    }

    return $reasons
}

function Should-Warn {
    param(
        [object]$Telemetry,
        [object]$Config
    )
    $contextPct = $Telemetry.estimated_context_pct
    if ($null -ne $contextPct -and [double]$contextPct -ge [double]$Config.warn_context_pct) {
        return $true
    }
    $turnCount = $Telemetry.turn_count
    if ($null -ne $turnCount -and [int]$turnCount -ge [math]::Floor([int]$Config.max_turn_count * 0.8)) {
        return $true
    }
    $elapsedMinutes = $Telemetry.session_elapsed_minutes
    if ($null -ne $elapsedMinutes -and [double]$elapsedMinutes -ge [math]::Floor([double]$Config.max_session_minutes * 0.8)) {
        return $true
    }
    return $false
}

function Build-HandoverMarkdown {
    param(
        [object]$Telemetry,
        [string]$SessionId,
        [string[]]$Reasons
    )

    $now = Get-Date
    $title = "Auto Handover - " + $now.ToString("yyyy-MM-dd HH:mm")
    $goal = if ($Telemetry.goal) { $Telemetry.goal } else { "TODO: fill current goal" }

    $completed = @()
    if ($Telemetry.completed_items) {
        $completed = @($Telemetry.completed_items)
    }
    if ($completed.Count -eq 0) {
        $completed = @("TODO: summarize completed work")
    }

    $blockers = @()
    if ($Telemetry.blockers) {
        $blockers = @($Telemetry.blockers)
    }
    if ($blockers.Count -eq 0) {
        $blockers = @("None reported")
    }

    $nextSteps = @()
    if ($Telemetry.next_steps) {
        $nextSteps = @($Telemetry.next_steps)
    }
    if ($nextSteps.Count -eq 0) {
        $nextSteps = @("TODO: define next 1-3 steps")
    }

    $acceptance = @()
    if ($Telemetry.acceptance_criteria) {
        $acceptance = @($Telemetry.acceptance_criteria)
    }
    if ($acceptance.Count -eq 0) {
        $acceptance = @("TODO: define testable acceptance criteria")
    }

    $files = @()
    if ($Telemetry.related_files) {
        $files = @($Telemetry.related_files)
    }
    if ($files.Count -eq 0) {
        $files = @("docs/status/current-status.md", "docs/handover.md")
    }

    $reasonText = if ($Reasons.Count -gt 0) { ($Reasons -join ", ") } else { "manual" }
    $contextText = if ($null -ne $Telemetry.estimated_context_pct) { "$($Telemetry.estimated_context_pct)%" } else { "unknown" }

    $lines = @()
    $lines += "# $title"
    $lines += ""
    $lines += "- generated_at: $($now.ToString("s"))"
    $lines += "- session_id: $SessionId"
    $lines += "- rotate_reason: $reasonText"
    $lines += "- estimated_context_pct: $contextText"
    $lines += "- turn_count: $($Telemetry.turn_count)"
    $lines += "- session_elapsed_minutes: $($Telemetry.session_elapsed_minutes)"
    $lines += ""
    $lines += "## Goal"
    $lines += ""
    $lines += "$goal"
    $lines += ""
    $lines += "## Completed"
    $lines += ""
    foreach ($item in $completed) { $lines += "- $item" }
    $lines += ""
    $lines += "## Blockers"
    $lines += ""
    foreach ($item in $blockers) { $lines += "- $item" }
    $lines += ""
    $lines += "## Next Steps"
    $lines += ""
    foreach ($item in $nextSteps) { $lines += "- $item" }
    $lines += ""
    $lines += "## Acceptance Criteria"
    $lines += ""
    foreach ($item in $acceptance) { $lines += "- $item" }
    $lines += ""
    $lines += "## Related Files"
    $lines += ""
    foreach ($item in $files) { $lines += "- $item" }
    $lines += ""

    return ($lines -join "`r`n")
}

function Build-NextPromptMarkdown {
    param(
        [string]$HandoverPath,
        [object]$Config
    )
    $lines = @()
    $lines += "/init"
    $lines += ""
    $lines += "Read the following context files and continue execution immediately:"
    $lines += "1. $($Config.paths.current_status_file)"
    $lines += "2. $($Config.paths.handover_file)"
    $lines += "3. $($Config.paths.process_registry_file)"
    $normalizedHandoverPath = $HandoverPath -replace "\\", "/"
    $lines += "4. $normalizedHandoverPath"
    $lines += ""
    $lines += "Requirements:"
    $lines += "- Restate goal, completed work, blockers, and next steps first."
    $lines += "- Execute next steps directly; do not re-ask already clear constraints."
    $lines += "- If coding is needed, use small iterations and sync docs."
    return ($lines -join "`r`n")
}

function Append-JsonlLine {
    param(
        [string]$Path,
        [object]$Data
    )
    Ensure-ParentDirectory -FilePath $Path
    $line = ($Data | ConvertTo-Json -Depth 10 -Compress)
    Add-Content -Path $Path -Value $line -Encoding UTF8
}

function Try-SeedNextChatPrompt {
    param(
        [object]$Config,
        [string]$PromptFilePath
    )

    if (-not [bool]$Config.auto_seed_next_chat_prompt) {
        return @{
            ok = $true
            skipped = $true
            message = "auto seed disabled"
        }
    }
    if (-not (Test-Path -Path $PromptFilePath)) {
        return @{
            ok = $false
            skipped = $false
            message = "prompt file not found"
        }
    }

    try {
        $promptText = Get-Content -Path $PromptFilePath -Raw -Encoding UTF8
        Set-Clipboard -Value $promptText

        $waitSeconds = if ($Config.seed_prompt_wait_seconds) { [int]$Config.seed_prompt_wait_seconds } else { 2 }
        if ($waitSeconds -gt 0) {
            Start-Sleep -Seconds $waitSeconds
        }

        Add-Type -AssemblyName System.Windows.Forms
        $activated = $false
        if ([bool]$Config.seed_prompt_activate_window -and $Config.cursor_window_title_contains) {
            try {
                $wshell = New-Object -ComObject WScript.Shell
                $activated = $wshell.AppActivate([string]$Config.cursor_window_title_contains)
                Start-Sleep -Milliseconds 300
            } catch {
                $activated = $false
            }
        }

        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 120
        if ([bool]$Config.seed_prompt_submit) {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }

        return @{
            ok = $true
            skipped = $false
            activated = $activated
            submitted = [bool]$Config.seed_prompt_submit
            message = "prompt pasted"
        }
    } catch {
        return @{
            ok = $false
            skipped = $false
            message = $_.Exception.Message
        }
    }
}

function Is-InCooldown {
    param(
        [object]$State,
        [int]$CooldownMinutes
    )
    if (-not $State.last_rotation_at) {
        return $false
    }
    $last = [datetime]::Parse($State.last_rotation_at)
    $minutes = ((Get-Date) - $last).TotalMinutes
    return ($minutes -lt $CooldownMinutes)
}

function Get-LatestTranscriptStats {
    param(
        [string]$TranscriptDir,
        [int]$FreshHours
    )

    $result = @{
        found = $false
        transcript_file = $null
        transcript_session_id = $null
        estimated_turn_count = 0
        user_message_count = 0
        assistant_message_count = 0
    }

    if (-not $TranscriptDir -or -not (Test-Path -Path $TranscriptDir)) {
        return $result
    }

    $files = Get-ChildItem -Path $TranscriptDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
        Sort-Object -Property LastWriteTime -Descending
    if (-not $files -or $files.Count -eq 0) {
        return $result
    }

    $latest = $files[0]
    if ($FreshHours -gt 0) {
        $age = ((Get-Date) - $latest.LastWriteTime).TotalHours
        if ($age -gt $FreshHours) {
            return $result
        }
    }

    try {
        $raw = Get-Content -Path $latest.FullName -Raw -Encoding UTF8
        $userCount = ([regex]::Matches($raw, '"role"\s*:\s*"user"')).Count
        $assistantCount = ([regex]::Matches($raw, '"role"\s*:\s*"assistant"')).Count
        $turnCount = [math]::Max($userCount, $assistantCount)

        $result.found = $true
        $result.transcript_file = $latest.FullName
        $result.transcript_session_id = [System.IO.Path]::GetFileNameWithoutExtension($latest.Name)
        $result.estimated_turn_count = $turnCount
        $result.user_message_count = $userCount
        $result.assistant_message_count = $assistantCount
    } catch {
        return $result
    }

    return $result
}

function Get-LatestSessionMarkdownSummary {
    param(
        [string]$SessionsDir,
        [int]$FreshHours,
        [int]$MaxItems,
        [object]$Telemetry,
        [object]$SummaryConfig
    )

    $result = @{
        found = $false
        source_file = $null
        title = $null
        goal = $null
        completed_items = @()
        blockers = @()
        next_steps = @()
    }

    if (-not $SessionsDir -or -not (Test-Path -Path $SessionsDir)) {
        return $result
    }

    $files = Get-ChildItem -Path $SessionsDir -Filter "*.md" -File -ErrorAction SilentlyContinue |
        Sort-Object -Property LastWriteTime -Descending
    if (-not $files -or $files.Count -eq 0) {
        return $result
    }

    $candidates = New-Object System.Collections.Generic.List[System.IO.FileInfo]
    foreach ($f in $files) {
        if ($FreshHours -gt 0) {
            $ageHours = ((Get-Date) - $f.LastWriteTime).TotalHours
            if ($ageHours -gt $FreshHours) {
                continue
            }
        }
        $candidates.Add($f)
    }
    if ($candidates.Count -eq 0) {
        return $result
    }

    $latest = $candidates[0]

    # v1.4 relevance routing: choose most relevant session instead of only latest.
    $relevanceEnabled = $true
    if ($SummaryConfig -and $null -ne $SummaryConfig.use_relevance_routing) {
        $relevanceEnabled = [bool]$SummaryConfig.use_relevance_routing
    }
    if ($relevanceEnabled) {
        $seedText = @(
            [string]$Telemetry.goal,
            [string]($Telemetry.completed_items -join " "),
            [string]($Telemetry.blockers -join " "),
            [string]($Telemetry.next_steps -join " ")
        ) -join " "

        $tokens = New-Object System.Collections.Generic.List[string]
        $englishMatches = [regex]::Matches($seedText, '[A-Za-z][A-Za-z0-9_-]{2,}')
        foreach ($m in $englishMatches) {
            $t = $m.Value.ToLowerInvariant()
            if (-not $tokens.Contains($t)) { $tokens.Add($t) }
            if ($tokens.Count -ge 20) { break }
        }
        if ($tokens.Count -lt 20) {
            $zhMatches = [regex]::Matches($seedText, '[\u4e00-\u9fff]{2,}')
            foreach ($m in $zhMatches) {
                $t = $m.Value
                if (-not $tokens.Contains($t)) { $tokens.Add($t) }
                if ($tokens.Count -ge 20) { break }
            }
        }
        if ($tokens.Count -eq 0) {
            $fallback = @("pim", "商品", "流程", "bug", "roundtable")
            foreach ($t in $fallback) { if (-not $tokens.Contains($t)) { $tokens.Add($t) } }
        }

        $bestFile = $latest
        $bestScore = -1.0
        $scanTopN = if ($SummaryConfig -and $SummaryConfig.relevance_scan_top_n) { [int]$SummaryConfig.relevance_scan_top_n } else { 12 }
        $index = 0
        foreach ($candidate in $candidates) {
            $index += 1
            if ($index -gt $scanTopN) { break }
            $score = 0.0
            $nameLower = $candidate.Name.ToLowerInvariant()
            foreach ($tk in $tokens) {
                if ([string]::IsNullOrWhiteSpace($tk)) { continue }
                if ($nameLower.Contains($tk.ToLowerInvariant())) {
                    $score += 2.0
                }
            }
            try {
                $content = Get-Content -Path $candidate.FullName -Raw -Encoding UTF8
                foreach ($tk in $tokens) {
                    if ([string]::IsNullOrWhiteSpace($tk)) { continue }
                    $occ = ([regex]::Matches($content, [regex]::Escape($tk))).Count
                    if ($occ -gt 0) {
                        $score += [math]::Min(3.0, [double]$occ * 0.35)
                    }
                }
            } catch {
                # ignore unreadable candidate
            }
            $ageDays = ((Get-Date) - $candidate.LastWriteTime).TotalDays
            $score += [math]::Max(0.0, 1.5 - ($ageDays * 0.2))

            if ($score -gt $bestScore) {
                $bestScore = $score
                $bestFile = $candidate
            }
        }
        $latest = $bestFile
    }

    $lines = Get-Content -Path $latest.FullName -Encoding UTF8
    if (-not $lines -or $lines.Count -eq 0) {
        return $result
    }

    $result.found = $true
    $result.source_file = $latest.FullName
    $titleLine = $lines | Where-Object { $_ -match '^#\s+' } | Select-Object -First 1
    if ($titleLine) {
        $result.title = ($titleLine -replace '^#\s+', '').Trim()
    }

    if ($result.title) {
        $result.goal = "Continue based on recent session: $($result.title)"
    }

    $currentSection = ""
    $globalBullets = @()
    $tableRowIndex = 0
    $tableMinCells = if ($SummaryConfig -and $SummaryConfig.table_data_row_min_cells) { [int]$SummaryConfig.table_data_row_min_cells } else { 2 }
    foreach ($rawLine in $lines) {
        $line = $rawLine.Trim()
        if (-not $line) {
            $tableRowIndex = 0
            continue
        }
        if ($line -match '^##\s+') {
            $tableRowIndex = 0
            if ($line -match 'Conclusion|Result|Output|Decision|Delivery') { $currentSection = "completed"; continue }
            if ($line -match 'Blocker|Risk|Issue|Problem|Gap') { $currentSection = "blockers"; continue }
            if ($line -match 'Next|Action|Todo|Plan|Follow-up') { $currentSection = "next"; continue }
            $currentSection = ""
            continue
        }
        if (-not ($line -match '^- ' -or $line -match '^\|')) {
            $tableRowIndex = 0
            if ($line -match 'Bug-\d+') {
                $bugId = $Matches[0]
                if ($result.blockers.Count -lt $MaxItems) {
                    $result.blockers += "Track unresolved issue: $bugId"
                }
            }
            continue
        }

        if ($line -match '^\-\s+') {
            $tableRowIndex = 0
            $content = ($line -replace '^\-\s+', '').Trim()
        } elseif ($line -match '^\|') {
            # Structured table extraction: ignore header/separator rows, keep data rows only.
            $tableRowIndex += 1
            $tableRaw = ((($line -replace '^\|', '') -replace '\|$', '')).Trim()
            $cells = $tableRaw.Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            if ($tableRowIndex -eq 1) {
                $content = ""
            } elseif ($cells.Count -lt $tableMinCells) {
                $content = ""
            } else {
                $dashOnly = $true
                foreach ($cell in $cells) {
                    if ($cell -notmatch '^[-:]+$') {
                        $dashOnly = $false
                        break
                    }
                }
                if ($dashOnly) {
                    $content = ""
                } else {
                    $content = ($cells | Select-Object -First 2) -join " - "
                }
            }
        } else {
            $tableRowIndex = 0
            $content = $line
        }
        if (-not $content) { continue }
        if ($content -match '^[-:| ]+$') { continue }
        if ($content -match '-{3,}\|') { continue }
        if ($content -match '\|') { continue }
        if ($content.Length -lt 3) { continue }
        $cleanContent = ($content -replace '\*\*', '').Trim()
        if ($globalBullets.Count -lt ($MaxItems * 3)) {
            $globalBullets += $cleanContent
        }

        if ($currentSection -eq "completed" -and $result.completed_items.Count -lt $MaxItems) {
            $result.completed_items += $cleanContent
        } elseif ($currentSection -eq "blockers" -and $result.blockers.Count -lt $MaxItems) {
            $result.blockers += $cleanContent
        } elseif ($currentSection -eq "next" -and $result.next_steps.Count -lt $MaxItems) {
            $result.next_steps += $cleanContent
        }
    }

    if ($result.completed_items.Count -eq 0 -and $globalBullets.Count -gt 0) {
        $result.completed_items = @($globalBullets | Select-Object -First $MaxItems)
    }
    if ($result.next_steps.Count -eq 0 -and $globalBullets.Count -gt $MaxItems) {
        $result.next_steps = @($globalBullets | Select-Object -Last ([Math]::Min(2, $MaxItems)))
    }

    return $result
}

function Normalize-SummaryList {
    param(
        [object[]]$Items,
        [int]$MaxItems
    )
    $normalized = New-Object System.Collections.Generic.List[string]
    if (-not $Items) {
        return @()
    }
    foreach ($item in $Items) {
        if ($null -eq $item) { continue }
        $text = [string]$item
        $text = ($text -replace '\*\*', '').Trim()
        if (-not $text) { continue }
        if ($text -match '^[-:| ]+$') { continue }
        if ($text -match '-{3,}\|') { continue }
        if ($text -match '^\s*[|].*[|]\s*$') { continue }
        if ($text -match '\|') { continue }
        if ($text.Length -lt 3) { continue }
        if (-not $normalized.Contains($text)) {
            $normalized.Add($text)
        }
        if ($normalized.Count -ge $MaxItems) {
            break
        }
    }
    return @($normalized)
}

function Get-StatusBlockers {
    param(
        [string]$StatusFilePath,
        [int]$MaxItems
    )

    $items = New-Object System.Collections.Generic.List[string]
    if (-not $StatusFilePath -or -not (Test-Path -Path $StatusFilePath)) {
        return @()
    }

    try {
        $lines = Get-Content -Path $StatusFilePath -Encoding UTF8
    } catch {
        return @()
    }

    $priority = ""
    foreach ($raw in $lines) {
        $line = $raw.Trim()
        if (-not $line) { continue }

        if ($line -match 'P0') {
            $priority = "P0"
            continue
        }
        if ($line -match 'P1') {
            $priority = "P1"
            continue
        }
        if ($line -match 'P2|P3') {
            $priority = ""
            continue
        }
        if ($priority -eq "") { continue }

        if ($line -match '^- \[\s\]\s*(Bug-\d+)[：:]\s*(.+)$') {
            $bugId = $Matches[1]
            $desc = $Matches[2]
            $item = "[${priority}] ${bugId}: ${desc}"
            if (-not $items.Contains($item)) {
                $items.Add($item)
            }
        }
        if ($items.Count -ge $MaxItems) {
            break
        }
    }

    # Fallback: if no open P0/P1 bugs, use unchecked DoD/checklist items as operational blockers.
    if ($items.Count -eq 0) {
        $inChecklist = $false
        foreach ($raw in $lines) {
            $line = $raw.Trim()
            if (-not $line) { continue }
            if ($line -match '验收清单|DoD|Definition of Done') {
                $inChecklist = $true
                continue
            }
            if (-not $inChecklist) { continue }
            if ($line -match '^- \[\s\]\s+(.+)$') {
                $todo = $Matches[1]
                $item = "[CHECKLIST] $todo"
                if (-not $items.Contains($item)) {
                    $items.Add($item)
                }
            }
            if ($items.Count -ge $MaxItems) { break }
        }
    }

    return @($items)
}

function Apply-SummaryInference {
    param(
        [object]$Telemetry,
        [object]$Config
    )

    if (-not $Config.summary_inference -or -not [bool]$Config.summary_inference.enabled) {
        return $Telemetry
    }

    $maxItems = if ($Config.summary_inference.max_items_per_section) { [int]$Config.summary_inference.max_items_per_section } else { 5 }
    $sourceSummary = @{
        found = $false
        source_file = $null
        title = $null
        goal = $null
        completed_items = @()
        blockers = @()
        next_steps = @()
    }

    if ([bool]$Config.summary_inference.read_latest_session_markdown) {
        $sessionsPath = Resolve-RepoPath -RelativePath $Config.summary_inference.roundtable_sessions_dir
        $freshHours = [int]$Config.summary_inference.latest_session_fresh_hours
        $sourceSummary = Get-LatestSessionMarkdownSummary -SessionsDir $sessionsPath -FreshHours $freshHours -MaxItems $maxItems -Telemetry $Telemetry -SummaryConfig $Config.summary_inference
    }

    $hasGoal = (-not [string]::IsNullOrWhiteSpace([string]$Telemetry.goal))
    if (-not $hasGoal) {
        if ($sourceSummary.goal) {
            $Telemetry.goal = [string]$sourceSummary.goal
        } else {
            $Telemetry.goal = "Keep delivery continuity and avoid context overflow."
        }
    }

    $overwriteWithSource = [bool]$Config.summary_inference.overwrite_with_source
    $sourceCompleted = Normalize-SummaryList -Items @($sourceSummary.completed_items) -MaxItems $maxItems
    $sourceBlockers = Normalize-SummaryList -Items @($sourceSummary.blockers) -MaxItems $maxItems
    $sourceNext = Normalize-SummaryList -Items @($sourceSummary.next_steps) -MaxItems $maxItems

    if ($overwriteWithSource -and $sourceSummary.found) {
        if ($sourceCompleted.Count -gt 0) { $Telemetry.completed_items = @($sourceCompleted) }
        if ($sourceBlockers.Count -gt 0) { $Telemetry.blockers = @($sourceBlockers) }
        if ($sourceNext.Count -gt 0) { $Telemetry.next_steps = @($sourceNext) }
    }

    $Telemetry.completed_items = Normalize-SummaryList -Items @($Telemetry.completed_items) -MaxItems $maxItems
    if (-not $Telemetry.completed_items -or @($Telemetry.completed_items).Count -eq 0) {
        if ($sourceCompleted.Count -gt 0) {
            $Telemetry.completed_items = @($sourceCompleted)
        } else {
            $Telemetry.completed_items = @(
                "Context guard has been running with automatic telemetry inference.",
                "Next-session prompt is generated after rotation."
            )
        }
    }

    $Telemetry.blockers = Normalize-SummaryList -Items @($Telemetry.blockers) -MaxItems $maxItems
    if (-not $Telemetry.blockers -or @($Telemetry.blockers).Count -eq 0) {
        if ($sourceBlockers.Count -gt 0) {
            $Telemetry.blockers = @($sourceBlockers)
        } else {
            $Telemetry.blockers = @("No explicit blocker detected from recent session notes.")
        }
    }

    $injectStatusBlockers = [bool]$Config.summary_inference.inject_status_blockers
    if ($injectStatusBlockers) {
        $statusPath = Resolve-RepoPath -RelativePath $Config.paths.current_status_file
        $maxStatus = if ($Config.summary_inference.max_status_blockers) { [int]$Config.summary_inference.max_status_blockers } else { 5 }
        $statusBlockers = Get-StatusBlockers -StatusFilePath $statusPath -MaxItems $maxStatus
        if ($statusBlockers.Count -gt 0) {
            $merged = @($statusBlockers) + @($Telemetry.blockers)
            $Telemetry.blockers = Normalize-SummaryList -Items $merged -MaxItems $maxItems
        }
    }

    $Telemetry.next_steps = Normalize-SummaryList -Items @($Telemetry.next_steps) -MaxItems $maxItems
    if (-not $Telemetry.next_steps -or @($Telemetry.next_steps).Count -eq 0) {
        if ($sourceNext.Count -gt 0) {
            $Telemetry.next_steps = @($sourceNext)
        } else {
            $Telemetry.next_steps = @(
                "Open next chat and load status, handover, process registry, and latest auto handover file.",
                "Continue with highest-priority pending item and verify before completion."
            )
        }
    }

    if (-not $Telemetry.acceptance_criteria -or @($Telemetry.acceptance_criteria).Count -eq 0) {
        $Telemetry.acceptance_criteria = @(
            "Next chat can restate goal/completed/blockers/next steps in under 1 minute.",
            "Execution continues without re-asking already-decided constraints."
        )
    }

    if (-not $Telemetry.related_files -or @($Telemetry.related_files).Count -eq 0) {
        $Telemetry.related_files = @(
            "docs/status/current-status.md",
            "docs/handover.md",
            "docs/process-registry.md"
        )
    }

    # If fields are still too sparse, enrich from source and defaults.
    if (@($Telemetry.completed_items).Count -eq 0) {
        if ($sourceSummary.completed_items.Count -gt 0) {
            $Telemetry.completed_items = @($sourceSummary.completed_items | Select-Object -First $maxItems)
        } else {
            $Telemetry.completed_items = @(
                "Context guard has been running with automatic telemetry inference.",
                "Next-session prompt is generated after rotation."
            )
        }
    }

    $summarySource = if ($sourceSummary.found) { $sourceSummary.source_file } else { "fallback-defaults" }
    if ($Telemetry -is [hashtable]) {
        $Telemetry["summary_source"] = $summarySource
    } elseif ($Telemetry.PSObject.Properties.Name -contains "summary_source") {
        $Telemetry.summary_source = $summarySource
    } else {
        $Telemetry | Add-Member -NotePropertyName "summary_source" -NotePropertyValue $summarySource -Force
    }

    return $Telemetry
}

function Apply-TelemetryInference {
    param(
        [object]$Telemetry,
        [object]$State,
        [object]$Config
    )

    if (-not $Config.telemetry_inference -or -not [bool]$Config.telemetry_inference.enabled) {
        return $Telemetry
    }

    if (-not $Telemetry.session_id) {
        $Telemetry.session_id = "auto-" + (Get-Date).ToString("yyyyMMdd")
    }

    $hasElapsed = ($null -ne $Telemetry.session_elapsed_minutes -and [double]$Telemetry.session_elapsed_minutes -gt 0)
    if (-not $hasElapsed -and $State.started_at) {
        try {
            $started = [datetime]::Parse($State.started_at)
            $Telemetry.session_elapsed_minutes = [math]::Floor(((Get-Date) - $started).TotalMinutes)
        } catch {
            $Telemetry.session_elapsed_minutes = 0
        }
    }

    $transcriptStats = @{
        found = $false
        transcript_file = $null
        transcript_session_id = $null
        estimated_turn_count = 0
        user_message_count = 0
        assistant_message_count = 0
    }

    $canReadTranscript = [bool]$Config.telemetry_inference.read_latest_transcript
    if ($canReadTranscript) {
        $freshHours = [int]$Config.telemetry_inference.transcript_fresh_hours
        $transcriptStats = Get-LatestTranscriptStats -TranscriptDir $Config.telemetry_inference.transcript_dir -FreshHours $freshHours
    }

    $hasTurns = ($null -ne $Telemetry.turn_count -and [int]$Telemetry.turn_count -gt 0)
    if (-not $hasTurns -and $transcriptStats.found) {
        $Telemetry.turn_count = [int]$transcriptStats.estimated_turn_count
        if (-not $Telemetry.session_id -or $Telemetry.session_id -like "auto-*") {
            $Telemetry.session_id = [string]$transcriptStats.transcript_session_id
        }
    }
    if (-not $Telemetry.turn_count) {
        $Telemetry.turn_count = 0
    }

    $hasContext = ($null -ne $Telemetry.estimated_context_pct -and [double]$Telemetry.estimated_context_pct -gt 0)
    if (-not $hasContext -and $Config.telemetry_inference.context_estimator) {
        $est = $Config.telemetry_inference.context_estimator
        $rawPct = [double]$est.base_pct +
            ([double]$est.per_turn_pct * [double]$Telemetry.turn_count) +
            ([double]$est.per_minute_pct * [double]$Telemetry.session_elapsed_minutes)
        $clamped = [math]::Min([double]$est.max_pct, [math]::Max(0, $rawPct))
        $Telemetry.estimated_context_pct = [math]::Round($clamped, 1)
    }

    $inferenceObject = @{
        timestamp = (Get-Date).ToString("s")
        turn_source = if ($transcriptStats.found) { "latest_transcript" } else { "manual_or_default" }
        transcript_file = $transcriptStats.transcript_file
        user_message_count = $transcriptStats.user_message_count
        assistant_message_count = $transcriptStats.assistant_message_count
        context_source = "estimator"
    }
    if ($Telemetry -is [hashtable]) {
        $Telemetry["inference"] = $inferenceObject
    } elseif ($Telemetry.PSObject.Properties.Name -contains "inference") {
        $Telemetry.inference = $inferenceObject
    } else {
        $Telemetry | Add-Member -NotePropertyName "inference" -NotePropertyValue $inferenceObject -Force
    }

    return $Telemetry
}

function Run-Governor {
    param(
        [string]$ConfigPath,
        [bool]$RunOnce
    )

    $resolvedConfigPath = Resolve-RepoPath -RelativePath $ConfigPath
    if (-not (Test-Path -Path $resolvedConfigPath)) {
        throw "Config file not found: $resolvedConfigPath"
    }

    Write-Host "Context Governor started with config: $resolvedConfigPath"
    Write-Host "Press Ctrl + C to stop."

    while ($true) {
        $config = Read-JsonFileOrDefault -Path $resolvedConfigPath -DefaultValue $null
        if ($null -eq $config) {
            throw "Config parse failed: $resolvedConfigPath"
        }

        $telemetryPath = Resolve-RepoPath -RelativePath $config.paths.telemetry_file
        $statePath = Resolve-RepoPath -RelativePath $config.paths.state_file
        $nextPromptPath = Resolve-RepoPath -RelativePath $config.paths.next_prompt_file
        $handoverDir = Resolve-RepoPath -RelativePath $config.paths.handover_dir
        $rotationLogPath = Resolve-RepoPath -RelativePath $config.paths.rotation_log_file

        $defaultTelemetry = @{
            session_id = (Get-Date).ToString("yyyyMMdd")
            estimated_context_pct = $null
            turn_count = 0
            session_elapsed_minutes = 0
            goal = $null
            completed_items = @()
            blockers = @()
            next_steps = @()
            acceptance_criteria = @()
            related_files = @()
        }
        $telemetry = Read-JsonFileOrDefault -Path $telemetryPath -DefaultValue $defaultTelemetry
        $state = Read-JsonFileOrDefault -Path $statePath -DefaultValue (New-InitialState)

        $state.loop_count = [int]$state.loop_count + 1
        $telemetry = Apply-TelemetryInference -Telemetry $telemetry -State $state -Config $config
        $telemetry = Apply-SummaryInference -Telemetry $telemetry -Config $config
        $sessionId = if ($telemetry.session_id) { [string]$telemetry.session_id } else { (Get-Date).ToString("yyyyMMdd") }
        Write-JsonFile -Path $telemetryPath -Data $telemetry

        if (Should-Warn -Telemetry $telemetry -Config $config) {
            $state.last_warn_at = (Get-Date).ToString("s")
            Write-Host "WARN: nearing context/session threshold. session_id=$sessionId"
        }

        $reasons = Get-RotationReasons -Telemetry $telemetry -Config $config
        $shouldRotate = ($reasons.Count -gt 0)
        $inCooldown = Is-InCooldown -State $state -CooldownMinutes ([int]$config.cooldown_minutes_after_rotate)
        if ($shouldRotate -and -not $inCooldown) {
            if (-not (Test-Path -Path $handoverDir)) {
                New-Item -Path $handoverDir -ItemType Directory -Force | Out-Null
            }

            $timestamp = (Get-Date).ToString("yyyyMMdd-HHmm")
            $handoverFilename = "session-$timestamp.md"
            $handoverPath = Join-Path -Path $handoverDir -ChildPath $handoverFilename

            $handoverText = Build-HandoverMarkdown -Telemetry $telemetry -SessionId $sessionId -Reasons $reasons
            Set-Content -Path $handoverPath -Value $handoverText -Encoding UTF8

            $relativeHandoverPath = Join-Path -Path $config.paths.handover_dir -ChildPath $handoverFilename
            $nextPromptText = Build-NextPromptMarkdown -HandoverPath $relativeHandoverPath -Config $config
            Ensure-ParentDirectory -FilePath $nextPromptPath
            Set-Content -Path $nextPromptPath -Value $nextPromptText -Encoding UTF8

            $rotationEvent = @{
                rotated_at = (Get-Date).ToString("s")
                session_id = $sessionId
                reasons = $reasons
                estimated_context_pct = $telemetry.estimated_context_pct
                turn_count = $telemetry.turn_count
                session_elapsed_minutes = $telemetry.session_elapsed_minutes
                handover_file = $relativeHandoverPath
                next_prompt_file = $config.paths.next_prompt_file
            }
            Append-JsonlLine -Path $rotationLogPath -Data $rotationEvent

            $state.rotation_count = [int]$state.rotation_count + 1
            $state.last_rotation_at = (Get-Date).ToString("s")
            $state.last_rotation_reason = $reasons
            $state.last_session_id = $sessionId
            Write-Host "ROTATE: handover generated at $relativeHandoverPath"

            if ([bool]$config.auto_open_next_chat -and $config.auto_open_command) {
                try {
                    Invoke-Expression $config.auto_open_command
                    Write-Host "ROTATE: auto-open next chat command executed."
                } catch {
                    Write-Warning "Failed to auto-open next chat: $($_.Exception.Message)"
                }
            }

            $seedResult = Try-SeedNextChatPrompt -Config $config -PromptFilePath $nextPromptPath
            if ($seedResult.ok -and -not $seedResult.skipped) {
                Write-Host "ROTATE: next-session prompt seeded."
            } elseif (-not $seedResult.ok) {
                Write-Warning "Failed to seed prompt: $($seedResult.message)"
            }
        }

        Write-JsonFile -Path $statePath -Data $state
        if ($RunOnce) {
            Write-Host "RunOnce completed."
            break
        }

        Start-Sleep -Seconds ([int]$config.poll_seconds)
    }
}

Run-Governor -ConfigPath $ConfigPath -RunOnce ([bool]$RunOnce)
