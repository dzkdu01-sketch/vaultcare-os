from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WPSiteViewSet, push_sku_view
from .webhooks import WooCommerceWebhookView

router = DefaultRouter()
router.register('wp-sites', WPSiteViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('wp-sync/push/<int:sku_id>/', push_sku_view, name='push-sku'),
    path('wp-sync/webhook/', WooCommerceWebhookView.as_view(), name='wc-webhook'),
]
