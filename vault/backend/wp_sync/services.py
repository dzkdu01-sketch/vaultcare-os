import logging
import requests
from requests.auth import HTTPBasicAuth
from django.utils import timezone
from .models import WPSite, WPProductMapping

logger = logging.getLogger(__name__)


class WooCommerceClient:
    def __init__(self, wp_site: WPSite):
        self.site = wp_site
        self.base_url = f"{wp_site.site_url.rstrip('/')}/wp-json/wc/v3"
        self.auth = HTTPBasicAuth(wp_site.consumer_key, wp_site.consumer_secret)
        self.timeout = 30

    def _request(self, method, endpoint, **kwargs):
        url = f"{self.base_url}/{endpoint}"
        try:
            resp = requests.request(
                method, url, auth=self.auth, timeout=self.timeout, **kwargs
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"WooCommerce API error [{self.site.site_url}]: {e}")
            raise

    def create_product(self, data):
        return self._request('POST', 'products', json=data)

    def update_product(self, product_id, data):
        return self._request('PUT', f'products/{product_id}', json=data)

    def get_product(self, product_id):
        return self._request('GET', f'products/{product_id}')

    def delete_product(self, product_id):
        return self._request('DELETE', f'products/{product_id}', params={'force': True})


def push_sku_to_wp(master_sku, wp_site):
    """Push or update a MasterSKU to a WP site."""
    client = WooCommerceClient(wp_site)

    distributor = wp_site.distributor
    whatsapp = ''
    if hasattr(distributor, 'site_environment'):
        whatsapp = distributor.site_environment.whatsapp_number

    product_data = {
        'name': master_sku.title_en,
        'sku': master_sku.master_code,
        'regular_price': str(master_sku.selling_price),
        'description': master_sku.description,
        'status': 'publish' if master_sku.is_active else 'draft',
        'stock_status': 'instock' if master_sku.is_active else 'outofstock',
    }

    if master_sku.image_urls:
        product_data['images'] = [{'src': url} for url in master_sku.image_urls[:5]]

    mapping = WPProductMapping.objects.filter(
        wp_site=wp_site, master_sku=master_sku
    ).first()

    if mapping:
        result = client.update_product(mapping.wp_product_id, product_data)
        mapping.sync_status = 'synced'
        mapping.last_synced_at = timezone.now()
        mapping.sync_error = ''
        mapping.save(update_fields=['sync_status', 'last_synced_at', 'sync_error'])
    else:
        result = client.create_product(product_data)
        WPProductMapping.objects.create(
            wp_site=wp_site,
            master_sku=master_sku,
            wp_product_id=result['id'],
            wp_sku=result.get('sku', master_sku.master_code),
            sync_status='synced',
            last_synced_at=timezone.now(),
        )

    wp_site.last_sync = timezone.now()
    wp_site.save(update_fields=['last_sync'])
    return result


def sync_stock_status(master_sku):
    """Sync stock status for a SKU across all WP sites that carry it."""
    from sites.models import DistributorSelection

    distributor_ids = DistributorSelection.objects.filter(
        master_sku=master_sku
    ).values_list('distributor_id', flat=True)

    wp_sites = WPSite.objects.filter(
        distributor_id__in=distributor_ids, is_active=True
    )

    results = []
    for site in wp_sites:
        try:
            result = push_sku_to_wp(master_sku, site)
            results.append({'site': site.site_url, 'status': 'ok'})
        except Exception as e:
            results.append({'site': site.site_url, 'status': 'error', 'message': str(e)})

    return results
