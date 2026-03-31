# 商品模块 AI 开发计划

> 基于 `2026-03-11-product-module-handover.md` 生成
> 项目路径：`D:\cursor\vault-os1.1\frontend`
> 技术栈：React 19 + React Router 7 + Vite 6 + TypeScript 5.7 + Tailwind 4.2

---

## 约定与规范

### 编码约定（AI 必须遵守）

- 数据获取：`useEffect` + `useState` + `appServices` 单例（沿用现有模式）
- 样式：纯 Tailwind class，不写自定义 CSS
- 组件导出：`export default function ComponentName()`
- 测试：Vitest + @testing-library/react，文件放 `__tests__/` 目录
- 类型：所有类型定义集中在 `src/services/types.ts`
- Mock 数据：集中在 `src/services/mock/index.ts`
- 服务层入口：`src/services/app-services.ts`（mock/real 切换点）
- 路由：`src/app/router/index.tsx`，所有业务页面包裹在 `<ProtectedRoute>` + `<AppShell>` 内

### 新增依赖决策

| 需求 | 方案 | 理由 |
|------|------|------|
| HTTP 客户端 | 原生 fetch 封装 | 项目轻量，无需引入 axios |
| 表单校验 | react-hook-form + zod | 交接文档建议，表单字段多且有复杂校验规则 |
| 状态管理 | 暂不引入 | 当前 service 层 + 组件 local state 足够 |

### 验证命令

```bash
# 每个任务完成后必须执行
cd D:\cursor\vault-os1.1\frontend
npx vitest run          # 单元测试
npx tsc --noEmit        # 类型检查
npx vite build          # 构建检查
```

---

## Phase 0：清理 + 基础设施（3 个任务）

### Task 0.1 — 清理调试日志

- 依赖：无
- 读取：`src/pages/products/ProductDetailPage.tsx`、`src/services/mock/index.ts`、`src/services/app-services.ts`
- 操作：删除所有 `fetch('http://127.0.0.1:7283/...')` 调试日志代码块
- 涉及位置：
  - `ProductDetailPage.tsx` 中的 `// #region agent log` 块
  - `mock/index.ts` 中的 `// #region agent log` 块
  - `app-services.ts` 中的 `// #region agent log` 块
- 验证：`npx vitest run && npx tsc --noEmit`
- 注意：只删除 agent log 块，不改动任何业务逻辑

### Task 0.2 — 扩展类型定义

- 依赖：无
- 读取：`src/services/types.ts`
- 操作：在 `types.ts` 末尾追加以下类型（不修改已有类型）

```typescript
// === 新增类型 ===

// 新建商品请求体
export type ProductCreateInput = {
  sku: string
  name: string
  market: 'UAE' | 'TH'
  supplier: string
  ownershipType: string
  barcode?: string
  brandName?: string
  titleAr?: string
  titleEn?: string
  descriptionEn?: string
}

// 编辑商品请求体
export type ProductUpdateInput = Partial<ProductCreateInput>

// 批量操作请求
export type BatchOperationRequest = {
  ids: string[]
}

// 批量操作结果
export type BatchOperationResult = {
  success: number
  failed: number
  errors?: Array<{ id: string; reason: string }>
}

// 导入结果
export type ImportResult = {
  total: number
  created: number
  skipped: number
  errors?: Array<{ row: number; reason: string }>
}

// 分页参数
export type PaginationParams = {
  page: number
  pageSize: number
}

// 分页列表返回
export type PaginatedProductListResult = ProductListResult & {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

- 验证：`npx tsc --noEmit`

### Task 0.3 — 安装表单依赖

- 依赖：无
- 操作：

```bash
cd D:\cursor\vault-os1.1\frontend
npm install react-hook-form zod @hookform/resolvers
```

- 验证：`npx tsc --noEmit && npx vite build`

---

## Phase 1（P0）：CRUD 读写闭环（7 个任务）

### Task 1.1 — 创建 HTTP 客户端 `api-client.ts`

- 依赖：Task 0.2
- 读取：`src/services/app-services.ts`（了解现有服务层模式）
- 创建：`src/services/api-client.ts`
- 要求：
  - 封装原生 fetch，提供 `get<T>`, `post<T>`, `put<T>`, `del<T>` 方法
  - 基础 URL 从环境变量 `VITE_API_BASE_URL` 读取，默认 `/api`
  - 自动附加 `Content-Type: application/json`
  - 自动从 `localStorage` 读取 token 附加到 `Authorization` header
  - 统一错误处理：非 2xx 响应抛出自定义 `ApiError`（含 status + message）
  - 导出 `apiClient` 单例

```typescript
// 期望的使用方式
import { apiClient } from './api-client'
const result = await apiClient.get<ProductDetail>('/products/123')
const created = await apiClient.post<ProductDetail>('/products', body)
```

- 验证：`npx tsc --noEmit`

### Task 1.2 — 创建商品 API 层 `product-api.ts`

- 依赖：Task 0.2, Task 1.1
- 读取：`src/services/api-client.ts`、`src/services/types.ts`
- 创建：`src/services/product-api.ts`
- 要求：导出 `productApi` 对象，包含以下方法：

```typescript
export const productApi = {
  // CRUD
  list(filters?: ProductFilters, pagination?: PaginationParams): Promise<PaginatedProductListResult>
  getById(id: string): Promise<ProductDetail>
  create(input: ProductCreateInput): Promise<ProductDetail>
  update(id: string, input: ProductUpdateInput): Promise<ProductDetail>
  remove(id: string): Promise<{ success: boolean }>

  // 状态操作
  pool(id: string): Promise<ProductDetail>
  identify(id: string): Promise<ProductDetail>
  confirm(id: string): Promise<ProductDetail>
  suspend(id: string): Promise<ProductDetail>
  resume(id: string): Promise<ProductDetail>

  // 批量操作
  batchAiNormalize(ids: string[]): Promise<BatchOperationResult>
  batchAiTranslate(ids: string[]): Promise<BatchOperationResult>
  batchAssetCheck(ids: string[]): Promise<BatchOperationResult>
  batchConfirm(ids: string[]): Promise<BatchOperationResult>

  // 导入
  importFile(file: File): Promise<ImportResult>
}
```

- API 路径参照交接文档 §4
- `importFile` 使用 `FormData`，不设 `Content-Type`（让浏览器自动设置 boundary）
- 验证：`npx tsc --noEmit`

### Task 1.3 — 改造服务层支持 mock/real 切换

- 依赖：Task 1.2
- 读取：`src/services/app-services.ts`、`src/services/mock/index.ts`、`src/services/product-api.ts`
- 修改：`src/services/app-services.ts`
- 要求：
  - 增加环境变量 `VITE_USE_MOCK`（默认 `'true'`）控制 mock/real 切换
  - `products` 命名空间扩展为完整 CRUD + 状态 + 批量 + 导入
  - mock 模式下：list/getById 沿用现有 mock，新增方法返回模拟成功结果
  - real 模式下：委托给 `productApi`
- 同时修改：`src/services/mock/index.ts`
  - 增加 mock 版本的 create/update/delete 函数（操作内存数组，返回模拟数据）
  - 增加 mock 分页支持（在 `listMockProducts` 中增加 page/pageSize 参数）
- 验证：`npx vitest run && npx tsc --noEmit`
- 注意：现有测试依赖 mock 数据，确保不破坏

### Task 1.4 — 创建通用组件：ConfirmDialog + Pagination

- 依赖：无
- 读取：`src/components/shared/`（了解现有共享组件风格）
- 创建两个文件：

**`src/components/shared/ConfirmDialog.tsx`**
- Props：`open`, `title`, `message`, `confirmLabel?`, `cancelLabel?`, `onConfirm`, `onCancel`, `variant?: 'danger' | 'default'`
- 使用原生 `<dialog>` 元素或 Tailwind 实现的模态框
- danger variant 时确认按钮为红色

**`src/components/shared/Pagination.tsx`**
- Props：`page`, `pageSize`, `total`, `onPageChange`
- 显示：「第 X / Y 页，共 Z 条」+ 上一页/下一页按钮
- 首页禁用上一页，末页禁用下一页

- 验证：`npx tsc --noEmit`

### Task 1.5 — 创建 ProductForm 组件

- 依赖：Task 0.2, Task 0.3
- 读取：`src/services/types.ts`（ProductCreateInput 类型）、`src/constants/markets.ts`、交接文档 §7 表单字段规格
- 创建：`src/components/business/ProductForm.tsx`
- 要求：
  - 使用 react-hook-form + zod 做表单管理和校验
  - Props：`mode: 'create' | 'edit'`、`defaultValues?: Partial<ProductCreateInput>`、`onSubmit: (data: ProductCreateInput) => Promise<void>`、`loading?: boolean`
  - 字段列表（参照交接文档 §7）：sku（编辑模式 disabled）、name、market（select）、supplier、ownershipType（select: 自有货权/寄售/外部供货）、barcode、brandName、titleEn、titleAr、descriptionEn（textarea）
  - 校验规则：
    - sku：必填，正则 `^SKU-(UAE|TH)-\d{3}$`
    - name：必填，2-100 字符
    - market：必填
    - supplier：必填
    - ownershipType：必填
  - 提交按钮文案：create 模式 "创建商品"，edit 模式 "保存修改"
  - loading 时按钮禁用 + 显示加载状态
- 验证：`npx tsc --noEmit`

### Task 1.6 — 重写 ProductCreatePage

- 依赖：Task 1.3, Task 1.5
- 读取：`src/pages/products/ProductCreatePage.tsx`（当前 29 行骨架）、`src/components/business/ProductForm.tsx`
- 修改：`src/pages/products/ProductCreatePage.tsx`
- 要求：
  - 使用 `PageHeader` 组件显示标题 "新建商品"
  - 嵌入 `ProductForm` 组件，mode='create'
  - onSubmit 调用 `appServices.products.create(data)`
  - 成功后 `navigate('/products')` 跳转回列表
  - 失败时显示错误提示（可用 window.alert 或内联错误信息）
- 同时更新测试：`src/pages/products/__tests__/product-create-page.test.tsx`
  - 测试表单渲染（所有必填字段存在）
  - 测试提交按钮存在
- 验证：`npx vitest run`

### Task 1.7 — 创建 ProductEditPage + 注册路由

- 依赖：Task 1.3, Task 1.5
- 读取：`src/pages/products/ProductCreatePage.tsx`（参考模式）、`src/app/router/index.tsx`
- 创建：`src/pages/products/ProductEditPage.tsx`
- 要求：
  - 从 URL 参数获取 `id`
  - 加载商品详情 `appServices.products.getById(id)`
  - 加载中显示 `LoadingState`，加载失败显示 `ErrorState`
  - 加载成功后渲染 `ProductForm`，mode='edit'，defaultValues 填充现有数据
  - onSubmit 调用 `appServices.products.update(id, data)`
  - 成功后 `navigate('/products/' + id)` 跳转回详情
- 修改：`src/app/router/index.tsx`
  - 在 `/products/:id` 路由之后增加 `/products/:id/edit` → `ProductEditPage`
- 创建测试：`src/pages/products/__tests__/product-edit-page.test.tsx`
- 验证：`npx vitest run`

---

## Phase 2（P0 续）：列表页增强 + 详情页完善（3 个任务）

### Task 2.1 — 详情页增强：完整字段 + 编辑/删除入口

- 依赖：Task 1.3, Task 1.4
- 读取：`src/pages/products/ProductDetailPage.tsx`（当前 81 行）
- 修改：`src/pages/products/ProductDetailPage.tsx`
- 要求：
  - 展示所有详情字段（当前只展示了 sku/market/supplier/ownershipType，需增加 barcode/brandName/titleEn/titleAr/descriptionEn）
  - 在 `PageHeader` 的 actions 区域增加两个按钮：
    - "编辑" → `navigate('/products/' + id + '/edit')`
    - "删除" → 弹出 `ConfirmDialog`，确认后调用 `appServices.products.remove(id)`，成功后跳转列表
  - 增加审计日志展示区域（`auditLog` 数组，按时间倒序，每条显示时间 + 操作 + 操作人）
- 更新测试：`src/pages/products/__tests__/product-detail-page.test.tsx`
- 验证：`npx vitest run`

### Task 2.2 — 列表页接入真实分页

- 依赖：Task 1.3, Task 1.4
- 读取：`src/pages/products/ProductListPage.tsx`（261 行，重点看分页占位部分 L250-258）
- 修改：`src/pages/products/ProductListPage.tsx`
- 要求：
  - 增加 `page` 和 `pageSize` state（默认 page=1, pageSize=20）
  - 将 page/pageSize 传入 `appServices.products.list()` 调用
  - 用 `Pagination` 组件替换底部分页占位 div
  - 切换筛选条件时重置 page 为 1
  - Tab 切换时重置 page 为 1
- 验证：`npx vitest run`
- 注意：不改动批量操作逻辑（Phase 4 处理）

### Task 2.3 — 创建 usePagination hook

- 依赖：Task 2.2（可选，如果 Task 2.2 中分页逻辑较简单可跳过）
- 创建：`src/hooks/usePagination.ts`
- 要求：
  - 封装 page/pageSize/total state
  - 提供 `goToPage`, `nextPage`, `prevPage`, `resetPage` 方法
  - 提供 `paginationProps` 对象可直接传给 `Pagination` 组件
- 如果 Task 2.2 中直接用 useState 已经足够清晰，此任务可标记为跳过
- 验证：`npx tsc --noEmit`

---

## Phase 3（P1）：状态流转（3 个任务）

### Task 3.1 — 创建 StatusTransitionButton 组件

- 依赖：Task 1.3
- 读取：`src/constants/status.ts`、`src/services/types.ts`（ProductStatus 类型）、交接文档 §3 状态流转规则
- 创建：`src/components/business/StatusTransitionButton.tsx`
- 要求：
  - Props：`product: ProductDetail`、`onTransition: () => void`（操作完成后的回调，用于刷新数据）
  - 根据当前 `product.status` 计算可用操作：

```
draft        → "入池"按钮（调用 pool）
pooled       → "确认身份"按钮（调用 identify）
identified   → "内容已整理"（需 AI 确认流程，暂显示为禁用提示）
content_ready → "素材已确认"（需素材检查流程，暂显示为禁用提示）
asset_ready  → "确认可分销"按钮（调用 confirm）
distributable → 无操作（终态）
suspended    → "恢复"按钮（调用 resume）
非 draft 且非 suspended → 额外显示"挂起"按钮（调用 suspend）
```

  - 每个操作前弹出 ConfirmDialog 确认
  - 操作成功后调用 `onTransition` 回调
  - 操作失败显示错误提示
- 验证：`npx tsc --noEmit`

### Task 3.2 — 详情页集成状态流转

- 依赖：Task 3.1, Task 2.1
- 读取：`src/pages/products/ProductDetailPage.tsx`
- 修改：`src/pages/products/ProductDetailPage.tsx`
- 要求：
  - 在状态徽章旁边放置 `StatusTransitionButton`
  - `onTransition` 回调中重新加载商品详情
- 更新测试
- 验证：`npx vitest run`

### Task 3.3 — 审计日志时间线样式优化

- 依赖：Task 2.1
- 读取：`src/pages/products/ProductDetailPage.tsx`
- 修改：`src/pages/products/ProductDetailPage.tsx`
- 要求：
  - 将审计日志列表改为时间线样式（左侧竖线 + 圆点 + 右侧内容）
  - 纯 Tailwind 实现，不引入额外组件库
  - 每条记录显示：时间（相对时间如"2小时前"或绝对时间）、操作描述、操作人
- 验证：`npx vitest run`

---

## Phase 4（P2）：批量操作（3 个任务）

### Task 4.1 — 创建 BatchResultDialog 组件

- 依赖：Task 0.2
- 读取：`src/services/types.ts`（BatchOperationResult 类型）
- 创建：`src/components/business/BatchResultDialog.tsx`
- 要求：
  - Props：`open`, `title`, `result: BatchOperationResult | null`, `onClose`
  - 显示：成功 N 条、失败 N 条
  - 如有 errors 数组，展示错误明细表格（商品 ID + 失败原因）
  - 关闭按钮
- 验证：`npx tsc --noEmit`

### Task 4.2 — 列表页接入批量操作

- 依赖：Task 1.3, Task 4.1
- 读取：`src/pages/products/ProductListPage.tsx`（重点看 L184-188 批量按钮区域和 L39,80-97 选择逻辑）
- 修改：`src/pages/products/ProductListPage.tsx`
- 要求：
  - 将 5 个批量操作按钮的 `alert()` 替换为真实调用：
    - "AI规范化" → `appServices.products.batchAiNormalize(selectedIds)`
    - "AI翻译" → `appServices.products.batchAiTranslate(selectedIds)`
    - "素材检查" → `appServices.products.batchAssetCheck(selectedIds)`
    - "批量确认" → `appServices.products.batchConfirm(selectedIds)`
    - "导入" → 打开 ImportDialog（Task 5.1）
  - 操作完成后打开 `BatchResultDialog` 展示结果
  - 操作期间按钮显示 loading 状态
  - 操作完成后刷新列表数据
  - 无选中项时批量按钮禁用（导入除外）
- 更新测试
- 验证：`npx vitest run`

### Task 4.3 — 创建 useProductMutation hook（可选）

- 依赖：Task 4.2
- 创建：`src/hooks/useProductMutation.ts`
- 要求：
  - 封装异步操作的 loading/error 状态管理
  - 提供 `mutate(fn)` 方法，自动管理 loading 和 error
  - 如果 Task 4.2 中直接用 useState 管理 loading 已经足够清晰，此任务可跳过
- 验证：`npx tsc --noEmit`

---

## Phase 5（P3）：导入功能（2 个任务）

### Task 5.1 — 创建 ImportDialog 组件

- 依赖：Task 0.2, Task 1.3
- 读取：`src/services/types.ts`（ImportResult 类型）
- 创建：`src/components/business/ImportDialog.tsx`
- 要求：
  - Props：`open`, `onClose`, `onSuccess`
  - 文件选择：`<input type="file" accept=".csv,.xlsx,.xls">`
  - 上传按钮，点击后调用 `appServices.products.importFile(file)`
  - 上传中显示 loading 状态
  - 上传完成后显示结果：总计 N 条、创建 N 条、跳过 N 条
  - 如有 errors，展示错误明细（行号 + 原因）
  - 关闭时调用 `onSuccess` 刷新列表
- 验证：`npx tsc --noEmit`

### Task 5.2 — 列表页集成导入功能

- 依赖：Task 5.1, Task 4.2
- 读取：`src/pages/products/ProductListPage.tsx`
- 修改：`src/pages/products/ProductListPage.tsx`
- 要求：
  - 增加 `importDialogOpen` state
  - "导入"按钮点击时设置 `importDialogOpen = true`
  - 渲染 `ImportDialog`，onSuccess 中刷新列表
- 验证：`npx vitest run`

---

## 任务依赖图

```
Phase 0（并行）
  Task 0.1 清理日志 ─────────────────────────────────────┐
  Task 0.2 扩展类型 ──┬──────────────────────────────────┤
  Task 0.3 安装依赖 ──┤                                  │
                      │                                  │
Phase 1               │                                  │
  Task 1.1 HTTP客户端 ←─ 0.2                             │
  Task 1.2 商品API层  ←─ 0.2 + 1.1                      │
  Task 1.3 服务层改造 ←─ 1.2                             │
  Task 1.4 通用组件   （无依赖，可与 Phase 0 并行）       │
  Task 1.5 表单组件   ←─ 0.2 + 0.3                      │
  Task 1.6 新建页重写 ←─ 1.3 + 1.5                      │
  Task 1.7 编辑页+路由 ←─ 1.3 + 1.5                     │
                      │                                  │
Phase 2               │                                  │
  Task 2.1 详情页增强 ←─ 1.3 + 1.4                      │
  Task 2.2 列表页分页 ←─ 1.3 + 1.4                      │
  Task 2.3 分页hook   ←─ 2.2（可选）                     │
                      │                                  │
Phase 3               │                                  │
  Task 3.1 状态按钮   ←─ 1.3                             │
  Task 3.2 详情页集成 ←─ 3.1 + 2.1                      │
  Task 3.3 审计日志   ←─ 2.1                             │
                      │                                  │
Phase 4               │                                  │
  Task 4.1 批量结果框 ←─ 0.2                             │
  Task 4.2 批量操作   ←─ 1.3 + 4.1                      │
  Task 4.3 mutation hook ←─ 4.2（可选）                  │
                      │                                  │
Phase 5               │                                  │
  Task 5.1 导入对话框 ←─ 0.2 + 1.3                      │
  Task 5.2 导入集成   ←─ 5.1 + 4.2                      │
```

## 可并行执行的任务组

以下任务之间无依赖，可同时分配给多个 AI agent：

- **并行组 A**：Task 0.1 + Task 0.2 + Task 0.3 + Task 1.4
- **并行组 B**（A 完成后）：Task 1.1 + Task 1.5
- **并行组 C**（Phase 2 内）：Task 2.1 + Task 2.2
- **并行组 D**（Phase 3 内）：Task 3.1 + Task 3.3（3.3 只依赖 2.1）
- **并行组 E**（Phase 4 内）：Task 4.1 可与 Phase 3 并行

---

## 每个任务的 AI Prompt 模板

执行每个任务时，向 AI 提供以下上下文：

```
你正在开发 vault-os1.1 前端项目的商品模块。

项目路径：D:\cursor\vault-os1.1\frontend
技术栈：React 19 + React Router 7 + TypeScript 5.7 + Tailwind 4.2 + Vite 6
测试：Vitest + @testing-library/react

当前任务：[Task ID] — [任务标题]

请先阅读以下文件了解上下文：
- [列出该任务的"读取"文件列表]

然后执行：
- [列出该任务的具体操作]

完成后运行验证：
- npx vitest run
- npx tsc --noEmit

要求：
- 沿用项目现有编码风格
- 不引入不必要的依赖
- 不修改任务范围外的代码
- 确保现有测试不回归
```
