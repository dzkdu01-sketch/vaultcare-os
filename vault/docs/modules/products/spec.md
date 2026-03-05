# Vaultcare OS — PIM 商品管理模块完整规格

> **来源**：基于 2026-03-02 四轮圆桌头脑风暴（IT专家 / 运营专家 / 分销商代表 / WordPress专家）  
> **版本**：v1.0  
> **状态**：已确认，待开发

---

## 一、模块定位

PIM（Product Information Management）是整个 Vaultcare OS 的数据核心。

**核心职责：**
- 维护全局唯一的 Master SKU 库（ERP 是唯一真相来源）
- 通过 WooCommerce API 将商品状态推送至各分销商 WordPress 站点
- 为分销商提供选品界面，支持跨区域、跨平台商品管理
- 提供 AI 辅助上线功能，将新商品上线时间从 20-30 分钟压缩至 5 分钟内

**架构原则：**
- ERP 是 Master（主），WordPress 是 Mirror（镜像）
- WordPress 站点只读展示，不允许在 WP 后台人工添加或修改商品
- 商品状态变更在 ERP 操作，异步推送到所有关联 WP 站

---

## 二、商品编码体系

### 2.1 自动编码格式

新商品（第一版迁移后新增）采用统一规范编码：

```
vc-{region}-{category}{seq:03d}

示例：
  vc-u-1001   → UAE市场 / Vibrators品类 / 第001号
  vc-a-2015   → 全区域 / Dildo品类 / 第015号
  vc-t-4023   → 泰国市场 / Masturbators品类 / 第023号
  vc-u-A007   → UAE市场 / Strap-Ons品类 / 第007号
```

| 字段 | 规则 | 示例 |
|------|------|------|
| 固定前缀 | 始终为 `vc` | `vc` |
| 区域代码 | 单字符：`u`=UAE, `t`=泰国, `a`=全区域 | `u` |
| 品类代码 | 单字符：`1`-`9` 或 `A`（见品类表） | `1` |
| 序号 | 3位数字，从 `001` 开始，按 (区域+品类) 独立计数 | `001` |

### 2.2 区域代码语义说明（重要）

> ⚠️ **编码中的区域代码 ≠ 销售限制**

- `master_code` 中的区域代码（如 `vc-u-1001` 中的 `u`）代表**商品创建时的主要目标市场**，一旦生成不可修改（不可变标识符）
- 实际的**当前推送范围**由 `MasterSKU.region` 字段控制，可以随业务需要更新（如从 `u` 扩展为 `a`）
- 分销商可以跨区域选品：一个泰国分销商可以选择 `vc-u-1001`（UAE编码）的商品并推送到泰国站点

### 2.3 品类代码表

| 代码 | 英文名 | 中文名 | 备注 |
|------|--------|--------|------|
| `1` | Vibrators | 女士震动用品 | |
| `2` | Dildo | 阳具 | |
| `3` | Butt Plugs | 肛塞 | WP 里叫 ButtPlay |
| `4` | Masturbators | 男士手持飞机杯 | |
| `5` | Cock Rings & Enhancers | 阴茎环和延长套 | WP 里叫 Cock Rings/long |
| `6` | med | 药品/延时/香水/润滑油等 | WP 里叫 Sexual Wellness |
| `7` | Half Body Sex Doll | 屁股和半身娃娃 | |
| `8` | Full Body Sex Doll | 全身娃娃 | |
| `9` | other | 其他杂类（内衣/SM/前列腺等） | 真正的小类杂项 |
| `A` | Strap-Ons | 穿戴绑带类 | 独立品类，预期增长 |

### 2.4 旧商品（历史遗留）处理策略

- 迁移脚本从 WordPress CSV 导入时：`master_code` = 旧 WP SKU（如 `QR42`），`legacy_code` = 旧 WP SKU（同值）
- 管理员可在 ERP 后台为旧商品一键生成规范编码：点击后自动分配新码（如 `vc-u-1001`），旧码保留在 `legacy_code` 字段
- 搜索时同时检索 `master_code` 和 `legacy_code`，保证分销商用旧码（如 `QR42`）也能找到商品

### 2.5 编码生成器实现要点

```python
class MasterCodeSequence(models.Model):
    """编码序号计数器，防并发重复"""
    region        = models.CharField(max_length=1)   # 'u', 't', 'a'
    category_code = models.CharField(max_length=1)   # '1'-'9', 'A'
    last_sequence = models.IntegerField(default=0)
    class Meta:
        unique_together = ('region', 'category_code')

def generate_master_code(region: str, category_code: str) -> str:
    """使用 select_for_update 保证并发安全"""
    with transaction.atomic():
        seq, _ = MasterCodeSequence.objects.select_for_update().get_or_create(
            region=region, category_code=category_code
        )
        seq.last_sequence += 1
        seq.save()
        return f"vc-{region}-{category_code}{seq.last_sequence:03d}"
```

---

## 三、完整数据模型

### 3.1 Category（品类表）

```python
class Category(models.Model):
    code     = models.CharField(max_length=1, unique=True)  # '1'-'9', 'A'
    name_en  = models.CharField(max_length=100)
    name_zh  = models.CharField(max_length=100)
    
    def __str__(self):
        return f"{self.code} - {self.name_en}"
```

**预置数据（10条）：** 1-Vibrators, 2-Dildo, 3-Butt Plugs, 4-Masturbators, 5-Cock Rings & Enhancers, 6-med, 7-Half Body Sex Doll, 8-Full Body Sex Doll, 9-other, A-Strap-Ons

### 3.2 OperationalTag（运营标签表）

```python
class OperationalTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    # 预置：best_seller, high_value, new_arrival
```

### 3.3 MasterCodeSequence（编码计数器）

见 2.5 节。

### 3.4 MasterSKU（主商品表）— 完整终版

```python
class MasterSKU(models.Model):
    REGION_CHOICES = [('u', 'UAE'), ('t', 'Thailand'), ('a', 'All')]

    # ── 编码 ──────────────────────────────────────────
    master_code  = models.CharField(max_length=20, unique=True)
    # 对新商品：自动生成规范码（vc-u-1001）
    # 对旧商品：暂时存旧码（QR42），后续可升级
    legacy_code  = models.CharField(max_length=50, blank=True, db_index=True)
    # 旧 WP SKU 或供应商码，可搜索

    # ── 市场范围 ───────────────────────────────────────
    region = models.CharField(max_length=1, choices=REGION_CHOICES, default='u')
    # 当前允许推送的市场范围（可修改）
    # 注意：master_code 中嵌入的区域码是创建时快照，不随此字段变动

    # ── 分类 ──────────────────────────────────────────
    primary_category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name='primary_skus'
    )
    # 决定编码中的品类代码，也是默认展示分类
    categories = models.ManyToManyField(Category, blank=True, related_name='skus')
    # 可附属多个分类，用于 WP 多分类展示和筛选

    # ── 标题与描述 ─────────────────────────────────────
    title_en          = models.CharField(max_length=255)
    title_ar          = models.CharField(max_length=255, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description       = models.TextField(blank=True)
    # 注意：description 只存纯文字，不含 [video] shortcode

    # ── 媒体资产 ───────────────────────────────────────
    image_urls = models.JSONField(default=list, blank=True)
    # 格式：["https://cdn.../img1.jpg", "https://cdn.../img2.jpg"]
    video_urls = models.JSONField(default=list, blank=True)
    # 格式：[{"url": "https://...", "width": 720, "height": 1280}]

    # ── 价格 ──────────────────────────────────────────
    regular_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )  # 划线原价（展示用）
    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )  # 实际成交价（利润计算用）

    # ── 标签 ──────────────────────────────────────────
    audience_tags = models.JSONField(default=list, blank=True)
    # 受众标签（枚举）：["for_her", "for_him", "for_couples"]
    operational_tags = models.ManyToManyField(OperationalTag, blank=True)
    # 运营标签：best_seller / high_value / new_arrival

    # ── 展示控制 ───────────────────────────────────────
    is_featured = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)

    # ── 时间戳 ────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.selling_price and self.regular_price:
            if self.selling_price > self.regular_price:
                raise ValidationError("售价(selling_price)不能高于原价(regular_price)")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['master_code']),
            models.Index(fields=['legacy_code']),
            models.Index(fields=['region', 'is_active']),
        ]
```

### 3.5 WPProductMapping（WP站点商品映射表）— 升级版

> 原有模型缺失 `sync_status`、`wp_sku`、`sync_error` 等关键字段，需重建。

```python
class WPProductMapping(models.Model):
    SYNC_STATUS_CHOICES = [
        ('pending',  '待同步'),
        ('syncing',  '同步中'),
        ('synced',   '已同步'),
        ('failed',   '同步失败'),
        ('draft',    'WP已下架'),
    ]

    master_sku    = models.ForeignKey(MasterSKU, on_delete=models.CASCADE,
                                       related_name='wp_mappings')
    wp_site       = models.ForeignKey('wp_sync.WPSite', on_delete=models.CASCADE,
                                       related_name='product_mappings')
    wp_product_id = models.IntegerField(null=True, blank=True)
    # WP 内部数字ID（如 4914）；新商品推送前为 null
    wp_sku        = models.CharField(max_length=100, blank=True)
    # WP SKU 字段的值（如 QR42）
    sync_status   = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES,
                                      default='pending')
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error     = models.TextField(blank=True)

    class Meta:
        unique_together = ('master_sku', 'wp_site')
```

---

## 四、WP 同步机制（V1 范围）

### 4.1 V1 同步范围（已确认）

V1 只同步上下架状态，**不同步**价格、描述、图片（留 V2）。

| 触发事件 | 同步内容 | 目标 WP 动作 |
|---------|---------|------------|
| 商品下架（is_active → False） | 状态 | WP 商品变为 `draft`（页面消失） |
| 商品上架（is_active → True） | 状态 | WP 商品变为 `publish` |
| 分销商新增选品 | 推送商品到该 WP 站 | WP 创建新商品（`publish`） |

> **商品下架后 WP 行为：** 变为草稿（Draft），页面完全消失（非 Out of Stock 展示）。

### 4.2 同步延迟要求

分钟级延迟可接受（无需实时推送），使用后台异步任务队列。

### 4.3 同步逻辑（V1 核心）

```python
def sync_product_status_to_wp(master_sku_id: int, is_active: bool):
    mappings = WPProductMapping.objects.filter(
        master_sku_id=master_sku_id,
        wp_product_id__isnull=False
    )
    for mapping in mappings:
        try:
            wp_status = 'publish' if is_active else 'draft'
            call_woocommerce_api(
                site=mapping.wp_site,
                method='PUT',
                endpoint=f'/products/{mapping.wp_product_id}',
                data={'status': wp_status}
            )
            mapping.sync_status = 'synced' if is_active else 'draft'
            mapping.last_synced_at = timezone.now()
            mapping.sync_error = ''
        except Exception as e:
            mapping.sync_status = 'failed'
            mapping.sync_error = str(e)
        mapping.save()
```

### 4.4 商品下架级联处理（修复 HIGH-002）

```python
# pim/signals.py
@receiver(pre_save, sender=MasterSKU)
def handle_product_status_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old = MasterSKU.objects.get(pk=instance.pk)
    except MasterSKU.DoesNotExist:
        return

    if old.is_active and not instance.is_active:
        # 商品从上架 → 下架
        # 1. 清除所有分销商选品
        DistributorSelection.objects.filter(master_sku=instance).delete()
        # 2. 触发 WP 异步下架（变为 draft）
        sync_product_status_to_wp.delay(instance.pk, is_active=False)
```

---

## 五、WordPress CSV 批量导入

### 5.1 导入范围

- 来源文件：`backend/pim/商品导出模板.csv`（vaultcare-d.com 主站导出）
- 目标：仅导入主站，创建 `MasterSKU` + `WPProductMapping`（wp_site = 主站）
- 分销商站点通过后续"分销商选品 → 推送"流程处理

### 5.2 字段映射表

| WP CSV 列 | ERP 目标字段 | 处理方式 |
|-----------|------------|---------|
| `ID` | `WPProductMapping.wp_product_id` | 直接映射 |
| `SKU` | `MasterSKU.master_code`（初始），`MasterSKU.legacy_code`，`WPProductMapping.wp_sku` | 三处都存 |
| `Name` | `MasterSKU.title_en` | 直接映射 |
| `Short description` | `MasterSKU.short_description` | 直接映射 |
| `Description` | 双重处理：① 正则提取 `[video]` → `video_urls`；② 剩余文字 → `description` | 需清洗 |
| `Regular price` | `MasterSKU.regular_price` | 直接映射 |
| `Sale price` | `MasterSKU.selling_price` | 直接映射；空则等于 regular_price |
| `Images` | `MasterSKU.image_urls` | 逗号分割 → 列表 |
| `Categories` | `MasterSKU.primary_category` + `MasterSKU.categories` | 查找/创建 Category |
| `Tags` | `audience_tags`（for_her/for_him）+ `operational_tags`（best_seller 等） | 分类处理 |
| `Is featured?` | `MasterSKU.is_featured` | `1` → True |
| `Published` | `MasterSKU.is_active` | `1` → True |
| — | `MasterSKU.region` | 默认 `'u'`（UAE） |

### 5.3 分类映射（WP → ERP）

| WP 分类 | ERP Category code |
|---------|-----------------|
| Vibrators | 1 |
| Dildos | 2 |
| ButtPlay | 3 |
| Masturbators | 4 |
| Cock Rings & Enhancers | 5 |
| Sexual Wellness | 6 |
| Half Body Sex Doll | 7 |
| Full Body Sex Doll | 8 |
| Strap-Ons | A |
| Uncategorized | **需人工处理** |
| other / 未在上表中的 | 9 |

### 5.4 描述字段清洗（视频提取）

```python
import re

VIDEO_PATTERN = re.compile(
    r'\[video[^\]]*mp4="([^"]+)"[^\]]*width="(\d+)"[^\]]*height="(\d+)"[^\]]*\]'
    r'.*?\[/video\]',
    re.DOTALL
)

def parse_description(raw_html: str) -> tuple[str, list]:
    """返回 (清理后的描述文字, 视频信息列表)"""
    videos = []
    for match in VIDEO_PATTERN.finditer(raw_html):
        videos.append({
            "url":    match.group(1),
            "width":  int(match.group(2)),
            "height": int(match.group(3))
        })
    clean_desc = VIDEO_PATTERN.sub('', raw_html).strip()
    return clean_desc, videos
```

### 5.5 需人工处理的数据质量问题

| 问题 | 商品数 | 处理建议 |
|------|--------|---------|
| Uncategorized 商品 | ~6条 | 导入后人工分配品类 |
| `title_ar` 为空 | 大部分商品 | AI 批量补填（V2 AI质检功能） |
| `short_description` 为空 | ~15条 | AI 批量补填 |
| Description 名实不符（如QR120） | ~3条 | 人工修正 |
| 视频 URL 仍在 description HTML 中 | 全部 | 导入脚本自动清洗 |

---

## 六、AI 辅助上线模块

### 6.1 功能范围（三个版本）

**V1（核心）：AI 辅助商品信息填写**
- 上传 1-5 张图片 → 自动填写 `title_en` / `title_ar` / `short_description` / `description`
- 自动建议 `primary_category` 和标签
- 人工确认后一键保存，禁止 AI 直接创建商品

**V2（增强）：AI 质检现有商品**
- 扫描全库，找出数据质量问题（空字段/分类错误/名实不符）
- 批量生成补全建议，管理员逐条确认

**V3（扩展）：WhatsApp 推广文案生成**
- 为分销商生成适合 WhatsApp 的商品推广话术（阿拉伯语/英语）

### 6.2 API 设计

> 口径说明（2026-03-05）：现行接口前缀为 `/api/ai/*`。  
> 历史文档中的 `/api/pim/ai/*` 视为旧口径，仅用于追溯，不再作为实现依据。

```
POST /api/ai/ocr-analyze/
  → 上传图片，返回字段建议（不保存）

POST /api/ai/optimize-text/
  → 传入标题/描述，返回优化文案（可对比后人工采用）

POST /api/ai/qa-scan/        （V2，规划）
  → 扫描现有商品，返回数据质量问题列表

POST /api/ai/generate-wa-copy/  （V3，规划）
  → 为指定商品生成 WhatsApp 推广文案
```

### 6.3 图片分析 Prompt 规范

```python
SYSTEM_PROMPT = """
You are a product content specialist for an adult wellness e-commerce brand
called Vaultcare, selling in the UAE market. Write SEO-friendly, tasteful
product listings that comply with marketplace guidelines.

Return ONLY a valid JSON object with these fields:
- title_en: string, max 80 chars
- title_ar: string, Arabic (Gulf dialect preferred)
- short_description: string, max 150 chars
- description: string, 200-350 words, structured with line breaks
- primary_category: one of [Vibrators|Dildo|Butt Plugs|Masturbators|
    Cock Rings & Enhancers|med|Half Body Sex Doll|Full Body Sex Doll|other|Strap-Ons]
- audience_tags: array, subset of ["for_her","for_him","for_couples"]
- operational_tags: array, subset of ["best_seller","high_value","new_arrival"]
- confidence_score: float 0-1
- notes: string, flag any uncertainty
"""
```

使用模型：`claude-3-5-haiku-20241022`（平衡速度与质量，成本低）

### 6.4 完整上线流程（AI + WP 映射结合）

```
管理员上传图片（1-5张）
    ↓ (~10秒)
Claude Vision 分析 → 返回建议字段 + 置信度
    ↓ (~2分钟)
管理员修改/确认 → 填写区域 + 价格
    ↓ (自动)
系统生成规范 Master Code（vc-u-xxxx）
    ↓ (自动)
创建 MasterSKU，is_active=True
    ↓ (自动触发 Signal)
各已选此商品的分销商 → 创建 WPProductMapping（pending）
    ↓ (~1分钟，后台异步)
调用 WooCommerce API 在各分销商 WP 站创建商品
    ↓
WPProductMapping.sync_status → synced，记录 wp_product_id

总耗时：约 5 分钟（原流程 20-30 分钟）
```

---

## 六点五、PIM 与消息互动（WhatsApp 素材）

PIM 是 WhatsApp 推广素材的**唯一数据来源**。消息互动模式下，客户通过 WhatsApp 看图选品，分销商所需素材均来自 MasterSKU：

| 素材类型 | PIM 字段 | WhatsApp 使用场景 |
|---------|---------|-----------------|
| 主图/多图 | image_urls | 发送商品图片给客户 |
| 简短描述 | short_description | 商品介绍话术参考 |
| 标题 | title_en / title_ar | 多语言推广 |

**V3 规划：WhatsApp 素材包与导出**
- 为指定商品/选品清单生成「WhatsApp 素材包」（图片 + 文案）
- 支持批量导出，便于分销商在 WhatsApp 中快速发送
- 含 `POST /api/ai/generate-wa-copy/` 推广文案生成（规划）

---

## 七、分销商视角：可售状态聚合

> **说明**：`availability` 与 `best_cost_price` 依赖 `supplier_skus` 关联数据。`SupplierSKU` 模型及供应商映射在 **OMS 模块** 中定义，PIM 通过跨模块查询获取库存与成本价，不在此定义 SupplierSKU 结构。

### 7.1 `availability` 计算逻辑

分销商在选品和录单时，需要一个直观的可售状态，而非自己拼凑多个字段。

```python
@property
def availability(self) -> str:
    """
    聚合计算商品的可售状态
    Returns: 'available' | 'low_stock' | 'unavailable'
    """
    if not self.is_active:
        return 'unavailable'

    supplier_skus = self.supplier_skus.filter(
        supplier__is_active=True,
        supplier__circuit_breaker=False
    )

    in_stock_suppliers = supplier_skus.filter(stock_status='in_stock')

    if not in_stock_suppliers.exists():
        return 'unavailable'

    # 如果只有低优先级供应商有货（主供应商缺货），标记为 low_stock
    primary_has_stock = in_stock_suppliers.filter(supplier__priority=1).exists()
    if not primary_has_stock:
        return 'low_stock'

    return 'available'
```

### 7.2 分销商可见的成本价

分销商**可以看到成本价**（已确认），显示当前最优供应商（路由引擎会选的那家）的成本价：

```python
@property
def best_cost_price(self) -> Decimal | None:
    """当前最优可用供应商的成本价（分销商可见）"""
    best = self.supplier_skus.filter(
        supplier__is_active=True,
        supplier__circuit_breaker=False,
        stock_status='in_stock'
    ).order_by('supplier__priority').first()
    return best.cost_price if best else None
```

---

## 八、待修复的已知问题（详见 docs/handover.md）

| 编号 | 严重度 | 问题 | 修复方案 |
|------|--------|------|---------|
| HIGH-001 | 🟠 | `selling_price > 0` 未验证 | 在 `MasterSKU.clean()` 中加 `MinValueValidator` |
| HIGH-002 | 🟠 | 商品下架无级联处理 | 实现 Django Signal（见 4.4 节） |
| MED-001 | 🟡 | `master_code` 格式未验证 | 新商品通过编码引擎生成，无法手动输入乱码 |
| MED-002 | 🟡 | 无价格变更审计日志 | Sprint 2 实现 `AuditLog` 模型 |
| CRIT-006 | ~~🔴~~ | 成本价对分销商可见 | **已确认为设计要求，非 Bug** |

---

## 九、Sprint 开发计划

### Sprint 1：基础重建（P0 必须项）

| 任务 | 说明 |
|------|------|
| 建立 `Category` 模型（10个品类，含代码 A） | 含中英文名，预置数据 |
| 建立 `OperationalTag` 模型 | 预置 best_seller / high_value / new_arrival |
| 建立 `MasterCodeSequence` 编码计数器 | `select_for_update` 原子锁 |
| `MasterSKU` 字段全面扩展（见 3.4 节） | 含所有新字段、`clean()` 验证 |
| 修复 HIGH-001 + HIGH-002 | 价格验证 + 下架级联 |
| WP CSV → ERP 批量导入脚本 | 只导主站，含视频提取、分类映射 |

### Sprint 2：映射关系 + WP 同步

| 任务 | 说明 |
|------|------|
| 重建 `WPProductMapping`（见 3.5 节） | 含状态机字段 |
| WP 上下架状态异步同步 | 分钟级延迟，下架变 Draft |
| 分销商选品时自动创建 WPProductMapping | `pending` 状态入队 |
| `availability` 聚合字段（API 输出） | 分销商核心需求 |
| `best_cost_price` 字段（API 输出） | 分销商可见成本价 |
| 价格变更审计日志（MED-002） | `AuditLog` 模型 |

### Sprint 3：AI 辅助上线（V1）

| 任务 | 说明 |
|------|------|
| Claude API 封装（含错误处理/重试） | 使用已有 API Key |
| `POST /api/ai/ocr-analyze/` | 核心图片/PDF 识别接口（现行） |
| `POST /api/ai/optimize-text/` | 文案优化接口（现行） |
| 前端 AI 辅助上线界面（三步骤流程） | 上传→确认→保存 |
| 确保 API 输出 `image_urls`、`short_description` 等 | PIM 作为 WhatsApp 素材唯一来源，V1 即需可用 |

### Sprint 4：WhatsApp 素材能力（V3）

| 任务 | 说明 |
|------|------|
| `POST /api/ai/generate-wa-copy/` | 为指定商品生成 WhatsApp 推广文案（规划） |
| WhatsApp 素材包生成与导出 | 指定商品/选品清单，批量导出图片+文案 |
| 支持阿拉伯语/英语推广话术 | 适配海湾方言 |

---

## 十、暂不纳入范围（V1 明确排除）

- 库存数量同步（只同步上下架状态）
- 价格/描述/图片的 WP 同步（V2）
- 商品变体（Variant）支持
- 供应商库存 API 接入（供应商完全依赖人工更新）
- WhatsApp 推广文案生成、素材包与导出（**V3 纳入**）
- AI 质检批量扫描（V2）
