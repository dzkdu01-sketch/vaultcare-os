from django.db import models
from django.contrib.auth.models import User


class Distributor(models.Model):
    TYPE_CHOICES = [
        ('self_operated', 'Self Operated'),
        ('distributor', 'Distributor'),
    ]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='distributor')
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='distributor_profile')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class SiteEnvironment(models.Model):
    distributor = models.OneToOneField(Distributor, on_delete=models.CASCADE, related_name='site_environment')
    domain_a = models.CharField(max_length=255, blank=True, default='', verbose_name='Product Domain (A)')
    domain_b = models.CharField(max_length=255, blank=True, default='', verbose_name='White Page Domain (B)')
    pixel_id = models.CharField(max_length=100, blank=True, default='', verbose_name='Facebook Pixel ID')
    whatsapp_number = models.CharField(max_length=50, blank=True, default='')
    payment_method = models.CharField(max_length=255, blank=True, default='', verbose_name='Ad Payment Method')
    cloaker_config = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Env: {self.distributor.name}"


class DistributorSelection(models.Model):
    distributor = models.ForeignKey(Distributor, on_delete=models.CASCADE, related_name='selections')
    master_sku = models.ForeignKey('pim.MasterSKU', on_delete=models.CASCADE, related_name='distributor_selections')

    class Meta:
        unique_together = ('distributor', 'master_sku')

    def __str__(self):
        return f"{self.distributor.name} -> {self.master_sku.master_code}"
