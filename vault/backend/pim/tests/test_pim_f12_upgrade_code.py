from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU, MasterCodeSequence


class PIMF12UpgradeCodeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="tester_f12",
            password="123456",
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code="1")

        # 创建一个旧编码商品（非 vc- 格式）
        self.old_sku = MasterSKU.objects.create(
            master_code="QR42",
            legacy_code="",
            title_en="Old Product",
            primary_category=self.category,
            region="u",
            selling_price=Decimal("10.00"),
            is_active=True,
        )

        # 创建一个已升级的商品（vc- 格式）
        self.new_sku = MasterSKU.objects.create(
            master_code="vc-u-9999",
            legacy_code="OLD001",
            title_en="New Product",
            primary_category=self.category,
            region="u",
            selling_price=Decimal("20.00"),
            is_active=True,
        )

    def test_upgrade_code_for_old_sku(self):
        """测试旧编码商品可以升级到规范编码"""
        url = f"/api/products/{self.old_sku.id}/upgrade_code/"

        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("old_code", res.data)
        self.assertIn("new_code", res.data)
        self.assertEqual(res.data["old_code"], "QR42")
        self.assertTrue(res.data["new_code"].startswith("vc-u-1"))

        # 验证数据库已更新
        self.old_sku.refresh_from_db()
        self.assertEqual(self.old_sku.master_code, res.data["new_code"])
        self.assertEqual(self.old_sku.legacy_code, "QR42")

    def test_upgrade_code_already_upgraded(self):
        """测试已升级商品不能再次升级"""
        url = f"/api/products/{self.new_sku.id}/upgrade_code/"

        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("已使用规范编码", res.data.get("detail", ""))

    def test_upgrade_code_uses_region_and_category(self):
        """测试升级时使用商品的 region 和 primary_category 生成编码"""
        # 创建一个泰国市场的商品（使用不同的旧编码避免冲突）
        th_category = Category.objects.get(code="4")
        th_sku = MasterSKU.objects.create(
            master_code="TH_OLD_99",
            legacy_code="",
            title_en="Thailand Product",
            primary_category=th_category,
            region="t",
            selling_price=Decimal("15.00"),
            is_active=True,
        )
        url = f"/api/products/{th_sku.id}/upgrade_code/"

        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, 200)
        # 应该生成 vc-t-4xxx 格式的编码
        self.assertTrue(res.data["new_code"].startswith("vc-t-4"))

    def test_upgrade_code_preserves_legacy_code(self):
        """测试升级后旧编码保留在 legacy_code 字段"""
        # 创建一个新的测试商品
        test_sku = MasterSKU.objects.create(
            master_code="OLD_LEGACY_TEST",
            legacy_code="",
            title_en="Legacy Test Product",
            primary_category=self.category,
            region="u",
            selling_price=Decimal("25.00"),
            is_active=True,
        )
        url = f"/api/products/{test_sku.id}/upgrade_code/"

        res = self.client.post(url, {}, format="json")
        self.assertEqual(res.status_code, 200)

        test_sku.refresh_from_db()
        # 旧编码应该保留在 legacy_code
        self.assertEqual(test_sku.legacy_code, "OLD_LEGACY_TEST")
        # master_code 应该是新编码
        self.assertTrue(test_sku.master_code.startswith("vc-"))
        # 新编码和旧编码不能相同
        self.assertNotEqual(test_sku.master_code, test_sku.legacy_code)
