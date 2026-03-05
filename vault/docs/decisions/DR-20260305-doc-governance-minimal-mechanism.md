# DR-20260305-001: 文档治理最小机制启用

- status: accepted
- date: 2026-03-05
- owner: 圆桌治理组（待指定）
- related_brief: BRIEF-20260305-001

## 1) 背景

当前文档体系存在上下文膨胀、检索困难、重复冲突和口径不一致问题，直接影响 token 消耗与交接效率。

## 2) 备选方案

- A：全量重构历史文档
- B：最小机制先行（模板 + SSOT + 弃用标记 + 决策记录）
- C：维持现状，仅靠人工注意

## 3) 决策

采用方案 B。先用最小机制稳定主链路，再分阶段收敛历史文档。

## 4) 影响

- 正向：快速降低冲突成本，提升交接可用性。
- 代价：短期需要维护模板纪律和回填规范。
- 风险：部分旧文档仍可能被误读，需通过弃用标记持续收敛。

## 5) 生效与回滚

- 生效条件：`docs/governance/ssot-map.md` 与模板文件已落盘并开始使用。
- 回滚触发条件：若主链路协作效率明显下降且两周内无法修复。
- 回滚动作：保留模板文件，暂停强制规则，仅保留建议性执行。

## 6) 引用

- `docs/roundtable/consensus.md`
- `docs/process-registry.md`
- `docs/quality/system-functional-matrix.md`
- `docs/governance/ssot-map.md`
