# Vaultcare OS — Process Registry (业务-流程-功能)

> 目标：提供“流程唯一入口”，连接业务口径与系统功能，避免在多文档间反复跳转。  
> 原则：本文件只记录**流程摘要与索引**；详细规则仍以模块 spec、功能矩阵、圆桌共识为准。
> owner：流程治理负责人（待指定）
> last_verified_at：2026-03-05

---

## 1) 使用方式（30 秒）

1. 先读 `docs/status/current-status.md` 了解当前优先级
2. 再读本文件定位流程（流程 ID / 触发方 / 高频低频）
3. 按“主文档链接”跳转到细节文档
4. 开发或测试时，按“系统功能映射”回到 `docs/quality/system-functional-matrix.md`

---

## 2) 字段标准（统一）

| 字段 | 说明 |
|------|------|
| 流程 ID | 例如 `PIM-F1` |
| 业务域 | `PIM` / `OMS` / `DIST` / `FX` / `OPS` |
| 流程名称 | 便于检索的一句话名称 |
| 目标 | 该流程最终要达成的结果 |
| 触发方 | 商品管理员 / 分销商 / 系统管理员 / 系统自动 |
| 频率 | 高频 / 中频 / 低频 |
| 输入 | 关键输入数据或前置条件 |
| 输出 | 关键产物或状态变更 |
| 系统功能映射 | 对应功能 ID（如 `PIM-1.4.2`） |
| 规则口径 | 指向 `docs/roundtable/consensus.md` 的共识 |
| 验收依据 | `current-status` DoD 或测试剧本 |
| 主文档链接 | spec / ops-processes / sessions |
| 状态 | 已落地 / 部分落地 / 待设计 |

### 执行视图字段（新增）

| 字段 | 说明 |
|------|------|
| 优先级 | `P0` / `P1` / `P2`（以当前业务影响和阻塞性评估） |
| 负责人 | Owner（未知时标 `待指定`） |
| 下一步动作 | 当前最小可执行动作（1 句） |
| 阻塞项 | 依赖、口径未定、技术前置条件 |
| 复核日期 | 下次检查日期（建议每周） |
| 执行状态 | `未开始` / `进行中` / `已完成` / `已阻塞` |

---

## 3) 已确认业务口径（2026-03-04）

- 分销商选品：有独立选品页，多站点支持“一次选品可推多站”
- 分销站点现状：当前已运营 7 个分销网站，相关流程按多站点前提设计
- 标签体系：受众/运营标签支持批量增删改，V1 不做自定义标签
- 导入规则：`master_code` 不存在时报错；逐行失败并继续导入其余行；写入验收标准
- QR 口径：双口径（`QR独家标签` + `当前仅QR可供`）
- 站点定价：主价 + 汇率换算价（以 AED 为基准）
- Woo 字段基线：以 `tmp/wc-product-export-2-3-2026-1772439558044.csv` 作为商品推送/抓单 v1 映射来源（详见 `docs/roundtable/sessions/2026-03-04-erp-mvp-current-state.md`）

---

## 4) 流程总览（首批）

| 流程 ID | 业务域 | 流程名称 | 触发方 | 频率 | 系统功能映射 | 主文档链接 | 状态 |
|---------|--------|----------|--------|------|--------------|------------|------|
| `PIM-F1` | PIM | AI 辅助新增建档 | 商品管理员 | 高频 | `PIM-1.2.1`, `PIM-1.6.7`, `PIM-1.6.8` | `docs/modules/products/spec.md` | 已落地 |
| `PIM-F2` | PIM | 手动新增建档 | 商品管理员 | 高频 | `PIM-1.2.1`, `PIM-1.6.6`, `PIM-1.6.7`, `PIM-1.6.8` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 已落地 |
| `PIM-F3` | PIM | CSV 批量导入 | 系统管理员 | 低频 | `PIM-1.4.2`, `PIM-1.4.3` | `docs/modules/products/spec.md` | 部分落地 |
| `PIM-F4` | PIM | 商品详情编辑 | 商品管理员 | 高频 | `PIM-1.2.1`, `PIM-1.2.4` | `docs/modules/products/spec.md` | 部分落地 |
| `PIM-F5` | PIM | 批量上下架/标签 | 商品管理员 | 高频 | `PIM-1.3.1`, `PIM-1.3.2`, `PIM-1.3.3` | `docs/quality/system-functional-matrix.md` | 部分落地 |
| `PIM-F6` | PIM | 导出 CSV | 商品管理员 | 中频 | `PIM-1.4.1` | `docs/status/current-status.md` | 已落地 |
| `PIM-F7` | PIM | 下架级联（清选品+WP draft） | 系统自动 | 中频 | `PIM-1.2.2`, `DIST-3.2.2` | `docs/modules/products/spec.md` | 需验证 |
| `PIM-F8` | DIST | 分销商选品与多站推送目标 | 分销商 | 高频 | `DIST-3.2.1`, `DIST-3.2.2` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 部分落地 |
| `PIM-F9` | DIST | WP 映射同步 | 系统自动 | 中频 | `WPS-5.2.1` | `docs/modules/products/spec.md` | 部分落地 |
| `PIM-F10` | PIM | 供应商 SKU 绑定 | 商品管理员 | 高频 | `PIM-1.2.3`, `SUP-4.2.1` | `docs/quality/system-functional-matrix.md` | 已落地 |
| `PIM-F11` | PIM | availability 聚合 | 系统自动 | 中频 | `OMS-2.3.2` | `docs/modules/products/spec.md` | 部分落地 |
| `PIM-F12` | PIM | 旧商品编码升级 | 系统管理员 | 低频 | `PIM-1.1.1` | `docs/modules/products/spec.md` | 已落地 |
| `PIM-F13` | PIM | 发布门禁与审批 | 商品管理员/审核员 | 中频 | `PIM-1.6.1`, `PIM-1.6.2`, `PIM-1.6.3`, `PIM-1.6.4` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 已落地 |
| `PIM-F14` | PIM/FX | 价格版本与生效策略 | 商品管理员/系统管理员 | 中频 | `待映射（需补 matrix）` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 待设计 |
| `PIM-F15` | PIM/OMS | 库存时效与可售 SLA | 系统自动/电商ERP | 中频 | `待映射（需补 matrix）` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 待设计 |
| `PIM-F16` | PIM/DIST | 同步异常工单闭环 | 系统自动/商品管理员 | 中频 | `待映射（需补 matrix）` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 待设计 |
| `PIM-F17` | PIM | 导入对账与批次回滚 | 系统管理员/电商ERP | 低频 | `待映射（需补 matrix）` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 待设计 |
| `PIM-F18` | DIST | 站点级上下架控制 | 分销商/商品管理员 | 中频 | `待映射（需补 matrix）` | `docs/roundtable/sessions/2026-03-04-pim-process-clarity.md` | 部分落地 |
| `OPS-A` | OPS | 新品上新（素材清洗到入库） | 审核员 | 高频 | `PIM-1.2.x` | `docs/context/ops-processes.md` | 业务已定义 |
| `OPS-D` | OPS/OMS | 审单路由与供应商导入 | 审核员 | 高频 | `OMS-2.2.x`, `OMS-2.3.x` | `docs/context/ops-processes.md` | 业务已定义 |
| `OPS-E` | OPS/OMS | 履约状态回写与分销跟进 | 审核员 | 高频 | `OMS-2.1.x` | `docs/context/ops-processes.md` | 业务已定义 |
| `FX-F1` | FX | 站点汇率与换算价维护 | 系统管理员 | 低频 | `FX-4.1.2`, `FX-4.1.3` | `docs/quality/system-functional-matrix.md` | 待设计 |

---

## 5) 可执行视图（Execution Board）

> 说明：该表用于排期和推进，不替代详细 spec。未知信息统一标记为“待指定”，避免错误假设。

| 流程 ID | 优先级 | 负责人 | 下一步动作 | 阻塞项 | 复核日期 | 执行状态 |
|---------|--------|--------|------------|--------|----------|----------|
| `PIM-F1` | `P0` | 老板（你） | 已落地：AI 新增改为专用草稿接口（强制草稿 + 品类/图片校验），并完成回归 | 无（进入持续观察） | 2026-03-11 | 已完成 |
| `PIM-F2` | `P0` | 老板（你） | 已落地：手动新增改为专用草稿接口，保存后详情展示回归通过 | 无（进入持续观察） | 2026-03-11 | 已完成 |
| `PIM-F3` | `P0` | 老板（你） | 已落地：导入规则改为逐行失败继续 + 前端展示成功/失败及失败明细 | 无（进入持续观察） | 2026-03-11 | 已完成 |
| `PIM-F5` | `P1` | 待指定 | 批量标签接口与页面联调（仅受众/运营标签） | 需确认 matrix 对应项状态更新 | 2026-03-11 | 未开始 |
| `PIM-F7` | `P1` | 待指定 | 验证下架级联链路：清选品 + WP draft + 状态回写 | 异步任务观测与复测证据缺失 | 2026-03-12 | 未开始 |
| `PIM-F8` | `P1` | 老板（你） | 已补页面失败/成功双链路证据（成功链路通过测试通道 `simulate_success`）；下一步补真实 WP 成功链路证据 | 缺可用 WP 测试站凭据（真实发布/撤销仍难复现） | 2026-03-12 | 进行中 |
| `PIM-F9` | `P1` | 待指定 | 基于 Woo CSV v1 字段基线完成映射与同步状态回写（含失败重试） | 重试策略、幂等键、错误码分层未统一 | 2026-03-12 | 未开始 |
| `PIM-F12` | `P2` | 老板（你） | 已落地：旧编码升级接口 `/api/products/{id}/upgrade_code/` 已实现，支持一键生成规范编码（vc-u-1001），旧码保留到 legacy_code；测试 `pim.tests.test_pim_f12_upgrade_code` 通过（4/4） | 无（进入持续观察） | 2026-03-13 | 已完成 |
| `PIM-F13` | `P1` | 待指定 | 已落地：三态门禁 + 提交/通过/驳回 + 上架前校验 + 老板紧急放行留痕 + 指标看板接入 | 暂无阻塞（进入持续观察） | 2026-03-13 | 已完成 |
| `PIM-F14` | `P2` | 待指定 | 设计价格版本模型（版本号/生效时间/回滚）并明确站点价覆盖策略 | 生效粒度（全局/站点/SKU）未定 | 2026-03-14 | 未开始 |
| `PIM-F15` | `P2` | 待指定 | 建立 ERP 库存变更到 availability 更新的时效 SLA 与告警 | ERP 回写机制与时钟基准未定 | 2026-03-14 | 未开始 |
| `PIM-F16` | `P1` | 待指定 | 定义同步失败自动建单、重试上限、人工接管闭环 | 工单系统接入点与状态机未统一 | 2026-03-13 | 未开始 |
| `PIM-F17` | `P1` | 待指定 | 已落地 V1：导入批次审计 + 仅重试失败行 + 48h 升级提醒标记 + 工单通道（create-workorder）+ 消息/邮件提醒通道（send-alert） | 自动触发调度（定时扫描并发送）待接入 | 2026-03-13 | 进行中 |
| `PIM-F18` | `P1` | 待指定 | 已落地基础动作并补失败链路 + 测试通道成功链路页面证据（publish/revoke） | 真实 WP 成功链路仍缺可用测试凭据；复盘指标待继续沉淀 | 2026-03-13 | 进行中 |
| `OPS-D` | `P1` | 待指定 | 对齐审单路由到系统字段，减少人工口径漂移 | OMS 路由字段与业务词典未完全对齐 | 2026-03-13 | 未开始 |
| `FX-F1` | `P2` | 待指定 | 明确定价实现：主价 + 汇率换算 + 站点 Tab 展示 | 汇率来源与更新频率未定 | 2026-03-13 | 未开始 |

---

## 6) 周节奏建议（用于人机协作）

- 每周固定 1 次（建议周三）复核可执行视图
- 每次最多推进 3 条流程，避免多线程失焦
- 圆桌确认的新口径，48 小时内同步到：
  1) `docs/roundtable/consensus.md`
  2) 本文件“已确认业务口径”与“可执行视图”
  3) 对应 `spec` / `matrix` / `current-status`

### 业务版两阶段清单（2026-03-04 新增）

> 面向业务同事的固定展示模板（少技术术语）

#### 阶段 1（本周上线，可用版）

- 目标：优先保证“审核员录入与优化”主链路可用
- 必须项：
  - `PIM-F1` AI 辅助录入商品（硬约束）
  - `PIM-F2` 手动录入
  - `PIM-F13` 录入后审核流可闭环（提交/驳回/重提）
  - `PIM-F17` 导入失败可升级处理（工单通道）
- 本阶段核心指标：
  - 审核员日处理量
  - 录入到可审核时长

#### 阶段 2（上线后滚动补齐）

- 分销扩展能力（第 1 阶段仅保现状不扩）
- `PIM-F17` 消息/邮件提醒通道
- `PIM-F18` 真实 WP 成功链路证据
- 低优先级体验优化与重构

---

## 7) 维护规则（避免上下文膨胀）

- 本文件不粘贴大段流程正文，只保留索引与关键口径
- 流程细节统一回源到：
  - 模块规格：`docs/modules/*/spec.md`
  - 运营流程：`docs/context/ops-processes.md`
  - 功能状态：`docs/quality/system-functional-matrix.md`
  - 最终决策：`docs/roundtable/consensus.md`
- 每次新增/变更流程时，只做两件事：
  1) 在此处新增或更新 1 行流程索引
  2) 在对应源文档补齐细节与证据

---

## 8) 变更记录

- 2026-03-04：创建初版，采用“业务-流程-功能”结构；纳入 PIM 全流程与低频流程索引。
- 2026-03-04：升级为“可执行视图”，新增优先级/负责人/下一步/阻塞项/复核日期/执行状态。
- 2026-03-04：圆桌增补方案 B 固化，新增 `PIM-F13~F18`（发布门禁、价格版本、库存SLA、异常闭环、导入回滚、站点级上下架）。
- 2026-03-04：新增 Woo CSV v1 字段基线口径，驱动 `PIM-F9` 推送/抓单映射设计。
- 2026-03-04：`PIM-F1/F2/F3` 完成首轮 P0 闭环（草稿态、图片与品类校验、导入逐行失败继续与结果明细）。
- 2026-03-04：`PIM-F13` 完成首轮闭环（门禁三态、审核流转、紧急放行留痕、看板指标接入）。
- 2026-03-04：`PIM-F8 + PIM-F18` 完成第三步基础联动（站点级发布/撤销/重试，同步状态回写与单站失败隔离）。
- 2026-03-04：`PIM-F8 + PIM-F18` 补页面级失败链路证据（失败提示、`映射:failed`、重试按钮可用），并定位“成功链路复测依赖可用 WP 测试凭据”。
- 2026-03-04：`PIM-F8 + PIM-F18` 新增测试通道成功回归能力（`DEBUG + simulate_success`），补齐发布/撤销成功态页面证据并保留真实凭据阻塞说明。
- 2026-03-04：`PIM-F17` 新增 48h 升级工单通道（`create-workorder`，幂等），形成"批次审计 -> 升级工单"的最小闭环。
- 2026-03-04：`PIM-F2` 状态机重构：新增 `inactive_delisted` 状态，区分"草稿（从未上架）"与"已下架（曾上架后主动下架）"；状态流转图更新为 `draft -> pending_review -> publishable -> inactive_delisted -> pending_review`
- 2026-03-04：`PIM-F13` 状态机重构：更新发布门禁为四态（`draft/pending_review/publishable/inactive_delisted`）；新增 `delist` 下架操作（仅审核员可执行）；`submit_review` 支持 `inactive_delisted -> pending_review` 重提路径
- 2026-03-04：`PIM-F7` 状态机重构：下架级联触发条件更新为 `publishable -> inactive_delisted`；保留 `is_active True->False` 兼容逻辑
- 2026-03-04：`PIM-F1/F2/F3` AI 整合手动新增：新增 OCR 识别接口（`/api/ai/ocr-analyze/`）和文案优化接口（`/api/ai/optimize-text/`）；手动新增 Step1 新增"AI 识别图片/PDF"按钮和结果确认对话框；Step2 新增"AI 优化文案"按钮和对比对话框；审核列表新增"AI 辅助程度"列
- 2026-03-04：Task 1 AI 设置模块：新增 `AIConfig` 模型（单例模式）；`/api/ai-config/` CRUD 接口（仅超管可修改）；前端 `/settings/ai` 配置页面；`ai_service.py` 动态读取配置
