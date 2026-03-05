# 待开发清单（唯一入口）

> 目的：统一“待开发事项”写入位置，避免需求散落在多个 plan 文件。  
> 生效日期：2026-03-05  
> 规则级别：强制  
> owner：项目执行负责人（待指定）  
> last_verified_at：2026-03-05

## 使用规则（强制）

1. 新开发需求在进入实现前，必须先写入本文件。
2. 继续未完成开发时，默认从本文件点选目标，不再跨多个计划文件检索。
3. 状态流转统一为：`pending -> in_progress -> done`（必要时可标记 `blocked`）。
4. 每条事项必须包含：目标、不做项、验收标准（至少 1 条页面行为）。
5. 事项完成后，保留记录并补充证据链接，不直接删除。

## 字段规范

| 字段 | 说明 |
|---|---|
| Backlog ID | `BL-YYYYMMDD-序号` |
| 类型 | `feature` / `bugfix` / `docs` / `ops` |
| 优先级 | `P0` / `P1` / `P2` |
| 状态 | `pending` / `in_progress` / `blocked` / `done` |
| 目标 | 一句话业务目标 |
| 不做项 | 至少 1 条 |
| 验收标准 | 3-5 条，至少 1 条页面行为 |
| 关联文档 | status / matrix / consensus / plans 链接 |

## Backlog（当前）

| Backlog ID | 类型 | 优先级 | 状态 | 目标 | 不做项 | 验收标准（摘要） | 关联文档 |
|---|---|---|---|---|---|---|---|
| BL-20260305-001 | feature | P1 | pending | 补齐 `M1~M12` 到功能矩阵映射 | 不改业务代码 | matrix 中存在完整功能 ID 对应关系 | `docs/status/current-status.md` |
| BL-20260305-002 | feature | P1 | pending | 补齐阶段 1 页面行为验收证据 | 不扩展新功能 | 门禁/站点独立/单站隔离证据可追溯 | `docs/status/current-status.md` |
| BL-20260305-003 | bugfix | P1 | pending | 完成真实 WP 凭据链路复测（F18） | 不做新接口改造 | 发布/撤销成功链路证据闭环 | `docs/status/current-status.md` |
| BL-20260305-004 | ops | P2 | pending | 完成生产部署配置（Nginx + Gunicorn） | 不调整业务流程 | 生产部署文档和运行检查通过 | `docs/status/current-status.md` |
| BL-20260305-005 | bugfix | P1 | done | 补齐 Sprint5 未勾项（供应商 Tab + 移动端行为） | 不做 F18 真实凭据联调 | 供应商映射可增改删；<768 强制卡片视图；移动端筛选可折叠且不占半屏；前端构建通过 | `docs/status/current-status.md`, `frontend/src/pages/ProductsPage.tsx` |
| BL-20260305-006 | bugfix | P1 | pending | 补齐移动端“筛选折叠展开”冒烟截图证据 | 不改业务逻辑 | 390x844 下点击“筛选”可折叠展开，且展开面板高度受控并有截图 | `docs/status/current-status.md`, `frontend/src/pages/ProductsPage.tsx` |

## 新增事项模板（复制）

```markdown
| BL-YYYYMMDD-XXX | feature/bugfix/docs/ops | P0/P1/P2 | pending | <一句话目标> | <至少1条不做项> | <3-5条验收摘要> | <关联文档路径> |
```
