from django.contrib import admin

from .models import (
    Brand,
    Category,
    ImportBatchAlert,
    ImportBatch,
    ImportBatchRow,
    ImportBatchWorkorder,
    MasterCodeSequence,
    MasterSKU,
    OperationalTag,
    PriceAuditLog,
    Supplier,
    SupplierSKU,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name_en', 'name_zh', 'is_active']
    list_editable = ['is_active']
    ordering = ['code']


@admin.register(OperationalTag)
class OperationalTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']
    list_editable = ['is_active']


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']
    list_editable = ['is_active']
    ordering = ['name']


@admin.register(MasterCodeSequence)
class MasterCodeSequenceAdmin(admin.ModelAdmin):
    list_display = ['region', 'category_code', 'last_sequence']
    readonly_fields = ['last_sequence']


class SupplierSKUInline(admin.TabularInline):
    model = SupplierSKU
    extra = 0


@admin.register(MasterSKU)
class MasterSKUAdmin(admin.ModelAdmin):
    list_display  = ['master_code', 'legacy_code', 'title_en', 'primary_category', 'region',
                     'selling_price', 'regular_price', 'is_active', 'is_featured', 'updated_at']
    list_filter   = ['is_active', 'is_featured', 'region', 'primary_category']
    search_fields = ['master_code', 'legacy_code', 'title_en', 'title_ar']
    inlines       = [SupplierSKUInline]
    readonly_fields = ['master_code', 'created_at', 'updated_at']
    filter_horizontal = ['categories', 'operational_tags']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display  = ['name', 'code_prefix', 'priority', 'is_active', 'circuit_breaker']
    list_editable = ['is_active', 'circuit_breaker', 'priority']


@admin.register(SupplierSKU)
class SupplierSKUAdmin(admin.ModelAdmin):
    list_display = ['supplier', 'master_sku', 'supplier_code', 'cost_price', 'stock_status']
    list_filter  = ['supplier', 'stock_status']


@admin.register(PriceAuditLog)
class PriceAuditLogAdmin(admin.ModelAdmin):
    list_display = ['master_sku', 'field_name', 'old_value', 'new_value', 'changed_at']
    list_filter  = ['field_name']
    readonly_fields = ['master_sku', 'field_name', 'old_value', 'new_value', 'changed_at', 'changed_by']


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'source_filename', 'total_rows', 'success_count', 'failed_count', 'status', 'created_at']
    list_filter = ['status']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ImportBatchRow)
class ImportBatchRowAdmin(admin.ModelAdmin):
    list_display = ['id', 'batch', 'line_no', 'master_code', 'status', 'retry_count', 'last_retry_at']
    list_filter = ['status']


@admin.register(ImportBatchWorkorder)
class ImportBatchWorkorderAdmin(admin.ModelAdmin):
    list_display = ['id', 'batch', 'status', 'external_ticket_id', 'created_at']
    list_filter = ['status']
    search_fields = ['external_ticket_id', 'title']


@admin.register(ImportBatchAlert)
class ImportBatchAlertAdmin(admin.ModelAdmin):
    list_display = ['id', 'batch', 'channel', 'status', 'recipient', 'created_at']
    list_filter = ['channel', 'status']
    search_fields = ['recipient', 'detail']
