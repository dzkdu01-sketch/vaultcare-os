from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMF2ManualDraftCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester2",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code="1")
        self.url = "/api/products/create-manual-draft/"

    def test_create_manual_draft_forces_inactive(self):
        payload = {
            "title_en": "Manual Product",
            "primary_category": self.category.id,
            "region": "u",
            "selling_price": "77.00",
            "is_active": True,
            "image_urls": [],
        }

        res = self.client.post(self.url, payload, format="json")
        self.assertEqual(res.status_code, 201)

        sku = MasterSKU.objects.get(id=res.data["id"])
        self.assertFalse(sku.is_active)
        self.assertEqual(sku.primary_category_id, self.category.id)

