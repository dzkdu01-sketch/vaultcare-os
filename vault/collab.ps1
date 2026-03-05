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

$scriptPath = Join-Path $PSScriptRoot "scripts/collab/collab.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Error "未找到执行器脚本：$scriptPath"
    exit 1
}

& $scriptPath -Command $Command -Mode $Mode -Goal $Goal -Priority $Priority -NotDo $NotDo -Acceptance $Acceptance -BacklogId $BacklogId -Symptom $Symptom -Repro $Repro -Expected $Expected -Impact $Impact -Result $Result -Summary $Summary -Changed $Changed -Docs $Docs -Quiet:$Quiet
