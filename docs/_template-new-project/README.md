# 新项目 — 人机协作模板

> 复制此目录到 `d:\cursor\<项目名>/` 作为新子项目起点。
> 目录命名：英文 + kebab-case（如 `my-feature`）

## 使用步骤

1. 复制整个 `_template-new-project` 到 `d:\cursor\<项目名>/`
2. 将项目名写入 `docs/index.md` 和 `docs/status/current-status.md`
3. （可选）调整 `AI.md` 的“项目特性/约束”段落
4. 运行同步脚本更新协作核文件（如果你已经升级了模板）

> 说明：本模板默认 **不再依赖全局 Junction**。`docs/roundtable` 与 `docs/flywheel` 作为子项目资产，便于在不同 IDE 中复用与独立进化。

## 目录结构（人机协作要求）

```
<项目名>/
├── AI.md                      # IDE 通用入口（必读）
├── collab.manifest.json       # 协作 OS 管理清单（脚本自动维护）
├── .cursor/
│   └── rules/
│       └── collab.mdc          # 人机协作规则
├── docs/
│   ├── index.md                # 入口（必读）
│   ├── handover.md             # 交接说明
│   ├── status/
│   │   └── current-status.md   # 当前状态、Bug、待办
│   ├── context/                # 业务/架构说明
│   ├── roundtable/             # 圆桌/意图系统（子项目版本，可独立进化）
│   └── flywheel/               # 飞轮/续航机制（子项目版本，可独立进化）
├── src/ 或 frontend/、backend/  # 按实际技术栈
└── tmp/                        # 临时文件（gitignore）
```
