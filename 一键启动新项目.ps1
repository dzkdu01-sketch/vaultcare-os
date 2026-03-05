# 一键启动新项目
# 用法：.\一键启动新项目.ps1 [项目名]
# 或直接运行，会提示输入项目名

$ErrorActionPreference = "Stop"
$cursorRoot = "D:\cursor"
$templatePath = "$cursorRoot\docs\_template-new-project"
$statusFile = "$cursorRoot\current-status.md"

# 获取项目名
$projectName = $args[0]
if (-not $projectName) {
    $projectName = Read-Host "请输入项目名（英文、kebab-case，如 my-feature）"
}
$projectName = $projectName.Trim()
if (-not $projectName) {
    Write-Host "错误：项目名不能为空" -ForegroundColor Red
    exit 1
}

# 校验项目名
if ($projectName -match '[\\/:*?"<>|]') {
    Write-Host "错误：项目名不能包含 \\ / : * ? `" < > | 等字符" -ForegroundColor Red
    exit 1
}

$targetPath = "$cursorRoot\$projectName"

# 1. 复制模板
if (Test-Path $targetPath) {
    Write-Host "错误：目录已存在 $targetPath" -ForegroundColor Red
    exit 1
}

Write-Host "正在复制模板到 $targetPath ..." -ForegroundColor Cyan
Copy-Item -Path $templatePath -Destination $targetPath -Recurse -Force

# 2. 创建 Junction
$roundtableJunction = "$targetPath\docs\roundtable"
if (Test-Path $roundtableJunction) {
    Write-Host "警告：roundtable 已存在，跳过 Junction 创建" -ForegroundColor Yellow
} else {
    Write-Host "正在创建 roundtable Junction ..." -ForegroundColor Cyan
    cmd /c "mklink /J `"$roundtableJunction`" `"$cursorRoot\docs\roundtable`""
}

# 3. 登记到 current-status.md
Write-Host "正在登记到 current-status.md ..." -ForegroundColor Cyan
$newRow = "| $projectName | ``$projectName/docs/status/current-status.md`` | 新建项目 |"
$lines = Get-Content $statusFile -Encoding UTF8
$newLines = @()
$inserted = $false

foreach ($line in $lines) {
    if (-not $inserted -and $line -match 'template-new-project') {
        $newLines += $newRow
        $inserted = $true
    }
    $newLines += $line
}

Set-Content -Path $statusFile -Value $newLines -Encoding UTF8

Write-Host ""
Write-Host "完成！新项目已创建：$targetPath" -ForegroundColor Green
Write-Host "下一步：编辑 $targetPath\docs\status\current-status.md 填写项目说明" -ForegroundColor Yellow
