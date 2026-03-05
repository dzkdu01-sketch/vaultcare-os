from rest_framework import serializers
from .models import WPSite, WPProductMapping


class WPSiteSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source='distributor.name', read_only=True)

    class Meta:
        model = WPSite
        fields = '__all__'
        extra_kwargs = {
            'consumer_secret': {'write_only': True},
        }


class WPProductMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = WPProductMapping
        fields = '__all__'
