# Vaultcare OS — 开发文档

> 版本：v1.0 | 日期：2026-03-02

---

## 一、技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 后端框架 | Django + DRF | 5.x + 3.15 |
| 认证 | djangorestframework-simplejwt | 5.x |
| 跨域 | django-cors-headers | 4.x |
| 过滤 | django-filter | 24.x |
| 前端框架 | React + TypeScript | 18.x |
| 构建工具 | Vite | 7.x |
| 样式 | Tailwind CSS v4 | 4.x |
| UI 组件 | Radix UI + class-variance-authority | 手动实现 |
| 路由 | React Router | 7.x |
| HTTP | Axios | 1.x |
| 数据库 | SQLite（MVP） | - |
| WP 集成 | WooCommerce REST API via requests | - |

---

## 二、目录结构

```
d:\cursor\vault\
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── db.sqlite3                  ← 数据库（勿删）
│   ├── vaultcare/
│   │   ├── settings.py             ← 核心配置（JWT、CORS、DRF）
│   │   └── urls.py                 ← 根路由（挂载所有 app）
│   ├── pim/                        ← 商品中心
│   │   ├── models.py               ← Category, OperationalTag, MasterCodeSequence,
│   │   │                              MasterSKU, Supplier, SupplierSKU
│   │   ├── signals.py              ← 商品下架级联 Signal（待新建）
│   │   ├── serializers.py
│   │   ├── views.py                ← ModelViewSet + AI 接口（待扩展）
│   │   ├── ai_service.py           ← Claude API 封装（待新建）
│   │   ├── import_wp_csv.py        ← WP CSV 批量导入脚本（待新建）
│   │   └── urls.py
│   ├── oms/                        ← 订单中心
│   │   ├── models.py               ← Order, OrderItem
│   │   ├── routing.py              ← 路由引擎（核心业务逻辑）
│   │   ├── serializers.py
│   │   ├── views.py                ← 含 quick_entry、route action
│   │   └── urls.py
│   ├── sites/                      ← 分销商+站点环境
│   │   ├── models.py               ← Distributor, SiteEnvironment, DistributorSelection
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── finance/                    ← 财务看板（无 models，纯聚合查询）
│   │   ├── views.py                ← finance_summary, by_distributor, by_supplier, daily
│   │   └── urls.py
│   └── wp_sync/                    ← WP 同步
│       ├── models.py               ← WPSite, WPProductMapping
│       ├── services.py             ← WooCommerceClient, push_sku_to_wp, sync_stock_status
│       ├── webhooks.py             ← WooCommerceWebhookView（AllowAny，无需JWT）
│       ├── serializers.py
│       ├── views.py
│       └── urls.py
│
└── frontend/
    ├── index.html                  ← 入口 HTML（挂载 #app）
    ├── vite.config.ts              ← Vite配置（React插件、Tailwind、代理/api→8000）
    ├── tsconfig.json
    ├── package.json
    └── src/
        ├── main.tsx                ← React 根入口
        ├── App.tsx                 ← 路由配置 + ProtectedRoute
        ├── index.css               ← Tailwind v4 全局样式
        ├── api/
        │   ├── client.ts           ← Axios实例 + JWT拦截器 + 自动刷新
        │   └── endpoints.ts        ← 所有接口封装（按模块）
        ├── hooks/
        │   └── useAuth.ts          ← 登录/登出/isAuthenticated
        ├── types/
        │   └── index.ts            ← 所有 TypeScript 类型（与后端 models 对应）
        ├── components/
        │   ├── Layout.tsx          ← 侧边栏 + Outlet（整体框架）
        │   └── ui/                 ← 基础UI组件
        │       ├── button.tsx
        │       ├── input.tsx
        │       ├── card.tsx
        │       ├── badge.tsx
        │       ├── dialog.tsx
        │       ├── select.tsx
        │       ├── label.tsx
        │       └── textarea.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── ProductsPage.tsx
            ├── OrdersPage.tsx
            ├── DistributorsPage.tsx
            ├── SuppliersPage.tsx
            ├── WPSitesPage.tsx
            └── FinancePage.tsx
```

---

## 三、本地启动

### 后端

```powershell
cd d:\cursor\vault\backend

# 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 启动开发服务器（默认 http://localhost:8000）
python manage.py runserver
```

### 前端

```powershell
cd d:\cursor\vault\frontend

# 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

> **注意**：前端 vite.config.ts 已配置 `/api` → `http://localhost:8000` 代理，前端直接请求 `/api/...` 即可。

### 创建管理员账号

```powershell
cd d:\cursor\vault\backend
python manage.py createsuperuser
```

---

## 三点五、PIM 数据模型（V2 升级版）

> 以下为 PIM 圆桌规划后确认的最终模型，需替换 pim/models.py 中的现有模型。
> 完整说明见 `docs/modules/products/spec.md`

### pim/models.py 完整结构

```python
# ─── 品类表（新增）───────────────────────────────────────────
class Category(models.Model):
    code    = models.CharField(max_length=1, unique=True)  # '1'-'9', 'A'
    name_en = models.CharField(max_length=100)
    name_zh = models.CharField(max_length=100)
    # 预置10条：1-Vibrators 2-Dildo 3-Butt Plugs 4-Masturbators
    #          5-Cock Rings & Enhancers 6-med 7-Half Body Sex Doll
    #          8-Full Body Sex Doll 9-other A-Strap-Ons

# ─── 运营标签表（新增）──────────────────────────────────────
class OperationalTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    # 预置：best_seller, high_value, new_arrival

# ─── 编码序列计数器（新增）──────────────────────────────────
class MasterCodeSequence(models.Model):
    region        = models.CharField(max_length=1)  # 'u','t','a'
    category_code = models.CharField(max_length=1)  # '1'-'9','A'
    last_sequence = models.IntegerField(default=0)
    class Meta:
        unique_together = ('region', 'category_code')

# ─── 主商品表（字段大幅扩展）────────────────────────────────
class MasterSKU(models.Model):
    REGION_CHOICES = [('u','UAE'), ('t','Thailand'), ('a','All')]

    # 编码
    master_code  = models.CharField(max_length=20, unique=True)
    legacy_code  = models.CharField(max_length=50, blank=True, db_index=True)
    region       = models.CharField(max_length=1, choices=REGION_CHOICES, default='u')

    # 分类
    primary_category = models.ForeignKey(Category, on_delete=models.PROTECT,
                                          related_name='primary_skus')
    categories       = models.ManyToManyField(Category, blank=True, related_name='skus')

    # 标题与描述
    title_en          = models.CharField(max_length=255)
    title_ar          = models.CharField(max_length=255, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description       = models.TextField(blank=True)  # 纯文字，不含[video] shortcode

    # 媒体资产
    image_urls = models.JSONField(default=list, blank=True)
    video_urls = models.JSONField(default=list, blank=True)
    # video格式: [{"url": "...", "width": 720, "height": 1280}]

    # 价格
    regular_price = models.DecimalField(max_digits=10, decimal_places=2,
                                         validators=[MinValueValidator(Decimal('0.01'))])
    selling_price = models.DecimalField(max_digits=10, decimal_places=2,
                                         validators=[MinValueValidator(Decimal('0.01'))])

    # 标签
    audience_tags    = models.JSONField(default=list, blank=True)
    # 枚举值: ["for_her", "for_him", "for_couples"]
    operational_tags = models.ManyToManyField(OperationalTag, blank=True)

    # 展示
    is_featured = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.selling_price and self.regular_price:
            if self.selling_price > self.regular_price:
                raise ValidationError("售价不能高于原价")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['master_code']),
            models.Index(fields=['legacy_code']),
            models.Index(fields=['region', 'is_active']),
        ]

# ─── 供应商表（已有，无变化）────────────────────────────────
class Supplier(models.Model):  # 无变化

# ─── 供应商SKU映射（已有，无变化）───────────────────────────
class SupplierSKU(models.Model):  # 无变化
```

### wp_sync/models.py 升级（WPProductMapping）

```python
class WPProductMapping(models.Model):
    SYNC_STATUS_CHOICES = [
        ('pending', '待同步'), ('syncing', '同步中'),
        ('synced',  '已同步'), ('failed',  '同步失败'), ('draft', 'WP已下架'),
    ]
    master_sku     = models.ForeignKey('pim.MasterSKU', on_delete=models.CASCADE,
                                        related_name='wp_mappings')
    wp_site        = models.ForeignKey(WPSite, on_delete=models.CASCADE,
                                        related_name='product_mappings')
    wp_product_id  = models.IntegerField(null=True, blank=True)
    wp_sku         = models.CharField(max_length=100, blank=True)
    sync_status    = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES,
                                       default='pending')
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error     = models.TextField(blank=True)
    class Meta:
        unique_together = ('master_sku', 'wp_site')
```

---

## 四、API 端点总览

**认证**（无需 JWT）：
```
POST /api/token/           ← 获取 access + refresh token
POST /api/token/refresh/   ← 用 refresh token 换新 access token
```

**商品（PIM）**：
```
GET/POST        /api/products/                    ← 商品列表/创建（含 availability、best_cost_price 字段）
GET/PUT/DELETE  /api/products/{id}/
POST            /api/products/{id}/generate-code/ ← 为旧商品生成规范编码（待新增）
GET/POST        /api/suppliers/
PUT             /api/suppliers/{id}/              ← 含熔断字段 circuit_breaker
GET/POST        /api/supplier-skus/
GET/POST        /api/categories/                  ← 品类管理（待新增）
GET/POST        /api/operational-tags/            ← 运营标签管理（待新增）

# AI 辅助上线（现行）
POST  /api/ai/ocr-analyze/     ← 上传图片/PDF→返回建议字段
POST  /api/ai/optimize-text/   ← 文案优化（标题/描述）
POST  /api/ai/qa-scan/         ← 数据质量扫描（V2，规划）
# 历史口径：/api/pim/ai/*（仅追溯，不再作为实现依据）
```

**站点（Sites）**：
```
GET/POST   /api/distributors/
GET/PUT    /api/distributors/{id}/
GET        /api/distributors/{id}/selections/
GET/PUT    /api/site-environments/{id}/
GET/POST/DELETE /api/distributor-selections/
```

**订单（OMS）**：
```
GET/POST   /api/orders/
GET/PUT    /api/orders/{id}/
POST       /api/orders/{id}/route/     ← 触发路由引擎
POST       /api/orders/quick-entry/    ← 快捷录单
```

**WP 同步**：
```
GET/POST   /api/wp-sites/
POST       /api/wp-sync/push/{sku_id}/   ← 推送SKU到WP
POST       /api/wp-sync/webhook/          ← WC回调（AllowAny，不需JWT）
```

**财务**：
```
GET /api/finance/summary/?period=week|month|quarter|all
GET /api/finance/by-distributor/
GET /api/finance/by-supplier/
GET /api/finance/daily/
```

---

## 五、核心业务逻辑

### 路由引擎（oms/routing.py）

```
输入：Order（含 items）
对每个 item → 查 SupplierSKU（过滤：supplier.is_active=True AND circuit_breaker=False AND stock_status=in_stock）
→ 按 supplier.priority 升序 → 取最优先
→ 写入 item.cost_price
→ 统计各供应商票数 → 主供应商为得票最多的
→ 计算 profit = total_amount - sum(cost×qty) - delivery_fee
→ 如跨供应商则返回 needs_split=True（提示拆单）
```

### JWT 自动刷新（frontend/src/api/client.ts）

- Axios 请求拦截器：每次请求自动带上 `Authorization: Bearer <access_token>`
- 响应拦截器：收到 401 → 自动用 refresh_token 换新 access_token → 重试原请求
- 换 token 失败 → 清除 localStorage → 跳转 /login

### WP Webhook 接单流程

```
WooCommerce 站点 → POST /api/wp-sync/webhook/
→ 根据 X-WC-Webhook-Source Header 匹配 WPSite
→ 解析 billing/shipping/line_items
→ 创建 Order + OrderItems
→ 自动触发路由引擎
```

---

## 六、重要配置项

### 后端 settings.py

```python
CORS_ALLOW_ALL_ORIGINS = True   # 生产环境改为指定域名

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    # ↑ 所有 API 默认需要 JWT，webhook 通过 AllowAny 豁免
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

### 前端环境变量

创建 `frontend/.env.local`（本地开发不需要，代理已配置）：

```env
VITE_API_URL=https://your-api-domain.com/api   # 部署时填写实际后端地址
```

---

## 七、数据库操作

```powershell
# 生成迁移（修改 models 后）
python manage.py makemigrations

# 应用迁移
python manage.py migrate

# 查看迁移状态
python manage.py showmigrations

# 进入 Django Shell
python manage.py shell
```

---

## 八、已知问题 & 注意事项

1. **Tailwind v4 CSS 变量**：v4 与 shadcn/ui 官方文档的 CSS 变量语法不兼容，项目使用了 Tailwind 原生 class 代替 CSS 变量。勿直接复制 shadcn 官网代码到 index.css。

2. **Node.js 版本警告**：当前 Node 22.9.0，Vite 7 要求 22.12+。功能正常，忽略该警告即可，或升级 Node。

3. **db.sqlite3 不进 git**：数据库文件不提交，每次部署新环境需 `migrate` 并 `createsuperuser`。

4. **WP Webhook 源地址匹配**：`webhooks.py` 用 `site_url__icontains` 模糊匹配，WP 站点的 `site_url` 填写时不要带末尾斜杠。
