from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Order, OrderItem
from .serializers import OrderSerializer, QuickEntrySerializer, OrderItemSerializer
from .routing import route_order
from pim.models import MasterSKU
from sites.models import Distributor


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('distributor', 'routed_supplier').prefetch_related('items__master_sku').all()
    serializer_class = OrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'distributor', 'routed_supplier', 'source']
    search_fields = ['order_number', 'customer_name', 'customer_phone']
    ordering_fields = ['created_at', 'total_amount']

    @action(detail=True, methods=['post'])
    def route(self, request, pk=None):
        order = self.get_object()
        result = route_order(order)
        return Response({
            'routed_supplier': result.routed_supplier.name if result.routed_supplier else None,
            'needs_split': result.needs_split,
            'items_routing': result.items_routing,
            'errors': result.errors,
            'profit': float(order.profit),
        })

    @action(detail=False, methods=['post'], url_path='quick-entry')
    def quick_entry(self, request):
        serializer = QuickEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            distributor = Distributor.objects.get(id=data['distributor_id'])
        except Distributor.DoesNotExist:
            return Response({'error': 'Distributor not found'}, status=status.HTTP_404_NOT_FOUND)

        order = Order.objects.create(
            distributor=distributor,
            source=data['source'],
            customer_name=data['customer_name'],
            customer_phone=data['customer_phone'],
            customer_address=data['customer_address'],
            city=data['city'],
            notes=data.get('notes', ''),
        )

        total = 0
        for item_data in data['items']:
            try:
                sku = MasterSKU.objects.get(id=item_data.get('sku_id'))
            except MasterSKU.DoesNotExist:
                continue
            qty = item_data.get('quantity', 1)
            price = item_data.get('unit_price', sku.selling_price)
            OrderItem.objects.create(
                order=order,
                master_sku=sku,
                quantity=qty,
                unit_price=price,
            )
            total += price * qty

        order.total_amount = total
        order.save(update_fields=['total_amount'])

        result = route_order(order)

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )


class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.select_related('order', 'master_sku').all()
    serializer_class = OrderItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order']
