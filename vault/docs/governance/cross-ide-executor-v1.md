# 跨 IDE 执行器（v1.1）

> 目标：让人机协作机制在非 Cursor IDE 中也能执行。  
> 命令入口：`collab.ps1`（仓库根目录）

## 1) 可用命令

```powershell
.\collab.ps1 start
.\collab.ps1 develop
.\collab.ps1 bug
.\collab.ps1 close
.\collab.ps1 help
.\collab.ps1 bridge
.\collab.ps1 bridge-zh
```

### 一键别名（PowerShell）

```powershell
.\scripts\collab\install-collab-alias.ps1
```

启用“每次新开终端自动运行 bridge（静默复制到剪贴板）”：

```powershell
.\scripts\collab\install-collab-alias.ps1 -Force -EnableAutoBridge
```

关闭自动运行：

```powershell
.\scripts\collab\install-collab-alias.ps1 -Force
```

安装后重开 PowerShell，可直接用：

```powershell
collab start
collab develop -Mode summary
collab help
collab bridge
collab bridge-zh
```

`bridge` 会输出并复制一段“会话约束提示词”，粘贴到其他 IDE 的聊天首条消息后，再输入“开发”即可走你定义的引导流程。
`bridge-zh` 会输出并复制中文版本提示词（推荐给中文聊天界面）。

### 参数化快捷模式（v1.1 新增）

```powershell
.\collab.ps1 develop -Mode new -Goal "目标一句话" -Priority P1 -NotDo "不做项" -Acceptance "验收摘要"
.\collab.ps1 develop -Mode continue -BacklogId BL-20260305-001
.\collab.ps1 develop -Mode summary
.\collab.ps1 bug -Symptom "现象" -Repro "步骤" -Expected "期望" -Impact "影响"
.\collab.ps1 close -BacklogId BL-20260305-001 -Result pass -Summary "验收通过" -Changed "改动摘要" -Docs "status,matrix,consensus"
```

## 2) 命令说明

- `start`
  - 输出新会话必读入口与规则位置（status / handover / AI.md / backlog）。
- `develop`
  - 点选：新开发 / 继续未完成 / 先看进度。
  - 新开发会写入 `docs/plans/development-backlog.md`。
  - 继续开发会把选中项状态切到 `in_progress`。
  - v1.1 支持 `-Mode new|continue|summary` 无交互执行。
- `bug`
  - 采集“现象/复现/期望/影响”，写入 backlog 与 status 的 Bug 快速提报区。
- `close`
  - 更新 backlog 状态为 `done` 或 `blocked`。
  - 自动生成收尾记录：`docs/handover/auto/session-YYYYMMDD-HHMMSS-close.md`。

## 3) 与现有机制的映射

- 门禁与流程规则来源：`AI.md`、`docs/roundtable/INTENTS-GUIDE.md`
- 待开发统一入口：`docs/plans/development-backlog.md`
- 回填与收尾：遵循“最多 3 处回填 + 自动收尾”

## 4) 注意事项

- v1.1 为 PowerShell 版本，优先覆盖 Windows + 任意 IDE 场景。
- 若在 Git Bash/WSL 使用，建议直接调用 `pwsh` 或 `powershell` 运行脚本。
- 该执行器负责“流程执行”，不替代具体代码实现与测试命令。
