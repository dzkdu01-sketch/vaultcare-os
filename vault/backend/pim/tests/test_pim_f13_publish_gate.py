from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMF13PublishGateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.submitter = get_user_model().objects.create_user(
            username="submitter",
            password="123456",
        )
        self.reviewer = get_user_model().objects.create_user(
            username="reviewer",
            password="123456",
            is_staff=True,
        )
        self.owner = get_user_model().objects.create_user(
            username="owner",
            password="123456",
            is_superuser=True,
            is_staff=True,
        )
        self.category = Category.objects.get(code="1")
        self.sku = MasterSKU.objects.create(
            master_code="vc-u-1001",
            title_en="Gate Product",
            primary_category=self.category,
            region="u",
            selling_price="88.00",
            is_active=False,
            review_status="draft",
        )

    def test_submit_review_moves_draft_to_pending(self):
        self.client.force_authenticate(user=self.submitter)
        res = self.client.post(f"/api/products/{self.sku.id}/submit_review/", {}, format="json")
        self.assertEqual(res.status_code, 200)
        self.sku.refresh_from_db()
        self.assertEqual(self.sku.review_status, "pending_review")

    def test_approve_requires_reviewer_role(self):
        self.client.force_authenticate(user=self.submitter)
        self.sku.review_status = "pending_review"
        self.sku.save(update_fields=["review_status"])
        res = self.client.post(f"/api/products/{self.sku.id}/approve_review/", {}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_approve_sets_publishable(self):
        self.client.force_authenticate(user=self.reviewer)
        self.sku.review_status = "pending_review"
        self.sku.save(update_fields=["review_status"])
        res = self.client.post(f"/api/products/{self.sku.id}/approve_review/", {}, format="json")
        self.assertEqual(res.status_code, 200)
        self.sku.refresh_from_db()
        self.assertEqual(self.sku.review_status, "publishable")

    def test_reject_back_to_draft_with_note(self):
        self.client.force_authenticate(user=self.reviewer)
        self.sku.review_status = "pending_review"
        self.sku.save(update_fields=["review_status"])
        res = self.client.post(
            f"/api/products/{self.sku.id}/reject_review/",
            {"review_note": "资料不完整"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.sku.refresh_from_db()
        self.assertEqual(self.sku.review_status, "draft")
        self.assertEqual(self.sku.review_note, "资料不完整")

    def test_cannot_publish_before_approval(self):
        self.client.force_authenticate(user=self.submitter)
        self.sku.review_status = "draft"
        self.sku.save(update_fields=["review_status"])
        res = self.client.patch(
            f"/api/products/{self.sku.id}/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "当前状态不可上架，请先通过审核")

    def test_can_publish_after_approval(self):
        self.client.force_authenticate(user=self.submitter)
        self.sku.review_status = "publishable"
        self.sku.save(update_fields=["review_status"])
        res = self.client.patch(
            f"/api/products/{self.sku.id}/",
            {"is_active": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.sku.refresh_from_db()
        self.assertTrue(self.sku.is_active)

    def test_emergency_publish_requires_owner(self):
        self.client.force_authenticate(user=self.reviewer)
        res = self.client.post(
            f"/api/products/{self.sku.id}/emergency_publish/",
            {"reason": "紧急活动上线"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_emergency_publish_sets_active_and_audit_fields(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            f"/api/products/{self.sku.id}/emergency_publish/",
            {"reason": "紧急活动上线"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.sku.refresh_from_db()
        self.assertTrue(self.sku.is_active)
        self.assertEqual(self.sku.review_status, "publishable")
        self.assertEqual(self.sku.emergency_override_reason, "紧急活动上线")
        self.assertEqual(self.sku.emergency_override_by_id, self.owner.id)
        self.assertIsNotNone(self.sku.emergency_override_at)
