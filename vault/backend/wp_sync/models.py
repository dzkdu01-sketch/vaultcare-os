from django.db import models
from django.utils import timezone


class WPSite(models.Model):
    distributor = models.ForeignKey('sites.Distributor', on_delete=models.CASCADE, related_name='wp_sites')
    site_url = models.URLField()
    consumer_key = models.CharField(max_length=255)
    consumer_secret = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'WordPress Site'

    def __str__(self):
        return f"WP: {self.site_url} ({self.distributor.name})"


class WPProductMapping(models.Model):
    SYNC_STATUS_CHOICES = [
        ('pending',  '待同步'),
        ('syncing',  '同步中'),
        ('synced',   '已同步'),
        ('failed',   '同步失败'),
        ('draft',    'WP已下架'),
    ]

    master_sku     = models.ForeignKey(
        'pim.MasterSKU', on_delete=models.CASCADE, related_name='wp_mappings'
    )
    wp_site        = models.ForeignKey(
        WPSite, on_delete=models.CASCADE, related_name='product_mappings'
    )
    wp_product_id  = models.IntegerField(null=True, blank=True)
    wp_sku         = models.CharField(max_length=100, blank=True)
    sync_status    = models.CharField(
        max_length=20, choices=SYNC_STATUS_CHOICES, default='pending'
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error     = models.TextField(blank=True)

    class Meta:
        unique_together = ('master_sku', 'wp_site')
        verbose_name = 'WP Product Mapping'
        verbose_name_plural = 'WP Product Mappings'

    def __str__(self):
        return f"{self.master_sku.master_code} → WP#{self.wp_product_id} [{self.get_sync_status_display()}]"

    def mark_synced(self):
        self.sync_status = 'synced'
        self.last_synced_at = timezone.now()
        self.sync_error = ''
        self.save(update_fields=['sync_status', 'last_synced_at', 'sync_error'])

    def mark_failed(self, error: str):
        self.sync_status = 'failed'
        self.sync_error = error
        self.save(update_fields=['sync_status', 'sync_error'])
