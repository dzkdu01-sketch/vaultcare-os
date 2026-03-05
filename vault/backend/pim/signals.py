from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import MasterSKU, PriceAuditLog


@receiver(pre_save, sender=MasterSKU)
def handle_product_status_change(sender, instance, **kwargs):
    """
    商品状态变更时的级联操作：
    1. publishable -> inactive_delisted: 清除选品 + WP 下架
    2. is_active: True -> False: 清除选品 + WP 下架（兼容旧逻辑）
    """
    if not instance.pk:
        return

    try:
        old = MasterSKU.objects.get(pk=instance.pk)
    except MasterSKU.DoesNotExist:
        return

    # 下架级联：publishable -> inactive_delisted（新状态机逻辑）
    if old.review_status == 'publishable' and instance.review_status == 'inactive_delisted':
        from sites.models import DistributorSelection
        DistributorSelection.objects.filter(master_sku=instance).delete()
        from wp_sync.tasks import enqueue_sync_status
        enqueue_sync_status(instance.pk, is_active=False)
        return

    # 兼容旧逻辑：is_active True -> False
    if old.is_active and not instance.is_active:
        from sites.models import DistributorSelection
        DistributorSelection.objects.filter(master_sku=instance).delete()
        from wp_sync.tasks import enqueue_sync_status
        enqueue_sync_status(instance.pk, is_active=False)


@receiver(pre_save, sender=MasterSKU)
def handle_price_change(sender, instance, **kwargs):
    """
    记录价格变更审计日志（selling_price / regular_price）
    """
    if not instance.pk:
        return

    try:
        old = MasterSKU.objects.get(pk=instance.pk)
    except MasterSKU.DoesNotExist:
        return

    for field in ('selling_price', 'regular_price'):
        old_val = getattr(old, field)
        new_val = getattr(instance, field)
        if old_val != new_val:
            PriceAuditLog.objects.create(
                master_sku_id=instance.pk,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
            )
