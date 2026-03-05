import csv
import io
import json
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from statistics import median

from django.core.mail import send_mail
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated

from .models import (
    AIConfig,
    BannedWord,
    Brand,
    Category,
    ImportBatch,
    ImportBatchAlert,
    ImportBatchRow,
    ImportBatchWorkorder,
    MasterSKU,
    OperationalTag,
    PriceAuditLog,
    Supplier,
    SupplierSKU,
)
from .permissions import DictionaryViewPermission
from .serializers import (
    AIConfigSerializer,
    BannedWordSerializer,
    BrandSerializer,
    CategorySerializer,
    MasterSKUListSerializer,
    MasterSKUSerializer,
    OperationalTagSerializer,
    PriceAuditLogSerializer,
    SupplierSerializer,
    SupplierSKUSerializer,
)


def _parse_replacement_id(request):
    replacement_id = request.data.get('replacement_id')
    if replacement_id in (None, ''):
        raise ValidationError({'replacement_id': 'replacement_id 不能为空'})
    try:
        return int(replacement_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError({'replacement_id': 'replacement_id 必须为数字'}) from exc


class CategoryViewSet(viewsets.ModelViewSet):
    """品类字典（管理端可维护）"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, DictionaryViewPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name_en', 'name_zh']
    ordering_fields = ['code', 'name_en', 'id']
    ordering = ['code']

    def get_queryset(self):
        qs = super().get_queryset()
        include_inactive = self.request.query_params.get('include_inactive')
        if include_inactive in ('1', 'true', 'True'):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=['post'], url_path='deactivate-with-replacement')
    def deactivate_with_replacement(self, request, pk=None):
        category = self.get_object()
        replacement_id = _parse_replacement_id(request)
        if replacement_id == category.id:
            raise ValidationError({'replacement_id': '替代项不能与当前项相同'})

        replacement = Category.objects.filter(id=replacement_id, is_active=True).first()
        if not replacement:
            raise ValidationError({'replacement_id': '替代分类不存在或已停用'})

        with transaction.atomic():
            primary_affected = MasterSKU.objects.filter(primary_category=category).update(
                primary_category=replacement
            )
            many_to_many_affected = 0
            for sku in MasterSKU.objects.filter(categories=category).distinct():
                if not sku.categories.filter(id=replacement.id).exists():
                    sku.categories.add(replacement)
                sku.categories.remove(category)
                many_to_many_affected += 1
            category.is_active = False
            category.save(update_fields=['is_active'])

        return Response({
            'detail': '分类已停用并完成替代映射',
            'primary_affected': primary_affected,
            'many_to_many_affected': many_to_many_affected,
            'replacement_id': replacement.id,
        })


class OperationalTagViewSet(viewsets.ModelViewSet):
    """运营标签字典（管理端可维护）"""
    queryset = OperationalTag.objects.all()
    serializer_class = OperationalTagSerializer
    permission_classes = [IsAuthenticated, DictionaryViewPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'id']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        include_inactive = self.request.query_params.get('include_inactive')
        if include_inactive in ('1', 'true', 'True'):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=['post'], url_path='deactivate-with-replacement')
    def deactivate_with_replacement(self, request, pk=None):
        tag = self.get_object()
        replacement_id = _parse_replacement_id(request)
        if replacement_id == tag.id:
            raise ValidationError({'replacement_id': '替代项不能与当前项相同'})

        replacement = OperationalTag.objects.filter(id=replacement_id, is_active=True).first()
        if not replacement:
            raise ValidationError({'replacement_id': '替代标签不存在或已停用'})

        with transaction.atomic():
            affected = 0
            for sku in MasterSKU.objects.filter(operational_tags=tag).distinct():
                if not sku.operational_tags.filter(id=replacement.id).exists():
                    sku.operational_tags.add(replacement)
                sku.operational_tags.remove(tag)
                affected += 1
            tag.is_active = False
            tag.save(update_fields=['is_active'])

        return Response({
            'detail': '运营标签已停用并完成替代映射',
            'affected': affected,
            'replacement_id': replacement.id,
        })


class BrandViewSet(viewsets.ModelViewSet):
    """品牌字典（管理端可维护）"""
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated, DictionaryViewPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'id']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        include_inactive = self.request.query_params.get('include_inactive')
        if include_inactive in ('1', 'true', 'True'):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=['post'], url_path='deactivate-with-replacement')
    def deactivate_with_replacement(self, request, pk=None):
        brand = self.get_object()
        replacement_id = _parse_replacement_id(request)
        if replacement_id == brand.id:
            raise ValidationError({'replacement_id': '替代项不能与当前项相同'})

        replacement = Brand.objects.filter(id=replacement_id, is_active=True).first()
        if not replacement:
            raise ValidationError({'replacement_id': '替代品牌不存在或已停用'})

        brand.is_active = False
        brand.save(update_fields=['is_active'])
        return Response({
            'detail': '品牌已停用并记录替代项',
            'affected': 0,
            'replacement_id': replacement.id,
        })


class MasterSKUViewSet(viewsets.ModelViewSet):
    queryset = MasterSKU.objects.select_related('primary_category').prefetch_related(
        'categories', 'operational_tags', 'supplier_skus__supplier'
    ).all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['master_code', 'legacy_code', 'title_en', 'title_ar', 'category']
    filterset_fields = ['is_active', 'is_featured', 'region', 'primary_category', 'review_status']
    ordering_fields  = ['created_at', 'updated_at', 'selling_price', 'regular_price', 'master_code']
    ordering         = ['-updated_at']  # 默认排序，防止分页结果不稳定

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # audience_tags JSONField contains 过滤（Bug-07）
        tags = params.getlist('audience_tags')
        if tags:
            from django.db import connection
            if connection.vendor == 'sqlite':
                # SQLite 不支持 JSONField __contains，用 json_each 实现
                tbl = qs.model._meta.db_table
                for tag in tags:
                    qs = qs.extra(where=[
                        f'EXISTS (SELECT 1 FROM json_each("{tbl}"."audience_tags") WHERE json_each.value = %s)'
                    ], params=[tag])
            else:
                for tag in tags:
                    qs = qs.filter(audience_tags__contains=[tag])

        # 统计条快速过滤（Bug-08）
        if params.get('uncategorized') == 'true':
            qs = qs.filter(primary_category__isnull=True)
        if params.get('missing_title_ar') == 'true':
            qs = qs.filter(Q(title_ar='') | Q(title_ar__isnull=True))
        if params.get('missing_image') == 'true':
            qs = qs.filter(image_urls=[])

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return MasterSKUListSerializer
        return MasterSKUSerializer

    def perform_update(self, serializer):
        instance = serializer.instance
        requested_is_active = serializer.validated_data.get('is_active', instance.is_active)
        is_activation = (not instance.is_active) and requested_is_active
        target_status = serializer.validated_data.get('review_status', instance.review_status)
        if is_activation and target_status != 'publishable':
            raise ValidationError({'detail': '当前状态不可上架，请先通过审核'})
        serializer.save()

    @action(detail=False, methods=['post'], url_path='create-ai-draft')
    def create_ai_draft(self, request):
        """
        POST /api/products/create-ai-draft/

        AI 新品上线专用创建口：
        - 强制保存为草稿（is_active=False）
        - 要求 primary_category 为有效 FK
        - 要求 image_urls 至少 1 张
        """
        payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        primary_category = payload.get('primary_category')
        if primary_category in (None, '', 'null'):
            return Response({'detail': 'primary_category 不能为空'}, status=400)

        image_urls = payload.get('image_urls')
        if not isinstance(image_urls, list) or len(image_urls) == 0:
            return Response({'detail': 'image_urls 至少需要 1 张图片'}, status=400)

        # 兼容 AI 返回的标签名称，避免前端因字符串标签导致保存失败
        allowed_audience_tags = {'for_her', 'for_him', 'for_couples'}
        raw_audience_tags = payload.get('audience_tags', [])
        if isinstance(raw_audience_tags, list):
            payload['audience_tags'] = [
                t for t in raw_audience_tags
                if isinstance(t, str) and t in allowed_audience_tags
            ]
        else:
            payload['audience_tags'] = []

        raw_operational_tags = payload.get('operational_tags', [])
        raw_operational_tag_ids = payload.get('operational_tag_ids', [])
        normalized_tag_ids = []
        normalized_tag_names = []

        if isinstance(raw_operational_tag_ids, list):
            for item in raw_operational_tag_ids:
                if isinstance(item, int):
                    normalized_tag_ids.append(item)
                elif isinstance(item, str) and item.isdigit():
                    normalized_tag_ids.append(int(item))

        if isinstance(raw_operational_tags, list):
            for item in raw_operational_tags:
                if isinstance(item, int):
                    normalized_tag_ids.append(item)
                elif isinstance(item, str):
                    token = item.strip()
                    if token.isdigit():
                        normalized_tag_ids.append(int(token))
                    elif token:
                        normalized_tag_names.append(token)

        if normalized_tag_names:
            normalized_tag_ids.extend(
                list(
                    OperationalTag.objects.filter(name__in=normalized_tag_names)
                    .values_list('id', flat=True)
                )
            )

        payload['operational_tag_ids'] = list(dict.fromkeys(normalized_tag_ids))
        payload.pop('operational_tags', None)

        # 服务端兜底：AI 上线一律先落草稿，避免误上架
        payload['is_active'] = False

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['post'], url_path='create-manual-draft')
    def create_manual_draft(self, request):
        """
        POST /api/products/create-manual-draft/

        手动新增专用创建口：
        - 强制保存为草稿（is_active=False）
        - 其他字段沿用 MasterSKUSerializer 校验逻辑
        """
        payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        payload['is_active'] = False

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def submit_review(self, request, pk=None):
        sku = self.get_object()
        # 允许 draft 和 inactive_delisted 提交审核
        if sku.review_status not in ['draft', 'inactive_delisted']:
            return Response({'detail': '仅草稿/已下架状态可提交审核'}, status=400)

        submit_count = sku.review_submit_count + 1
        sku.review_status = 'pending_review'
        sku.review_note = ''
        sku.review_submitted_at = timezone.now()
        sku.review_submitted_by = request.user
        sku.review_submit_count = submit_count
        sku.save(update_fields=[
            'review_status', 'review_note', 'review_submitted_at',
            'review_submitted_by', 'review_submit_count',
        ])
        return Response({'detail': '已提交审核', 'review_status': sku.review_status})

    @action(detail=True, methods=['post'])
    def approve_review(self, request, pk=None):
        sku = self.get_object()
        if not request.user.is_staff:
            raise PermissionDenied('仅审核员可执行此操作')
        if sku.review_status != 'pending_review':
            return Response({'detail': '仅待审核状态可通过'}, status=400)

        sku.review_status = 'publishable'
        sku.review_note = ''
        sku.reviewed_at = timezone.now()
        sku.reviewed_by = request.user
        sku.save(update_fields=['review_status', 'review_note', 'reviewed_at', 'reviewed_by'])
        return Response({'detail': '审核通过', 'review_status': sku.review_status})

    @action(detail=True, methods=['post'])
    def reject_review(self, request, pk=None):
        sku = self.get_object()
        if not request.user.is_staff:
            raise PermissionDenied('仅审核员可执行此操作')
        if sku.review_status != 'pending_review':
            return Response({'detail': '仅待审核状态可驳回'}, status=400)

        reject_count = sku.review_reject_count + 1
        note = str(request.data.get('review_note', '')).strip()
        sku.review_status = 'draft'
        sku.review_note = note
        sku.reviewed_at = timezone.now()
        sku.reviewed_by = request.user
        sku.review_reject_count = reject_count
        sku.save(update_fields=['review_status', 'review_note', 'reviewed_at', 'reviewed_by', 'review_reject_count'])
        return Response({'detail': '已驳回至草稿', 'review_status': sku.review_status, 'review_note': sku.review_note})

    @action(detail=True, methods=['post'])
    def emergency_publish(self, request, pk=None):
        sku = self.get_object()
        if not request.user.is_superuser:
            raise PermissionDenied('仅老板可执行紧急放行')

        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response({'detail': 'reason 不能为空'}, status=400)

        now = timezone.now()
        sku.review_status = 'publishable'
        sku.is_active = True
        sku.review_note = f"[EMERGENCY] {reason}"
        sku.reviewed_at = now
        sku.reviewed_by = request.user
        sku.emergency_override_at = now
        sku.emergency_override_reason = reason
        sku.emergency_override_by = request.user
        sku.save(update_fields=[
            'review_status', 'is_active', 'review_note',
            'reviewed_at', 'reviewed_by',
            'emergency_override_at', 'emergency_override_reason', 'emergency_override_by',
        ])
        return Response({'detail': '已紧急放行并上架', 'review_status': sku.review_status, 'is_active': sku.is_active})

    @action(detail=True, methods=['post'])
    def delist(self, request, pk=None):
        """主动下架商品（从 publishable 状态）"""
        sku = self.get_object()
        if sku.review_status != 'publishable':
            return Response({'detail': '仅可发布状态可下架'}, status=400)
        if not request.user.is_staff:
            raise PermissionDenied('仅审核员可执行下架操作')

        sku.review_status = 'inactive_delisted'
        sku.ever_published = True
        sku.save(update_fields=['review_status', 'ever_published', 'updated_at'])

        # F7 级联：清除选品 + WP 下架
        from sites.models import DistributorSelection
        DistributorSelection.objects.filter(master_sku=sku).delete()
        from wp_sync.tasks import enqueue_sync_status
        enqueue_sync_status(sku.pk, is_active=False)

        return Response({'detail': '已下架', 'review_status': sku.review_status})

    @action(detail=False, methods=['get'], url_path='review_metrics')
    def review_metrics(self, request):
        approved_qs = MasterSKU.objects.filter(review_status='publishable', review_submitted_at__isnull=False)
        approved_count = approved_qs.count()
        first_pass_approved_count = approved_qs.filter(review_submit_count=1, review_reject_count=0).count()
        first_pass_rate = round((first_pass_approved_count / approved_count) * 100, 1) if approved_count else 0.0
        rework_count = MasterSKU.objects.filter(review_reject_count__gt=0).count()
        emergency_override_count = MasterSKU.objects.filter(emergency_override_at__isnull=False).count()
        pending_review_count = MasterSKU.objects.filter(review_status='pending_review').count()

        return Response({
            'approved_count': approved_count,
            'first_pass_approved_count': first_pass_approved_count,
            'first_pass_rate': first_pass_rate,
            'rework_count': rework_count,
            'emergency_override_count': emergency_override_count,
            'pending_review_count': pending_review_count,
        })

    @action(detail=False, methods=['get'], url_path='phase1_metrics')
    def phase1_metrics(self, request):
        """
        第1阶段业务指标（审核员效率）：
        - review_ready_daily_count: 当天进入可审核（pending_review）的商品数
        - median_hours_to_review_ready: 录入(created_at)到可审核(review_submitted_at)中位小时数
        """
        now = timezone.now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        review_ready_qs = MasterSKU.objects.filter(review_submitted_at__isnull=False)

        review_ready_daily_count = review_ready_qs.filter(review_submitted_at__gte=start_of_day).count()
        review_ready_window_count = review_ready_qs.count()
        review_processed_daily_count = MasterSKU.objects.filter(
            reviewed_at__gte=start_of_day,
            reviewed_by__is_staff=True,
            emergency_override_at__isnull=True,
        ).count()

        hours = []
        for sku in review_ready_qs.only('created_at', 'review_submitted_at'):
            if sku.created_at and sku.review_submitted_at and sku.review_submitted_at >= sku.created_at:
                delta_hours = (sku.review_submitted_at - sku.created_at).total_seconds() / 3600
                hours.append(round(delta_hours, 2))

        median_hours_to_review_ready = round(median(hours), 2) if hours else 0.0
        daily_trend = []
        for days_ago in range(6, -1, -1):
            day_start = (start_of_day - timedelta(days=days_ago))
            day_end = day_start + timedelta(days=1)
            daily_trend.append({
                'date': day_start.date().isoformat(),
                'review_ready_count': review_ready_qs.filter(
                    review_submitted_at__gte=day_start,
                    review_submitted_at__lt=day_end,
                ).count(),
                'review_processed_count': MasterSKU.objects.filter(
                    reviewed_at__gte=day_start,
                    reviewed_at__lt=day_end,
                    reviewed_by__is_staff=True,
                    emergency_override_at__isnull=True,
                ).count(),
            })

        return Response({
            'review_ready_daily_count': review_ready_daily_count,
            'review_ready_window_count': review_ready_window_count,
            'median_hours_to_review_ready': median_hours_to_review_ready,
            'review_processed_daily_count': review_processed_daily_count,
            'daily_trend': daily_trend,
        })

    @action(detail=True, methods=['get'])
    def price_logs(self, request, pk=None):
        sku = self.get_object()
        logs = PriceAuditLog.objects.filter(master_sku=sku)
        serializer = PriceAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """GET /api/products/stats/ — 统计条数据"""
        qs = MasterSKU.objects.all()
        data = {
            'total': qs.count(),
            'active': qs.filter(is_active=True).count(),
            'inactive': qs.filter(is_active=False).count(),
            'uncategorized': qs.filter(primary_category__isnull=True).count(),
            'missing_title_ar': qs.filter(Q(title_ar='') | Q(title_ar__isnull=True)).count(),
            'missing_image': qs.filter(image_urls=[]).count(),
            'missing_short_desc': qs.filter(Q(short_description='') | Q(short_description__isnull=True)).count(),
        }
        return Response(data)

    @action(detail=False, methods=['post'], url_path='bulk-action')
    def bulk_action(self, request):
        """POST /api/products/bulk-action/

        Body A（按 ID）: { ids: [1,2,3], action: "activate"|"deactivate"|"delete"|"set_category"|"set_region", params: {...} }
        Body B（按筛选）: { filter: {search, is_active, ...}, action: ..., params: {...} }

        权限控制：批量修改操作仅限审核员 (is_staff) 或超级管理员 (is_superuser)
        """
        # S2-W3-7 批量管理升级：添加权限控制
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': '批量修改操作仅限审核员或超级管理员'},
                status=status.HTTP_403_FORBIDDEN
            )

        act  = request.data.get('action')
        ids  = request.data.get('ids')
        flt  = request.data.get('filter')
        params = request.data.get('params', {})

        # S2-W3-7 批量管理升级：新增 set_supplier, set_price, set_sales_region
        allowed_actions = {
            'activate',
            'deactivate',
            'delete',
            'set_category',
            'set_region',
            'submit_review',
            'add_audience_tags',
            'remove_audience_tags',
            'add_operational_tags',
            'remove_operational_tags',
            # S2-W3-7 批量管理升级新增
            'set_supplier',
            'set_price',
            'set_sales_region',
        }
        if act not in allowed_actions:
            return Response({'detail': f'未知操作: {act}'}, status=400)

        if ids is not None:
            qs = MasterSKU.objects.filter(id__in=ids)
        elif flt is not None:
            qs = self._apply_filter(flt)
        else:
            return Response({'detail': '必须提供 ids 或 filter'}, status=400)

        count = qs.count()

        if act == 'activate':
            qs.update(is_active=True)
        elif act == 'deactivate':
            qs.update(is_active=False)
        elif act == 'delete':
            # S2-W3-3: 停用替代删除 - 不真正删除数据，而是软删除（停用）
            qs.update(is_active=False)
        elif act == 'set_category':
            cat_id = params.get('category_id')
            if not cat_id:
                return Response({'detail': 'params.category_id 不能为空'}, status=400)
            try:
                cat = Category.objects.get(id=cat_id)
            except Category.DoesNotExist:
                return Response({'detail': '品类不存在'}, status=404)
            qs.update(primary_category=cat)
        elif act == 'set_region':
            region = params.get('region')
            if region not in ('u', 't', 'a'):
                return Response({'detail': 'params.region 必须为 u/t/a'}, status=400)
            qs.update(region=region)
        elif act == 'submit_review':
            now = timezone.now()
            submitted = 0
            for sku in qs:
                if sku.review_status != 'draft':
                    continue
                sku.review_status = 'pending_review'
                sku.review_note = ''
                sku.review_submitted_at = now
                sku.review_submitted_by = request.user
                sku.review_submit_count = (sku.review_submit_count or 0) + 1
                sku.save(update_fields=[
                    'review_status', 'review_note', 'review_submitted_at',
                    'review_submitted_by', 'review_submit_count', 'updated_at',
                ])
                submitted += 1
            return Response({'affected': count, 'submitted': submitted})
        elif act in ('add_audience_tags', 'remove_audience_tags'):
            raw_tags = params.get('tags', [])
            if not isinstance(raw_tags, list):
                return Response({'detail': 'params.tags 必须为数组'}, status=400)
            allowed_audience_tags = {'for_her', 'for_him', 'for_couples'}
            tags = [t for t in raw_tags if isinstance(t, str) and t in allowed_audience_tags]
            if not tags:
                return Response({'detail': 'params.tags 无有效标签'}, status=400)

            for sku in qs:
                current = sku.audience_tags if isinstance(sku.audience_tags, list) else []
                current_set = set([t for t in current if isinstance(t, str)])
                if act == 'add_audience_tags':
                    current_set.update(tags)
                else:
                    current_set.difference_update(tags)
                sku.audience_tags = sorted(current_set)
                sku.save(update_fields=['audience_tags', 'updated_at'])
        elif act in ('add_operational_tags', 'remove_operational_tags'):
            raw_tag_ids = params.get('tag_ids', [])
            raw_tag_names = params.get('tag_names', [])
            if not isinstance(raw_tag_ids, list):
                return Response({'detail': 'params.tag_ids 必须为数组'}, status=400)
            if not isinstance(raw_tag_names, list):
                return Response({'detail': 'params.tag_names 必须为数组'}, status=400)

            tag_ids = []
            for item in raw_tag_ids:
                if isinstance(item, int):
                    tag_ids.append(item)
                elif isinstance(item, str) and item.isdigit():
                    tag_ids.append(int(item))

            tag_names = [name.strip() for name in raw_tag_names if isinstance(name, str) and name.strip()]
            if tag_names:
                tag_ids.extend(
                    list(
                        OperationalTag.objects.filter(name__in=tag_names).values_list('id', flat=True)
                    )
                )
            tag_ids = list(dict.fromkeys(tag_ids))
            if not tag_ids:
                return Response({'detail': 'params.tag_ids/tag_names 无有效运营标签'}, status=400)

            for sku in qs:
                if act == 'add_operational_tags':
                    sku.operational_tags.add(*tag_ids)
                else:
                    sku.operational_tags.remove(*tag_ids)

        # S2-W3-7 批量管理升级新增操作
        elif act == 'set_supplier':
            # params: { supplier_id: int, supplier_code: str, cost_price: str }
            supplier_id = params.get('supplier_id')
            supplier_code = params.get('supplier_code', '')
            cost_price = params.get('cost_price', '0')
            if not supplier_id:
                return Response({'detail': 'params.supplier_id 不能为空'}, status=400)
            try:
                supplier = Supplier.objects.get(id=supplier_id)
            except Supplier.DoesNotExist:
                return Response({'detail': '供应商不存在'}, status=404)

            updated = 0
            for sku in qs:
                # 更新或创建 SupplierSKU
                sup_sku, created = SupplierSKU.objects.update_or_create(
                    supplier=supplier,
                    master_sku=sku,
                    defaults={
                        'supplier_code': supplier_code or sku.master_code,
                        'cost_price': cost_price,
                        'stock_status': 'in_stock',
                    }
                )
                updated += 1
            return Response({'affected': count, 'updated': updated})

        elif act == 'set_price':
            # params: { selling_price: str, regular_price: str (optional) }
            selling_price = params.get('selling_price')
            regular_price = params.get('regular_price')
            if not selling_price:
                return Response({'detail': 'params.selling_price 不能为空'}, status=400)

            from .models import PriceAuditLog
            updated = 0
            for sku in qs:
                old_price = str(sku.selling_price)
                sku.selling_price = selling_price
                if regular_price:
                    sku.regular_price = regular_price
                sku.save(update_fields=['selling_price', 'regular_price', 'updated_at'])
                # 记录价格变更日志
                PriceAuditLog.objects.create(
                    master_sku=sku,
                    changed_by=request.user,
                    field_name='selling_price',
                    old_value=old_price,
                    new_value=selling_price,
                )
                updated += 1
            return Response({'affected': count, 'updated': updated})

        elif act == 'set_sales_region':
            # params: { sales_region: str } - 改销售区域（同 set_region）
            region = params.get('sales_region') or params.get('region')
            if region not in ('u', 't', 'a'):
                return Response({'detail': 'params.sales_region 必须为 u/t/a'}, status=400)
            qs.update(region=region)
            return Response({'affected': count})

        return Response({'affected': count})

    def _apply_filter(self, flt: dict):
        """根据前端传入的筛选条件构建 QuerySet（用于全选操作）"""
        qs = MasterSKU.objects.all()
        search = flt.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(master_code__icontains=search) |
                Q(legacy_code__icontains=search) |
                Q(title_en__icontains=search) |
                Q(title_ar__icontains=search)
            )
        if flt.get('is_active') in (True, False, 'true', 'false'):
            val = flt['is_active'] in (True, 'true')
            qs = qs.filter(is_active=val)
        if flt.get('is_featured') in (True, False, 'true', 'false'):
            val = flt['is_featured'] in (True, 'true')
            qs = qs.filter(is_featured=val)
        if flt.get('review_status'):
            qs = qs.filter(review_status=flt['review_status'])
        tags = flt.get('audience_tags')
        if isinstance(tags, list):
            from django.db import connection
            if connection.vendor == 'sqlite':
                tbl = qs.model._meta.db_table
                for tag in tags:
                    qs = qs.extra(where=[
                        f'EXISTS (SELECT 1 FROM json_each("{tbl}"."audience_tags") WHERE json_each.value = %s)'
                    ], params=[tag])
            else:
                for tag in tags:
                    qs = qs.filter(audience_tags__contains=[tag])
        if flt.get('region'):
            qs = qs.filter(region=flt['region'])
        if flt.get('primary_category'):
            qs = qs.filter(primary_category_id=flt['primary_category'])
        if flt.get('uncategorized'):
            qs = qs.filter(primary_category__isnull=True)
        if flt.get('missing_title_ar'):
            qs = qs.filter(Q(title_ar='') | Q(title_ar__isnull=True))
        if flt.get('missing_image'):
            qs = qs.filter(image_urls=[])
        return qs

    @action(detail=True, methods=['get'])
    def wp_mappings(self, request, pk=None):
        """GET /api/products/{id}/wp-mappings/ — 该商品的 WP 映射列表"""
        from wp_sync.models import WPProductMapping
        sku = self.get_object()
        mappings = WPProductMapping.objects.select_related('wp_site__distributor').filter(master_sku=sku)
        data = [
            {
                'id': m.id,
                'site_url': m.wp_site.site_url,
                'distributor_name': m.wp_site.distributor.name,
                'wp_product_id': m.wp_product_id,
                'wp_sku': m.wp_sku,
                'sync_status': m.sync_status,
                'sync_status_display': m.get_sync_status_display(),
                'last_synced_at': m.last_synced_at.isoformat() if m.last_synced_at else None,
                'sync_error': m.sync_error,
            }
            for m in mappings
        ]
        return Response(data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """GET /api/products/export/ — 按当前筛选条件导出 CSV"""
        qs = self._apply_filter({
            'search': request.query_params.get('search', ''),
            'is_active': request.query_params.get('is_active'),
            'is_featured': request.query_params.get('is_featured'),
            'region': request.query_params.get('region'),
            'primary_category': request.query_params.get('primary_category'),
        })
        qs = qs.select_related('primary_category').prefetch_related('supplier_skus')

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'master_code', 'legacy_code', 'region',
            'primary_category', 'title_en', 'title_ar',
            'short_description', 'selling_price', 'regular_price',
            'is_active', 'is_featured', 'audience_tags', 'image_urls',
        ])
        for p in qs.iterator():
            writer.writerow([
                p.master_code,
                p.legacy_code,
                p.region,
                p.primary_category.name_zh if p.primary_category else '',
                p.title_en,
                p.title_ar,
                p.short_description,
                str(p.selling_price),
                str(p.regular_price) if p.regular_price else '',
                '1' if p.is_active else '0',
                '1' if p.is_featured else '0',
                ','.join(p.audience_tags or []),
                ','.join(p.image_urls or []),
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="products_export.csv"'
        return response

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request):
        """POST /api/products/import-csv/ — 上传 CSV 批量更新/新增商品

        CSV 格式与 export 输出一致：
          master_code, legacy_code, region, primary_category, title_en, title_ar,
          short_description, selling_price, regular_price, is_active, is_featured,
          audience_tags, image_urls
        支持：
          - master_code 已存在 → 更新
          - master_code 不存在 → 记为失败并继续处理后续行（新增请用 API 或 AI 上线）
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'detail': '请上传 CSV 文件（field: file）'}, status=400)

        categories_map = {c.name_zh: c for c in Category.objects.all()}
        categories_map.update({c.name_en: c for c in Category.objects.all()})

        def to_dec(val):
            try:
                return Decimal(val.strip()) if val.strip() else None
            except InvalidOperation:
                return None

        try:
            text = csv_file.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            text = csv_file.read().decode('gbk', errors='replace')

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        batch = ImportBatch.objects.create(
            source_filename=getattr(csv_file, 'name', '') or '',
            total_rows=len(rows),
            created_by=request.user if request.user.is_authenticated else None,
        )

        results = {
            'updated': 0,
            'skipped': 0,  # 兼容旧字段：仅用于空行/无 master_code 的行
            'errors': [],  # 兼容旧字段：字符串错误列表
            'success_count': 0,
            'failed_count': 0,
            'failed_rows': [],  # [{line_no, master_code, reason}]
            'import_batch_id': batch.id,
        }

        for i, row in enumerate(rows, start=2):
            ok, mc, reason = self._apply_import_row(row, categories_map, to_dec)
            if ok:
                results['updated'] += 1
                results['success_count'] += 1
                ImportBatchRow.objects.create(
                    batch=batch,
                    line_no=i,
                    master_code=mc,
                    status='success',
                    row_data=row,
                )
                continue

            if not mc:
                results['skipped'] += 1
                results['errors'].append(f"行{i}: {reason}")
            else:
                results['errors'].append(f"行{i} {mc}: {reason}")
            results['failed_count'] += 1
            results['failed_rows'].append({
                'line_no': i,
                'master_code': mc,
                'reason': reason,
            })
            ImportBatchRow.objects.create(
                batch=batch,
                line_no=i,
                master_code=mc,
                status='failed',
                reason=reason,
                row_data=row,
            )

        batch.success_count = results['success_count']
        batch.failed_count = results['failed_count']
        batch.status = 'partial_failed' if batch.failed_count > 0 else 'completed'
        batch.save(update_fields=['success_count', 'failed_count', 'status', 'updated_at'])

        return Response(results)

    def _apply_import_row(self, row, categories_map, to_dec):
        mc = row.get('master_code', '').strip()
        if not mc:
            return False, '', 'master_code 为空'
        try:
            sku = MasterSKU.objects.get(master_code=mc)
        except MasterSKU.DoesNotExist:
            return False, mc, 'master_code 不存在'

        update_fields = {}
        if row.get('title_en', '').strip():
            update_fields['title_en'] = row['title_en'].strip()
        if 'title_ar' in row:
            update_fields['title_ar'] = row['title_ar'].strip()
        if 'title_th' in row:
            update_fields['title_th'] = row['title_th'].strip()
        if 'short_description' in row:
            update_fields['short_description'] = row['short_description'].strip()
        if row.get('selling_price', '').strip():
            val = to_dec(row['selling_price'])
            if val:
                update_fields['selling_price'] = val
        if 'regular_price' in row:
            val = to_dec(row.get('regular_price', ''))
            update_fields['regular_price'] = val
        if row.get('region', '') in ('u', 't', 'a'):
            update_fields['region'] = row['region']
        if 'is_active' in row:
            update_fields['is_active'] = row['is_active'].strip() in ('1', 'true', 'True')
        if 'is_featured' in row:
            update_fields['is_featured'] = row['is_featured'].strip() in ('1', 'true', 'True')
        if 'audience_tags' in row:
            raw = row['audience_tags'].strip()
            update_fields['audience_tags'] = [t.strip() for t in raw.split(',') if t.strip()] if raw else []
        if 'image_urls' in row:
            raw = row['image_urls'].strip()
            update_fields['image_urls'] = [u.strip() for u in raw.split(',') if u.strip()] if raw else []
        if row.get('primary_category', '').strip():
            cat = categories_map.get(row['primary_category'].strip())
            if cat:
                update_fields['primary_category'] = cat

        try:
            for attr, val in update_fields.items():
                setattr(sku, attr, val)
            sku.save()
            return True, mc, ''
        except Exception as e:
            return False, mc, str(e)

    @action(detail=False, methods=['get'], url_path='import-batches')
    def import_batches(self, request):
        cutoff = timezone.now() - timedelta(hours=48)
        batches = ImportBatch.objects.select_related('workorder').prefetch_related('alerts').all()[:20]
        data = []
        for b in batches:
            needs_escalation = b.failed_count > 0 and b.created_at < cutoff
            workorder = getattr(b, 'workorder', None)
            alerts = list(b.alerts.all())
            last_alert = alerts[0] if alerts else None
            data.append({
                'id': b.id,
                'source_filename': b.source_filename,
                'total_rows': b.total_rows,
                'success_count': b.success_count,
                'failed_count': b.failed_count,
                'status': b.status,
                'created_at': b.created_at.isoformat(),
                'needs_escalation': needs_escalation,
                'workorder_created': bool(workorder),
                'workorder_status': workorder.status if workorder else '',
                'alert_sent': bool(last_alert and last_alert.status == 'sent'),
                'last_alert_at': last_alert.created_at.isoformat() if last_alert else None,
                'alert_channels': sorted(list({a.channel for a in alerts if a.status == 'sent'})),
            })
        return Response(data)

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[^/.]+)/create-workorder')
    def create_workorder(self, request, batch_id=None):
        try:
            batch = ImportBatch.objects.get(pk=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({'detail': '批次不存在'}, status=404)

        cutoff = timezone.now() - timedelta(hours=48)
        needs_escalation = batch.failed_count > 0 and batch.created_at < cutoff
        if not needs_escalation:
            return Response({'detail': '当前批次未达到升级条件（失败且超过48小时）'}, status=400)

        title = f"[F17] 导入失败升级提醒 Batch#{batch.id}"
        detail = (
            f"source={batch.source_filename or '-'}, "
            f"total={batch.total_rows}, success={batch.success_count}, failed={batch.failed_count}"
        )
        workorder, created = ImportBatchWorkorder.objects.get_or_create(
            batch=batch,
            defaults={
                'title': title,
                'detail': detail,
                'status': 'open',
                'created_by': request.user if request.user.is_authenticated else None,
            },
        )
        return Response({
            'created': created,
            'workorder_id': workorder.id,
            'status': workorder.status,
            'detail': '工单已创建' if created else '工单已存在',
        })

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[^/.]+)/send-alert')
    def send_alert(self, request, batch_id=None):
        try:
            batch = ImportBatch.objects.get(pk=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({'detail': '批次不存在'}, status=404)

        cutoff = timezone.now() - timedelta(hours=48)
        needs_escalation = batch.failed_count > 0 and batch.created_at < cutoff
        if not needs_escalation:
            return Response({'detail': '当前批次未达到升级条件（失败且超过48小时）'}, status=400)

        channels = request.data.get('channels') or ['message']
        if not isinstance(channels, list) or any(c not in ('message', 'email') for c in channels):
            return Response({'detail': 'channels 仅支持 message/email'}, status=400)

        email_recipients = request.data.get('email_recipients') or []
        if not isinstance(email_recipients, list):
            return Response({'detail': 'email_recipients 必须为数组'}, status=400)

        subject = f"[F17] 导入失败升级提醒 Batch#{batch.id}"
        detail = (
            f"source={batch.source_filename or '-'}, "
            f"total={batch.total_rows}, success={batch.success_count}, failed={batch.failed_count}"
        )
        actor = request.user if request.user.is_authenticated else None

        results = []
        sent_count = 0
        failed_count = 0

        if 'message' in channels:
            alert = ImportBatchAlert.objects.create(
                batch=batch,
                channel='message',
                status='sent',
                recipient='ops-room',
                detail=detail,
                created_by=actor,
            )
            sent_count += 1
            results.append({
                'channel': 'message',
                'status': 'sent',
                'detail': '消息提醒已记录',
                'alert_id': alert.id,
            })

        if 'email' in channels:
            if not email_recipients:
                alert = ImportBatchAlert.objects.create(
                    batch=batch,
                    channel='email',
                    status='failed',
                    recipient='',
                    detail='email_recipients 为空',
                    created_by=actor,
                )
                failed_count += 1
                results.append({
                    'channel': 'email',
                    'status': 'failed',
                    'detail': 'email_recipients 为空',
                    'alert_id': alert.id,
                })
            else:
                try:
                    send_mail(
                        subject=subject,
                        message=detail,
                        from_email=None,
                        recipient_list=email_recipients,
                        fail_silently=False,
                    )
                    recipient_display = ','.join(email_recipients)
                    alert = ImportBatchAlert.objects.create(
                        batch=batch,
                        channel='email',
                        status='sent',
                        recipient=recipient_display,
                        detail=detail,
                        created_by=actor,
                    )
                    sent_count += 1
                    results.append({
                        'channel': 'email',
                        'status': 'sent',
                        'detail': f'邮件已发送至 {recipient_display}',
                        'alert_id': alert.id,
                    })
                except Exception as exc:
                    recipient_display = ','.join(email_recipients)
                    alert = ImportBatchAlert.objects.create(
                        batch=batch,
                        channel='email',
                        status='failed',
                        recipient=recipient_display,
                        detail=str(exc),
                        created_by=actor,
                    )
                    failed_count += 1
                    results.append({
                        'channel': 'email',
                        'status': 'failed',
                        'detail': str(exc),
                        'alert_id': alert.id,
                    })

        return Response({
            'batch_id': batch.id,
            'needs_escalation': needs_escalation,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'results': results,
        })

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[^/.]+)/retry-failed')
    def retry_failed_rows(self, request, batch_id=None):
        try:
            batch = ImportBatch.objects.get(pk=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({'detail': '批次不存在'}, status=404)

        categories_map = {c.name_zh: c for c in Category.objects.all()}
        categories_map.update({c.name_en: c for c in Category.objects.all()})

        def to_dec(val):
            try:
                return Decimal(val.strip()) if str(val).strip() else None
            except InvalidOperation:
                return None

        retried_count = 0
        fixed_count = 0
        still_failed_count = 0

        failed_rows = batch.rows.filter(status='failed')
        for r in failed_rows:
            retried_count += 1
            ok, mc, reason = self._apply_import_row(r.row_data or {}, categories_map, to_dec)
            r.retry_count += 1
            r.last_retry_at = timezone.now()
            r.master_code = mc
            if ok:
                r.status = 'fixed'
                r.reason = ''
                fixed_count += 1
            else:
                r.status = 'failed'
                r.reason = reason
                still_failed_count += 1
            r.save(update_fields=['retry_count', 'last_retry_at', 'master_code', 'status', 'reason'])

        batch.success_count = batch.rows.filter(status__in=['success', 'fixed']).count()
        batch.failed_count = batch.rows.filter(status='failed').count()
        batch.status = 'partial_failed' if batch.failed_count > 0 else 'completed'
        batch.save(update_fields=['success_count', 'failed_count', 'status', 'updated_at'])

        return Response({
            'batch_id': batch.id,
            'retried_count': retried_count,
            'fixed_count': fixed_count,
            'still_failed_count': still_failed_count,
            'status': batch.status,
        })

    @action(detail=True, methods=['post'])
    def upgrade_code(self, request, pk=None):
        """为旧商品一键生成规范编码（vc-u-1001），旧码保留到 legacy_code"""
        from .models import generate_master_code
        sku = self.get_object()

        if sku.master_code.startswith('vc-'):
            return Response({'detail': '该商品已使用规范编码，无需升级。'}, status=400)

        region = sku.region or 'u'
        cat_code = sku.primary_category.code if sku.primary_category else '9'
        new_code = generate_master_code(region, cat_code)

        sku.legacy_code = sku.master_code
        sku.master_code = new_code
        sku.save(update_fields=['master_code', 'legacy_code'])

        return Response({'old_code': sku.legacy_code, 'new_code': new_code})


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, DictionaryViewPermission]

    @action(detail=True, methods=['post'], url_path='deactivate-with-replacement')
    def deactivate_with_replacement(self, request, pk=None):
        supplier = self.get_object()
        replacement_id = _parse_replacement_id(request)
        if replacement_id == supplier.id:
            raise ValidationError({'replacement_id': '替代项不能与当前项相同'})

        replacement = Supplier.objects.filter(id=replacement_id, is_active=True).first()
        if not replacement:
            raise ValidationError({'replacement_id': '替代供应商不存在或已停用'})

        with transaction.atomic():
            moved = 0
            merged = 0
            links = SupplierSKU.objects.filter(supplier=supplier).select_related('master_sku')
            for link in links:
                existing = SupplierSKU.objects.filter(
                    supplier=replacement,
                    master_sku=link.master_sku,
                ).first()
                if existing:
                    if link.cost_price < existing.cost_price:
                        existing.cost_price = link.cost_price
                        existing.stock_status = link.stock_status
                        existing.supplier_code = existing.supplier_code or link.supplier_code
                        existing.save(update_fields=['cost_price', 'stock_status', 'supplier_code'])
                    link.delete()
                    merged += 1
                else:
                    link.supplier = replacement
                    link.save(update_fields=['supplier'])
                    moved += 1
            supplier.is_active = False
            supplier.save(update_fields=['is_active'])

        return Response({
            'detail': '供应商已停用并完成替代映射',
            'moved': moved,
            'merged': merged,
            'replacement_id': replacement.id,
        })


class SupplierSKUViewSet(viewsets.ModelViewSet):
    queryset = SupplierSKU.objects.select_related('supplier', 'master_sku').all()
    serializer_class = SupplierSKUSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'master_sku', 'stock_status']


class PriceAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PriceAuditLog.objects.select_related('master_sku', 'changed_by').all()
    serializer_class = PriceAuditLogSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ['master_sku']


# ---------------------------------------------------------------------------
# 脏词字典管理（S2-W3-3）
# ---------------------------------------------------------------------------

class BannedWordViewSet(viewsets.ModelViewSet):
    """脏词字典管理（仅限审核员或超级管理员）"""
    queryset = BannedWord.objects.all()
    serializer_class = BannedWordSerializer
    permission_classes = [IsAuthenticated, DictionaryViewPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['word']
    ordering_fields = ['word', 'created_at', 'id']
    ordering = ['word']

    def get_queryset(self):
        qs = super().get_queryset()
        # 默认只返回启用的脏词，除非明确请求包含停用的
        include_inactive = self.request.query_params.get('include_inactive')
        if include_inactive not in ('1', 'true', 'True'):
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        # 检查重复
        word = request.data.get('word', '').strip()
        if BannedWord.objects.filter(word__iexact=word).exists():
            return Response({'detail': '该脏词已存在'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # 检查重复（排除当前记录）
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        word = request.data.get('word', instance.word).strip()
        if BannedWord.objects.filter(word__iexact=word).exclude(id=instance.id).exists():
            return Response({'detail': '该脏词已存在'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# AI 辅助上线接口（Sprint 3）
# ---------------------------------------------------------------------------

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage


class CurrentUserView(APIView):
    """GET /api/auth/me/ — 获取当前登录用户信息"""
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': '未认证'}, status=401)
        return Response({
            'id': request.user.id,
            'username': request.user.username,
            'is_staff': request.user.is_staff,
            'is_superuser': request.user.is_superuser,
        })


class UploadImageView(APIView):
    """
    POST /api/products/upload-image/
    上传图片，返回图片 URL。
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': '缺少文件'}, status=status.HTTP_400_BAD_REQUEST)
        
        filename = default_storage.save(file.name, file)
        url = request.build_absolute_uri(default_storage.url(filename))
        return Response({'url': url})

class AIAnalyzeImagesView(APIView):
    """
    POST /api/pim/ai/analyze-images/

    上传 1-5 张商品图片，AI 返回字段建议（不保存数据库）。

    multipart/form-data:
        images: File（可多个）
    """
    parser_classes = [MultiPartParser, FormParser]

    @staticmethod
    def _error_meta(error_code: str, retryable: bool) -> dict:
        return {
            'error_code': error_code,
            'retryable': retryable,
            'trace_id': str(uuid.uuid4()),
        }

    @staticmethod
    def _fallback_result(reason: str) -> dict:
        data = {
            'title_en': '',
            'title_ar': '',
            'short_description': '',
            'description': '',
            'primary_category': 'other',
            'audience_tags': [],
            'operational_tags': [],
            'confidence_score': 0.0,
            'notes': f'AI 服务暂不可用，已降级为可编辑草稿模式：{reason}',
            'degraded': True,
        }
        data.update(AIAnalyzeImagesView._error_meta('AI_UPSTREAM_UNAVAILABLE', retryable=True))
        return data

    def post(self, request):
        files = request.FILES.getlist('images')
        if not files:
            return Response({'error': '请至少上传 1 张图片'}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > 5:
            return Response({'error': '最多支持 5 张图片'}, status=status.HTTP_400_BAD_REQUEST)

        images = []
        for f in files:
            images.append({
                'filename': f.name,
                'data': f.read(),
            })

        try:
            from .ai_service import analyze_product_images
            result = analyze_product_images(images)
            if isinstance(result, dict):
                result.setdefault('degraded', False)
            return Response(result)
        except RuntimeError as exc:
            return Response(self._fallback_result(str(exc)), status=status.HTTP_200_OK)
        except ValueError as exc:
            payload = {'error': str(exc)}
            payload.update(self._error_meta('AI_INPUT_INVALID', retryable=False))
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            payload = {'error': f'AI 分析失败: {exc}'}
            payload.update(self._error_meta('AI_ANALYZE_INTERNAL_ERROR', retryable=False))
            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIGenerateArabicView(APIView):
    """
    POST /api/pim/ai/generate-arabic/

    传入英文标题和描述，生成阿拉伯语版本（含质量评分）。

    JSON body:
        title_en: str (必填)
        description: str (可选)
    """
    parser_classes = [JSONParser]

    def post(self, request):
        title_en = request.data.get('title_en', '').strip()
        description = request.data.get('description', '')

        if not title_en:
            return Response({'error': 'title_en 不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .ai_service import generate_arabic_content
            result = generate_arabic_content(title_en, description)
            return Response(result)
        except RuntimeError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'AI 生成失败: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# AI 配置管理
# ---------------------------------------------------------------------------

class AIConfigViewSet(viewsets.ModelViewSet):
    """AI 配置管理（仅限超管）"""
    queryset = AIConfig.objects.all()
    serializer_class = AIConfigSerializer

    def get_queryset(self):
        # 单例模式，只返回 id=1 的配置
        return AIConfig.objects.filter(id=1)

    def create(self, request, *args, **kwargs):
        # 强制单例：总是更新 id=1 的记录
        config, created = AIConfig.objects.get_or_create(id=1, defaults=request.data)
        if not created:
            serializer = self.get_serializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(self.get_serializer(config).data, status=201)

    def update(self, request, *args, **kwargs):
        # 权限检查：仅限超管
        if not request.user.is_superuser:
            raise PermissionDenied('仅老板可配置 AI 设置')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # 不允许删除，只能修改
        return Response({'detail': '配置不可删除'}, status=400)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """获取当前配置（公开，供 AI 服务读取）"""
        config = AIConfig.get_config()
        return Response(AIConfigSerializer(config).data)


# ---------------------------------------------------------------------------
# Task 3: OCR 识别和文案优化接口
# ---------------------------------------------------------------------------

class AIOCRAnalyzeView(APIView):
    """
    POST /api/ai/ocr-analyze/
    OCR 识别图片/PDF，返回建议字段
    """
    parser_classes = [MultiPartParser, FormParser]

    @staticmethod
    def _fallback_result(reason: str) -> dict:
        data = {
            'title_en': '',
            'title_ar': '',
            'short_description': '',
            'description': '',
            'primary_category': 'other',
            'audience_tags': [],
            'confidence_score': 0.0,
            'notes': f'AI 服务暂不可用，请手动填写：{reason}',
            'degraded': True,
        }
        data.update(AIAnalyzeImagesView._error_meta('AI_UPSTREAM_UNAVAILABLE', retryable=True))
        return data

    def post(self, request):
        files = request.FILES.getlist('images')
        if not files:
            return Response({'error': '请至少上传 1 张图片'}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > 5:
            return Response({'error': '最多支持 5 张图片'}, status=status.HTTP_400_BAD_REQUEST)

        images = []
        for f in files:
            images.append(f)

        try:
            from .ai_service import ocr_analyze
            result = ocr_analyze(images)
            if isinstance(result, dict):
                result.setdefault('degraded', False)
            return Response(result)
        except RuntimeError as exc:
            return Response(self._fallback_result(str(exc)), status=status.HTTP_200_OK)
        except ValueError as exc:
            payload = {'error': str(exc)}
            payload.update(AIAnalyzeImagesView._error_meta('AI_INPUT_INVALID', retryable=False))
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            payload = {'error': f'OCR 识别失败：{exc}'}
            payload.update(AIAnalyzeImagesView._error_meta('AI_ANALYZE_INTERNAL_ERROR', retryable=False))
            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AIOptimizeTextView(APIView):
    """
    POST /api/ai/optimize-text/
    文案优化（标题/描述润色）
    """
    parser_classes = [JSONParser]

    def post(self, request):
        title_en = request.data.get('title_en', '').strip()
        description = request.data.get('description', '').strip()

        if not title_en:
            return Response({'error': 'title_en 不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .ai_service import optimize_text
            result = optimize_text(title_en, description)
            return Response(result)
        except RuntimeError as exc:
            return Response({'error': str(exc), 'degraded': True}, status=status.HTTP_200_OK)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'文案优化失败：{exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
