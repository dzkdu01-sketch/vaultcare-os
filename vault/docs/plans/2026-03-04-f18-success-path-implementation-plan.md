# F18 Success Path Evidence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在无可用 WP 测试凭据条件下，为 `PIM-F8/F18` 提供可控成功链路并补齐页面成功态证据。

**Architecture:** 后端在 `site_operation` 增加“显式触发 + 环境开关”测试成功通道，仅用于本地开发/测试；前端通过环境变量启用该通道并复用现有操作流刷新状态；最后同步状态与交接文档，明确该证据来自测试通道而非真实 WP 凭据。

**Tech Stack:** Django + DRF, React + TypeScript + Axios, pytest/unittest (Django TestCase)

---

### Task 1: 后端测试成功通道（TDD）

**Files:**
- Modify: `backend/sites/tests/test_f18_site_operations.py`
- Modify: `backend/sites/views.py`
- Test: `backend/sites/tests/test_f18_site_operations.py`

**Step 1: Write the failing test**

- 新增用例：`simulate_success=True` 时，`publish/revoke` 返回 200 且不调用 `WooCommerceClient`。
- 断言返回 `sync_status` 与目标状态一致，并清空 `sync_error`。

**Step 2: Run test to verify it fails**

Run: `.\venv\Scripts\python.exe manage.py test sites.tests.test_f18_site_operations.F18SiteOperationsTests.test_site_publish_simulate_success_bypasses_wp_client`
Expected: FAIL（当前仍会调用 WooClient 并返回失败）

**Step 3: Write minimal implementation**

- 在 `site_operation` 增加 `simulate_success` 参数解析；
- 仅在 `DEBUG=True` 且 `simulate_success=True` 时绕过 Woo 调用；
- 直接写回 `mapping.sync_status/last_synced_at/sync_error` 并返回成功结构。

**Step 4: Run test to verify it passes**

Run: `.\venv\Scripts\python.exe manage.py test sites.tests.test_f18_site_operations -v 2`
Expected: PASS（新旧用例都通过）

### Task 2: 前端接入测试成功通道

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/pages/DistributorSelectionPage.tsx`

**Step 1: Add failing behavior check**

- 手工验证：启用 `VITE_SITE_OPERATION_SIMULATE_SUCCESS=1` 时，应发送 `simulate_success: true`；
- 关闭时不得发送该字段。

**Step 2: Implement minimal code**

- 为 `siteOperation` payload 增加可选字段；
- 页面层读取环境变量并在调用时按开关注入。

**Step 3: Verify behavior**

Run: `npm run build`
Expected: PASS（类型与构建通过）

### Task 3: 证据与交接文档同步

**Files:**
- Modify: `docs/status/current-status.md`
- Modify: `docs/process-registry.md`
- Add: `docs/handover/auto/session-20260304-<time>.md`

**Step 1: Capture evidence**

- 记录“成功发布/撤销”来自测试成功通道的证据；
- 明确外部 WP 凭据仍是真实联调阻塞项。

**Step 2: Update docs**

- `current-status` 增加本轮验证证据；
- `process-registry` 更新 `PIM-F18` 下一步/阻塞项与执行状态；
- 新建 auto handover 快照，指向下一步真实凭据联调。

**Step 3: Verify docs consistency**

Run: `rg "PIM-F18|成功|simulate_success|凭据" docs -n`
Expected: 关键文档均可检索到本轮变更口径。
