# 新项目 — 人机协作模板

> 复制此目录到 `d:\cursor\<项目名>/` 作为新子项目起点。
> 目录命名：英文 + kebab-case（如 `my-feature`）

## 使用步骤

1. 复制整个 `_template-new-project` 到 `d:\cursor\<项目名>/`
2. 将项目名写入 `docs/index.md` 和 `docs/status/current-status.md`
3. 将 `docs/roundtable` 作为 Junction 指向 `../../docs/roundtable`（与 vault 一致）
4. 在全局 `current-status.md` 中登记此项目

## 目录结构（人机协作要求）

```
<项目名>/
├── .cursor/
│   └── rules/
│       └── collab.mdc          # 人机协作规则
├── docs/
│   ├── index.md                # 入口（必读）
│   ├── handover.md             # 交接说明
│   ├── status/
│   │   └── current-status.md   # 当前状态、Bug、待办
│   ├── context/                # 业务/架构说明
│   └── roundtable -> ../../docs/roundtable  # Junction 到全局智库
├── src/ 或 frontend/、backend/  # 按实际技术栈
└── tmp/                        # 临时文件（gitignore）
```

## 创建 roundtable Junction

```powershell
cmd /c "mklink /J ""d:\cursor\<项目名>\docs\roundtable"" ""d:\cursor\docs\roundtable"""
```
