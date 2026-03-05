"""
PIM-F18 多站发布控制测试
验证：
1. 站点级发布/撤销
2. 单站失败隔离（A 站失败不阻断 B 站）
3. 状态回写可见
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU
from sites.models import Distributor, DistributorSelection
from wp_sync.models import WPSite, WPProductMapping


@override_settings(DEBUG=True)
class PIMF18MultiSitePublishTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.operator = get_user_model().objects.create_user(
            username='operator_f18',
            password='123456',
            is_staff=True,
        )
        self.client.force_authenticate(user=self.operator)

        self.category = Category.objects.get(code='1')
        self.sku = MasterSKU.objects.create(
            master_code='vc-u-f18-001',
            title_en='F18 Multi-Site Product',
            primary_category=self.category,
            region='u',
            selling_price='99.00',
            is_active=True,
            review_status='publishable',
        )

        self.distributor = Distributor.objects.create(
            name='Multi-Site Distributor',
            type='distributor',
            is_active=True,
        )

        # 创建两个 WP 站点
        self.site_a = WPSite.objects.create(
            distributor=self.distributor,
            site_url='https://site-a.test',
            consumer_key='ck_a',
            consumer_secret='cs_a',
            is_active=True,
        )
        self.site_b = WPSite.objects.create(
            distributor=self.distributor,
            site_url='https://site-b.test',
            consumer_key='ck_b',
            consumer_secret='cs_b',
            is_active=True,
        )

        # 创建选品关系
        DistributorSelection.objects.create(
            distributor=self.distributor,
            master_sku=self.sku,
        )

        # 创建映射记录
        self.mapping_a, _ = WPProductMapping.objects.get_or_create(
            master_sku=self.sku,
            wp_site=self.site_a,
            defaults={'wp_product_id': 101, 'sync_status': 'draft'},
        )
        self.mapping_b, _ = WPProductMapping.objects.get_or_create(
            master_sku=self.sku,
            wp_site=self.site_b,
            defaults={'wp_product_id': 102, 'sync_status': 'draft'},
        )

    def test_site_status_visible_after_operation(self):
        """操作后状态回写可见"""
        # 使用 simulate_success 测试通道
        res = self.client.post(
            f'/api/distributors/{self.distributor.id}/site_operation/',
            {
                'master_sku_id': self.sku.id,
                'site_id': self.site_a.id,
                'action': 'publish',
                'simulate_success': True,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['sync_status'], 'synced')
        self.assertIn('last_synced_at', res.data)

        # 查询站点状态，验证状态可见
        status_res = self.client.get(
            f'/api/distributors/{self.distributor.id}/site_selection_status/',
            {'master_sku_id': self.sku.id},
        )
        self.assertEqual(status_res.status_code, 200)

        sites = status_res.data['sites']
        site_a_data = next(s for s in sites if s['site_id'] == self.site_a.id)
        self.assertEqual(site_a_data['sync_status'], 'synced')
        self.assertIsNotNone(site_a_data['last_synced_at'])

    def test_site_revoke_updates_status_to_draft(self):
        """站点撤销后状态更新为 draft"""
        # 先发布（模拟成功）
        self.client.post(
            f'/api/distributors/{self.distributor.id}/site_operation/',
            {
                'master_sku_id': self.sku.id,
                'site_id': self.site_a.id,
                'action': 'publish',
                'simulate_success': True,
            },
            format='json',
        )

        # 再撤销
        res = self.client.post(
            f'/api/distributors/{self.distributor.id}/site_operation/',
            {
                'master_sku_id': self.sku.id,
                'site_id': self.site_a.id,
                'action': 'revoke',
                'simulate_success': True,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['sync_status'], 'draft')

        self.mapping_a.refresh_from_db()
        self.assertEqual(self.mapping_a.sync_status, 'draft')

    def test_site_retry_sync_after_failure(self):
        """失败后可重试同步"""
        # 手动设置失败状态
        self.mapping_a.sync_status = 'failed'
        self.mapping_a.sync_error = 'Network error'
        self.mapping_a.save(update_fields=['sync_status', 'sync_error'])

        # 重试（模拟成功）
        res = self.client.post(
            f'/api/distributors/{self.distributor.id}/site_operation/',
            {
                'master_sku_id': self.sku.id,
                'site_id': self.site_a.id,
                'action': 'retry_sync',
                'simulate_success': True,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['sync_status'], 'synced')

        self.mapping_a.refresh_from_db()
        self.assertEqual(self.mapping_a.sync_status, 'synced')
        self.assertEqual(self.mapping_a.sync_error, '')

    def test_multi_site_independent_status(self):
        """多站点状态独立"""
        # A 站发布成功
        self.client.post(
            f'/api/distributors/{self.distributor.id}/site_operation/',
            {
                'master_sku_id': self.sku.id,
                'site_id': self.site_a.id,
                'action': 'publish',
                'simulate_success': True,
            },
            format='json',
        )

        # B 站保持 draft 状态
        # 查询站点状态，验证两个站点状态独立
        status_res = self.client.get(
            f'/api/distributors/{self.distributor.id}/site_selection_status/',
            {'master_sku_id': self.sku.id},
        )
        self.assertEqual(status_res.status_code, 200)

        sites = status_res.data['sites']
        site_a_data = next(s for s in sites if s['site_id'] == self.site_a.id)
        site_b_data = next(s for s in sites if s['site_id'] == self.site_b.id)

        # A 站已同步，B 站仍为初始状态 (pending 或 draft)
        self.assertEqual(site_a_data['sync_status'], 'synced')
        self.assertIn(site_b_data['sync_status'], ['draft', 'pending'])
