from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'distributor', 'customer_name', 'total_amount', 'status', 'routed_supplier', 'profit', 'created_at']
    list_filter = ['status', 'distributor', 'routed_supplier', 'source']
    search_fields = ['order_number', 'customer_name', 'customer_phone']
    inlines = [OrderItemInline]
    readonly_fields = ['order_number', 'profit']
