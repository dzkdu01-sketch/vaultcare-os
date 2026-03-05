from rest_framework import serializers
from .models import Distributor, SiteEnvironment, DistributorSelection


class SiteEnvironmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteEnvironment
        fields = '__all__'


class DistributorSerializer(serializers.ModelSerializer):
    site_environment = SiteEnvironmentSerializer(read_only=True)

    class Meta:
        model = Distributor
        fields = '__all__'


class DistributorSelectionSerializer(serializers.ModelSerializer):
    sku_code = serializers.CharField(source='master_sku.master_code', read_only=True)
    sku_title = serializers.CharField(source='master_sku.title_en', read_only=True)

    class Meta:
        model = DistributorSelection
        fields = '__all__'
