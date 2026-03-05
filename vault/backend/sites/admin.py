from django.contrib import admin
from .models import Distributor, SiteEnvironment, DistributorSelection


class SiteEnvironmentInline(admin.StackedInline):
    model = SiteEnvironment
    extra = 0


@admin.register(Distributor)
class DistributorAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'is_active', 'user']
    list_filter = ['type', 'is_active']
    inlines = [SiteEnvironmentInline]


@admin.register(DistributorSelection)
class DistributorSelectionAdmin(admin.ModelAdmin):
    list_display = ['distributor', 'master_sku']
    list_filter = ['distributor']
