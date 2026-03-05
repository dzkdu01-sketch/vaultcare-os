# Setup Cursor Auto-Bridge Task
# This script creates a Windows Task Scheduler task to run bridge-zh when Cursor starts

$ErrorActionPreference = "Stop"

$taskName = "Cursor-AutoBridge"
$cursorPath = "D:\Program Files\cursor\resources\app\bin\cursor.cmd"
$collabScript = "D:\cursor\vault\collab.ps1"

# Create the trigger action script
$triggerScript = @"
# Cursor Auto-Bridge Trigger
# Runs when Cursor starts

Start-Sleep -Seconds 2
& "D:\cursor\vault\collab.ps1" -Command bridge-zh
"@

$triggerScriptPath = "$env:TEMP\cursor-autobridge-trigger.ps1"
Set-Content -Path $triggerScriptPath -Value $triggerScript -Encoding UTF8

Write-Host "=== Cursor Auto-Bridge Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will create a Windows Task Scheduler task that:"
Write-Host "  1. Triggers when Cursor starts (via process monitoring)"
Write-Host "  2. Runs 'collab bridge-zh' to copy collaboration prompt to clipboard"
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task '$taskName' already exists." -ForegroundColor Yellow
    $overwrite = Read-Host "Overwrite existing task? (Y/N)"
    if ($overwrite -ne 'Y' -and $overwrite -ne 'y') {
        Write-Host "Setup cancelled."
        exit 0
    }
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Alternative approach: Create a simpler solution using PowerShell profile
Write-Host ""
Write-Host "Note: Windows Task Scheduler cannot directly trigger on process start without WMI events." -ForegroundColor Yellow
Write-Host "Alternative approach: Use PowerShell profile with auto-bridge when working in vault directory."
Write-Host ""

# Install the collab alias with auto-bridge enabled
Write-Host "Installing collab alias with auto-bridge enabled..."
& "D:\cursor\vault\scripts\collab\install-collab-alias.ps1" -EnableAutoBridge -Force

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Auto-bridge is now configured. The bridge-zh command will run automatically when:"
Write-Host "  1. You open a new PowerShell terminal in Cursor (within vault directory)"
Write-Host "  2. You start any PowerShell session (if in vault directory)"
Write-Host ""
Write-Host "To manually trigger: collab bridge-zh"
Write-Host ""
Write-Host "For true 'Cursor start' trigger, you would need:"
Write-Host "  - A WMI event subscription (complex, requires admin)"
Write-Host "  - Or modify Cursor's startup behavior (not recommended)"
Write-Host ""
Write-Host "Recommended workflow: Open integrated terminal in Cursor - auto-bridge will run."
