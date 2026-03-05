from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction


# ---------------------------------------------------------------------------
# 品类表
# ---------------------------------------------------------------------------

class Category(models.Model):
    code    = models.CharField(max_length=1, unique=True)   # '1'-'9', 'A'
    name_en = models.CharField(max_length=100)
    name_zh = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['code']
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return f"{self.code} - {self.name_en}"


# ---------------------------------------------------------------------------
# 运营标签表
# ---------------------------------------------------------------------------

class OperationalTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    # 预置：best_seller, high_value, new_arrival
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# 品牌字典
# ---------------------------------------------------------------------------

class Brand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# 编码计数器（并发安全）
# ---------------------------------------------------------------------------

class MasterCodeSequence(models.Model):
    region        = models.CharField(max_length=1)   # 'u', 't', 'a'
    category_code = models.CharField(max_length=1)   # '1'-'9', 'A'
    last_sequence = models.IntegerField(default=0)

    class Meta:
        unique_together = ('region', 'category_code')

    def __str__(self):
        return f"seq({self.region},{self.category_code})={self.last_sequence}"


def generate_master_code(region: str, category_code: str) -> str:
    """select_for_update 保证并发安全"""
    with transaction.atomic():
        seq, _ = MasterCodeSequence.objects.select_for_update().get_or_create(
            region=region, category_code=category_code
        )
        seq.last_sequence += 1
        seq.save()
        return f"vc-{region}-{category_code}{seq.last_sequence:03d}"


# ---------------------------------------------------------------------------
# 主商品表
# ---------------------------------------------------------------------------

class MasterSKU(models.Model):
    REVIEW_STATUS_CHOICES = [
        ('draft', 'Draft'),                     # 草稿（从未上架）
        ('pending_review', 'Pending Review'),   # 待审核
        ('publishable', 'Publishable'),         # 可发布
        ('inactive_delisted', 'Inactive (Delisted)'),  # 已下架（曾上架后主动下架）
    ]

    REGION_CHOICES = [
        ('u', 'UAE'),
        ('t', 'Thailand'),
        ('a', 'All'),
    ]

    # ── 编码 ──────────────────────────────────────────
    master_code = models.CharField(max_length=20, unique=True)
    legacy_code = models.CharField(max_length=50, blank=True, default='', db_index=True)

    # ── 市场范围 ───────────────────────────────────────
    region = models.CharField(
        max_length=1, choices=REGION_CHOICES, default='u',
        help_text='当前允许推送的市场范围（可修改，与编码中的区域码无关）'
    )

    # ── 分类 ──────────────────────────────────────────
    primary_category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='primary_skus',
        null=True,
        blank=True,
    )
    categories = models.ManyToManyField(
        Category,
        blank=True,
        related_name='skus',
    )
    # 保留旧 category CharField，用于向后兼容和历史数据
    category = models.CharField(max_length=100, blank=True, default='')

    # ── 标题与描述 ─────────────────────────────────────
    title_en          = models.CharField(max_length=255)
    title_ar          = models.CharField(max_length=255, blank=True, default='')
    title_th          = models.CharField(max_length=255, blank=True, default='')
    short_description = models.CharField(max_length=500, blank=True, default='')
    description       = models.TextField(blank=True, default='')

    # ── 媒体资产 ───────────────────────────────────────
    image_urls = models.JSONField(default=list, blank=True)
    video_urls = models.JSONField(default=list, blank=True)

    # ── 价格 ──────────────────────────────────────────
    regular_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        null=True, blank=True,
        help_text='划线原价（展示用）',
    )
    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        default=Decimal('0.01'),
        help_text='实际成交价（利润计算用）',
    )

    # ── 标签 ──────────────────────────────────────────
    audience_tags    = models.JSONField(default=list, blank=True)
    operational_tags = models.ManyToManyField(OperationalTag, blank=True)

    # ── 展示控制 ───────────────────────────────────────
    is_featured = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)
    ever_published = models.BooleanField(default=False, help_text='是否曾经上架过')

    # ── AI 辅助程度 ─────────────────────────────────────
    AI_ASSISTED_CHOICES = [
        ('none', '完全手动'),
        ('ocr', 'AI 识别'),
        ('optimize', 'AI 优化'),
        ('both', 'AI 生成'),
    ]
    ai_assisted = models.CharField(
        max_length=20,
        choices=AI_ASSISTED_CHOICES,
        default='none',
        help_text='AI 辅助程度'
    )

    review_status = models.CharField(
        max_length=20,
        choices=REVIEW_STATUS_CHOICES,
        default='draft',
        db_index=True,
    )
    review_note = models.CharField(max_length=500, blank=True, default='')
    review_submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_submit_count = models.PositiveIntegerField(default=0)
    review_reject_count = models.PositiveIntegerField(default=0)
    review_submitted_by = models.ForeignKey(
        'auth.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_reviews',
    )
    reviewed_by = models.ForeignKey(
        'auth.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='approved_reviews',
    )
    emergency_override_at = models.DateTimeField(null=True, blank=True)
    emergency_override_reason = models.CharField(max_length=500, blank=True, default='')
    emergency_override_by = models.ForeignKey(
        'auth.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='emergency_published_reviews',
    )

    # ── 时间戳 ────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Master SKU'
        verbose_name_plural = 'Master SKUs'
        indexes = [
            models.Index(fields=['master_code']),
            models.Index(fields=['legacy_code']),
            models.Index(fields=['region', 'is_active']),
        ]

    def __str__(self):
        return f"{self.master_code} - {self.title_en}"

    def clean(self):
        super().clean()
        if self.selling_price and self.regular_price:
            if self.selling_price > self.regular_price:
                raise ValidationError(
                    "售价(selling_price)不能高于原价(regular_price)"
                )

    # ── 计算属性（依赖 OMS 的 SupplierSKU） ─────────────
    @property
    def availability(self) -> str:
        """
        聚合计算商品可售状态
        Returns: 'available' | 'low_stock' | 'unavailable'
        注意：supplier_skus 反向关系来自 pim.SupplierSKU
        """
        if not self.is_active:
            return 'unavailable'

        supplier_skus = self.supplier_skus.filter(
            supplier__is_active=True,
            supplier__circuit_breaker=False,
        )

        in_stock = supplier_skus.filter(stock_status='in_stock')

        if not in_stock.exists():
            return 'unavailable'

        primary_has_stock = in_stock.filter(supplier__priority=1).exists()
        if not primary_has_stock:
            return 'low_stock'

        return 'available'

    @property
    def best_cost_price(self):
        """当前最优可用供应商的成本价（分销商可见）"""
        best = self.supplier_skus.filter(
            supplier__is_active=True,
            supplier__circuit_breaker=False,
            stock_status='in_stock',
        ).order_by('supplier__priority').first()
        return best.cost_price if best else None


# ---------------------------------------------------------------------------
# 供应商
# ---------------------------------------------------------------------------

class Supplier(models.Model):
    name             = models.CharField(max_length=100)
    code_prefix      = models.CharField(max_length=20)
    settlement_cycle = models.CharField(max_length=200, blank=True, default='')
    is_active        = models.BooleanField(default=True)
    circuit_breaker  = models.BooleanField(default=False)
    priority         = models.IntegerField(default=10, help_text='Lower number = higher priority')
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority']

    def __str__(self):
        suffix = ' [CIRCUIT BREAK]' if self.circuit_breaker else ''
        return f"{self.name}{suffix}"


class SupplierSKU(models.Model):
    STOCK_CHOICES = [
        ('in_stock',     'In Stock'),
        ('out_of_stock', 'Out of Stock'),
    ]

    supplier      = models.ForeignKey(Supplier,   on_delete=models.CASCADE, related_name='supplier_skus')
    master_sku    = models.ForeignKey(MasterSKU,  on_delete=models.CASCADE, related_name='supplier_skus')
    supplier_code = models.CharField(max_length=100)
    cost_price    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_status  = models.CharField(max_length=20, choices=STOCK_CHOICES, default='in_stock')
    last_stock_check = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('supplier', 'master_sku')
        verbose_name = 'Supplier SKU'

    def __str__(self):
        return f"{self.supplier.name}:{self.supplier_code} -> {self.master_sku.master_code}"


# ---------------------------------------------------------------------------
# 价格变更审计日志
# ---------------------------------------------------------------------------

class PriceAuditLog(models.Model):
    master_sku    = models.ForeignKey(MasterSKU, on_delete=models.CASCADE, related_name='price_logs')
    changed_by    = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    field_name    = models.CharField(max_length=50)          # 'selling_price' / 'regular_price'
    old_value     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    new_value     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    changed_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.master_sku.master_code} {self.field_name}: {self.old_value} → {self.new_value}"


class ImportBatch(models.Model):
    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('partial_failed', 'Partial Failed'),
    ]

    source_filename = models.CharField(max_length=255, blank=True, default='')
    total_rows = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    created_by = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ImportBatch#{self.id} {self.status} s={self.success_count} f={self.failed_count}"


class ImportBatchRow(models.Model):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('fixed', 'Fixed'),
    ]

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='rows')
    line_no = models.PositiveIntegerField()
    master_code = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='success')
    reason = models.CharField(max_length=500, blank=True, default='')
    row_data = models.JSONField(default=dict, blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['line_no']

    def __str__(self):
        return f"Batch#{self.batch_id} L{self.line_no} {self.status}"


class ImportBatchWorkorder(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]

    batch = models.OneToOneField(ImportBatch, on_delete=models.CASCADE, related_name='workorder')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True, default='')
    external_ticket_id = models.CharField(max_length=100, blank=True, default='')
    created_by = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Workorder#{self.id} batch={self.batch_id} {self.status}"


class ImportBatchAlert(models.Model):
    CHANNEL_CHOICES = [
        ('message', 'Message'),
        ('email', 'Email'),
    ]
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='alerts')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    recipient = models.CharField(max_length=255, blank=True, default='')
    detail = models.TextField(blank=True, default='')
    created_by = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Alert#{self.id} batch={self.batch_id} {self.channel} {self.status}"


# ---------------------------------------------------------------------------
# AI 配置（全局单例）
# ---------------------------------------------------------------------------

class AIConfig(models.Model):
    """全局 AI 配置（单例模式）"""

    MODEL_CHOICES = [
        ('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (快/便宜)'),
        ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (平衡)'),
        ('claude-3-opus-20240229', 'Claude 3 Opus (最强/贵)'),
    ]

    # 功能开关
    ocr_enabled = models.BooleanField(default=True, verbose_name='OCR 功能')
    copywriting_enabled = models.BooleanField(default=True, verbose_name='文案优化')
    review_assistant_enabled = models.BooleanField(default=True, verbose_name='审核助手')

    # 模型配置
    primary_model = models.CharField(
        max_length=50,
        choices=MODEL_CHOICES,
        default='claude-3-5-haiku-20241022',
        verbose_name='主模型'
    )
    fallback_model = models.CharField(
        max_length=50,
        choices=MODEL_CHOICES,
        default='claude-3-5-haiku-20241022',
        verbose_name='降级模型'
    )

    # 降级策略
    enable_fallback = models.BooleanField(default=True, verbose_name='启用降级')
    max_retries = models.IntegerField(default=2, verbose_name='最大重试次数')
    timeout_seconds = models.IntegerField(default=30, verbose_name='超时时间 (秒)')

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'AI 配置'
        verbose_name_plural = 'AI 配置'

    def __str__(self):
        return f"AIConfig (updated: {self.updated_at})"

    @classmethod
    def get_config(cls):
        """获取单例配置（缓存友好）"""
        config, _ = cls.objects.get_or_create(id=1)
        return config


# ---------------------------------------------------------------------------
# 脏词字典（S2-W3-3）
# ---------------------------------------------------------------------------

class BannedWord(models.Model):
    """脏词/敏感词字典，用于商品录入和字典治理的拦截验证"""

    word = models.CharField(max_length=100, unique=True, verbose_name='脏词内容')
    category = models.CharField(
        max_length=50,
        choices=[
            ('profanity', 'Profanity/脏话'),
            ('fraud', 'Fraud/诈骗'),
            ('contraband', 'Contraband/违禁品'),
            ('adult', 'Adult/成人内容'),
            ('political', 'Political/敏感政治'),
            ('other', 'Other/其他'),
        ],
        default='other',
        verbose_name='脏词分类'
    )
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['word']
        verbose_name = 'Banned Word'
        verbose_name_plural = 'Banned Words'

    def __str__(self):
        return f"[{self.category}] {self.word}"

    @classmethod
    def check_contains_banned_words(cls, text: str) -> list:
        """检查文本是否包含脏词，返回匹配的脏词列表"""
        if not text:
            return []
        normalized = text.lower().strip()
        banned_words = cls.objects.filter(is_active=True)
        matched = []
        for bw in banned_words:
            if bw.word.lower() in normalized:
                matched.append(bw.word)
        return matched
