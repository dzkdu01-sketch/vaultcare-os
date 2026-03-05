from django.urls import path
from .views import finance_summary, finance_by_distributor, finance_by_supplier, finance_daily

urlpatterns = [
    path('finance/summary/', finance_summary, name='finance-summary'),
    path('finance/by-distributor/', finance_by_distributor, name='finance-by-distributor'),
    path('finance/by-supplier/', finance_by_supplier, name='finance-by-supplier'),
    path('finance/daily/', finance_daily, name='finance-daily'),
]
