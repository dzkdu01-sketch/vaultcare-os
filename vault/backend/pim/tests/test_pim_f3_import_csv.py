from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU


class PIMF3ImportCsvTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester3",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code="1")
        self.url = "/api/products/import-csv/"

        self.existing = MasterSKU.objects.create(
            master_code="vc-u-1001",
            title_en="Old Name",
            primary_category=self.category,
            region="u",
            selling_price="10.00",
            is_active=True,
        )

    def test_import_csv_reports_missing_master_code_as_failed_and_continue(self):
        csv_text = (
            "master_code,title_en,selling_price,primary_category\n"
            "vc-u-1001,Updated Name,20.00,Vibrators\n"
            "vc-u-9999,Missing Row,30.00,Vibrators\n"
        )
        upload = SimpleUploadedFile(
            "products.csv",
            csv_text.encode("utf-8"),
            content_type="text/csv",
        )

        res = self.client.post(self.url, {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)

        # 旧字段兼容
        self.assertEqual(res.data["updated"], 1)
        self.assertEqual(res.data["skipped"], 0)

        # 新口径字段
        self.assertEqual(res.data["success_count"], 1)
        self.assertEqual(res.data["failed_count"], 1)
        self.assertEqual(len(res.data["failed_rows"]), 1)
        self.assertIn("master_code 不存在", res.data["failed_rows"][0]["reason"])

        self.existing.refresh_from_db()
        self.assertEqual(self.existing.title_en, "Updated Name")

