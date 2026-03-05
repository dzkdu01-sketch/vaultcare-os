from unittest.mock import patch
import re

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient


class PIMAIAnalyzeImagesFallbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_ai_fallback",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.url = "/api/ai/analyze-images/"

    @patch("pim.ai_service.analyze_product_images")
    def test_analyze_images_returns_editable_fallback_when_ai_unavailable(self, mock_analyze):
        mock_analyze.side_effect = RuntimeError("Claude API temporary unavailable")
        upload = SimpleUploadedFile("sample.png", b"fake-image-bytes", content_type="image/png")

        res = self.client.post(self.url, {"images": upload}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["degraded"])
        self.assertEqual(res.data["primary_category"], "other")
        self.assertEqual(res.data["audience_tags"], [])
        self.assertEqual(res.data["operational_tags"], [])
        self.assertIn("AI 服务暂不可用", res.data["notes"])
        self.assertEqual(res.data["error_code"], "AI_UPSTREAM_UNAVAILABLE")
        self.assertTrue(res.data["retryable"])
        self.assertTrue(re.match(r"^[0-9a-f-]{36}$", res.data["trace_id"]))

    @patch("pim.ai_service.analyze_product_images")
    def test_analyze_images_returns_observable_error_fields_for_unexpected_exception(self, mock_analyze):
        mock_analyze.side_effect = Exception("unknown boom")
        upload = SimpleUploadedFile("sample.png", b"fake-image-bytes", content_type="image/png")

        res = self.client.post(self.url, {"images": upload}, format="multipart")
        self.assertEqual(res.status_code, 500)
        self.assertEqual(res.data["error_code"], "AI_ANALYZE_INTERNAL_ERROR")
        self.assertFalse(res.data["retryable"])
        self.assertTrue(re.match(r"^[0-9a-f-]{36}$", res.data["trace_id"]))

