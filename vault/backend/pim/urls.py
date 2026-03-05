from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AIAnalyzeImagesView,
    AIGenerateArabicView,
    AIOCRAnalyzeView,
    AIOptimizeTextView,
    AIConfigViewSet,
    BannedWordViewSet,
    BrandViewSet,
    CategoryViewSet,
    CurrentUserView,
    MasterSKUViewSet,
    OperationalTagViewSet,
    PriceAuditLogViewSet,
    SupplierSKUViewSet,
    SupplierViewSet,
    UploadImageView,
)

router = DefaultRouter()
router.register('products',         MasterSKUViewSet)
router.register('categories',       CategoryViewSet)
router.register('operational-tags', OperationalTagViewSet)
router.register('brands',           BrandViewSet)
router.register('suppliers',        SupplierViewSet)
router.register('supplier-skus',    SupplierSKUViewSet)
router.register('price-audit-logs', PriceAuditLogViewSet)
router.register('banned-words',     BannedWordViewSet)
router.register('ai-config',        AIConfigViewSet, basename='ai-config')

urlpatterns = [
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('products/upload-image/', UploadImageView.as_view(), name='upload-image'),
    path('ai/analyze-images/',  AIAnalyzeImagesView.as_view(),  name='ai-analyze-images'),
    path('ai/generate-arabic/', AIGenerateArabicView.as_view(), name='ai-generate-arabic'),
    path('ai/ocr-analyze/', AIOCRAnalyzeView.as_view(), name='ai-ocr-analyze'),
    path('ai/optimize-text/', AIOptimizeTextView.as_view(), name='ai-optimize-text'),
    path('', include(router.urls)),
]
