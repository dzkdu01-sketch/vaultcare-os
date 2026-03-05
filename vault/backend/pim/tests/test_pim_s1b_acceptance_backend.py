from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMS1BAcceptanceBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_s1b_acceptance",
            password="123456",
            is_staff=True,  # 批量操作需要审核员权限
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(code="T", name_en="Toys", name_zh="玩具")

        self.sku_uncategorized = MasterSKU.objects.create(
            master_code="vc-u-s1b-001",
            title_en="S1B SKU 1",
            title_ar="",
            selling_price=Decimal("19.99"),
            image_urls=[],
            audience_tags=["for_her"],
            is_active=True,
            review_status="draft",
        )
        self.sku_categorized = MasterSKU.objects.create(
            master_code="vc-u-s1b-002",
            title_en="S1B SKU 2",
            title_ar="عنوان",
            primary_category=self.category,
            selling_price=Decimal("29.99"),
            image_urls=["https://example.com/a.jpg"],
            audience_tags=["for_him"],
            is_active=True,
            review_status="draft",
        )
        self.sku_inactive = MasterSKU.objects.create(
            master_code="vc-u-s1b-003",
            title_en="S1B SKU 3",
            title_ar="",  # 不能为 None，改为空字符串
            primary_category=self.category,
            selling_price=Decimal("39.99"),
            image_urls=["https://example.com/b.jpg"],
            audience_tags=["for_couples"],
            is_active=False,
            review_status="draft",
        )

    def test_stats_returns_expected_quick_filter_counts(self):
        res = self.client.get("/api/products/stats/")
        self.assertEqual(res.status_code, 200)

        self.assertEqual(res.data["total"], 3)
        self.assertEqual(res.data["active"], 2)
        self.assertEqual(res.data["inactive"], 1)
        self.assertEqual(res.data["uncategorized"], 1)
        self.assertEqual(res.data["missing_title_ar"], 2)
        self.assertEqual(res.data["missing_image"], 1)

    def test_list_filters_by_audience_tags_chip(self):
        res = self.client.get("/api/products/", {"audience_tags": ["for_her"]}, format="json")
        self.assertEqual(res.status_code, 200)

        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["master_code"], self.sku_uncategorized.master_code)

    def test_bulk_deactivate_updates_active_status(self):
        res = self.client.post(
            "/api/products/bulk-action/",
            {
                "ids": [self.sku_uncategorized.id, self.sku_categorized.id],
                "action": "deactivate",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["affected"], 2)

        self.sku_uncategorized.refresh_from_db()
        self.sku_categorized.refresh_from_db()
        self.assertFalse(self.sku_uncategorized.is_active)
        self.assertFalse(self.sku_categorized.is_active)

