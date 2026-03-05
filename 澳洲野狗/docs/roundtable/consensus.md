# 圆桌共识（Roundtable Consensus）

> 更新时间：2026-03-05
> 定位：记录产品 + 技术 + 业务三方确认的关键决策，作为系统实现的唯一依据
> owner：圆桌机制负责人（待指定）
> last_verified_at：2026-03-05

---

## 2026-03-04 共识（Tasks 1-3）

### 1. AI 设置模块（Task 1）

#### 1.1 配置范围
- **API Key 存储方式**：通过环境变量 `CLAUDE_API_KEY` 配置，**不存储数据库**
  - 原因：安全考虑，避免数据库泄露导致 API Key 暴露
  - 影响：部署时需在服务器配置环境变量

- **数据库配置项**：仅存储非敏感配置
  - 模型选择（主模型/降级模型）
  - 功能开关（OCR/文案/审核助手）
  - 降级策略（重试次数/超时时间/是否启用降级）

#### 1.2 权限控制
- **读取权限**：所有认证用户可读（供 AI 服务使用）
- **修改权限**：仅 `is_superuser=True` 用户可修改
- **页面入口**：设置菜单 -> "AI 配置"（`/settings/ai`）

#### 1.3 实时生效
- 每次 AI 调用时从数据库读取最新配置
- 无需重启服务即可生效

---

### 2. 状态机重构（Task 2）

#### 2.1 状态定义
| 状态 | 英文 | 说明 |
|------|------|------|
| 草稿 | `draft` | 从未上架的商品 |
| 待审核 | `pending_review` | 已提交审核，等待审批 |
| 可发布 | `publishable` | 审核通过，可上架销售 |
| 已下架 | `inactive_delisted` | 曾经上架后主动下架 |

#### 2.2 状态流转图
```
draft ──submit_review──> pending_review ──approve_review──> publishable ──delist──> inactive_delisted
                              │                                                      │
                              └──reject_review──> draft                              └──submit_review──> pending_review
```

#### 2.3 关键决策
- **草稿 vs 已下架**：明确区分"从未上架"和"曾上架后下架"，语义清晰
- **下架操作权限**：仅限审核员（`is_staff=True`）可执行
- **重新提交审核**：所有用户可从 `inactive_delisted` 状态重新提交
- **F7 级联触发**：下架级联（清选品+WP 下架）触发条件为 `publishable -> inactive_delisted`
- **兼容旧逻辑**：保留 `is_active True->False` 的兼容处理

---

### 3. AI 整合手动新增（Task 3）

#### 3.1 AI 辅助程度标记
| 标记值 | 说明 | 触发条件 |
|--------|------|----------|
| `none` | 完全手动 | 未使用任何 AI 功能 |
| `ocr` | AI 识别 | 使用了 OCR 图片识别 |
| `optimize` | AI 优化 | 使用了文案优化 |
| `both` | AI 生成 | 同时使用了 OCR 和文案优化 |

#### 3.2 OCR 识别流程
1. 用户在 Step1 上传本地图片/PDF
2. 点击"AI 识别图片/PDF"按钮
3. 弹出**结果确认对话框**，显示原文 vs AI 建议
4. 用户可编辑 AI 建议值
5. 点击"确认使用 AI 建议"后填充表单

#### 3.3 文案优化流程
1. 用户在 Step2 填写英文标题和描述
2. 点击"AI 优化文案"按钮
3. 弹出**对比对话框**，显示原文案 vs 优化后
4. 显示改进说明和质量评分
5. 点击"采用优化版本"后更新表单

#### 3.4 降级处理
- AI 服务不可用时返回 `degraded=true`
- 前端提示"AI 服务暂不可用，请手动填写"
- **不阻断流程**，用户可继续手动填写

#### 3.5 审核列表展示
- 新增"AI 辅助程度"列
- 使用 Badge 展示：完全手动/AI 识别/AI 优化/AI 生成

---

## 历史共识（归档）

### 2026-03-04 早期共识

#### 商品主数据管理边界
- **商品主数据**（PIM）：负责商品建档、审核、上下架、标签管理
- **分销选品运营**（DIST）：负责分销商选品、站点同步、WP 映射

#### 标签体系
- **受众标签**（`audience_tags`）：`for_her` / `for_him` / `for_couples`
- **运营标签**（`operational_tags`）：`best_seller` / `high_value` / `new_arrival`
- V1 不做自定义标签，使用预置字典

#### 导入规则
- `master_code` 不存在时：该行失败，其余行继续导入
- 导入结果展示：成功数/失败数/失败明细（行号 + 原因）

#### QR 口径（双口径）
- `QR 独家标签`：标记为 QR 独有的商品
- `当前仅 QR 可供`：当前只有 QR 供应商有库存

#### 站点定价
- 主价（AED） + 汇率换算价（THB 等）
- 以 AED 为基准货币

---

## 维护规则

1. 每次圆桌会议后 48 小时内更新本文件
2. 新增决策需产品 + 技术 + 业务三方确认
3. 已确认决策作为系统实现的唯一依据
4. 如需变更已确认决策，需重新圆桌评审

---

## 2026-03-05 共识（文档治理最小机制）

### 1. 目标与边界

- 目标：降低 token 消耗与交接时间，优先解决“找不到信息 / 不敢用 / 重复冲突”。
- 边界：不引入新工具，只在现有文档体系内治理。

### 2. 四件套模板（即日起启用）

- `brief`：`docs/templates/brief-template.md`
- `SSOT 映射`：`docs/governance/ssot-map.md`
- `弃用标记`：`docs/templates/deprecation-template.md`
- `决策记录`：`docs/templates/decision-record-template.md`

### 3. 运行规则（强制）

1. 非 SSOT 文档禁止复制正文，只能“摘要 + 链接”。
2. 每次开发闭环最多回填 3 处：`current-status`、`system-functional-matrix`、`consensus`。
3. 发现冲突 24 小时内完成收敛：以 SSOT 为准，其他文档改引用或打弃用标记。
4. 关键文档维护 `owner` 与 `last_verified_at`，超过 14 天进入“待复核”。

### 4. 执行计划入口

- 落地计划：`docs/plans/2026-03-05-doc-governance-rollout-plan.md`
