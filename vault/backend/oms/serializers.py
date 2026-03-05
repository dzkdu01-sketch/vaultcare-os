from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source='master_sku.master_code', read_only=True)
    sku_title = serializers.CharField(source='master_sku.title_en', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    distributor_name = serializers.CharField(source='distributor.name', read_only=True)
    supplier_name = serializers.CharField(source='routed_supplier.name', read_only=True, default=None)

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ['order_number', 'profit']


class QuickEntrySerializer(serializers.Serializer):
    distributor_id = serializers.IntegerField()
    customer_name = serializers.CharField(max_length=200)
    customer_phone = serializers.CharField(max_length=50)
    customer_address = serializers.CharField()
    city = serializers.CharField(max_length=100)
    source = serializers.ChoiceField(choices=['website', 'whatsapp', 'manual'], default='whatsapp')
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
    )
    notes = serializers.CharField(required=False, default='')
