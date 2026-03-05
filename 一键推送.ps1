# 一键推送脚本（Windows PowerShell）
# 用法：
#   .\一键推送.ps1 "本次更新说明"
#   .\一键推送.ps1              # 不传时自动生成时间戳消息

param(
    [Parameter(Position = 0)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

function Fail-And-Exit {
    param([string]$Text)
    Write-Host ""
    Write-Host "失败：$Text" -ForegroundColor Red
    Write-Host "已停止，工作区改动仍保留（未丢失）。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "常用回退命令（按需选择）：" -ForegroundColor Cyan
    Write-Host "1) 撤销最后一次本地提交（保留改动）: git reset --soft HEAD~1"
    Write-Host "2) 已推送后安全回退某提交:          git revert <commit-hash>"
    Write-Host "3) 查看历史操作记录:                  git reflog"
    exit 1
}

try {
    $repoRoot = (git rev-parse --show-toplevel 2>$null).Trim()
    if (-not $repoRoot) {
        Fail-And-Exit "当前目录不是 Git 仓库。"
    }

    Set-Location $repoRoot

    $branch = (git branch --show-current).Trim()
    if (-not $branch) {
        Fail-And-Exit "无法识别当前分支。"
    }

    if (-not $Message -or -not $Message.Trim()) {
        $Message = "chore: quick update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    } else {
        $Message = $Message.Trim()
    }

    $status = git status --porcelain
    if (-not $status) {
        Write-Host "没有检测到改动，无需推送。" -ForegroundColor Yellow
        exit 0
    }

    Write-Host "仓库：$repoRoot" -ForegroundColor Cyan
    Write-Host "分支：$branch" -ForegroundColor Cyan
    Write-Host "提交信息：$Message" -ForegroundColor Cyan
    Write-Host ""

    git add -A
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git add 失败。" }

    git commit -m "$Message"
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git commit 失败。" }

    $upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
    if ($LASTEXITCODE -eq 0 -and $upstream) {
        git push
    } else {
        git push -u origin $branch
    }
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "git push 失败（网络、权限或远程配置可能异常）。" }

    Write-Host ""
    Write-Host "完成：已提交并推送到 origin/$branch" -ForegroundColor Green
} catch {
    Fail-And-Exit $_.Exception.Message
}
