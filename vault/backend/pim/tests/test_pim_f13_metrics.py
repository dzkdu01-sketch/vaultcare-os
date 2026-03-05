from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMF13MetricsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.submitter = get_user_model().objects.create_user(
            username="metric_submitter",
            password="123456",
        )
        self.reviewer = get_user_model().objects.create_user(
            username="metric_reviewer",
            password="123456",
            is_staff=True,
        )
        self.owner = get_user_model().objects.create_user(
            username="metric_owner",
            password="123456",
            is_staff=True,
            is_superuser=True,
        )
        self.category = Category.objects.get(code="1")

        self.sku_a = MasterSKU.objects.create(
            master_code="vc-u-2001",
            title_en="A",
            primary_category=self.category,
            region="u",
            selling_price="88.00",
            is_active=False,
            review_status="draft",
        )
        self.sku_b = MasterSKU.objects.create(
            master_code="vc-u-2002",
            title_en="B",
            primary_category=self.category,
            region="u",
            selling_price="88.00",
            is_active=False,
            review_status="draft",
        )
        self.sku_c = MasterSKU.objects.create(
            master_code="vc-u-2003",
            title_en="C",
            primary_category=self.category,
            region="u",
            selling_price="88.00",
            is_active=False,
            review_status="draft",
        )

    def test_review_metrics_aggregation(self):
        # A: 一次通过
        self.client.force_authenticate(user=self.submitter)
        self.client.post(f"/api/products/{self.sku_a.id}/submit_review/", {}, format="json")
        self.client.force_authenticate(user=self.reviewer)
        self.client.post(f"/api/products/{self.sku_a.id}/approve_review/", {}, format="json")

        # B: 驳回后重提再通过
        self.client.force_authenticate(user=self.submitter)
        self.client.post(f"/api/products/{self.sku_b.id}/submit_review/", {}, format="json")
        self.client.force_authenticate(user=self.reviewer)
        self.client.post(
            f"/api/products/{self.sku_b.id}/reject_review/",
            {"review_note": "补充资料"},
            format="json",
        )
        self.client.force_authenticate(user=self.submitter)
        self.client.post(f"/api/products/{self.sku_b.id}/submit_review/", {}, format="json")
        self.client.force_authenticate(user=self.reviewer)
        self.client.post(f"/api/products/{self.sku_b.id}/approve_review/", {}, format="json")

        # C: 老板紧急放行
        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f"/api/products/{self.sku_c.id}/emergency_publish/",
            {"reason": "大促紧急"},
            format="json",
        )

        self.client.force_authenticate(user=self.submitter)
        res = self.client.get("/api/products/review_metrics/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["approved_count"], 2)
        self.assertEqual(res.data["first_pass_approved_count"], 1)
        self.assertEqual(res.data["first_pass_rate"], 50.0)
        self.assertEqual(res.data["rework_count"], 1)
        self.assertEqual(res.data["emergency_override_count"], 1)

    def test_phase1_metrics_returns_daily_volume_and_time_to_review_ready(self):
        self.client.force_authenticate(user=self.submitter)

        # SKU A: 2 小时完成录入到可审核
        self.client.post(f"/api/products/{self.sku_a.id}/submit_review/", {}, format="json")
        review_a = MasterSKU.objects.get(id=self.sku_a.id).review_submitted_at
        MasterSKU.objects.filter(id=self.sku_a.id).update(created_at=review_a - timedelta(hours=2))

        # SKU B: 4 小时完成录入到可审核
        self.client.post(f"/api/products/{self.sku_b.id}/submit_review/", {}, format="json")
        review_b = MasterSKU.objects.get(id=self.sku_b.id).review_submitted_at
        MasterSKU.objects.filter(id=self.sku_b.id).update(created_at=review_b - timedelta(hours=4))

        # SKU C: 非当天提交，不计入 daily
        old_submit_at = timezone.now() - timedelta(days=2)
        MasterSKU.objects.filter(id=self.sku_c.id).update(
            review_status="pending_review",
            review_submitted_at=old_submit_at,
        )

        res = self.client.get("/api/products/phase1_metrics/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["review_ready_daily_count"], 2)
        self.assertEqual(res.data["review_ready_window_count"], 3)
        self.assertEqual(res.data["median_hours_to_review_ready"], 3.0)

    def test_phase1_metrics_returns_reviewer_processed_daily_count(self):
        # A: 提交后由审核员通过（应计入）
        self.client.force_authenticate(user=self.submitter)
        self.client.post(f"/api/products/{self.sku_a.id}/submit_review/", {}, format="json")
        self.client.force_authenticate(user=self.reviewer)
        self.client.post(f"/api/products/{self.sku_a.id}/approve_review/", {}, format="json")

        # B: 提交后由审核员驳回（应计入）
        self.client.force_authenticate(user=self.submitter)
        self.client.post(f"/api/products/{self.sku_b.id}/submit_review/", {}, format="json")
        self.client.force_authenticate(user=self.reviewer)
        self.client.post(
            f"/api/products/{self.sku_b.id}/reject_review/",
            {"review_note": "资料不足"},
            format="json",
        )

        # C: 老板紧急放行（不计入“审核员通过/驳回处理量”）
        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f"/api/products/{self.sku_c.id}/emergency_publish/",
            {"reason": "紧急上架"},
            format="json",
        )

        self.client.force_authenticate(user=self.submitter)
        res = self.client.get("/api/products/phase1_metrics/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["review_processed_daily_count"], 2)

    def test_phase1_metrics_returns_7day_trend(self):
        now = timezone.now()
        yesterday = now - timedelta(days=1)

        # today: ready=1 processed=1
        MasterSKU.objects.filter(id=self.sku_a.id).update(
            review_status="pending_review",
            review_submitted_at=now,
            created_at=now - timedelta(hours=2),
            reviewed_at=now,
            reviewed_by=self.reviewer,
            emergency_override_at=None,
        )
        # yesterday: ready=1 processed=0
        MasterSKU.objects.filter(id=self.sku_b.id).update(
            review_status="pending_review",
            review_submitted_at=yesterday,
            created_at=yesterday - timedelta(hours=3),
            reviewed_at=None,
            reviewed_by=None,
            emergency_override_at=None,
        )

        self.client.force_authenticate(user=self.submitter)
        res = self.client.get("/api/products/phase1_metrics/")
        self.assertEqual(res.status_code, 200)

        trend = res.data["daily_trend"]
        self.assertEqual(len(trend), 7)

        by_date = {item["date"]: item for item in trend}
        today_key = timezone.localtime(now).date().isoformat()
        yesterday_key = timezone.localtime(yesterday).date().isoformat()

        self.assertEqual(by_date[today_key]["review_ready_count"], 1)
        self.assertEqual(by_date[today_key]["review_processed_count"], 1)
        self.assertEqual(by_date[yesterday_key]["review_ready_count"], 1)
        self.assertEqual(by_date[yesterday_key]["review_processed_count"], 0)
