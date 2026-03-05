from django.contrib import admin
from .models import WPSite, WPProductMapping


@admin.register(WPSite)
class WPSiteAdmin(admin.ModelAdmin):
    list_display = ['site_url', 'distributor', 'is_active', 'last_sync']
    list_filter = ['is_active']


@admin.register(WPProductMapping)
class WPProductMappingAdmin(admin.ModelAdmin):
    list_display = ['master_sku', 'wp_site', 'wp_product_id', 'wp_sku', 'sync_status', 'last_synced_at']
    list_filter = ['sync_status', 'wp_site']
    search_fields = ['master_sku__master_code', 'wp_sku']
    readonly_fields = ['last_synced_at', 'sync_error']
