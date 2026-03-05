"""
sites/signals.py

分销商选品（DistributorSelection）联动逻辑：
- 新增选品 → 为该分销商的所有 WPSite 创建 WPProductMapping(pending) 并入队推送
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='sites.DistributorSelection')
def handle_new_selection(sender, instance, created, **kwargs):
    """新增选品时，为该分销商每个 WP 站点创建映射并入队推送。"""
    if not created:
        return

    from wp_sync.models import WPProductMapping, WPSite
    from wp_sync.tasks import enqueue_push_selection

    wp_sites = WPSite.objects.filter(
        distributor=instance.distributor,
        is_active=True,
    )

    for wp_site in wp_sites:
        mapping, is_new = WPProductMapping.objects.get_or_create(
            master_sku=instance.master_sku,
            wp_site=wp_site,
            defaults={'sync_status': 'pending'},
        )
        if is_new:
            enqueue_push_selection(instance.master_sku_id, wp_site.pk)
            logger.info(
                "Enqueued push: sku=%s site=%s",
                instance.master_sku.master_code, wp_site.site_url,
            )
