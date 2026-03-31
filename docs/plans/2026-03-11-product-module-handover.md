# 商品模块交接文档：CRUD + 状态流转 + 批量操作

> 交接时间：2026-03-11
> 项目路径：`D:\cursor\vault-os1.1\frontend`
> 当前分支：`main` @ `ee8529f`

---

## 一、当前已完成

| 功能 | 文件 | 状态 |
|------|------|------|
| 商品列表展示（含统计卡片、Tab 切换、关键词/市场/供应商筛选） | `src/pages/products/ProductListPage.tsx` | 已完成，mock 数据 |
| 商品详情只读展示（基础信息 + 状态徽章） | `src/pages/products/ProductDetailPage.tsx` | 已完成，mock 数据 |
| 新建商品页（仅 SKU 字段，提交为 alert 占位） | `src/pages/products/ProductCreatePage.tsx` | 骨架占位 |
| 行选择 checkbox（全选/单选） | `ProductListPage.tsx:39,80-97` | UI 已实现，未联动后端 |
| 批量操作按钮（AI规范化/翻译/素材检查/确认/导入） | `ProductListPage.tsx:184-188` | 全部 alert 占位 |
| 分页 UI | `ProductListPage.tsx:250-258` | 静态占位，无真实分页逻辑 |
| 状态徽章组件 | `src/components/business/StatusBadge.tsx` | 已完成 |
| 服务层 mock | `src/services/mock/index.ts` | 8 条商品 mock 数据 |
| 单元测试 | `src/pages/products/__tests__/` | 3 个测试文件，覆盖列表/详情/新建 |
| E2E 测试 | — | 已移除；历史方案见 `90-归档/2026-03-10-e2e-recovery-playwright-gate.md` |

## 二、数据模型

### 2.1 现有类型定义

文件：`src/services/types.ts`

```typescript
// 商品状态枚举
type ProductStatus =
  | 'draft'           // 草稿/待入池
  | 'pooled'          // 已入池
  | 'identified'      // 身份已确认
  | 'content_ready'   // 内容已整理
  | 'asset_ready'     // 素材已确认
  | 'distributable'   // 可分销
  | 'suspended'       // 已挂起

// AI 处理状态
type AiStatus = 'not_generated' | 'generated' | 'confirmed'

// 人工确认状态
type ConfirmStatus = 'pending' | 'confirmed' | 'manual_edited'

// 商品行（列表用）
type ProductRow = {
  id: string
  sku: string
  name: string
  market: 'UAE' | 'TH'
  status: ProductStatus
  supplier: string
  ownershipType: string
  aiStatus: AiStatus
  confirmStatus: ConfirmStatus
  blockCount: number
  updatedAt: string
}

// 商品详情（详情页用）
type ProductDetail = ProductRow & {
  barcode?: string
  brandName?: string
  titleAr?: string
  titleEn?: string
  descriptionEn?: string
  auditLog?: AuditLogEntry[]
}

// 筛选参数
type ProductFilters = {
  keyword?: string
  market?: 'UAE' | 'TH'
  status?: ProductStatus
  supplier?: string
  ownershipType?: string
}

// 列表返回结构
type ProductListResult = {
  rows: ProductRow[]
  stats: ProductStats
  filterOptions: {
    markets: FilterOption[]
    statuses: FilterOption[]
    suppliers: FilterOption[]
    ownershipTypes: FilterOption[]
  }
}
```

### 2.2 需要扩展的类型

```typescript
// 新建/编辑商品的请求体
type ProductCreateInput = {
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

type ProductUpdateInput = Partial<ProductCreateInput>

// 批量操作请求
type BatchOperationRequest = {
  ids: string[]
}

// 批量操作结果
type BatchOperationResult = {
  success: number
  failed: number
  errors?: Array<{ id: string; reason: string }>
}

// 导入结果
type ImportResult = {
  total: number
  created: number
  skipped: number
  errors?: Array<{ row: number; reason: string }>
}

// 分页参数
type PaginationParams = {
  page: number
  pageSize: number
}

// 分页列表返回
type PaginatedProductListResult = ProductListResult & {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

## 三、商品状态流转

### 3.1 状态机

```
draft ──────→ pooled ──────→ identified ──────→ content_ready ──────→ asset_ready ──────→ distributable
  │                                                                                          │
  │                              ┌──────────────────────────────────────────────────────────┘
  │                              │
  └──── suspended ←──────────────┘ （任意非 draft 状态均可挂起）
         │
         └──────→ 恢复到挂起前状态
```

### 3.2 状态转换规则

| 当前状态 | 可转换到 | 触发条件 | 操作方式 |
|---------|---------|---------|---------|
| `draft` | `pooled` | 基础信息完整（SKU、名称、市场、供应商） | 手动"入池" |
| `pooled` | `identified` | 品牌、条码等身份信息已填写 | 手动"确认身份" |
| `identified` | `content_ready` | AI 生成内容已确认或人工编辑完成 | AI 规范化 + 人工确认 |
| `content_ready` | `asset_ready` | 素材（图片等）已上传并通过检查 | 素材检查通过 |
| `asset_ready` | `distributable` | 最终确认，无卡点 | 手动"确认可分销" |
| 任意非 draft | `suspended` | 发现问题需暂停 | 手动"挂起" |
| `suspended` | 挂起前状态 | 问题解决 | 手动"恢复" |

### 3.3 AI 状态与确认状态的关系

```
aiStatus:      not_generated ──→ generated ──→ confirmed
                                     │
                                     ↓
confirmStatus: pending ──────→ confirmed / manual_edited
```

- AI 生成内容后 `aiStatus` 变为 `generated`
- 人工确认 AI 内容后 `aiStatus` 变为 `confirmed`，`confirmStatus` 变为 `confirmed`
- 人工手动修改内容后 `confirmStatus` 变为 `manual_edited`

## 四、后端 API 契约

### 4.1 商品 CRUD

```
GET    /api/products              → PaginatedProductListResult
GET    /api/products/:id          → ProductDetail
POST   /api/products              → ProductDetail          (body: ProductCreateInput)
PUT    /api/products/:id          → ProductDetail          (body: ProductUpdateInput)
DELETE /api/products/:id          → { success: boolean }
```

### 4.2 状态操作

```
POST   /api/products/:id/pool           → ProductDetail    (draft → pooled)
POST   /api/products/:id/identify       → ProductDetail    (pooled → identified)
POST   /api/products/:id/confirm        → ProductDetail    (asset_ready → distributable)
POST   /api/products/:id/suspend        → ProductDetail    (→ suspended)
POST   /api/products/:id/resume         → ProductDetail    (suspended → 恢复)
```

### 4.3 批量操作

```
POST   /api/products/batch/ai-normalize   → BatchOperationResult  (body: { ids: string[] })
POST   /api/products/batch/ai-translate   → BatchOperationResult  (body: { ids: string[] })
POST   /api/products/batch/asset-check    → BatchOperationResult  (body: { ids: string[] })
POST   /api/products/batch/confirm        → BatchOperationResult  (body: { ids: string[] })
```

### 4.4 导入

```
POST   /api/products/import               → ImportResult    (body: FormData, file field: "file")
```

### 4.5 查询参数

`GET /api/products` 支持的 query params：

| 参数 | 类型 | 说明 |
|------|------|------|
| `keyword` | string | 模糊搜索 SKU/名称/供应商 |
| `market` | `UAE` \| `TH` | 目标市场 |
| `status` | ProductStatus | 商品状态 |
| `supplier` | string | 供应商 |
| `ownershipType` | string | 货权类型 |
| `page` | number | 页码，默认 1 |
| `pageSize` | number | 每页条数，默认 20 |

## 五、前端实现清单

### 5.1 需要新建的文件

| 文件 | 用途 |
|------|------|
| `src/services/api-client.ts` | HTTP 客户端（axios/fetch 封装，含 token、错误拦截） |
| `src/services/product-api.ts` | 商品模块 API 调用层（替代 mock） |
| `src/pages/products/ProductEditPage.tsx` | 商品编辑页 |
| `src/components/business/ProductForm.tsx` | 商品表单组件（新建/编辑共用） |
| `src/components/business/ImportDialog.tsx` | 导入对话框（文件上传 + 结果展示） |
| `src/components/business/BatchResultDialog.tsx` | 批量操作结果对话框 |
| `src/components/business/StatusTransitionButton.tsx` | 状态流转操作按钮（根据当前状态显示可用操作） |
| `src/components/shared/Pagination.tsx` | 通用分页组件 |
| `src/components/shared/ConfirmDialog.tsx` | 通用确认对话框 |
| `src/hooks/usePagination.ts` | 分页 hook |
| `src/hooks/useProductMutation.ts` | 商品写操作 hook（create/update/delete/状态变更） |

### 5.2 需要修改的文件

| 文件 | 改动内容 |
|------|---------|
| `src/services/app-services.ts` | 增加真实 API 调用，保留 mock 作为 fallback 或开发模式 |
| `src/services/types.ts` | 增加 §2.2 中的新类型 |
| `src/pages/products/ProductListPage.tsx` | 接入真实分页、批量操作调用后端、导入功能 |
| `src/pages/products/ProductDetailPage.tsx` | 增加状态流转按钮、编辑入口、删除操作、审计日志展示 |
| `src/pages/products/ProductCreatePage.tsx` | 替换为完整表单，调用 POST /api/products |
| `src/app/router/index.tsx` | 增加 `/products/:id/edit` 路由 |
| `src/constants/status.ts` | 如有新状态需同步更新 |

### 5.3 需要清理的代码

| 位置 | 内容 |
|------|------|
| `src/pages/products/ProductDetailPage.tsx:19,27,35` | 删除 `fetch('http://127.0.0.1:7283/...')` 调试日志 |
| `src/services/mock/index.ts:396,412` | 删除同类调试日志 |
| `src/services/app-services.ts:25,33,39` | 删除同类调试日志 |

## 六、实现优先级建议

### P0：基础 CRUD（先跑通读写闭环）

1. 搭建 `api-client.ts`（HTTP 封装 + 错误处理）
2. 实现 `product-api.ts`（对接后端 CRUD 接口）
3. 改造 `app-services.ts`（支持 mock/real 切换）
4. 完善 `ProductCreatePage`（完整表单 + 调用 POST）
5. 新建 `ProductEditPage`（复用表单组件 + 调用 PUT）
6. 在 `ProductDetailPage` 增加编辑/删除入口
7. 接入真实分页

### P1：状态流转

8. 实现 `StatusTransitionButton` 组件
9. 在详情页集成状态操作按钮
10. 在列表页支持行内快捷状态操作（可选）
11. 审计日志时间线展示

### P2：批量操作

12. 批量 AI 规范化（选中行 → 调用后端 → 展示结果）
13. 批量 AI 翻译（同上）
14. 批量素材检查（同上）
15. 批量确认（同上）
16. 实现 `BatchResultDialog`（统一展示成功/失败数量和错误明细）

### P3：导入

17. 实现 `ImportDialog`（文件选择 + 上传 + 进度 + 结果展示）
18. 支持 CSV / Excel 格式
19. 导入预览（可选，展示将要导入的数据供确认）

## 七、商品表单字段规格

`ProductForm` 组件需要支持的字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sku` | text | 是 | 主编码，新建后不可修改 |
| `name` | text | 是 | 商品名称（中文） |
| `market` | select | 是 | 目标市场：UAE / TH |
| `supplier` | select/text | 是 | 供应商 |
| `ownershipType` | select | 是 | 货权类型：自有货权 / 寄售 / 外部供货 |
| `barcode` | text | 否 | 条码 |
| `brandName` | text | 否 | 品牌名 |
| `titleEn` | text | 否 | 英文标题 |
| `titleAr` | text | 否 | 阿拉伯文标题 |
| `descriptionEn` | textarea | 否 | 英文描述 |

### 表单校验规则

- `sku`：必填，格式 `SKU-{市场代码}-{3位数字}`，不可重复
- `name`：必填，2-100 字符
- `market`：必填，枚举值
- `supplier`：必填
- `ownershipType`：必填，枚举值

## 八、关键文件索引

```
src/
├── services/
│   ├── types.ts                    ← 所有类型定义
│   ├── app-services.ts             ← 服务入口（mock/real 切换点）
│   ├── mock/index.ts               ← Mock 数据层
│   ├── api-client.ts               ← [待建] HTTP 客户端
│   └── product-api.ts              ← [待建] 商品 API 层
├── pages/products/
│   ├── ProductListPage.tsx         ← 商品列表（最复杂的页面）
│   ├── ProductDetailPage.tsx       ← 商品详情
│   ├── ProductCreatePage.tsx       ← 新建商品（需重写）
│   ├── ProductEditPage.tsx         ← [待建] 编辑商品
│   └── __tests__/                  ← 单元测试
├── components/
│   ├── business/
│   │   ├── StatusBadge.tsx         ← 状态徽章
│   │   ├── ProductForm.tsx         ← [待建] 商品表单
│   │   ├── ImportDialog.tsx        ← [待建] 导入对话框
│   │   ├── BatchResultDialog.tsx   ← [待建] 批量结果对话框
│   │   └── StatusTransitionButton.tsx ← [待建] 状态操作按钮
│   └── shared/
│       ├── DataTable.tsx           ← 通用表格
│       ├── Pagination.tsx          ← [待建] 分页组件
│       └── ConfirmDialog.tsx       ← [待建] 确认对话框
├── hooks/
│   ├── usePagination.ts            ← [待建]
│   └── useProductMutation.ts       ← [待建]
└── constants/
    ├── status.ts                   ← 状态元数据
    └── markets.ts                  ← 市场元数据
```

## 九、测试要求

每个新功能需要：
- 1 个 Vitest 单元测试（组件渲染 + 交互）
- 对应的 E2E 场景更新（如果影响主流程）

现有测试基线：
- Vitest：19 files / 43 tests
- Playwright E2E：15 tests
- Build：通过

新增功能不得导致现有测试回归。

## 十、环境与依赖

| 项目 | 版本 |
|------|------|
| React | 19 |
| React Router | 6 |
| Vite | 6.4.1 |
| TypeScript | 5.7 |
| Tailwind CSS | 4.2 (via @tailwindcss/vite) |
| Vitest | 3.2 |
| Playwright | 1.52 |

当前无状态管理库（zustand/redux），如需全局状态建议引入 zustand。
当前无表单库，如需复杂表单校验建议引入 react-hook-form + zod。
当前无 HTTP 客户端库，建议引入 axios 或使用原生 fetch + 封装。
