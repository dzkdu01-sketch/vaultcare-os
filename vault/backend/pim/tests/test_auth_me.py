from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model


class AuthAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        User.objects.all().delete()
        self.normal_user = User.objects.create_user(username='test_user', password='123')
        self.staff_user = User.objects.create_user(username='test_staff', password='123', is_staff=True)
        self.super_user = User.objects.create_user(username='test_owner', password='123', is_superuser=True, is_staff=True)

    def test_auth_me_unauthenticated(self):
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 401)

    def test_auth_me_normal_user(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_staff'])
        self.assertFalse(res.data['is_superuser'])

    def test_auth_me_staff_user(self):
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['is_staff'])
        self.assertFalse(res.data['is_superuser'])

    def test_auth_me_superuser(self):
        self.client.force_authenticate(user=self.super_user)
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['is_staff'])
        self.assertTrue(res.data['is_superuser'])
