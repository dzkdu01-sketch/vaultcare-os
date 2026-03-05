from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from pim.models import Category, ImportBatchAlert, ImportBatchWorkorder, MasterSKU


class PIMF17ImportBatchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_f17",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code="1")

        self.existing = MasterSKU.objects.create(
            master_code="vc-u-3001",
            title_en="Old Name",
            primary_category=self.category,
            region="u",
            selling_price="10.00",
            is_active=True,
        )

    def test_import_csv_creates_batch_audit(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertIn("import_batch_id", res.data)
        self.assertEqual(res.data["success_count"], 1)
        self.assertEqual(res.data["failed_count"], 1)

        list_res = self.client.get("/api/products/import-batches/")
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(len(list_res.data), 1)
        self.assertEqual(list_res.data[0]["id"], res.data["import_batch_id"])
        self.assertEqual(list_res.data[0]["failed_count"], 1)

    def test_retry_failed_rows_only(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        batch_id = res.data["import_batch_id"]

        # 先补齐缺失商品，再执行“仅重试失败行”
        MasterSKU.objects.create(
            master_code="vc-u-3999",
            title_en="Seed Missing",
            primary_category=self.category,
            region="u",
            selling_price="9.00",
            is_active=True,
        )
        retry_res = self.client.post(f"/api/products/import-batches/{batch_id}/retry-failed/", {}, format="json")
        self.assertEqual(retry_res.status_code, 200)
        self.assertEqual(retry_res.data["retried_count"], 1)
        self.assertEqual(retry_res.data["fixed_count"], 1)
        self.assertEqual(retry_res.data["still_failed_count"], 0)

        fixed = MasterSKU.objects.get(master_code="vc-u-3999")
        self.assertEqual(fixed.title_en, "Missing Row")

    def test_create_workorder_for_escalated_batch(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        batch_id = res.data["import_batch_id"]

        # 调整为超过 48h，触发升级条件
        old_ts = timezone.now() - timedelta(hours=49)
        from pim.models import ImportBatch
        ImportBatch.objects.filter(id=batch_id).update(created_at=old_ts)

        create_res = self.client.post(f"/api/products/import-batches/{batch_id}/create-workorder/", {}, format="json")
        self.assertEqual(create_res.status_code, 200)
        self.assertEqual(create_res.data["created"], True)
        self.assertTrue(create_res.data["workorder_id"])
        self.assertEqual(ImportBatchWorkorder.objects.filter(batch_id=batch_id).count(), 1)

    def test_create_workorder_is_idempotent(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        batch_id = res.data["import_batch_id"]

        old_ts = timezone.now() - timedelta(hours=49)
        from pim.models import ImportBatch
        ImportBatch.objects.filter(id=batch_id).update(created_at=old_ts)

        first_res = self.client.post(f"/api/products/import-batches/{batch_id}/create-workorder/", {}, format="json")
        self.assertEqual(first_res.status_code, 200)
        self.assertEqual(first_res.data["created"], True)
        workorder_id = first_res.data["workorder_id"]

        second_res = self.client.post(f"/api/products/import-batches/{batch_id}/create-workorder/", {}, format="json")
        self.assertEqual(second_res.status_code, 200)
        self.assertEqual(second_res.data["created"], False)
        self.assertEqual(second_res.data["workorder_id"], workorder_id)
        self.assertEqual(ImportBatchWorkorder.objects.filter(batch_id=batch_id).count(), 1)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_send_alert_supports_message_and_email_channels(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        batch_id = res.data["import_batch_id"]

        old_ts = timezone.now() - timedelta(hours=49)
        from pim.models import ImportBatch
        ImportBatch.objects.filter(id=batch_id).update(created_at=old_ts)

        alert_res = self.client.post(
            f"/api/products/import-batches/{batch_id}/send-alert/",
            {
                "channels": ["message", "email"],
                "email_recipients": ["ops@example.com"],
            },
            format="json",
        )
        self.assertEqual(alert_res.status_code, 200)
        self.assertEqual(alert_res.data["sent_count"], 2)
        self.assertEqual(alert_res.data["failed_count"], 0)
        self.assertEqual(ImportBatchAlert.objects.filter(batch_id=batch_id).count(), 2)

        from django.core import mail
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f"Batch#{batch_id}", mail.outbox[0].subject)

    def test_send_alert_requires_escalation_condition(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-3001,Updated Name,20.00,Vibrators\n"
            "vc-u-3999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile("products.csv", csv_text.encode("utf-8"), content_type="text/csv")
        res = self.client.post("/api/products/import-csv/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        batch_id = res.data["import_batch_id"]

        alert_res = self.client.post(
            f"/api/products/import-batches/{batch_id}/send-alert/",
            {"channels": ["message"]},
            format="json",
        )
        self.assertEqual(alert_res.status_code, 400)
