# Vaultcare OS — Bug修复交接文档

> 生成时间：2026-03-02  
> 来源：圆桌测试报告（19项问题）  
> 下一个会话请先读：`docs/04-context-management.md` → `docs/CURRENT_STATUS.md` → 本文件

---

## 一、项目当前状态速览

- Sprint 1-4 全部完成：PIM后端 + 商品列表页重建 + 详情页 + 阶段C/D（导入导出）
- 前端：ProductsPage（统计条+10列表格+批量操作）、ProductDetailPage（4Tab）、ProductNewAIPage（AI三步向导）
- 后端：stats / bulk_action / export / import_csv / wp_mappings 五个新Action全部完成
- TypeScript编译：零错误 ✅ | Django系统检查：零错误 ✅

---

## 二、待修复Bug清单（按优先级）

---

### 🔴 P0 — 阻断核心流程（必须第一批修复）

#### Bug-01：手动新增路由指向AI向导，无独立手动新增页

**文件**：`frontend/src/App.tsx:36`、`frontend/src/pages/ProductsPage.tsx`

**现象**：点击列表页"手动新增"按钮，跳转到 `/products/new`，
但该路由渲染的是 `ProductNewAIPage`（AI辅助上线页），
页面标题显示"AI 辅助上线新品"。

**根本原因**：
```typescript
// App.tsx 第36行
<Route path="products/new" element={<ProductNewAIPage />} />
// 应该是独立的手动新增页面
```

**修复方案**：
1. 新建 `frontend/src/pages/ProductNewManualPage.tsx`
   - 全字段表单（不需要AI步骤）
   - 直接展示所有字段：title_en / title_ar / primary_category（下拉）/ region / selling_price / regular_price / audience_tags / image_urls / is_featured
   - `is_active` 默认 `false`（草稿）
   - 保存后跳转到 `/products/:id`
2. `App.tsx` 中将 `products/new` 路由改为 `ProductNewManualPage`

---

#### Bug-02：AI上线图片字段硬编码为空数组，图片全部丢失

**文件**：`frontend/src/pages/ProductNewAIPage.tsx:237-251`

**现象**：AI三步向导完成后，商品保存，`image_urls` 永远是 `[]`。
所有通过AI向导创建的商品无图。

**根本原因**：
```typescript
// 第237行：计算了imageUrls但完全没用
const imageUrls = previews.map((_, i) => URL.createObjectURL(files[i]))

// 第251行：image_urls 硬编码空数组
image_urls: [],  // ← BUG！应该是 imageUrls
```

**修复方案**：
- **方案A（最小改动）**：`image_urls: imageUrls`
  - 注意：`URL.createObjectURL` 生成的是 blob URL，只在当前浏览器会话有效，保存后刷新就失效
- **方案B（正确做法）**：
  1. 后端新增图片上传接口 `POST /api/upload-image/`，接收文件返回CDN/静态文件URL
  2. Step3保存前先上传图片，拿到真实URL后写入 `image_urls`
- 当前阶段可先用方案A（blob URL），标记为技术债，后续做图片上传服务

---

#### Bug-03：AI上线商品直接上架，应为草稿

**文件**：`frontend/src/pages/ProductNewAIPage.tsx:249`

**根本原因**：
```typescript
is_active: true,  // ← 改为 false
```

**修复方案**：
1. `is_active: false`
2. 最后一步"确认上线"按钮文案改为"**保存为草稿**"
3. 跳转后 toast 提示"已保存为草稿，请前往详情页审核后上架"

---

### 🟠 P1 — 功能性错误（第二批修复）

#### Bug-04：AI上线品类字段错误，所有AI上线商品均显示"未分类"

**文件**：`frontend/src/pages/ProductNewAIPage.tsx:244`

**根本原因**：
```typescript
// ❌ 错误：写入旧的自由文本字段
category: form.primary_category,

// ✅ 正确：应写入FK ID字段
primary_category: <Category 对象的 id>
```

且品类选项是硬编码英文字符串（`CATEGORY_OPTIONS` 数组），
没有从 `GET /api/categories/` 动态加载，与数据库Category表可能不同步。

**修复方案**：
1. Step1加载时调用 `categoriesAPI.list()` 获取品类列表
2. 品类下拉显示 `name_zh`，选中后存储 `id`（数字）
3. 保存时传 `primary_category: parseInt(form.primary_category_id)`
4. 删除 `CATEGORY_OPTIONS` 硬编码数组

---

#### Bug-05：供应商Tab完全只读，无法绑定/解绑供应商SKU

**文件**：`frontend/src/pages/ProductDetailPage.tsx` `SupplierSkusTab`

**现象**：如截图所示，Tab内显示"暂无供应商映射"，没有任何操作入口。
由于无法绑定供应商SKU，所有商品的 `availability` 均为 `unavailable`（缺货），
统计条、路由引擎的可售判断均失效。

**修复方案**：
在 `SupplierSkusTab` 组件内新增：
1. **添加供应商SKU** 按钮 → 弹窗表单：
   - 供应商下拉（调用 `suppliersAPI.list()`）
   - supplier_code（文本输入）
   - cost_price（数字输入，AED）
   - stock_status（单选：有货/缺货）
   - 调用 `supplierSKUsAPI.create({ supplier, master_sku: productId, ... })`
2. **编辑** 按钮（每行）→ 支持修改 cost_price 和 stock_status
3. **删除** 按钮（每行）→ 调用 `supplierSKUsAPI.delete(id)`
4. 操作完成后刷新 `loadProduct()`

---

#### Bug-06：后端 `ordering_fields` 缺少 `updated_at`

**文件**：`backend/pim/views.py:46`

**现象**：前端默认按 `-updated_at` 排序，后端未注册，
列表顺序不可预期（可能报400或静默忽略）。

**修复方案**：
```python
# 改前
ordering_fields = ['created_at', 'selling_price', 'regular_price', 'master_code']

# 改后
ordering_fields = ['created_at', 'updated_at', 'selling_price', 'regular_price', 'master_code']
```

---

#### Bug-07：受众标签（audience_tags）筛选 chip 完全无效

**文件**：`frontend/src/pages/ProductsPage.tsx` `loadProducts` 函数

**现象**：点击"她用/他用/畅销/新品"等chip，列表不变化。

**根本原因**：
1. `loadProducts` 里 `filters.audience_tags` 未传给API
2. 后端 `filterset_fields` 不支持 JSONField contains 查询

**修复方案**：

后端 `MasterSKUViewSet` 中重写 `get_queryset`：
```python
def get_queryset(self):
    qs = super().get_queryset()
    tags = self.request.query_params.getlist('audience_tags')
    for tag in tags:
        qs = qs.filter(audience_tags__contains=tag)
    return qs
```

前端 `loadProducts` 中添加：
```typescript
if (filters.audience_tags.length > 0) {
  filters.audience_tags.forEach(tag => {
    // axios 支持同名参数数组
    (params as Record<string, unknown[]>).audience_tags =
      filters.audience_tags
  })
}
```

---

#### Bug-08：统计条快速过滤功能完全失效

**文件**：`frontend/src/pages/ProductsPage.tsx` `handleStatClick` + `loadProducts`

**现象**：点击"12 未分类""缺阿语""缺图片"数字，列表不过滤。

**根本原因**：
- `filters.uncategorized` 等字段被设置，但 `loadProducts` 从不读取它们传给API
- 后端没有对应的 `?uncategorized=true` 参数处理

**修复方案**：

后端 `get_queryset` 中添加：
```python
if self.request.query_params.get('uncategorized') == 'true':
    qs = qs.filter(primary_category__isnull=True)
if self.request.query_params.get('missing_title_ar') == 'true':
    qs = qs.filter(Q(title_ar='') | Q(title_ar__isnull=True))
if self.request.query_params.get('missing_image') == 'true':
    qs = qs.filter(image_urls=[])
```

前端 `loadProducts` 中添加：
```typescript
if (filters.uncategorized) params.uncategorized = 'true'
if (filters.missing_title_ar) params.missing_title_ar = 'true'
if (filters.missing_image) params.missing_image = 'true'
```

---

### 🟡 P2 — 体验缺陷（第三批修复）

| # | 文件 | 问题 | 修复建议 |
|---|------|------|---------|
| 9 | `endpoints.ts` + `views.py` | `bulk-action`（前端连字符）vs 后端函数名 `bulk_action`（下划线），URL可能404 | 统一：后端加 `url_path='bulk-action'`，`import_csv` 加 `url_path='import-csv'` |
| 10 | `ProductsPage.tsx` `handleBulkCopyWA` | 全选模式下只复制当前页20条 | 全选模式下展示提示"仅复制当前页"，或分页加载后合并 |
| 11 | `ProductsPage.tsx` 卡片视图 | 移动端checkbox不可见（hover-only） | 移除 `opacity-0 group-hover:opacity-100`，改为始终显示 |
| 12 | `ProductsPage.tsx` | Toast与批量操作浮动栏底部重叠 | Toast改为 `bottom-20`（在浮动栏上方） |
| 13 | `ProductsPage.tsx` | 价格双击编辑 `onBlur` 误触发保存 | 删除 `onBlur` 回调，只保留 Enter 保存、Escape 取消 |

---

### ⚪ P3 — 完善项（最后处理）

| # | 文件 | 问题 | 修复建议 |
|---|------|------|---------|
| 14 | `ProductDetailPage.tsx` | 基本信息与供应商Tab图标相同（均为Package） | 供应商Tab改用 `Truck` 图标 |
| 15 | `ProductDetailPage.tsx` | WP映射Tab无"立即同步"按钮 | 添加"重新同步"按钮，调用 `POST /api/wp-sync/push/:skuId/` |
| 16 | `ProductNewAIPage.tsx` | 最后步骤按钮文案"确认上线"与草稿逻辑矛盾 | 改为"保存为草稿"（Bug-03连带修复） |
| 17 | `ProductsPage.tsx` | 移动端筛选栏全部平铺，占半个屏幕 | 添加"展开筛选"折叠按钮，默认折叠 |
| 18 | `ProductDetailPage.tsx` | 保存后价格日志Tab不刷新 | 编辑保存成功后同步刷新所有Tab数据 |
| 19 | `views.py` import_csv | 图片URL逗号分割可能误切含逗号URL | 改为换行符分割，或用JSON数组格式 |

---

## 三、推荐实施顺序

```
第1次会话（2小时）—— P0 全部修复
  ├── Bug-01：新建 ProductNewManualPage.tsx + 修改 App.tsx 路由
  ├── Bug-02：ProductNewAIPage.tsx 修复 image_urls（使用 imageUrls 变量）
  └── Bug-03：ProductNewAIPage.tsx 修复 is_active:false + 按钮文案

第2次会话（3小时）—— P1 全部修复
  ├── Bug-04：ProductNewAIPage.tsx 品类从API加载 + 传 primary_category FK ID
  ├── Bug-05：ProductDetailPage.tsx 供应商Tab增删改功能
  ├── Bug-06：views.py ordering_fields 添加 updated_at
  ├── Bug-07：audience_tags 前后端过滤联通
  └── Bug-08：统计条快速过滤前后端联通

第3次会话（1小时）—— P2 修复
  ├── Bug-09：URL 命名统一（@action url_path）
  ├── Bug-11：卡片视图 checkbox 移动端可见
  ├── Bug-12：Toast 位置避让浮动栏
  └── Bug-13：价格编辑去除 onBlur 自动保存

第4次会话（1小时）—— P3 完善
  ├── Bug-14：供应商Tab图标改 Truck
  ├── Bug-15：WP映射Tab添加重新同步按钮
  ├── Bug-17：移动端筛选折叠
  └── 更新 CURRENT_STATUS.md
```

---

## 四、新对话启动指令（复制给下一个会话）

### 第1次会话（P0修复）：
```
请读取 docs/04-context-management.md、docs/CURRENT_STATUS.md 和
docs/05-handover-bugfix.md，然后执行 P0 修复任务：

1. 新建 frontend/src/pages/ProductNewManualPage.tsx
   （全字段手动新增表单，is_active默认false，保存后跳转详情页）
2. App.tsx：将 products/new 路由指向 ProductNewManualPage
3. ProductNewAIPage.tsx：
   - 修复 image_urls: imageUrls（使用已计算的变量）
   - 修复 is_active: false
   - 最后步骤按钮文案改为"保存为草稿"
```

### 第2次会话（P1修复）：
```
请读取 docs/04-context-management.md、docs/CURRENT_STATUS.md 和
docs/05-handover-bugfix.md，执行 P1 修复任务（Bug-04 至 Bug-08）。
```

---

## 五、关键文件速查

| 文件 | 当前状态 | 本次涉及Bug |
|------|---------|------------|
| `frontend/src/App.tsx` | ✅ | Bug-01（路由） |
| `frontend/src/pages/ProductNewAIPage.tsx` | ⚠️ 多处Bug | Bug-02、03、04 |
| `frontend/src/pages/ProductNewManualPage.tsx` | ❌ 不存在 | Bug-01 |
| `frontend/src/pages/ProductDetailPage.tsx` | ⚠️ | Bug-05、14、15、18 |
| `frontend/src/pages/ProductsPage.tsx` | ⚠️ | Bug-07、08、10、11、12、13、17 |
| `backend/pim/views.py` | ⚠️ | Bug-06、07、08、09、19 |

---

## 六、版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-03-02 | 圆桌测试报告，19项问题，形成本交接文档 |
