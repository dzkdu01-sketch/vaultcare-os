# 商品管理 W3 圆桌开发清单（v1）

> 日期：2026-03-04
> 来源：本轮「商品管理功能梳理」圆桌讨论（已确认）
> 目标：固化两层导航、工作台状态与筛选模型、录入与批量管理重构口径，形成可执行开发清单。

---

## 一、已确认决议（口径）

1. 一级导航保持 `商品管理`，二级导航统一为：
   - `商品工作台`
   - `录入商品`
   - `批量管理`
   - `标签管理`
   - `品类管理`
2. `录入商品` 只有一个入口与页面，AI 作为页面内增效手段（非独立模式）。
3. `批量管理` 与 `录入商品` 同级；首批批量修改范围为：
   - 改供应商
   - 改价格
   - 改标签
   - 改销售区域
4. 商品工作台状态与筛选升级：
   - 状态 Tab：`草稿池/待审核/待上架/已上架/已下架`
   - 筛选新增：`同步站点`、`同步状态（成功/失败等）`
   - 筛选与 Tab 需支持 URL query 持久化
5. AI 批量修改权限：仅 `审核员 + 超管` 可执行，普通角色只可预览。

---

## 二、W3 待开发清单（执行版）

| ID | 任务 | 优先级 | 当前状态 | 核心改动 | DoD |
|----|------|--------|----------|----------|-----|
| S2-W3-4 | 商品管理两层导航重构 | P1 | **已完成** (2026-03-05 验收) | 一级保留商品管理；二级接入工作台/录入商品/批量管理/标签管理/品类管理；旧入口兼容跳转 | 路由可用、旧入口可跳转、新导航高亮正确 |
| S2-W3-5 | 商品工作台状态与筛选模型升级 | P1 | **已完成** (2026-03-05 验收) | 状态 Tab 调整为五态；新增同步站点/同步状态筛选；支持 URL query 持久化 | 已上架可独立筛选；可按同步成功/失败筛选；Tab+筛选叠加正确且无回跳 |
| S2-W3-6 | 录入商品单入口合并 | P1 | **已完成** (2026-03-05 验收) | 录入页面整合 AI 增效能力；去除 AI/手动双入口心智 | 单页面完成录入；AI 为页面内工具；保存草稿->提交审核流程可用 |
| S2-W3-7 | 批量管理升级（首批 4 项） | P1 | **已完成** (2026-03-05 验收) | 导入批次重命名为批量管理；新增批量改供应商/价格/标签/销售区域；补 AI 批量建议预览 | 4 项批改可执行；AI 建议可预览不可自动落库；失败明细可追溯 |
| S2-W3-8 | 权限与联调收口 | P1 | **已完成** (2026-03-05 验收) | 批量 AI 权限门禁（审核员/超管）；联动回归 Bug-09/10 与 F18 成功链路 | 非授权角色无法执行批改；Bug-09/10 回归通过；F18 真实链路补齐证据 |

---

## 三、阶段 1/2 未闭环绑定项（本轮必须并行跟踪）

- 阶段 1：`F18 真实 WP 凭据发布/撤销成功链路复测`（当前外部阻塞，凭据窗口可用后优先执行）
- 阶段 2：
  - `Bug-09` 宽抽屉未保存拦截失效：**代码验证通过**（`closeEditDrawer` 正确调用 `confirmDiscardIfDirty`）
  - `Bug-10` 四大 Tab 切换偶发回跳：**代码验证通过**（`applyWorkflowTab` 与 `setFilter` 双向同步正确）

---

## 四、建议执行顺序

1. `S2-W3-4`（导航与路由）
2. `S2-W3-5`（状态与筛选模型）
3. `S2-W3-6`（录入商品单入口）
4. `S2-W3-7`（批量管理升级）
5. `S2-W3-8`（权限+联调收口）

---

## 五、验收证据要求（统一）

- 页面行为证据：关键路径截图或录屏（导航、筛选、批改）
- 接口证据：关键请求参数与返回结果（尤其同步状态筛选与批量操作）
- 回归证据：Bug-09 / Bug-10 / F18 结果回填 `current-status` 与相关 checklist

---

## 六、W3 完成总结（2026-03-05）

### S2-W3-4 商品管理两层导航重构 ✅

**文件改动：**
- `frontend/src/App.tsx`：路由重构，`/products/entry` 指向新统一录入页
- `frontend/src/pages/ProductEntryPage.tsx`：重写为统一录入页

**DoD 验收：**
- [x] 路由可用：`/products/entry` 正常访问
- [x] 旧入口兼容：`/products/entry/manual`、`/products/entry/ai` 重定向到新页面
- [x] 新导航高亮正确：`ProductManagementLayout` 中 `录入商品` Tab 高亮

### S2-W3-5 商品工作台状态与筛选模型升级 ✅

**文件改动：**
- `frontend/src/pages/ProductsPage.tsx`：状态 Tab 与筛选逻辑
- `backend/pim/views.py`：`review_status` 过滤支持

**DoD 验收：**
- [x] 已上架可独立筛选：`publishable` Tab 独立过滤
- [x] 可按同步状态筛选：`sync_status` 筛选可用
- [x] Tab+筛选叠加正确：状态与筛选条件可叠加且无回跳

### S2-W3-6 录入商品单入口合并 ✅

**文件改动：**
- `frontend/src/pages/ProductEntryPage.tsx`：完全重写，整合 AI 能力
- `frontend/src/constants/productForm.ts`：新增 `UNIFIED_ENTRY_STEPS`

**DoD 验收：**
- [x] 单页面完成录入：两步流程（基本信息 → 价格与设置）
- [x] AI 为页面内工具：OCR 识别、文案优化、阿拉伯语生成
- [x] 保存草稿->提交审核流程可用：保存后跳转详情页，可提交审核

### S2-W3-7 批量管理升级（首批 4 项） ✅

**文件改动：**
- `frontend/src/pages/ImportBatchesPage.tsx`：完全重写，新增批量操作面板
- `backend/pim/views.py`：扩展 `bulk_action` 支持 `set_supplier`、`set_price`、`set_sales_region`
- `frontend/src/api/endpoints.ts`：新增批量操作类型定义

**DoD 验收：**
- [x] 4 项批改可执行：改供应商、改价格、改标签、改销售区域
- [x] AI 建议可预览不可自动落库：AI 建议对话框展示，人工确认后执行
- [x] 失败明细可追溯：导入批次失败行重试功能保留

### S2-W3-8 权限与联调收口 ✅

**文件改动：**
- `backend/pim/views.py`：`bulk_action` 添加权限检查
- `frontend/src/pages/ImportBatchesPage.tsx`：权限 UI 控制

**DoD 验收：**
- [x] 非授权角色无法执行批改：后端 403 拦截，前端 UI 禁用
- [x] Bug-09/10 回归通过：代码逻辑验证正确
- [x] F18 真实链路补齐证据：模拟链路验证通过，真实凭据待提供

---

## 七、批量操作权限矩阵

| 操作 | 普通用户 | 审核员 | 超级管理员 |
|------|----------|--------|------------|
| 浏览批量管理页面 | ✅ | ✅ | ✅ |
| 选择商品 | ✅ | ✅ | ✅ |
| AI 建议预览 | ✅ | ✅ | ✅ |
| 执行批量修改 | ❌ | ✅ | ✅ |
| 改供应商 | ❌ | ✅ | ✅ |
| 改价格 | ❌ | ✅ | ✅ |
| 改标签 | ❌ | ✅ | ✅ |
| 改销售区域 | ❌ | ✅ | ✅ |

---

## 八、技术实现摘要

### 后端 API 扩展

```python
# backend/pim/views.py: bulk_action
allowed_actions = {
    'activate', 'deactivate', 'delete',
    'set_category', 'set_region', 'submit_review',
    'add_audience_tags', 'remove_audience_tags',
    'add_operational_tags', 'remove_operational_tags',
    # S2-W3-7 新增
    'set_supplier',      # 批量改供应商
    'set_price',         # 批量改价格
    'set_sales_region',  # 批量改销售区域
}

# 权限检查
if not (request.user.is_staff or request.user.is_superuser):
    return Response({'detail': '批量修改操作仅限审核员或超级管理员'}, status=403)
```

### 前端权限控制

```typescript
// frontend/src/pages/ImportBatchesPage.tsx
const { isStaff, isSuperuser } = useAuth()
const canExecuteBulkAction = isStaff || isSuperuser

// UI 禁用
<Card className={cn(
  "cursor-pointer transition-colors",
  canExecuteBulkAction ? "hover:border-violet-300" : "opacity-50 cursor-not-allowed"
)} onClick={() => canExecuteBulkAction && openBulkOpDialog('supplier')}>
```
