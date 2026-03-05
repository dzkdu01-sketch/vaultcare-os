# Vaultcare OS — 商品管理模块重建交接文件

> 生成时间：2026-03-02  
> 用途：新对话开启前的完整上下文交接，直接粘贴给下一个 Claude 会话即可

---

## 一、项目概况（30 秒速读）

**Vaultcare OS** 是一套面向阿联酋成人用品独立站矩阵的私有 ERP 系统。

- 技术栈：Django 5.x + DRF + React 18 + TypeScript + Tailwind + shadcn/ui
- 项目路径：`D:\cursor\vault\`
- 前端：`frontend/`（Vite + React）
- 后端：`backend/`（Django + SQLite）

---

## 二、关键背景

- 老板在北京远程经营，5 个亲友"分销商"各自运营 WordPress 站
- 核心流程：FB 广告 → WhatsApp 确认 → ERP 审单 → 推送货盘 → COD 配送
- 分销商**可以看到成本价**（设计要求）
- ERP 是 Master（唯一真相来源），WordPress 是 Mirror（只读镜像）

**完整商业背景**：`01_vaultcare_business_context.md`  
**架构共识**：`02_vaultcare_consensus_solutions.md`  
**PIM 规格**：`docs/pim-module-spec.md`

---

## 三、已完成工作（Sprint 1-3 全部完成）

### 后端已完成

| 模块 | 文件 | 说明 |
|------|------|------|
| PIM 模型 | `pim/models.py` | Category / OperationalTag / MasterCodeSequence / MasterSKU(20+字段) / PriceAuditLog |
| PIM Signal | `pim/signals.py` | 下架级联(清选品+WP Draft) + 价格审计 |
| PIM Serializer | `pim/serializers.py` | MasterSKUSerializer(详情) / MasterSKUListSerializer(列表) / 辅助 Serializer |
| PIM Views | `pim/views.py` | CRUD ViewSet + upgrade_code + price_logs + AIAnalyzeImagesView + AIGenerateArabicView |
| PIM URLs | `pim/urls.py` | products/categories/operational-tags/suppliers/supplier-skus/price-audit-logs + ai/analyze-images/ + ai/generate-arabic/ |
| AI 服务 | `pim/ai_service.py` | Claude API 封装（analyze_product_images / generate_arabic_content） |
| CSV 导入 | `pim/management/commands/import_wp_csv.py` | WP CSV 批量导入（已执行，60 条已入库） |
| 预置数据 | `pim/migrations/0003_seed_categories.py` | 10 个品类 + 3 个运营标签 |
| WP 映射 | `wp_sync/models.py` | WPProductMapping 重建（5 态状态机：pending/syncing/synced/failed/draft） |
| WP 任务 | `wp_sync/tasks.py` | sync_product_status_to_wp / enqueue_sync_status / push_new_selection_to_wp / enqueue_push_selection |
| WP 服务 | `wp_sync/services.py` | WooCommerceClient + push_sku_to_wp（已兼容新字段） |
| 选品联动 | `sites/signals.py` | 新增选品 → 自动创建 WPProductMapping + 入队推送 |
| Django Q2 | `vaultcare/settings.py` | Q_CLUSTER 配置（ORM broker，无需 Redis） |
| 依赖 | `requirements.txt` | 已添加 django-q2>=1.6 + anthropic>=0.40 |

### 前端已完成

| 文件 | 说明 |
|------|------|
| `pages/ProductNewAIPage.tsx` | AI 辅助上线三步向导（上传→确认→价格） |
| `api/endpoints.ts` | 已添加 aiAPI（analyzeImages / generateArabic） |
| `App.tsx` | 已添加 /products/new-ai 路由 |
| `components/Layout.tsx` | 侧边栏有"AI 新品上线"独立入口（需重构） |

### 数据库当前状态

| 指标 | 数量 |
|------|------|
| MasterSKU 总数 | 70 |
| 上架中 | 69 |
| 已下架 | 1 |
| Categories | 10 |
| OperationalTag | 3 |
| 未分类商品 | 12 |
| Migration 状态 | 全部已执行（pim 0001-0003, wp_sync 0001-0002, django_q 全部） |

### 登录凭证

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | test_admin | 123456 |
| 自营一组 | test_self1 | 123456 |
| 分销商 1 | test_dist1 | 123456 |

---

## 四、当前核心问题（圆桌会议诊断）

经过两轮圆桌头脑风暴（ERP 产品专家 + 2 运营 + 开发 + UI/UX），确认当前 `ProductsPage.tsx` 存在以下结构性缺陷：

1. **导航层级错误** — AI 新品上线是独立侧边栏入口，应归入商品管理子功能
2. **列表字段严重缺失** — 只有 7 列，后端输出 15+ 字段前端没用（缩略图/原价/成本价/可售状态/品类/区域/精选 全缺）
3. **编辑弹窗字段极度简陋** — 只有 8 个字段（后端 20+），分类是纯文本框
4. **无批量操作** — 无 checkbox，无法批量上下架/改品类/删除
5. **筛选维度单一** — 只有上架/下架，缺品类/区域/精选/标签/可售状态筛选
6. **无商品详情页** — 没有 `/products/:id` 页面
7. **无统计概览** — 无数据质量统计（缺阿语/缺图/未分类数量）
8. **无导入导出** — CSV 导入只有命令行
9. **TypeScript 类型过时** — `MasterSKU` 接口只有 12 字段，与后端不同步
10. **无 WhatsApp 素材快捷复制** — 分销商最高频操作没有支持

---

## 五、重建方案（10 项设计决议）

### 决议 1：页面结构与路由

```
/products                → 商品列表（统计条 + 筛选 + 表格/卡片切换 + 批量操作）
/products/:id            → 商品详情（查看/编辑双态 + 图片画廊 + Tab）
/products/new            → 手动新增（全字段表单页）
/products/new-ai         → AI 辅助上线（保留现有三步向导）
```

侧边栏只保留「商品管理」一个入口。AI 上线和手动新增作为列表页顶部的按钮入口。删除侧边栏的"AI 新品上线"独立菜单项。

### 决议 2：列表页顶部统计条

```
70 总SKU     69 上架     1 下架     12 未分类     ?缺阿语     ?缺图片
```

每个数字可点击 → 触发对应筛选条件。后端需新增 `GET /api/products/stats/` 接口。

### 决议 3：筛选栏

| 筛选器 | 类型 | 来源 |
|--------|------|------|
| 搜索 | 文本框 | master_code / legacy_code / title_en |
| 品类 | 下拉（含各品类商品数 + "未分类"选项） | /api/categories/ |
| 区域 | 下拉 (全部/UAE/Thailand/All) | 固定枚举 |
| 上架状态 | 下拉 (全部/上架/下架) | is_active |
| 可售状态 | 下拉 (全部/可售/低库存/缺货) | availability（前端过滤） |
| 精选 | 下拉 (全部/精选/非精选) | is_featured |
| 标签 | 多选 Chip | for_her/for_him/best_seller/new_arrival 等 |

### 决议 4：列表表格列定义（10 列）

| 列 | 宽 | 内容 | 交互 |
|---|---|---|---|
| ☑ | 40px | Checkbox | 全选/单选/三态 |
| 图 | 56px | `image_urls[0]` 缩略图（无图占位符） | hover 放大 |
| 编码/名称 | flex | `master_code`(粗) + `title_en` + `legacy_code`(灰) + `title_ar`(灰RTL) | **点击跳转详情** |
| 品类 | 100px | `primary_category_name` Badge | - |
| 价格 | 130px | 售价(粗) / 原价(删除线) / 成本价(灰) | hover 毛利 tooltip；双击行内编辑售价 |
| 状态 | 80px | 上架 Badge + availability 圆点 | 点击切换上架 |
| 精选 | 40px | 星星图标（实心/空心） | 点击切换 |
| 区域 | 60px | u/t/a Badge | - |
| 时间 | 100px | 相对时间 | 列头排序 |
| 操作 | 48px | ··· 下拉菜单 | - |

操作菜单项：查看详情 / 编辑 / 复制WA素材(简版) / 复制WA素材(完整) / 升级编码 / --- / 删除(红)

### 决议 5：批量操作栏（底部浮动）

选中 ≥1 个商品时从底部滑出：

```
☑ 已选 5 件 (全选当前 38 件)  │ 批量上架 │ 批量下架 │ 改品类 │ 改区域 │ 复制WA │ 删除 │ ✕
```

支持两种模式：手动勾选 `ids` / 全选当前筛选条件 `filter`。

### 决议 6：卡片视图

右上角 `[≡ 列表] [⊞ 卡片]` 切换。卡片 Grid 布局（大图 + 编码 + 标题 + 三行价格 + 可售圆点 + 复制WA/详情按钮）。**移动端 <768px 自动切换卡片视图**。偏好存 localStorage。

### 决议 7：商品详情页 `/products/:id`

左右分栏（移动端上下）：

- **左栏**：图片画廊（滑动浏览）+ 视频 + 快捷按钮（上/下架、复制WA、AI重分析、编辑）
- **右栏 Tab**：
  - 基本信息（查看/编辑双态切换）
  - 供应商映射（SupplierSKU 列表）
  - WP 映射（WPProductMapping 状态列表）
  - 价格日志（PriceAuditLog 时间线）

编辑模式字段控件：
- title_en/title_ar → Input
- short_description → Input + 字数
- description → Textarea
- primary_category → **下拉选择器**
- categories → 多选下拉
- region → Radio (UAE/Thailand/All)
- audience_tags → **Chip 多选**
- operational_tags → **Chip 多选**
- regular_price/selling_price → 数字 Input + AED 前缀
- image_urls → URL 列表可视化（缩略图+删除+拖拽排序+粘贴添加）
- is_featured/is_active → 开关

### 决议 8：WhatsApp 素材复制

行操作菜单 + 详情页 + 批量操作栏 均提供。

简版格式：
```
QR42 - Rabbits Vibrator
199 AED (was 229 AED)
https://vaultcare-d.com/.../QR42-2.jpg
```

完整版格式：
```
QR42 - Rabbits Vibrator
199 AED (was 229 AED)
Rabbits Vibrator Clitoris Stimulator...
https://vaultcare-d.com/.../QR42-2.jpg
https://vaultcare-d.com/.../QR42-1-2.jpeg
https://vaultcare-d.com/.../QR42-1-3.jpeg
```

批量勾选多个商品时，用分隔线连接所有选中商品。

### 决议 9：TypeScript 类型对齐

```typescript
// types/index.ts 中 MasterSKU 需要更新为：
interface MasterSKU {
  id: number
  master_code: string
  legacy_code: string
  region: 'u' | 't' | 'a'
  primary_category: number | null
  primary_category_name: string
  primary_category_info?: { id: number; code: string; name_en: string; name_zh: string }
  category: string
  title_en: string
  title_ar: string
  short_description: string
  description: string
  image_urls: string[]
  video_urls: Array<{ url: string; width: number; height: number }>
  regular_price: string | null
  selling_price: string
  best_cost_price: string | null
  audience_tags: string[]
  operational_tags?: number[]
  operational_tag_names?: string[]
  is_featured: boolean
  is_active: boolean
  availability: 'available' | 'low_stock' | 'unavailable'
  supplier_skus?: SupplierSKU[]
  created_at: string
  updated_at: string
}

interface ProductStats {
  total: number
  active: number
  inactive: number
  uncategorized: number
  missing_title_ar: number
  missing_image: number
  missing_short_desc: number
}
```

### 决议 10：后端需新增的 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/products/stats/` | GET | 统计条数据 |
| `/api/products/bulk-action/` | POST | `{ids:[...], action:"activate"\|"deactivate"\|"delete"\|"set_category"\|"set_region", params:{...}}` 或 `{filter:{search:...}, action:...}` |
| `MasterSKUListSerializer` | 修改 | 补充输出 `region`、`short_description`、`audience_tags` |

P1 后续：
| `/api/products/export/` | GET | 按筛选导出 CSV |
| `/api/products/import/` | POST | 上传 CSV 导入 |

---

## 六、实施阶段（4 阶段）

### 阶段 A — 列表页重建（最紧急，必须先做）

**后端改动：**
1. `pim/serializers.py` — `MasterSKUListSerializer` 补充 `region`、`short_description`、`audience_tags` 字段
2. `pim/views.py` — 新增 `@action stats`（统计）+ 新增 `@action bulk_action`（批量操作）
3. `pim/urls.py` — 注册新 action（stats 和 bulk-action 通过 ViewSet action 自动注册）

**前端改动：**
4. `types/index.ts` — 重写 `MasterSKU` 接口 + 新增 `ProductStats`
5. `api/endpoints.ts` — 新增 `productsAPI.stats()` / `productsAPI.bulkAction()` / `categoriesAPI.list()`
6. `components/Layout.tsx` — 删除 AI 新品上线独立菜单项，只保留商品管理
7. `pages/ProductsPage.tsx` — **完全重写**（统计条 + 多维筛选 + 10 列表格 + checkbox + 排序 + 批量操作浮动栏 + 分页）

### 阶段 B — 详情页 + 编辑

8. `pages/ProductDetailPage.tsx` — **新建**（左右分栏 + 图片画廊 + 查看/编辑双态 + 4 个 Tab）
9. `App.tsx` — 新增 `/products/:id` 路由
10. `api/endpoints.ts` — 新增 `categoriesAPI`、`operationalTagsAPI`

### 阶段 C — 卡片视图 + WA 复制 + 移动端

11. `ProductsPage.tsx` — 新增卡片视图切换 + WA 素材复制函数 + 行内编辑（售价）
12. 移动端适配（<768px 自动卡片，筛选折叠）

### 阶段 D（P1）— 导入导出

13. 后端 — 新增 export/import API
14. 前端 — 导出按钮 + 导入上传页面

---

## 七、当前完整代码结构

```
D:\cursor\vault\
├── backend/
│   ├── pim/
│   │   ├── models.py          ✅ 完成（Category/OperationalTag/MasterCodeSequence/MasterSKU/PriceAuditLog）
│   │   ├── serializers.py     ✅ 完成（但 ListSerializer 需补字段）
│   │   ├── views.py           ✅ 完成（但需新增 stats/bulk_action）
│   │   ├── urls.py            ✅ 完成
│   │   ├── signals.py         ✅ 完成
│   │   ├── apps.py            ✅ 完成
│   │   ├── admin.py           ✅ 完成
│   │   ├── ai_service.py      ✅ 完成
│   │   ├── management/commands/import_wp_csv.py  ✅ 完成（已执行）
│   │   ├── migrations/0001_initial.py            ✅
│   │   ├── migrations/0002_category_...py        ✅
│   │   ├── migrations/0003_seed_categories.py    ✅
│   │   └── 商品导出模板.csv
│   ├── wp_sync/
│   │   ├── models.py          ✅ 重建完成（WPProductMapping 5 态状态机）
│   │   ├── services.py        ✅ 已兼容新字段
│   │   ├── tasks.py           ✅ 新建完成（异步同步 + 降级执行）
│   │   ├── admin.py           ✅ 已更新
│   │   └── migrations/0002_alter...py  ✅
│   ├── sites/
│   │   ├── models.py          ✅（Distributor/DistributorSelection/SiteEnvironment）
│   │   ├── apps.py            ✅ 新建（注册 signals）
│   │   └── signals.py         ✅ 新建（选品 → 自动推送）
│   ├── oms/                   现有（路由引擎 + 熔断）
│   ├── finance/               现有（财务看板）
│   ├── vaultcare/settings.py  ✅ 已配 django_q + CLAUDE_API_KEY
│   ├── requirements.txt       ✅ 已加 django-q2 + anthropic
│   └── db.sqlite3             70 条商品 + 10 品类 + 3 标签
│
└── frontend/src/
    ├── types/index.ts              ⚠️ 需重写（MasterSKU 只有 12 字段）
    ├── api/endpoints.ts            ⚠️ 需扩展（stats/bulk/categories）
    ├── api/client.ts               ✅
    ├── App.tsx                     ⚠️ 需加 /products/:id 路由
    ├── components/Layout.tsx       ⚠️ 需删 AI 独立菜单项
    ├── pages/ProductsPage.tsx      ❌ 需完全重写
    ├── pages/ProductDetailPage.tsx ❌ 需新建
    ├── pages/ProductNewAIPage.tsx  ✅ 保留
    ├── pages/DashboardPage.tsx     ✅
    ├── pages/OrdersPage.tsx        ✅
    ├── pages/DistributorsPage.tsx  ✅
    ├── pages/SuppliersPage.tsx     ✅
    ├── pages/WPSitesPage.tsx       ✅
    ├── pages/FinancePage.tsx       ✅
    ├── pages/LoginPage.tsx         ✅
    ├── hooks/useAuth.ts            ✅
    ├── lib/utils.ts                ✅
    └── components/ui/              ✅（shadcn/ui 组件）
```

---

## 八、启动与验证

```bash
# 后端
cd D:\cursor\vault\backend
.\venv\Scripts\python.exe manage.py runserver

# 前端
cd D:\cursor\vault\frontend
npm run dev

# Django Q2 Worker（可选，WP 异步同步用）
cd D:\cursor\vault\backend
.\venv\Scripts\python.exe manage.py qcluster
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:8000/api/
- Django Admin：http://localhost:8000/admin

---

## 九、新对话开启指令

> 请将以下内容作为第一条消息发给新 Claude：

---

**背景**：我在开发 Vaultcare OS ERP 系统（`D:\cursor\vault\`），请先阅读 `docs/04-handover-products-redesign.md` 了解完整上下文。

**任务**：按交接文件第六节的阶段计划，执行商品管理模块重建：

**阶段 A（先做这个）— 列表页重建：**

后端：
1. `pim/serializers.py` — `MasterSKUListSerializer` 补充 `region`、`short_description`、`audience_tags`
2. `pim/views.py` — MasterSKUViewSet 新增 `stats` action（GET，返回统计数据）和 `bulk_action` action（POST，支持 ids 或 filter + 批量上架/下架/删除/改品类/改区域）

前端：
3. `types/index.ts` — 重写 MasterSKU 接口对齐后端（见决议 9）
4. `api/endpoints.ts` — 新增 stats / bulkAction / categoriesAPI
5. `components/Layout.tsx` — 删除 AI 新品上线独立菜单项
6. `pages/ProductsPage.tsx` — **完全重写**：统计条（可点击筛选）+ 多维筛选栏（搜索/品类/区域/状态/精选/标签）+ 10列表格（checkbox/缩略图/编码名称/品类/三行价格/状态+可售/精选/区域/时间/操作菜单）+ 列头排序 + 底部批量操作浮动栏 + WA素材复制

完成阶段 A 后继续阶段 B（商品详情页）。

设计决议的完整细节见交接文件第五节的 10 项决议。

---
