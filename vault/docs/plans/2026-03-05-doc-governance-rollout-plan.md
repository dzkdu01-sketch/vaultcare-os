# 文档治理落地计划（最小模板 + 运行规则）

> 日期：2026-03-05  
> 边界：不引入新工具。  
> 目标：降低 token 消耗、降低交接时间。

## 1) 本轮唯一目标

以最小变更方式建立文档治理基线，解决“找不到信息 / 不敢用 / 重复冲突”。

## 2) 本轮不做

- 不重构全部历史文档
- 不变更现有开发流程工具链
- 不一次性清理所有归档文件

## 3) 执行阶段

### Phase 1（D1-D2）止血

- [x] 新增 `docs/governance/ssot-map.md`
- [x] 新增模板：
  - `docs/templates/brief-template.md`
  - `docs/templates/deprecation-template.md`
  - `docs/templates/decision-record-template.md`
- [x] 续航入口与意图口径对齐：`docs/status/next-session.prompt.md` 使用 `/启动`
- [x] 清理重复段落（优先：`INTENTS-GUIDE`、`roundtable-v2-protocol`、`current-status`）
- [x] 标记旧 API 路径为历史口径并指向现行口径

### Phase 2（D3-D5）结构化

- [x] 建立 `docs/briefs/` 与 `docs/decisions/` 实例文件（至少各 1 个）
- [x] 对高冲突旧文档加弃用标记（仅前 5-10 行，不删历史）
- [x] 给关键文档补 `owner` 与 `last_verified_at`

### Phase 3（D6-D7）稳态

- [x] 建立每周 30 分钟治理节奏（冲突清单、过期清单、引用合规率）
- [x] 固化“每次开发回填最多 3 处”规则
- [x] 输出首周效果复盘

## 4) 度量口径（首周）

### 指标 A：token 消耗

- 统计项：
  - 单次 `/开发` 启动上下文字数
  - 首轮引用文档数量
  - 重复段落数量
- 目标：较治理前下降 30% 以上

### 指标 B：交接时间

- 统计项：
  - 接手到可开始编码的分钟数
  - 首轮必读文档数量
- 目标：较治理前下降 35% 以上

## 5) 风险与对冲

- 风险：短期内团队写作习惯不一致，容易回到“复制粘贴”。
- 对冲：仅对 `/开发` 主链路强制执行模板，其他场景渐进纳入。
