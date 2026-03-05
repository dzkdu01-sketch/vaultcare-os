# AI 协作入口（Vault 子项目）

> 本文件是 **任何 IDE / 任何 AI 助手** 的统一入口。  
> Cursor 会额外应用 `vault/.cursor/rules/*.mdc`，但机制正文以 `vault/docs/**` 为准。

---

## 0) 常用入口

- 新会话：`/启动`
- 开发功能：`/开发 + 目标一句话`
- 报 Bug：`/Bug + 现象一句话`
- 复杂问题讨论：`/圆桌 + 主题`
- 跨 IDE 执行器：`.\collab.ps1 start|develop|bug|close`

---

## 1) 强制模式标签（每条回复开头）

必须以模式标签开头，例如：
- `[人机协作-日常]`
- `[人机协作-启动]`
- `[人机协作-开发]`
- `[人机协作-Bug]`
- `[人机协作-圆桌]`

---

## 2) 新会话必读顺序

1. `docs/status/current-status.md`
2. `docs/handover.md`
3. `docs/roundtable/INTENTS-GUIDE.md`
4. （按需）`docs/flywheel/index.md`

---

## 3) 开发硬门禁（进入 `/开发` 前必须闭环）

1. 唯一业务目标（1 句话）
2. 明确不做项（至少 1 条）
3. 验收标准（3-5 条，至少 1 条页面行为）
4. 回填上限规则：每次开发闭环最多回填 3 处（`current-status`、`system-functional-matrix`、`consensus`）

---

## 4) 安全边界（强制）

- **禁止敏感信息入库**：API Key / 密码 / Token 不允许写入 `docs/**` 与 `.cursor/rules/**`。
- 凭据请放在：`.env` / 部署配置 / 密码管理器（或本地私密文件，不提交 git）。

---

## 5) 引导式开发入口（业务同学优先）

当用户仅输入“开发”或“/开发”且未给出完整门禁信息时，AI 必须按以下流程执行：

1. 先做点选式追问（最多 1 轮）：
   - 新开发
   - 继续未完成开发
   - 先看当前进度
2. 若用户选“继续未完成开发”，先从 `docs/status/current-status.md` 提取未完成项并让用户点选目标。
3. 若用户选“新开发”，必须先进入圆桌式步进评估（需求评估 -> 方案提取 -> 验收草案），再回到 `/开发` 闭环门禁。
4. AI 自动预填门禁草案（目标/不做/验收），用户只需确认或微调。
5. 新开发门禁确认后，必须将需求写入“待开发清单”再开始实现：
   - 固定入口：`docs/plans/development-backlog.md`（唯一写入位置）
6. 门禁闭环后进入开发；闭环后回填仍遵守“最多 3 处”规则。

## 6) 机制冲突防护（强制二次确认）

当用户提出“新建文档/流程/执行方式”与现有人机协作机制冲突时，AI 必须先执行：

1. 明确指出冲突点（与哪条规则冲突）。
2. 说明影响范围（进度、质量、回填一致性、交接成本）。
3. 给出替代方案（至少 1 个符合机制的做法）。
4. 要求用户明确确认（是/否）后才能继续执行。

> 未完成上述 4 步时，不允许直接执行冲突请求。

## 7) 自动收尾（强制，无需用户提醒）

每次开发或修 Bug 完成后，AI 必须自动执行以下收尾动作：

1. 输出验收结果（通过/未通过 + 原因）。
2. 输出改动清单（代码/文档）。
3. 输出文档回填清单（最多 3 处）。
4. 更新 `docs/plans/development-backlog.md` 中对应事项状态。
5. 给出下一步第一动作（可直接执行）。

---

## 极速跳转卡（新会话 30 秒）

`/启动` → `docs/status/current-status.md` → `docs/handover.md` → `docs/process-registry.md`  
治理入口：`docs/governance/governance-completion-snapshot-2026-03-05.md`  
规则：开发前先过门禁（目标/不做/验收），开发后回填最多 3 处（status/matrix/consensus）  
模板：`docs/templates/brief-template.md`、`docs/templates/decision-record-template.md`  
周节奏：`docs/governance/weekly-30min-governance-template.md`

