from decimal import Decimal

from rest_framework import serializers

from .models import (
    AIConfig,
    BannedWord,
    Brand,
    Category,
    MasterCodeSequence,
    MasterSKU,
    OperationalTag,
    PriceAuditLog,
    Supplier,
    SupplierSKU,
    generate_master_code,
)


def validate_dictionary_text(value: str, field_label: str) -> str:
    """验证文本是否包含脏词（从数据库动态读取）"""
    text = str(value or '').strip()
    if not text:
        return value
    matched_words = BannedWord.check_contains_banned_words(text)
    if matched_words:
        raise serializers.ValidationError(
            f'{field_label}包含禁用词：{", ".join(matched_words)}，请修改后重试'
        )
    return value


# ---------------------------------------------------------------------------
# 辅助模型 Serializer
# ---------------------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    def validate_name_en(self, value):
        return validate_dictionary_text(value, '英文名')

    def validate_name_zh(self, value):
        return validate_dictionary_text(value, '中文名')

    class Meta:
        model = Category
        fields = ['id', 'code', 'name_en', 'name_zh', 'is_active']


class OperationalTagSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        return validate_dictionary_text(value, '标签名')

    class Meta:
        model = OperationalTag
        fields = ['id', 'name', 'is_active']


class BrandSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        return validate_dictionary_text(value, '品牌名')

    class Meta:
        model = Brand
        fields = ['id', 'name', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class SupplierSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        return validate_dictionary_text(value, '供应商名称')

    def validate_settlement_cycle(self, value):
        return validate_dictionary_text(value, '结算周期说明')

    class Meta:
        model = Supplier
        fields = '__all__'


class SupplierSKUSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierSKU
        fields = '__all__'


# ---------------------------------------------------------------------------
# MasterSKU Serializer（详情 / 创建 / 更新）
# ---------------------------------------------------------------------------

class MasterSKUSerializer(serializers.ModelSerializer):
    supplier_skus         = SupplierSKUSerializer(many=True, read_only=True)
    primary_category_info = CategorySerializer(source='primary_category', read_only=True)
    primary_category_name = serializers.CharField(
        source='primary_category.name_en', read_only=True, default=''
    )
    operational_tag_names = serializers.SerializerMethodField()
    availability          = serializers.SerializerMethodField()
    best_cost_price       = serializers.SerializerMethodField()
    # 写入时接受 operational_tags id 列表
    operational_tag_ids   = serializers.PrimaryKeyRelatedField(
        source='operational_tags',
        queryset=OperationalTag.objects.all(),
        many=True,
        required=False,
    )
    category_ids = serializers.PrimaryKeyRelatedField(
        source='categories',
        queryset=Category.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = MasterSKU
        fields = [
            'id', 'master_code', 'legacy_code', 'region',
            'primary_category', 'primary_category_info', 'primary_category_name',
            'category', 'category_ids', 'categories',
            'title_en', 'title_ar', 'title_th', 'short_description', 'description',
            'image_urls', 'video_urls',
            'regular_price', 'selling_price',
            'audience_tags', 'operational_tags', 'operational_tag_ids', 'operational_tag_names',
            'is_featured', 'is_active', 'review_status', 'review_note',
            'emergency_override_at', 'emergency_override_reason',
            'ai_assisted',
            'availability', 'best_cost_price',
            'supplier_skus',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'master_code', 'created_at', 'updated_at',
            'review_status', 'review_note',
            'emergency_override_at', 'emergency_override_reason',
        ]

    def get_operational_tag_names(self, obj):
        return list(obj.operational_tags.values_list('name', flat=True))

    def get_availability(self, obj):
        return obj.availability

    def get_best_cost_price(self, obj):
        val = obj.best_cost_price
        return str(val) if val is not None else None

    def create(self, validated_data):
        """自动生成 master_code"""
        operational_tags = validated_data.pop('operational_tags', [])
        categories       = validated_data.pop('categories', [])

        region = validated_data.get('region', 'u')
        primary_cat = validated_data.get('primary_category')
        category_code = primary_cat.code if primary_cat else '9'

        validated_data['master_code'] = generate_master_code(region, category_code)

        sku = MasterSKU.objects.create(**validated_data)
        sku.operational_tags.set(operational_tags)
        sku.categories.set(categories)
        return sku

    def update(self, instance, validated_data):
        operational_tags = validated_data.pop('operational_tags', None)
        categories       = validated_data.pop('categories', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if operational_tags is not None:
            instance.operational_tags.set(operational_tags)
        if categories is not None:
            instance.categories.set(categories)
        return instance


# ---------------------------------------------------------------------------
# MasterSKU 列表 Serializer（轻量，用于 list action）
# ---------------------------------------------------------------------------

class MasterSKUListSerializer(serializers.ModelSerializer):
    primary_category_name = serializers.CharField(
        source='primary_category.name_en', read_only=True, default=''
    )
    availability    = serializers.SerializerMethodField()
    best_cost_price = serializers.SerializerMethodField()

    class Meta:
        model = MasterSKU
        fields = [
            'id', 'master_code', 'legacy_code', 'region',
            'primary_category', 'primary_category_name', 'category',
            'title_en', 'title_ar', 'title_th', 'short_description',
            'regular_price', 'selling_price',
            'is_active', 'is_featured', 'review_status',
            'audience_tags',
            'ai_assisted',
            'availability', 'best_cost_price',
            'image_urls',
            'updated_at',
        ]

    def get_availability(self, obj):
        return obj.availability

    def get_best_cost_price(self, obj):
        val = obj.best_cost_price
        return str(val) if val is not None else None


# ---------------------------------------------------------------------------
# 价格审计日志
# ---------------------------------------------------------------------------

class PriceAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True, default='system')

    class Meta:
        model = PriceAuditLog
        fields = ['id', 'master_sku', 'changed_by_name', 'field_name', 'old_value', 'new_value', 'changed_at']


# ---------------------------------------------------------------------------
# AI 配置 Serializer
# ---------------------------------------------------------------------------

class AIConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConfig
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


# ---------------------------------------------------------------------------
# 脏词字典 Serializer（S2-W3-3）
# ---------------------------------------------------------------------------

class BannedWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BannedWord
        fields = ['id', 'word', 'category', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
