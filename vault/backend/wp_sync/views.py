from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import WPSite
from .serializers import WPSiteSerializer
from .services import push_sku_to_wp, sync_stock_status
from pim.models import MasterSKU
from sites.models import DistributorSelection


class WPSiteViewSet(viewsets.ModelViewSet):
    queryset = WPSite.objects.select_related('distributor').all()
    serializer_class = WPSiteSerializer


@api_view(['POST'])
def push_sku_view(request, sku_id):
    """Push a specific SKU to all related WP sites."""
    try:
        sku = MasterSKU.objects.get(id=sku_id)
    except MasterSKU.DoesNotExist:
        return Response({'error': 'SKU not found'}, status=status.HTTP_404_NOT_FOUND)

    results = sync_stock_status(sku)
    return Response({'sku': sku.master_code, 'results': results})
