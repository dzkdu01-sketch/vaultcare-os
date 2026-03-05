import uuid
from django.db import models


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('pushed', 'Pushed to Supplier'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('rejected', 'Rejected by Customer'),
        ('returned', 'Returned'),
    ]
    SOURCE_CHOICES = [
        ('website', 'Website'),
        ('whatsapp', 'WhatsApp'),
        ('manual', 'Manual Entry'),
    ]

    order_number = models.CharField(max_length=50, unique=True, editable=False)
    distributor = models.ForeignKey('sites.Distributor', on_delete=models.CASCADE, related_name='orders')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=50)
    customer_address = models.TextField()
    city = models.CharField(max_length=100)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    routed_supplier = models.ForeignKey('pim.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=50)
    rejection_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.order_number} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"VC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    master_sku = models.ForeignKey('pim.MasterSKU', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.master_sku.master_code} x{self.quantity}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    @property
    def cost_subtotal(self):
        return self.cost_price * self.quantity
