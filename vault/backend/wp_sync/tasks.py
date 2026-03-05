"""
wp_sync/tasks.py — WP 状态同步异步任务

用法（在其他模块中调用）：
    from wp_sync.tasks import enqueue_sync_status
    enqueue_sync_status(master_sku_id, is_active=False)

Django Q2 worker 启动：
    python manage.py qcluster
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 核心同步逻辑（同步版本，可直接调用也可由队列调度）
# ---------------------------------------------------------------------------

def sync_product_status_to_wp(master_sku_id: int, is_active: bool) -> dict:
    """
    将商品上/下架状态同步到所有关联 WP 站点。
    由 Django Q2 worker 执行，失败时记录到 WPProductMapping.sync_error。
    返回汇总结果字典。
    """
    from .models import WPProductMapping
    from .services import WooCommerceClient

    mappings = WPProductMapping.objects.filter(
        master_sku_id=master_sku_id,
        wp_product_id__isnull=False,
    ).select_related('wp_site')

    wp_status = 'publish' if is_active else 'draft'
    results = {'success': [], 'failed': []}

    for mapping in mappings:
        if not mapping.wp_site.is_active:
            continue
        mapping.sync_status = 'syncing'
        mapping.save(update_fields=['sync_status'])

        try:
            client = WooCommerceClient(mapping.wp_site)
            client.update_product(mapping.wp_product_id, {'status': wp_status})
            mapping.sync_status = 'synced' if is_active else 'draft'
            mapping.last_synced_at = timezone.now()
            mapping.sync_error = ''
            mapping.save(update_fields=['sync_status', 'last_synced_at', 'sync_error'])
            results['success'].append(mapping.wp_site.site_url)
            logger.info(
                "WP sync OK: sku_id=%s site=%s status=%s",
                master_sku_id, mapping.wp_site.site_url, wp_status,
            )
        except Exception as exc:
            mapping.sync_status = 'failed'
            mapping.sync_error = str(exc)
            mapping.save(update_fields=['sync_status', 'sync_error'])
            results['failed'].append({'site': mapping.wp_site.site_url, 'error': str(exc)})
            logger.error(
                "WP sync FAILED: sku_id=%s site=%s error=%s",
                master_sku_id, mapping.wp_site.site_url, exc,
            )

    return results


# ---------------------------------------------------------------------------
# 入队辅助函数（封装 django_q 调用，失败时降级为同步执行）
# ---------------------------------------------------------------------------

def enqueue_sync_status(master_sku_id: int, is_active: bool) -> None:
    """
    将同步任务加入 Django Q2 队列。
    如果队列服务不可用（未启动 qcluster），降级为同步执行。
    """
    try:
        from django_q.tasks import async_task
        async_task(
            'wp_sync.tasks.sync_product_status_to_wp',
            master_sku_id,
            is_active,
            group='wp_sync',
        )
        logger.debug("Enqueued WP sync: sku_id=%s is_active=%s", master_sku_id, is_active)
    except Exception as exc:
        logger.warning(
            "Django Q2 unavailable (%s), falling back to sync execution for sku_id=%s",
            exc, master_sku_id,
        )
        sync_product_status_to_wp(master_sku_id, is_active)


# ---------------------------------------------------------------------------
# 分销商选品推送任务（Sprint 2 / 5.6）
# ---------------------------------------------------------------------------

def push_new_selection_to_wp(master_sku_id: int, wp_site_id: int) -> dict:
    """
    分销商新增选品时，将商品推送到对应 WP 站点。
    若 WPProductMapping 已有 wp_product_id 则更新，否则新建。
    """
    from pim.models import MasterSKU
    from .models import WPProductMapping, WPSite
    from .services import WooCommerceClient

    sku = MasterSKU.objects.get(pk=master_sku_id)
    wp_site = WPSite.objects.get(pk=wp_site_id)
    client = WooCommerceClient(wp_site)

    product_data = {
        'name':          sku.title_en,
        'sku':           sku.master_code,
        'regular_price': str(sku.selling_price),
        'description':   sku.description,
        'short_description': sku.short_description,
        'status':        'publish' if sku.is_active else 'draft',
    }
    if sku.image_urls:
        product_data['images'] = [{'src': url} for url in sku.image_urls[:5]]

    mapping, _ = WPProductMapping.objects.get_or_create(
        master_sku=sku,
        wp_site=wp_site,
        defaults={'sync_status': 'pending'},
    )

    mapping.sync_status = 'syncing'
    mapping.save(update_fields=['sync_status'])

    try:
        if mapping.wp_product_id:
            # 【白名单机制】若是更新已存在商品，则只强推核心参数，防覆盖分销商的营销文案（标题/描述）
            safe_update_data = {
                'status':        'publish' if sku.is_active else 'draft',
                'regular_price': str(sku.selling_price),
            }
            if sku.image_urls:
                safe_update_data['images'] = [{'src': url} for url in sku.image_urls[:5]]
            client.update_product(mapping.wp_product_id, safe_update_data)
        else:
            # 首次推送，全量推送
            result = client.create_product(product_data)
            mapping.wp_product_id = result['id']
            mapping.wp_sku = result.get('sku', sku.master_code)

        mapping.sync_status = 'synced'
        mapping.last_synced_at = timezone.now()
        mapping.sync_error = ''
        mapping.save(update_fields=['wp_product_id', 'wp_sku', 'sync_status', 'last_synced_at', 'sync_error'])
        return {'status': 'ok', 'wp_product_id': mapping.wp_product_id}

    except Exception as exc:
        mapping.sync_status = 'failed'
        mapping.sync_error = str(exc)
        mapping.save(update_fields=['sync_status', 'sync_error'])
        logger.error("push_new_selection FAILED: sku=%s site=%s error=%s", master_sku_id, wp_site_id, exc)
        return {'status': 'error', 'error': str(exc)}


def enqueue_push_selection(master_sku_id: int, wp_site_id: int) -> None:
    """分销商选品入队推送（降级为同步执行）。"""
    try:
        from django_q.tasks import async_task
        async_task(
            'wp_sync.tasks.push_new_selection_to_wp',
            master_sku_id,
            wp_site_id,
            group='wp_sync',
        )
    except Exception as exc:
        logger.warning("Django Q2 unavailable (%s), sync push for sku_id=%s", exc, master_sku_id)
        push_new_selection_to_wp(master_sku_id, wp_site_id)
