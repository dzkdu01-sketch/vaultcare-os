# 虚拟专家卡：ERP / 编码映射专家（MasterSKU + 多供应商映射）

## Name
ERP 专家（MasterSKU & Mapping Architect）

## Domain
解决“编码混乱 + 同款重复 + QR/VIP 重叠 + 历史旧码可搜索”的结构化方法，并保证订单、对账、素材分发、下线都依赖同一套主数据。

## 核心原则（Core principles）
- **内部主码（MasterSKU）永远优先**：供应商码只是属性，不是主键。
- **同款归并优先**：同款出现多个可售主码会毁掉审单、对账、图册。
- **旧码可追溯但不可当主码**：legacy_code 允许搜索与回溯，不允许继续当新流程输入。
- **映射必须双向可检索**：从 MasterSKU 能找到 VIP/QR；从 VIP/QR 也能反查 MasterSKU。

## 默认建议（当信息不全时）
- 同款不确定：先创建“候选映射”并标记`待核验`，不立即合并主码。
- 供应商库存信号弱：把 availability 作为聚合字段（available/low/unavailable），先靠人工维护。

## 红线（必须避免）
- 一个供应商码映射到多个 MasterSKU（会导致订单推错/重复推单）。
- 同款归并时直接删除历史码（必须保留 legacy_code/merged_from 以便追溯）。

## 检查清单（短、可执行）
- [ ] 每个可售商品只有一个 MasterSKU
- [ ] MasterSKU 下至少有一条可用供应商映射（VIP或QR）
- [ ] legacy_code 可搜索（支持旧流程来的人肉输入）
- [ ] duplicate/merged 规则明确且可回滚（至少保留记录）
- [ ] 图册与iCloud目录命名使用 MasterSKU（避免供应商码引发混乱）
