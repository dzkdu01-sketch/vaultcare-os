"""
PIM-F1 + PIM-F2 建档入口统一测试
验证 AI 新增和手动新增两条链路都能：
1. 落到草稿态
2. 字段口径一致
3. 能进入后续审核流
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Category, MasterSKU, OperationalTag


class PIMF1F2UnifiedEntryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username='test_user',
            password='123456',
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.get(code='1')
        self.op_tag, _ = OperationalTag.objects.get_or_create(name='best_seller')

    def test_manual_draft_creates_draft_status(self):
        """手动新增创建后为草稿态"""
        res = self.client.post('/api/products/create-manual-draft/', {
            'title_en': 'Manual Product',
            'title_ar': 'عربي',
            'title_th': 'ไทย',
            'primary_category': self.category.id,
            'region': 'a',
            'selling_price': '99.00',
            'audience_tags': ['for_her'],
            'operational_tag_ids': [self.op_tag.id],
            'image_urls': ['http://example.com/img.jpg'],
        }, format='json')
        self.assertEqual(res.status_code, 201)
        sku = MasterSKU.objects.get(id=res.data['id'])
        self.assertEqual(sku.review_status, 'draft')
        self.assertFalse(sku.is_active)
        self.assertEqual(sku.title_th, 'ไทย')

    def test_ai_draft_creates_draft_status(self):
        """AI 新增创建后为草稿态"""
        res = self.client.post('/api/products/create-ai-draft/', {
            'title_en': 'AI Product',
            'title_ar': 'عربي',
            'title_th': 'ไทย',
            'primary_category': self.category.id,
            'region': 'u',
            'selling_price': '88.00',
            'audience_tags': ['for_him'],
            'operational_tag_ids': [self.op_tag.id],
            'image_urls': ['http://example.com/ai.jpg'],
        }, format='json')
        self.assertEqual(res.status_code, 201)
        sku = MasterSKU.objects.get(id=res.data['id'])
        self.assertEqual(sku.review_status, 'draft')
        self.assertFalse(sku.is_active)
        self.assertEqual(sku.title_th, 'ไทย')

    def test_manual_draft_can_submit_review(self):
        """手动新增草稿可提交审核"""
        res = self.client.post('/api/products/create-manual-draft/', {
            'title_en': 'Review Test',
            'primary_category': self.category.id,
            'region': 'u',
            'selling_price': '50.00',
            'image_urls': ['http://example.com/test.jpg'],
        }, format='json')
        sku_id = res.data['id']

        # 提交审核
        res = self.client.post(f'/api/products/{sku_id}/submit_review/', {}, format='json')
        self.assertEqual(res.status_code, 200)

        sku = MasterSKU.objects.get(id=sku_id)
        self.assertEqual(sku.review_status, 'pending_review')
        self.assertEqual(sku.review_submitted_by, self.user)

    def test_ai_draft_can_submit_review(self):
        """AI 新增草稿可提交审核"""
        res = self.client.post('/api/products/create-ai-draft/', {
            'title_en': 'AI Review Test',
            'primary_category': self.category.id,
            'region': 'u',
            'selling_price': '60.00',
            'image_urls': ['http://example.com/ai-test.jpg'],
        }, format='json')
        sku_id = res.data['id']

        # 提交审核
        res = self.client.post(f'/api/products/{sku_id}/submit_review/', {}, format='json')
        self.assertEqual(res.status_code, 200)

        sku = MasterSKU.objects.get(id=sku_id)
        self.assertEqual(sku.review_status, 'pending_review')
        self.assertEqual(sku.review_submitted_by, self.user)

    def test_both_entries_have_same_fields(self):
        """两种入口创建的草稿字段一致"""
        # 手动新增
        manual_res = self.client.post('/api/products/create-manual-draft/', {
            'title_en': 'Field Test',
            'title_ar': 'عربي',
            'title_th': 'ไทย',
            'primary_category': self.category.id,
            'region': 'a',
            'selling_price': '77.00',
            'regular_price': '99.00',
            'audience_tags': ['for_her', 'for_him'],
            'operational_tag_ids': [self.op_tag.id],
            'image_urls': ['http://example.com/manual.jpg'],
            'is_featured': True,
        }, format='json')

        # AI 新增
        ai_res = self.client.post('/api/products/create-ai-draft/', {
            'title_en': 'Field Test',
            'title_ar': 'عربي',
            'title_th': 'ไทย',
            'primary_category': self.category.id,
            'region': 'a',
            'selling_price': '77.00',
            'regular_price': '99.00',
            'audience_tags': ['for_her', 'for_him'],
            'operational_tag_ids': [self.op_tag.id],
            'image_urls': ['http://example.com/ai.jpg'],
            'is_featured': True,
        }, format='json')

        manual_data = manual_res.data
        ai_data = ai_res.data

        # 验证关键字段一致
        self.assertEqual(manual_data['title_en'], ai_data['title_en'])
        self.assertEqual(manual_data['title_ar'], ai_data['title_ar'])
        self.assertEqual(manual_data['title_th'], ai_data['title_th'])
        self.assertEqual(manual_data['region'], ai_data['region'])
        self.assertEqual(manual_data['selling_price'], ai_data['selling_price'])
        self.assertEqual(manual_data['review_status'], ai_data['review_status'])
        self.assertEqual(manual_data['is_active'], ai_data['is_active'])

    def test_full_review_flow_from_manual_draft(self):
        """手动新增草稿完整审核流程"""
        res = self.client.post('/api/products/create-manual-draft/', {
            'title_en': 'Full Flow Manual',
            'primary_category': self.category.id,
            'region': 'u',
            'selling_price': '50.00',
            'image_urls': ['http://example.com/flow.jpg'],
        }, format='json')
        sku_id = res.data['id']

        # 提交审核
        self.client.post(f'/api/products/{sku_id}/submit_review/', {}, format='json')

        # 审核员审核通过
        staff_user = get_user_model().objects.create_user(
            username='staff', password='123', is_staff=True
        )
        self.client.force_authenticate(user=staff_user)
        res = self.client.post(f'/api/products/{sku_id}/approve_review/', {}, format='json')
        self.assertEqual(res.status_code, 200)

        # 验证可上架
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(f'/api/products/{sku_id}/', {'is_active': True}, format='json')
        self.assertEqual(res.status_code, 200)

        sku = MasterSKU.objects.get(id=sku_id)
        self.assertTrue(sku.is_active)
        self.assertEqual(sku.review_status, 'publishable')

    def test_full_review_flow_from_ai_draft(self):
        """AI 新增草稿完整审核流程"""
        res = self.client.post('/api/products/create-ai-draft/', {
            'title_en': 'Full Flow AI',
            'primary_category': self.category.id,
            'region': 'u',
            'selling_price': '50.00',
            'image_urls': ['http://example.com/ai-flow.jpg'],
        }, format='json')
        sku_id = res.data['id']

        # 提交审核
        self.client.post(f'/api/products/{sku_id}/submit_review/', {}, format='json')

        # 审核员审核通过
        staff_user = get_user_model().objects.create_user(
            username='staff2', password='123', is_staff=True
        )
        self.client.force_authenticate(user=staff_user)
        res = self.client.post(f'/api/products/{sku_id}/approve_review/', {}, format='json')
        self.assertEqual(res.status_code, 200)

        # 验证可上架
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(f'/api/products/{sku_id}/', {'is_active': True}, format='json')
        self.assertEqual(res.status_code, 200)

        sku = MasterSKU.objects.get(id=sku_id)
        self.assertTrue(sku.is_active)
        self.assertEqual(sku.review_status, 'publishable')
