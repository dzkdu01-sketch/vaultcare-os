from decimal import Decimal
from pim.models import SupplierSKU


class RoutingResult:
    def __init__(self):
        self.routed_supplier = None
        self.items_routing = []
        self.needs_split = False
        self.errors = []


def route_order(order):
    """Route an order to the best available supplier with circuit breaker support."""
    result = RoutingResult()
    supplier_votes = {}

    for item in order.items.select_related('master_sku').all():
        available = SupplierSKU.objects.filter(
            master_sku=item.master_sku,
            supplier__is_active=True,
            supplier__circuit_breaker=False,
            stock_status='in_stock',
        ).select_related('supplier').order_by('supplier__priority')

        if not available.exists():
            result.errors.append(f"{item.master_sku.master_code}: no supplier available")
            continue

        best = available.first()
        item.cost_price = best.cost_price
        item.save(update_fields=['cost_price'])

        supplier_id = best.supplier_id
        supplier_votes[supplier_id] = supplier_votes.get(supplier_id, 0) + 1
        result.items_routing.append({
            'item_id': item.id,
            'sku': item.master_sku.master_code,
            'supplier': best.supplier.name,
            'cost': float(best.cost_price),
        })

    if not supplier_votes:
        result.errors.append('No items could be routed')
        return result

    if len(supplier_votes) > 1:
        result.needs_split = True

    primary_supplier_id = max(supplier_votes, key=supplier_votes.get)
    from pim.models import Supplier
    result.routed_supplier = Supplier.objects.get(id=primary_supplier_id)

    order.routed_supplier = result.routed_supplier

    total_cost = sum(
        item.cost_price * item.quantity
        for item in order.items.all()
    )
    order.profit = order.total_amount - total_cost - order.delivery_fee
    order.save(update_fields=['routed_supplier', 'profit'])

    return result
