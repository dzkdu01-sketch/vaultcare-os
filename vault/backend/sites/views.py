from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from .models import Distributor, SiteEnvironment, DistributorSelection
from .serializers import DistributorSerializer, SiteEnvironmentSerializer, DistributorSelectionSerializer
from pim.models import MasterSKU
from wp_sync.models import WPSite, WPProductMapping
from wp_sync.services import WooCommerceClient


class DistributorViewSet(viewsets.ModelViewSet):
    queryset = Distributor.objects.select_related('site_environment').all()
    serializer_class = DistributorSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['type', 'is_active']

    @action(detail=True, methods=['get'])
    def selections(self, request, pk=None):
        distributor = self.get_object()
        selections = DistributorSelection.objects.filter(
            distributor=distributor
        ).select_related('master_sku')
        serializer = DistributorSelectionSerializer(selections, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def site_selection_status(self, request, pk=None):
        distributor = self.get_object()
        master_sku_id = request.query_params.get('master_sku_id')
        if not master_sku_id:
            raise ValidationError({'master_sku_id': 'master_sku_id is required.'})

        is_selected = DistributorSelection.objects.filter(
            distributor=distributor,
            master_sku_id=master_sku_id,
        ).exists()

        mappings = {
            m.wp_site_id: m
            for m in WPProductMapping.objects.select_related('wp_site').filter(
                master_sku_id=master_sku_id,
                wp_site__distributor=distributor,
            )
        }
        sites = WPSite.objects.filter(distributor=distributor).order_by('id')
        site_items = []
        for site in sites:
            mapping = mappings.get(site.id)
            site_items.append({
                'site_id': site.id,
                'site_url': site.site_url,
                'site_active': site.is_active,
                'selected': is_selected,
                'mapping_exists': bool(mapping),
                'sync_status': mapping.sync_status if mapping else 'not_created',
                'last_synced_at': mapping.last_synced_at if mapping else None,
                'sync_error': mapping.sync_error if mapping else '',
            })

        return Response({
            'distributor_id': distributor.id,
            'distributor_name': distributor.name,
            'master_sku_id': int(master_sku_id),
            'selected': is_selected,
            'sites': site_items,
        })

    @action(detail=True, methods=['post'])
    def site_operation(self, request, pk=None):
        if not request.user.is_staff:
            raise PermissionDenied('仅审核员可执行站点发布操作')

        distributor = self.get_object()
        master_sku_id = request.data.get('master_sku_id')
        site_id = request.data.get('site_id')
        action_name = request.data.get('action')
        simulate_success_raw = request.data.get('simulate_success', False)
        simulate_success = str(simulate_success_raw).lower() in ('1', 'true', 'yes', 'on')

        if not master_sku_id:
            raise ValidationError({'master_sku_id': 'master_sku_id is required.'})
        if not site_id:
            raise ValidationError({'site_id': 'site_id is required.'})
        if action_name not in ('publish', 'revoke', 'retry_sync'):
            raise ValidationError({'action': 'action must be publish/revoke/retry_sync.'})

        try:
            sku = MasterSKU.objects.get(pk=master_sku_id)
        except MasterSKU.DoesNotExist:
            return Response({'detail': '商品不存在'}, status=status.HTTP_404_NOT_FOUND)

        if action_name == 'publish' and sku.review_status != 'publishable':
            return Response(
                {'detail': '当前状态不可发布到站点，请先通过审核'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_selected = DistributorSelection.objects.filter(
            distributor=distributor,
            master_sku=sku,
        ).exists()
        if not is_selected:
            return Response({'detail': '该商品未被选入当前分销商'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            site = WPSite.objects.get(pk=site_id, distributor=distributor)
        except WPSite.DoesNotExist:
            return Response({'detail': '站点不存在或不属于当前分销商'}, status=status.HTTP_404_NOT_FOUND)
        if not site.is_active:
            return Response({'detail': '站点未启用，无法执行操作'}, status=status.HTTP_400_BAD_REQUEST)

        mapping = WPProductMapping.objects.filter(master_sku=sku, wp_site=site).first()
        if not mapping and action_name in ('revoke', 'retry_sync'):
            return Response({'detail': '尚未创建映射，无法执行该操作'}, status=status.HTTP_400_BAD_REQUEST)

        if not mapping:
            mapping = WPProductMapping.objects.create(
                master_sku=sku,
                wp_site=site,
                sync_status='pending',
            )

        target_status = 'publish'
        if action_name == 'revoke':
            target_status = 'draft'
        elif action_name == 'retry_sync' and mapping.sync_status == 'draft':
            target_status = 'draft'

        mapping.sync_status = 'syncing'
        mapping.save(update_fields=['sync_status'])
        if settings.DEBUG and simulate_success:
            mapping.sync_status = 'synced' if target_status == 'publish' else 'draft'
            mapping.sync_error = ''
            mapping.last_synced_at = timezone.now()
            mapping.save(update_fields=['wp_product_id', 'wp_sku', 'sync_status', 'sync_error', 'last_synced_at'])
            return Response({
                'detail': '操作成功（测试通道）',
                'action': action_name,
                'target_status': target_status,
                'site_id': site.id,
                'site_url': site.site_url,
                'sync_status': mapping.sync_status,
                'last_synced_at': mapping.last_synced_at,
            })

        client = WooCommerceClient(site)

        try:
            if mapping.wp_product_id:
                client.update_product(mapping.wp_product_id, {'status': target_status})
            elif target_status == 'publish':
                result = client.create_product({
                    'name': sku.title_en,
                    'sku': sku.master_code,
                    'regular_price': str(sku.selling_price),
                    'description': sku.description,
                    'short_description': sku.short_description,
                    'status': target_status,
                })
                mapping.wp_product_id = result.get('id')
                mapping.wp_sku = result.get('sku', sku.master_code)
            else:
                return Response({'detail': '无 WP 商品映射，无法撤销发布'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            mapping.sync_status = 'failed'
            mapping.sync_error = str(exc)
            mapping.save(update_fields=['sync_status', 'sync_error'])
            return Response(
                {'detail': f'站点操作失败: {exc}', 'sync_status': mapping.sync_status},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        mapping.sync_status = 'synced' if target_status == 'publish' else 'draft'
        mapping.sync_error = ''
        mapping.last_synced_at = timezone.now()
        mapping.save(update_fields=['wp_product_id', 'wp_sku', 'sync_status', 'sync_error', 'last_synced_at'])

        return Response({
            'detail': '操作成功',
            'action': action_name,
            'target_status': target_status,
            'site_id': site.id,
            'site_url': site.site_url,
            'sync_status': mapping.sync_status,
            'last_synced_at': mapping.last_synced_at,
        })


class SiteEnvironmentViewSet(viewsets.ModelViewSet):
    queryset = SiteEnvironment.objects.select_related('distributor').all()
    serializer_class = SiteEnvironmentSerializer


class DistributorSelectionViewSet(viewsets.ModelViewSet):
    queryset = DistributorSelection.objects.select_related('distributor', 'master_sku').all()
    serializer_class = DistributorSelectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['distributor']

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        distributor_ids = request.data.get('distributor_ids', [])
        master_sku_id = request.data.get('master_sku_id')
        if not isinstance(distributor_ids, list) or not distributor_ids:
            raise ValidationError({'distributor_ids': 'distributor_ids must be a non-empty array.'})
        if not master_sku_id:
            raise ValidationError({'master_sku_id': 'master_sku_id is required.'})

        created = []
        existing = []
        for distributor_id in distributor_ids:
            obj, is_created = DistributorSelection.objects.get_or_create(
                distributor_id=distributor_id,
                master_sku_id=master_sku_id,
            )
            target = created if is_created else existing
            target.append({
                'id': obj.id,
                'distributor_id': obj.distributor_id,
                'master_sku_id': obj.master_sku_id,
            })

        return Response(
            {
                'created_count': len(created),
                'existing_count': len(existing),
                'created': created,
                'existing': existing,
            },
            status=status.HTTP_200_OK,
        )
