# 协作 OS 子项目化（Subproject-scoped Collab OS）设计稿

> 日期：2026-03-04  
> 目标：将「人机协作机制 / 飞轮进化 / 圆桌头脑风暴 / 意图系统」从 **个人全局环境** 下沉为 **子项目资产**，保证：
>
> - 子项目内生效（不依赖 Cursor 全局 rules）
> - 换 IDE 仍可用（至少能按同一入口与文档运行）
> - 新建子项目一键带齐
> - 允许子项目各自进化，但成熟改动可回流到模板，并可选择同步到其他子项目

---

## 1) 背景与问题

### 现状
- 已存在一套协作机制文档（`docs/roundtable/*`、`docs/flywheel/*` 等）。
- Cursor 可通过 `.cursor/rules/*.mdc` 强制入口、模式标签、门禁等执行约束。

### 痛点
- **全局规则对其他 IDE 无效**：导致协作者/不同 IDE 环境无法复现同样的协作流程。
- **子项目多、机制需要可复用**：需要“模板化 + 一键生成 + 可控回流”。

---

## 2) 核心原则（必须长期保持）

### 2.1 子项目资产优先
- 机制文档、入口文件、最小骨架必须存在于 **子项目目录** 内，作为可版本化资产。
- Cursor `.cursor/rules` 仅作为“强制执行器”，正文以 docs 为准。

### 2.2 各自进化 + 可控回流
选择策略：**允许子项目分叉试验，但成熟后回流到模板；默认只更新模板，不自动覆盖其他子项目。**

### 2.3 默认安全（避免误伤项目态）
- 同步机制默认 **只补齐缺失** 或 **仅在确认“未被本地修改”** 的情况下更新。
- `docs/status/current-status.md`、`docs/roundtable/sessions/**`、真实业务 handover 等属于“项目态”，默认不覆盖。

### 2.4 禁止敏感信息写入协作文档与规则
- API Key / 密码 / Token 不允许进入 `.mdc` 与 `docs/**`。
- 敏感信息应进入：`.env`、部署配置、密码管理器或专门的私密文档（不入库）。

---

## 3) 子项目最小“协作 OS”结构

每个子项目根目录必须具备：

- `AI.md`（IDE 通用入口）
  - 任何 IDE / 任何 AI 助手都能读懂的协作入口与约束说明
  - 指向本子项目 docs 的“单一入口”
- `.cursor/rules/collab.mdc`（Cursor 强制层）
  - 强制：入口读取顺序、模式标签、门禁规则提醒
  - 不承载长正文（避免重复与漂移）
- `docs/roundtable/**`（本子项目版本）
  - 意图系统、圆桌 v2 协议、共识等机制文档（允许演进）
- `docs/flywheel/**`（本子项目版本）
  - 飞轮指标口径、周报/metrics、续航/自治机制（允许演进）
- `docs/status/current-status.md`、`docs/handover.md`
  - 项目态入口（各自维护）
- `collab.manifest.json`
  - 该子项目是否受“协作脚本”管理的标识
  - 记录上次同步时的文件 hash，用于“安全更新（未改动才覆盖）”

---

## 4) 模板（单一源）与脚本职责

### 4.1 模板单一源
使用仓库内：
- `docs/_template-new-project/` 作为“协作 OS 模板源”

模板包含：
- `AI.md`
- `.cursor/rules/collab.mdc`
- `docs/roundtable/**`（最小集）
- `docs/flywheel/**`（最小集）
- `collab.manifest.json`（初始模板）

### 4.2 脚本集合（PowerShell）
放在 `scripts/collab/`：

1) `new-subproject.ps1`
- 创建新子项目目录
- 复制模板最小集
- 初始化 `collab.manifest.json`

2) `sync-collab.ps1`
- 自动发现所有含 `collab.manifest.json` 的子项目
- **默认安全模式**：
  - 若文件缺失：从模板补齐
  - 若文件存在：只有在“当前 hash == 上次同步记录的 hash”才覆盖更新
  - 若本地已改动：跳过并报告
- 提供可选 `-Force` 强制覆盖（人工确认后使用）

3) `promote-to-template.ps1`
- 将某子项目里已验证成熟的“协作机制核文件”回流到模板
- **默认只更新模板**（不自动同步到其他子项目）

---

## 5) 回流工作流（推荐操作顺序）

1. 在某子项目试点修改协作机制（docs / rules / AI.md）
2. 通过实际使用与飞轮指标验证有效
3. 运行 `promote-to-template.ps1 -From <子项目名>` 将成熟改动回流模板
4. 如需推广到其他子项目：手动运行 `sync-collab.ps1`（默认安全，不会覆盖本地已改动的子项目）

---

## 6) 验收标准（DoD）

- 任一子项目打开后（Cursor / 其他 IDE）都能通过 `AI.md` 找到：
  - 入口读取顺序
  - 模式标签规范（`[人机协作-XXX]`）
  - `/启动 /圆桌 /开发 /Bug` 等最小使用方式
- Cursor 在子项目中可自动应用 `.cursor/rules/collab.mdc`
- `new-subproject.ps1` 可一键生成新子项目并自动纳入脚本管理（manifest 存在）
- `promote-to-template.ps1` 可将成熟改动写回模板
- `sync-collab.ps1` 默认不会覆盖任何本地已改动文件（除非 `-Force`）

