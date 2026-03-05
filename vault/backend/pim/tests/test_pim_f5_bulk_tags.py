from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import MasterSKU, OperationalTag


class PIMF5BulkTagsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_bulk_tags",
            password="123456",
            is_staff=True,  # 批量标签操作需要审核员权限
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/products/bulk-action/"

        self.sku1 = MasterSKU.objects.create(
            master_code="vc-u-1001",
            title_en="SKU 1",
            selling_price=Decimal("10.00"),
            audience_tags=["for_her"],
        )
        self.sku2 = MasterSKU.objects.create(
            master_code="vc-u-1002",
            title_en="SKU 2",
            selling_price=Decimal("20.00"),
            audience_tags=[],
        )
        self.best_seller, _ = OperationalTag.objects.get_or_create(name="best_seller")
        self.new_arrival, _ = OperationalTag.objects.get_or_create(name="new_arrival")

    def test_bulk_add_and_remove_audience_tags(self):
        add_res = self.client.post(
            self.url,
            {
                "ids": [self.sku1.id, self.sku2.id],
                "action": "add_audience_tags",
                "params": {"tags": ["for_him", "unknown_tag"]},
            },
            format="json",
        )
        self.assertEqual(add_res.status_code, 200)
        self.assertEqual(add_res.data["affected"], 2)

        self.sku1.refresh_from_db()
        self.sku2.refresh_from_db()
        self.assertEqual(sorted(self.sku1.audience_tags), ["for_her", "for_him"])
        self.assertEqual(self.sku2.audience_tags, ["for_him"])

        remove_res = self.client.post(
            self.url,
            {
                "ids": [self.sku1.id, self.sku2.id],
                "action": "remove_audience_tags",
                "params": {"tags": ["for_him"]},
            },
            format="json",
        )
        self.assertEqual(remove_res.status_code, 200)
        self.assertEqual(remove_res.data["affected"], 2)

        self.sku1.refresh_from_db()
        self.sku2.refresh_from_db()
        self.assertEqual(self.sku1.audience_tags, ["for_her"])
        self.assertEqual(self.sku2.audience_tags, [])

    def test_bulk_add_and_remove_operational_tags_by_name(self):
        add_res = self.client.post(
            self.url,
            {
                "ids": [self.sku1.id, self.sku2.id],
                "action": "add_operational_tags",
                "params": {"tag_names": ["best_seller", "new_arrival", "unknown_op"]},
            },
            format="json",
        )
        self.assertEqual(add_res.status_code, 200)
        self.assertEqual(add_res.data["affected"], 2)

        self.assertEqual(
            sorted(self.sku1.operational_tags.values_list("name", flat=True)),
            ["best_seller", "new_arrival"],
        )
        self.assertEqual(
            sorted(self.sku2.operational_tags.values_list("name", flat=True)),
            ["best_seller", "new_arrival"],
        )

        remove_res = self.client.post(
            self.url,
            {
                "ids": [self.sku1.id, self.sku2.id],
                "action": "remove_operational_tags",
                "params": {"tag_names": ["new_arrival"]},
            },
            format="json",
        )
        self.assertEqual(remove_res.status_code, 200)
        self.assertEqual(remove_res.data["affected"], 2)

        self.assertEqual(
            list(self.sku1.operational_tags.values_list("name", flat=True)),
            ["best_seller"],
        )
        self.assertEqual(
            list(self.sku2.operational_tags.values_list("name", flat=True)),
            ["best_seller"],
        )
