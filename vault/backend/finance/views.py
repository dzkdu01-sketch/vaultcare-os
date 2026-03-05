from django.db.models import Sum, Count, Q, F
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from rest_framework.decorators import api_view
from rest_framework.response import Response
from oms.models import Order


@api_view(['GET'])
def finance_summary(request):
    """Overall financial summary."""
    period = request.query_params.get('period', 'all')

    qs = Order.objects.all()
    if period != 'all':
        from django.utils import timezone
        from datetime import timedelta
        days = {'week': 7, 'month': 30, 'quarter': 90}.get(period, 30)
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))

    delivered = qs.filter(status='delivered')

    summary = {
        'total_orders': qs.count(),
        'delivered_orders': delivered.count(),
        'rejected_orders': qs.filter(status='rejected').count(),
        'pending_orders': qs.filter(status='pending').count(),
        'total_revenue': float(delivered.aggregate(s=Sum('total_amount'))['s'] or 0),
        'total_profit': float(delivered.aggregate(s=Sum('profit'))['s'] or 0),
        'total_delivery_fees': float(delivered.aggregate(s=Sum('delivery_fee'))['s'] or 0),
        'avg_order_value': float(delivered.aggregate(s=Sum('total_amount'))['s'] or 0) / max(delivered.count(), 1),
    }
    return Response(summary)


@api_view(['GET'])
def finance_by_distributor(request):
    """Financial breakdown by distributor."""
    data = Order.objects.filter(status='delivered').values(
        'distributor__name'
    ).annotate(
        order_count=Count('id'),
        revenue=Sum('total_amount'),
        profit=Sum('profit'),
    ).order_by('-profit')

    return Response(list(data))


@api_view(['GET'])
def finance_by_supplier(request):
    """Financial breakdown by supplier."""
    data = Order.objects.filter(
        status='delivered', routed_supplier__isnull=False
    ).values(
        'routed_supplier__name'
    ).annotate(
        order_count=Count('id'),
        revenue=Sum('total_amount'),
        profit=Sum('profit'),
    ).order_by('-profit')

    return Response(list(data))


@api_view(['GET'])
def finance_daily(request):
    """Daily financial trend."""
    data = Order.objects.filter(status='delivered').annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(
        order_count=Count('id'),
        revenue=Sum('total_amount'),
        profit=Sum('profit'),
    ).order_by('-date')[:30]

    return Response(list(data))
