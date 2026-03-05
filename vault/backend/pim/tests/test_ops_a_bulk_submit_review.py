from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import MasterSKU


class OPSABulkSubmitReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_ops_a_bulk_review",
            password="123456",
            is_staff=True,  # 批量提交审核需要审核员权限
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/products/bulk-action/"

        self.draft1 = MasterSKU.objects.create(
            master_code="vc-u-2001",
            title_en="Draft SKU 1",
            selling_price=Decimal("10.00"),
            review_status="draft",
        )
        self.draft2 = MasterSKU.objects.create(
            master_code="vc-u-2002",
            title_en="Draft SKU 2",
            selling_price=Decimal("20.00"),
            review_status="draft",
        )
        self.pending = MasterSKU.objects.create(
            master_code="vc-u-2003",
            title_en="Pending SKU",
            selling_price=Decimal("30.00"),
            review_status="pending_review",
        )

    def test_bulk_submit_review_only_moves_draft_to_pending(self):
        res = self.client.post(
            self.url,
            {
                "ids": [self.draft1.id, self.draft2.id, self.pending.id],
                "action": "submit_review",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["affected"], 3)
        self.assertEqual(res.data["submitted"], 2)

        self.draft1.refresh_from_db()
        self.draft2.refresh_from_db()
        self.pending.refresh_from_db()

        self.assertEqual(self.draft1.review_status, "pending_review")
        self.assertEqual(self.draft2.review_status, "pending_review")
        self.assertEqual(self.pending.review_status, "pending_review")
        self.assertEqual(self.draft1.review_submitted_by_id, self.user.id)
        self.assertEqual(self.draft1.review_submit_count, 1)

