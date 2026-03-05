# 开发任务 Brief

- brief_id: BRIEF-20260305-001
- created_at: 2026-03-05
- owner: 人机协作治理负责人（待指定）
- status: active

## 1) 本轮唯一目标（1 句话）

完成文档治理 Phase 2：建立可复用实例、收敛高冲突历史文档、补齐关键文档责任标识。

## 2) 本轮不做项（至少 1 条）

- 不重构全部历史文档正文
- 不改动业务代码与接口实现
- 不引入新工具或新系统

## 3) 验收标准（3-5 条，至少 1 条页面行为）

- [x] 新增 1 份真实 brief 实例
- [x] 新增 1 份真实决策记录（DR）实例
- [x] 至少 2 份高冲突历史文档添加弃用标记头
- [x] 关键 SSOT 文档补齐 `owner` 与 `last_verified_at`

## 4) 风险与阻塞

- 风险：历史文档跨度大，容易误伤仍在使用的内容。
- 阻塞：暂无；以“弃用标记 + 替代链接”避免硬删除风险。

## 5) 权威链接（最多 5 个，仅 SSOT）

- 状态：`docs/status/current-status.md`
- 流程：`docs/process-registry.md`
- 功能矩阵：`docs/quality/system-functional-matrix.md`
- 决策：`docs/roundtable/consensus.md`
- 治理映射：`docs/governance/ssot-map.md`

## 6) 下一步第一动作（必须可执行）

按冲突优先级给历史计划文档打弃用标记并补替代文档链接。
