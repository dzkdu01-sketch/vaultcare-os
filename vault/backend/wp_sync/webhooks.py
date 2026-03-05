from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from oms.models import Order, OrderItem
from pim.models import MasterSKU
from .models import WPSite


class WooCommerceWebhookView(APIView):
    """Receive new order webhooks from WooCommerce sites."""
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data

        source_url = request.headers.get('X-WC-Webhook-Source', '')
        wp_site = WPSite.objects.filter(site_url__icontains=source_url.replace('https://', '').replace('http://', '').rstrip('/')).first()

        if not wp_site:
            return Response({'error': 'Unknown source'}, status=status.HTTP_400_BAD_REQUEST)

        billing = data.get('billing', {})
        shipping = data.get('shipping', {})

        order = Order.objects.create(
            distributor=wp_site.distributor,
            source='website',
            customer_name=f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip(),
            customer_phone=billing.get('phone', ''),
            customer_address=f"{shipping.get('address_1', '')} {shipping.get('address_2', '')}".strip(),
            city=shipping.get('city', ''),
            total_amount=data.get('total', 0),
            notes=f"WC Order #{data.get('id', 'unknown')}",
        )

        for line in data.get('line_items', []):
            sku_code = line.get('sku', '')
            master_sku = MasterSKU.objects.filter(master_code=sku_code).first()
            if master_sku:
                OrderItem.objects.create(
                    order=order,
                    master_sku=master_sku,
                    quantity=line.get('quantity', 1),
                    unit_price=line.get('price', 0),
                )

        from oms.routing import route_order
        route_order(order)

        return Response({'order_number': order.order_number}, status=status.HTTP_201_CREATED)
