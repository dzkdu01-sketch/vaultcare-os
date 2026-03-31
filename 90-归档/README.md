# 归档区说明

这个目录只放两类文件：

1. 已经失效的旧文档
2. 被新文档替代的历史版本

规则：

- 主区还在使用的文档，不放这里
- 放进来时，文件名尽量保留原名
- 如果是替代关系，建议在文件开头或索引中写明被哪份文档替代
- 归档不等于废弃，后续如果要改需求，仍可把这里的讨论稿和旧版本作为历史参考

---

## 已归档文档

### 01-中台总方案.md

- 原位置：`20-方案设计/01-中台总方案.md`
- 归档原因：其“项目定位、一期范围、目标与边界”内容已被 `20-方案设计/12-一期需求说明书.md` 正式收口
- 保留原因：作为正式版之前的总方案讨论稿，后续若回溯最初范围判断和阶段目标，仍有参考价值

### 02-一期模块与页面设计.md

- 原位置：`20-方案设计/02-一期模块与页面设计.md`
- 归档原因：其“模块定位、页面拆分与核心区块”内容已被 `20-方案设计/12-一期需求说明书.md` 和 `20-方案设计/09-原型设计与验证/` 体系覆盖
- 保留原因：作为页面讨论稿，后续若回溯某些页面最初设计思路，仍有参考价值

### 04-页面字段字典.md

- 原位置：`20-方案设计/04-页面字段字典.md`
- 归档原因：已被 `20-方案设计/05-页面字段字典.md` 替代
- 说明：旧版（设计版）使用系统字段键命名，新版（讨论版）补充了评估摘要、门禁区字段、筛选字段等内容，覆盖范围更完整

### docs-plans-2026-03-09-page-s1-ai-config-implementation-plan.md

- 原位置：`docs/plans/2026-03-09-page-s1-ai-config-implementation-plan.md`
- 归档原因：该计划采用“后端 Django + 前端 React 的 S1 垂直切片”实施路径，已不再是当前批准并执行中的主路径
- 替代文档：`docs/plans/2026-03-09-frontend-project-skeleton-design.md` + `90-归档/2026-03-09-frontend-project-skeleton-implementation-plan.md`
- 说明：S1 AI 配置页设计文档仍保留在主区，作为前端骨架 Task 15 的页面输入；仅其旧实施计划被归档

### 2026-03-10-e2e-recovery-playwright-gate.md

- 原位置：`docs/plans/2026-03-10-e2e-recovery-playwright-gate.md`
- 归档原因：仓库内已无 `frontend/e2e/` 与 Playwright 门禁落地，相关脚本与依赖已移除；此文仅作历史参考
- 当前测试：`frontend` 以 Vitest + RTL 为主（`npm run test`）

### 2026-03-20-whatsapp-lookbook-implementation.md

- 原位置：`docs/plans/2026-03-20-whatsapp-lookbook-implementation.md`
- 归档原因：客户侧主交付已转向「分册 PNG 图册」生成；网页 `/lookbook` 若仍保留代码，此文不再作为执行清单
- 说明：可选线上预览仍可能存在于路由 `/lookbook`，与本文档无强制绑定

### 2026-03-20-whatsapp-lookbook-design.md

- 原位置：`docs/plans/2026-03-20-whatsapp-lookbook-design.md`
- 归档原因：与上条同属网页 Lookbook 方案讨论稿；当前产品沟通以 PNG 图册为主
