from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DistributorViewSet, SiteEnvironmentViewSet, DistributorSelectionViewSet

router = DefaultRouter()
router.register('distributors', DistributorViewSet)
router.register('site-environments', SiteEnvironmentViewSet)
router.register('distributor-selections', DistributorSelectionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
