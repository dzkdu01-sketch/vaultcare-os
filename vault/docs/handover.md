# Vaultcare OS — Handover (Single Source)

> If you only read one doc besides `current-status`, read this one.

## Read order

1. `docs/status/current-status.md`
2. This file: `docs/handover.md`
3. `docs/process-registry.md`（流程索引：业务-流程-功能）
4. If you are working on products: `docs/modules/products/index.md`

## What is the “truth” for each kind of information?

- **Current work / what to do next:** `docs/status/current-status.md`
- **Process mapping (business -> flow -> feature):** `docs/process-registry.md`
- **Functional status & verification evidence:** `docs/quality/system-functional-matrix.md`
- **Module specs:** `docs/modules/*/spec.md`
- **Business & architecture:** `docs/context/overview.md`
- **Flywheel evolution index (metrics/reports):** `docs/flywheel/index.md`

## Quickstart (local dev)

```bash
# backend
cd D:\cursor\vault\backend
.\venv\Scripts\python.exe manage.py runserver

# frontend
cd D:\cursor\vault\frontend
npm run dev
```

## Accounts

See `docs/reference/accounts.md`.

---

## Latest active handover snapshot

- **本次**：录入商品/手动新增/AI 新品 页面全屏布局修复（ProductEntryPage、ProductNewManualPage、ProductNewAIPage 主容器改为 `w-full`）；文档已更新；代码已推送，VPS 部署需在服务器拉取后重新构建前端或执行网页终端部署脚本。
- `docs/deploy/VPS-DEPLOYMENT-HANDOVER-2026-03-05.md` (VPS 部署交接：**部署成功** ✅ - Hostinger + CloudPanel 完整部署流程、HTTP 502 修复、软链接 `.conf` 后缀问题、下次部署注意事项)
- `docs/handover/auto/session-20260305-1129.md` (文档治理闭环 + 跨 IDE 执行器 v1.1 + 全局 collab 别名与自动 bridge 已完成)
- `docs/handover/auto/session-20260304-2335.md` (W1 QA 冒烟执行版完成：服务恢复、Tab/动态列/抽屉链路验证，新增 Bug-09/10)
- `docs/handover/auto/session-20260304-2326.md` (W1 首版落地：四大 Tab、动态列持久化、宽抽屉未保存拦截与“保存并下一条”已可用)
- `docs/handover/auto/session-20260304-1615.md` (进度文档已同步：流程盘点与全景模块对齐快照落盘，可直接续航)
- `docs/handover/auto/session-20260304-1600.md` (PIM 表单重构与架构边界 Phase 1 完成，防误伤同步闭环，前端上传与语言联动就绪)
- `docs/handover/auto/session-20260304-1545.md` (人机协作机制升级v1.2：自动直推 + 上下文高压续航，附续航包)
- `docs/handover/auto/session-20260304-1530.md` (第1阶段指标已升级为近7天趋势，前端卡片可见可审核/已处理)
- `docs/handover/auto/session-20260304-1510.md` (第1阶段第二口径已落地：审核员当日处理量接入后端与页面)
- `docs/handover/auto/session-20260304-1452.md` (第1阶段指标已接入商品列表页，业务可直接查看效率卡片)
- `docs/handover/auto/session-20260304-1435.md` (第1阶段业务指标采集已落地：phase1_metrics + 测试通过)
- `docs/handover/auto/session-20260304-1410.md` (方案A第1阶段启动：AI/手动录入+审核门禁回归 12/12 通过)
- `docs/roundtable/sessions/2026-03-04-product-go-live-scheduling.md` (开发排期圆桌已拍板：方案A，本周上线阶段1，AI辅助录入为硬约束)
- `docs/handover/auto/session-20260304-1342.md` (F17 工单提醒通道最小闭环完成，进入消息/邮件通道选择阶段)
- `docs/handover/auto/session-20260304-1325.md` (飞轮进化与续航包已落盘，下一步锁定 PIM-F17 自动提醒通道)
- `docs/handover/auto/session-20260304-1310.md` (F18 测试通道成功链路完成：后端/前端/文档同步，真实 WP 凭据仍阻塞)
- `docs/handover/auto/session-20260304-1249.md` (F18 页面证据与错误文案透传完成，进入“成功链路凭据补齐”阶段)
- `docs/handover/auto/session-20260304-1244.md` (F18 页面级失败链路回归完成，定位成功链路受 WP 测试凭据阻塞)
- `docs/handover/auto/session-20260304-1238.md` (F18 失败隔离测试补齐并完成 matrix/status/process 三文档同步)
- `docs/handover/auto/session-20260304-1228.md` (F8 第二步完成，进入 F8+F18 站点级发布/撤销联动实现)
- `docs/archive/handover-pim-mvp-phase1-2026-03-04.md` (PIM `F1/F2/F3` P0 loop closure, tests, and next-step entry)

---

## Embedded legacy handover sources (archived in-place)

The following sections are preserved for historical context. New work should reference the canonical docs listed above.

### Legacy: Products redesign handover (archived)

Archived full text: `docs/archive/handover-products-redesign-2026-03-02.md`

### Legacy: Bugfix handover (archived)

Archived full text: `docs/archive/handover-bugfix-2026-03-02.md`

