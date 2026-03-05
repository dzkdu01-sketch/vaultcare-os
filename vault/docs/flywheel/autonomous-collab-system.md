# 人机协作自治系统（Context Governor）

> 版本：v1.6  
> 日期：2026-03-04  
> 目标：让人机协作持续运行，自动控制上下文风险，减少人工盯盘。

---

## 1. 设计目标

- 自动监控会话健康度（上下文占用、轮次、会话时长）。
- 在接近风险阈值时自动触发“压缩 + 交接 + 续接”。
- 产出标准化交接包，保证新会话可无损接力。
- 支持可选自动打开新会话，尽量减少人工干预。

---

## 2. 核心机制（四环）

### 环 A：会话哨兵（Sentinel）

监控三类信号：

- `estimated_context_pct`（若可获得）
- `turn_count`
- `session_elapsed_minutes`

阈值建议：

- `< 60%`：正常执行
- `60% ~ 70%`：预警
- `70% ~ 75%`：准备交接
- `>= 75%`：强制交接并轮转新会话

> 若无法读取真实上下文占用，则以“轮次 + 时长”双门限兜底。
> v1.1 增加：可从最新会话转录自动推断轮次（无需手填）。

### 环 B：自动快照（Snapshot）

触发交接时自动生成：

- `docs/handover/auto/session-YYYYMMDD-HHMM.md`
- 摘要包含：目标、已完成、阻塞、下一步、验收标准、关键文件

v1.3 增加：

- 自动从最新 `docs/roundtable/sessions/*.md` 提取摘要线索
- 自动填充 Goal / Completed / Blockers / Next Steps（无源时使用系统默认语义，不再输出 TODO 占位）

### 环 C：自动续接（Relay）

同时生成：

- `docs/status/next-session.prompt.md`

该文件是“下一会话首条消息”，默认包含：

1. `/启动`
2. 本次交接摘要
3. 任务边界与验收要求

v1.2 增加：

- 可自动打开新会话
- 自动粘贴 `next-session.prompt.md` 到输入框
- 可选自动发送（默认关闭，建议先人工确认后发送）

### 环 D：飞轮记录（Evolution）

每次轮转会记入：

- `docs/flywheel/context-rotation-log.jsonl`

用于后续统计：

- 轮转次数
- 触发原因分布（占用超阈值 / 轮次超限 / 时长超限）
- 交接后一次通过率

---

## 3. 文件结构

- `scripts/dev/context-governor.ps1`：常驻守护脚本
- `scripts/dev/context-governor.config.json`：阈值与行为配置
- `docs/status/context-telemetry.json`：会话遥测输入（可选）
- `docs/status/context-governor.state.json`：守护器状态
- `docs/status/next-session.prompt.md`：自动续接提示词
- `docs/handover/auto/*.md`：自动交接包
- `docs/flywheel/context-rotation-log.jsonl`：轮转日志

---

## 4. 运行方式

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev\context-governor.ps1
```

支持可选自动打开新会话：

- 在配置中设置 `auto_open_next_chat = true`
- 设置 `auto_open_command`（示例：`Start-Process "cursor://new-chat"`）

支持自动投喂下一会话 Prompt：

- `auto_seed_next_chat_prompt = true`
- `seed_prompt_wait_seconds = 2`（等待新会话窗口就绪）
- `seed_prompt_activate_window = true`
- `cursor_window_title_contains = "Cursor"`
- `seed_prompt_submit = false`（建议默认 false）

---

## 5. 实施边界（务实）

- 脚本无法保证读取到 Cursor 内部“真实上下文百分比”时，自动降级为轮次+时长治理。
- “自动打开新会话”依赖本机是否支持对应命令或 URI Scheme。
- 若自动打开失败，仍会保证交接包和下一会话 Prompt 已就绪。
- 自动粘贴依赖系统焦点与窗口激活，可能受弹窗/输入法/权限影响；失败不会阻断交接文件生成。

---

## 6. 建议默认值（生产可用）

- `warn_context_pct`: 68
- `rotate_context_pct`: 75
- `max_turn_count`: 26
- `max_session_minutes`: 45
- `poll_seconds`: 20
- `transcript_fresh_hours`: 6

---

## 6.1 v1.1 自动推断说明

当 `telemetry_inference.enabled = true` 时：

- 自动读取最新 `agent-transcripts/*.jsonl`（可配置路径）
- 以 `role=user/assistant` 计数估算 `turn_count`
- 以 `turn_count + elapsed_minutes` 估算 `estimated_context_pct`
- 每轮回写 `docs/status/context-telemetry.json`，形成实时遥测快照

## 6.2 v1.3 自动摘要说明

当 `summary_inference.enabled = true` 时：

- 读取最新会话纪要（可配置新鲜时间窗口）
- 按章节关键词提取：
  - Completed：`结论/产出/已确认`
  - Blockers：`待确认/问题/风险/不一致`
  - Next Steps：`后续动作/建议/下一步`
- 回写到 `context-telemetry.json` 并用于生成 handover

## 6.3 v1.4 相关性路由说明

当 `summary_inference.use_relevance_routing = true` 时：

- 会话候选不再仅按“最新时间”选择
- 以当前遥测中的目标/已完成/阻塞/下一步提取关键词
- 对最近 N 个 session 按“文件名命中 + 内容命中 + 新鲜度”打分
- 选择最高分 session 作为 `summary_source`

推荐：

- `relevance_scan_top_n = 12`
- `latest_session_fresh_hours = 168`

## 6.4 v1.5 结构化摘要提取

v1.5 增强了“摘要可读性”：

- 表格提取只保留数据行（跳过表头和分隔行）
- 摘要字段支持“源覆盖模式”（`overwrite_with_source = true`）
- 对 `completed/blockers/next_steps` 统一做清洗去重，减少噪声项

推荐参数：

- `summary_inference.overwrite_with_source = true`
- `summary_inference.table_data_row_min_cells = 2`

## 6.5 v1.6 阻塞项注入

v1.6 增加了可执行阻塞识别：

- 从 `docs/status/current-status.md` 自动提取 P0/P1 未关闭 Bug
- 自动注入 `Blockers`，优先于“无阻塞”默认语句
- 与 session 提取结果合并后再清洗去重

推荐参数：

- `summary_inference.inject_status_blockers = true`
- `summary_inference.max_status_blockers = 5`

---

## 7. 验收标准（DoD）

- 连续运行 2 小时不报错。
- 至少触发 1 次自动轮转，且生成交接包与续接 Prompt。
- 轮转日志记录完整（时间、原因、阈值、会话 ID）。
- 新会话可基于 `next-session.prompt.md` 在 1 分钟内恢复到可开发状态。
