from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU
from sites.models import Distributor, DistributorSelection
from wp_sync.models import WPSite, WPProductMapping


class F18SiteOperationsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.operator = get_user_model().objects.create_user(
            username="operator",
            password="123456",
            is_staff=True,
        )
        self.normal_user = get_user_model().objects.create_user(
            username="normal_user",
            password="123456",
            is_staff=False,
        )

        self.category = Category.objects.get(code="1")
        self.sku = MasterSKU.objects.create(
            master_code="vc-u-1888",
            title_en="F18 Product",
            primary_category=self.category,
            region="u",
            selling_price="99.00",
            is_active=True,
            review_status="publishable",
        )
        self.distributor = Distributor.objects.create(
            name="Dist-A",
            type="distributor",
            is_active=True,
        )
        self.site = WPSite.objects.create(
            distributor=self.distributor,
            site_url="https://example-shop.test",
            consumer_key="ck_x",
            consumer_secret="cs_x",
            is_active=True,
        )
        DistributorSelection.objects.create(
            distributor=self.distributor,
            master_sku=self.sku,
        )
        self.mapping, _ = WPProductMapping.objects.get_or_create(
            master_sku=self.sku,
            wp_site=self.site,
            defaults={
                "wp_product_id": 321,
                "wp_sku": self.sku.master_code,
                "sync_status": "draft",
            },
        )
        if not self.mapping.wp_product_id:
            self.mapping.wp_product_id = 321
        self.mapping.wp_sku = self.sku.master_code
        self.mapping.sync_status = "draft"
        self.mapping.sync_error = ""
        self.mapping.save(update_fields=["wp_product_id", "wp_sku", "sync_status", "sync_error"])

    def _operate(self, action: str, user, extra_data=None):
        payload = {
            "master_sku_id": self.sku.id,
            "site_id": self.site.id,
            "action": action,
        }
        if extra_data:
            payload.update(extra_data)
        self.client.force_authenticate(user=user)
        return self.client.post(
            f"/api/distributors/{self.distributor.id}/site_operation/",
            payload,
            format="json",
        )

    def test_site_publish_requires_staff(self):
        res = self._operate("publish", self.normal_user)
        self.assertEqual(res.status_code, 403)

    def test_site_publish_requires_publishable_status(self):
        self.sku.review_status = "draft"
        self.sku.save(update_fields=["review_status"])
        res = self._operate("publish", self.operator)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "当前状态不可发布到站点，请先通过审核")

    @patch("sites.views.WooCommerceClient")
    def test_site_publish_updates_mapping_status(self, mock_client_cls):
        mock_client = mock_client_cls.return_value
        mock_client.update_product.return_value = {"id": self.mapping.wp_product_id}

        res = self._operate("publish", self.operator)

        self.assertEqual(res.status_code, 200)
        self.mapping.refresh_from_db()
        self.assertEqual(self.mapping.sync_status, "synced")
        self.assertEqual(self.mapping.sync_error, "")

    @patch("sites.views.WooCommerceClient")
    def test_site_revoke_updates_mapping_to_draft(self, mock_client_cls):
        self.mapping.sync_status = "synced"
        self.mapping.save(update_fields=["sync_status"])
        mock_client = mock_client_cls.return_value
        mock_client.update_product.return_value = {"id": self.mapping.wp_product_id}

        res = self._operate("revoke", self.operator)

        self.assertEqual(res.status_code, 200)
        self.mapping.refresh_from_db()
        self.assertEqual(self.mapping.sync_status, "draft")

    @patch("sites.views.WooCommerceClient")
    def test_site_publish_failure_sets_failed_and_returns_502(self, mock_client_cls):
        mock_client = mock_client_cls.return_value
        mock_client.update_product.side_effect = Exception("wp timeout")

        res = self._operate("publish", self.operator)

        self.assertEqual(res.status_code, 502)
        self.mapping.refresh_from_db()
        self.assertEqual(self.mapping.sync_status, "failed")
        self.assertIn("wp timeout", self.mapping.sync_error)

    @override_settings(DEBUG=True)
    @patch("sites.views.WooCommerceClient")
    def test_site_publish_simulate_success_bypasses_wp_client(self, mock_client_cls):
        mock_client_cls.side_effect = AssertionError("WooCommerceClient should not be called")

        res = self._operate("publish", self.operator, {"simulate_success": True})

        self.assertEqual(res.status_code, 200)
        self.mapping.refresh_from_db()
        self.assertEqual(self.mapping.sync_status, "synced")
        self.assertEqual(self.mapping.sync_error, "")

    @override_settings(DEBUG=True)
    @patch("sites.views.WooCommerceClient")
    def test_site_revoke_simulate_success_bypasses_wp_client(self, mock_client_cls):
        self.mapping.sync_status = "synced"
        self.mapping.save(update_fields=["sync_status"])
        mock_client_cls.side_effect = AssertionError("WooCommerceClient should not be called")

        res = self._operate("revoke", self.operator, {"simulate_success": True})

        self.assertEqual(res.status_code, 200)
        self.mapping.refresh_from_db()
        self.assertEqual(self.mapping.sync_status, "draft")
        self.assertEqual(self.mapping.sync_error, "")
