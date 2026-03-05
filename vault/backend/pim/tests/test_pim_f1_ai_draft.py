from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMF1AIDraftCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code="1")
        self.url = "/api/products/create-ai-draft/"

    def test_create_ai_draft_forces_inactive_and_persists_fields(self):
        payload = {
            "title_en": "AI Product",
            "title_ar": "منتج",
            "short_description": "short desc",
            "description": "long desc",
            "primary_category": self.category.id,
            "region": "u",
            "selling_price": "88.00",
            "regular_price": "99.00",
            "is_active": True,  # 即使传 true，也必须落草稿
            "image_urls": [
                "data:image/png;base64,AAA",
                "data:image/png;base64,BBB",
            ],
            "audience_tags": ["for_her"],
        }

        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)

        sku = MasterSKU.objects.get(id=res.data["id"])
        self.assertFalse(sku.is_active)
        self.assertEqual(sku.primary_category_id, self.category.id)
        self.assertEqual(sku.image_urls, payload["image_urls"])

    def test_create_ai_draft_requires_primary_category(self):
        payload = {
            "title_en": "AI Product",
            "region": "u",
            "selling_price": "88.00",
            "image_urls": ["data:image/png;base64,AAA"],
        }

        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "primary_category 不能为空")

    def test_create_ai_draft_requires_image_urls(self):
        payload = {
            "title_en": "AI Product",
            "primary_category": self.category.id,
            "region": "u",
            "selling_price": "88.00",
            "image_urls": [],
        }

        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "image_urls 至少需要 1 张图片")

    def test_create_ai_draft_accepts_operational_tag_names(self):
        payload = {
            "title_en": "AI Product",
            "title_ar": "منتج",
            "short_description": "short desc",
            "description": "long desc",
            "primary_category": self.category.id,
            "region": "u",
            "selling_price": "88.00",
            "regular_price": "99.00",
            "image_urls": [
                "data:image/png;base64,AAA",
            ],
            "audience_tags": ["for_her", "unknown_tag"],
            "operational_tags": ["best_seller", "new_arrival", "unknown_op_tag"],
        }

        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        sku = MasterSKU.objects.get(id=res.data["id"])
        self.assertEqual(sku.audience_tags, ["for_her"])
        self.assertEqual(
            sorted(list(sku.operational_tags.values_list("name", flat=True))),
            ["best_seller", "new_arrival"],
        )
