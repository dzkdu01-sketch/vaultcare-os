from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from pim.models import Brand, Category, MasterSKU, OperationalTag, Supplier, SupplierSKU


class PIMW3DictionaryManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.editor = get_user_model().objects.create_user(
            username='tester_w3_dict_editor',
            password='123456',
            is_staff=True,
        )
        self.viewer = get_user_model().objects.create_user(
            username='tester_w3_dict_viewer',
            password='123456',
        )
        self.client.force_authenticate(user=self.editor)

    def test_category_crud_and_filter(self):
        create_res = self.client.post(
            '/api/categories/',
            {'code': 'Z', 'name_en': 'Test Cat', 'name_zh': '测试分类'},
            format='json',
        )
        self.assertEqual(create_res.status_code, 201)
        category_id = create_res.data['id']

        patch_res = self.client.patch(
            f'/api/categories/{category_id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(patch_res.status_code, 200)

        default_list = self.client.get('/api/categories/')
        active_ids = [item['id'] for item in default_list.data['results']]
        self.assertNotIn(category_id, active_ids)

        with_inactive = self.client.get('/api/categories/?include_inactive=true')
        all_ids = [item['id'] for item in with_inactive.data['results']]
        self.assertIn(category_id, all_ids)

    def test_operational_tag_crud(self):
        create_res = self.client.post(
            '/api/operational-tags/',
            {'name': 'dict_tag_x'},
            format='json',
        )
        self.assertEqual(create_res.status_code, 201)
        tag_id = create_res.data['id']

        update_res = self.client.patch(
            f'/api/operational-tags/{tag_id}/',
            {'name': 'dict_tag_y'},
            format='json',
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.data['name'], 'dict_tag_y')

    def test_brand_crud(self):
        create_res = self.client.post(
            '/api/brands/',
            {'name': 'Brand A'},
            format='json',
        )
        self.assertEqual(create_res.status_code, 201)
        brand_id = create_res.data['id']

        update_res = self.client.patch(
            f'/api/brands/{brand_id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertFalse(update_res.data['is_active'])

        self.assertEqual(Brand.objects.filter(id=brand_id, is_active=False).count(), 1)

    def test_requires_authentication(self):
        unauthenticated = APIClient()
        res = unauthenticated.get('/api/categories/')
        self.assertEqual(res.status_code, 401)

    def test_non_editor_cannot_write_dictionary(self):
        viewer_client = APIClient()
        viewer_client.force_authenticate(user=self.viewer)

        create_res = viewer_client.post(
            '/api/brands/',
            {'name': 'Viewer Brand'},
            format='json',
        )
        self.assertEqual(create_res.status_code, 403)

    def test_seed_models_still_queryable(self):
        # 防止后续改动影响基础模型可用性
        Category.objects.create(code='Y', name_en='Seed', name_zh='种子')
        OperationalTag.objects.create(name='seed_tag')
        Brand.objects.create(name='Seed Brand')
        self.assertTrue(Category.objects.filter(code='Y', is_active=True).exists())
        self.assertTrue(OperationalTag.objects.filter(name='seed_tag', is_active=True).exists())
        self.assertTrue(Brand.objects.filter(name='Seed Brand', is_active=True).exists())

    def test_category_deactivate_with_replacement_remaps_products(self):
        old_cat = Category.objects.create(code='B', name_en='Old Cat', name_zh='旧分类')
        new_cat = Category.objects.create(code='C', name_en='New Cat', name_zh='新分类')
        sku = MasterSKU.objects.create(
            master_code='vc-u-B001',
            title_en='SKU A',
            primary_category=old_cat,
        )
        sku.categories.add(old_cat)

        res = self.client.post(
            f'/api/categories/{old_cat.id}/deactivate-with-replacement/',
            {'replacement_id': new_cat.id},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        old_cat.refresh_from_db()
        sku.refresh_from_db()
        self.assertFalse(old_cat.is_active)
        self.assertEqual(sku.primary_category_id, new_cat.id)
        self.assertTrue(sku.categories.filter(id=new_cat.id).exists())
        self.assertFalse(sku.categories.filter(id=old_cat.id).exists())

    def test_tag_deactivate_with_replacement_remaps_products(self):
        old_tag = OperationalTag.objects.create(name='old_tag')
        new_tag = OperationalTag.objects.create(name='new_tag')
        sku = MasterSKU.objects.create(master_code='vc-u-9001', title_en='SKU T')
        sku.operational_tags.add(old_tag)

        res = self.client.post(
            f'/api/operational-tags/{old_tag.id}/deactivate-with-replacement/',
            {'replacement_id': new_tag.id},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        old_tag.refresh_from_db()
        sku.refresh_from_db()
        self.assertFalse(old_tag.is_active)
        self.assertTrue(sku.operational_tags.filter(id=new_tag.id).exists())
        self.assertFalse(sku.operational_tags.filter(id=old_tag.id).exists())

    def test_supplier_deactivate_with_replacement_remaps_supplier_skus(self):
        old_supplier = Supplier.objects.create(name='Old Supplier', code_prefix='OLD')
        new_supplier = Supplier.objects.create(name='New Supplier', code_prefix='NEW')
        sku = MasterSKU.objects.create(master_code='vc-u-9002', title_en='SKU S')
        SupplierSKU.objects.create(
            supplier=old_supplier,
            master_sku=sku,
            supplier_code='OLD-001',
            cost_price='10.00',
        )

        res = self.client.post(
            f'/api/suppliers/{old_supplier.id}/deactivate-with-replacement/',
            {'replacement_id': new_supplier.id},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        old_supplier.refresh_from_db()
        self.assertFalse(old_supplier.is_active)
        self.assertTrue(SupplierSKU.objects.filter(supplier=new_supplier, master_sku=sku).exists())
        self.assertFalse(SupplierSKU.objects.filter(supplier=old_supplier, master_sku=sku).exists())

    def test_dictionary_bad_words_blocked(self):
        bad_payloads = [
            ('/api/categories/', {'code': 'D', 'name_en': 'bad shit', 'name_zh': '正常'}),
            ('/api/operational-tags/', {'name': 'fuck_tag'}),
            ('/api/brands/', {'name': '诈骗品牌'}),
            ('/api/suppliers/', {'name': '违禁供货商', 'code_prefix': 'VX'}),
        ]
        for url, payload in bad_payloads:
            res = self.client.post(url, payload, format='json')
            self.assertEqual(res.status_code, 400)
