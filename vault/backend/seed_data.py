"""
Vaultcare OS 示例数据生成脚本
用于快速填充测试数据，方便演示和开发

使用方法:
    python manage.py shell < seed_data.py
    或
    python manage.py runscript seed_data  (如果有 django-extensions)
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vaultcare.settings')
django.setup()

from django.contrib.auth.models import User
from pim.models import MasterSKU, Supplier, SupplierSKU
from sites.models import Distributor, SiteEnvironment, DistributorSelection
from oms.models import Order, OrderItem
from wp_sync.models import WPSite, WPProductMapping
from decimal import Decimal
from datetime import datetime, timedelta
import random


def clear_all():
    """清空所有数据（谨慎使用）"""
    print("⚠️  正在清空所有数据...")
    WPProductMapping.objects.all().delete()
    WPSite.objects.all().delete()
    OrderItem.objects.all().delete()
    Order.objects.all().delete()
    DistributorSelection.objects.all().delete()
    SiteEnvironment.objects.all().delete()
    Distributor.objects.all().delete()
    SupplierSKU.objects.all().delete()
    Supplier.objects.all().delete()
    MasterSKU.objects.all().delete()
    User.objects.filter(username__startswith='test_').delete()
    print("✓ 清空完成")


def create_users():
    """创建测试用户"""
    print("\n📦 创建用户...")

    users = [
        {'username': 'test_admin', 'email': 'admin@vaultcare.com', 'is_staff': True, 'is_superuser': True},
        {'username': 'test_self1', 'email': 'self1@vaultcare.com', 'is_staff': False, 'is_superuser': False},
        {'username': 'test_self2', 'email': 'self2@vaultcare.com', 'is_staff': False, 'is_superuser': False},
        {'username': 'test_dist1', 'email': 'dist1@vaultcare.com', 'is_staff': False, 'is_superuser': False},
        {'username': 'test_dist2', 'email': 'dist2@vaultcare.com', 'is_staff': False, 'is_superuser': False},
        {'username': 'test_dist3', 'email': 'dist3@vaultcare.com', 'is_staff': False, 'is_superuser': False},
    ]

    created_users = {}
    for user_data in users:
        user, created = User.objects.get_or_create(
            username=user_data['username'],
            defaults={
                'email': user_data['email'],
                'is_staff': user_data['is_staff'],
                'is_superuser': user_data['is_superuser'],
            }
        )
        if created:
            user.set_password('123456')
            user.save()
        created_users[user_data['username']] = user
        print(f"  ✓ 用户：{user_data['username']} (密码：123456)")

    return created_users


def create_suppliers():
    """创建供应商"""
    print("\n📦 创建供应商...")

    suppliers_data = [
        {'name': 'VIP Supplier', 'code_prefix': 'VIP', 'settlement_cycle': 'Weekly', 'priority': 1, 'circuit_breaker': False},
        {'name': 'QR Supplier', 'code_prefix': 'QR', 'settlement_cycle': 'Bi-weekly', 'priority': 2, 'circuit_breaker': True},  # 熔断状态
    ]

    suppliers = {}
    for sup_data in suppliers_data:
        supplier, created = Supplier.objects.get_or_create(
            name=sup_data['name'],
            defaults={
                'code_prefix': sup_data['code_prefix'],
                'settlement_cycle': sup_data['settlement_cycle'],
                'priority': sup_data['priority'],
                'circuit_breaker': sup_data['circuit_breaker'],
                'is_active': True,
            }
        )
        suppliers[sup_data['code_prefix']] = supplier
        status = " [熔断]" if supplier.circuit_breaker else " [正常]"
        print(f"  ✓ 供应商：{supplier.name}{status} (优先级：{supplier.priority})")

    return suppliers


def create_products(suppliers):
    """创建商品数据"""
    print("\n📦 创建商品...")

    products_data = [
        # 延时喷剂类
        {
            'master_code': 'VC-SPRAY-001',
            'title_en': 'Delay Spray Premium 50ml',
            'title_ar': 'بخاخ تأخير فاخر 50 مل',
            'description': 'Premium delay spray with natural ingredients. Long-lasting effect up to 2 hours.',
            'category': 'Sprays',
            'selling_price': Decimal('299.00'),
            'image_urls': ['https://example.com/spray1.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-SP-001', 'cost_price': Decimal('120.00'), 'stock_status': 'in_stock'},
                {'supplier': 'QR', 'supplier_code': 'QR-SP-001', 'cost_price': Decimal('100.00'), 'stock_status': 'out_of_stock'},
            ]
        },
        {
            'master_code': 'VC-SPRAY-002',
            'title_en': 'Delay Spray Max Strength 30ml',
            'title_ar': 'بخاخ تأخير قوة قصوى 30 مل',
            'description': 'Maximum strength formula for extended performance.',
            'category': 'Sprays',
            'selling_price': Decimal('349.00'),
            'image_urls': ['https://example.com/spray2.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-SP-002', 'cost_price': Decimal('140.00'), 'stock_status': 'in_stock'},
            ]
        },
        # 润滑油类
        {
            'master_code': 'VC-LUBE-001',
            'title_en': 'Water Based Lubricant 100ml',
            'title_ar': 'مزلق قائم على الماء 100 مل',
            'description': 'Smooth, non-sticky water-based lubricant for enhanced comfort.',
            'category': 'Lubricants',
            'selling_price': Decimal('199.00'),
            'image_urls': ['https://example.com/lube1.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-LB-001', 'cost_price': Decimal('70.00'), 'stock_status': 'in_stock'},
                {'supplier': 'QR', 'supplier_code': 'QR-LB-001', 'cost_price': Decimal('60.00'), 'stock_status': 'in_stock'},
            ]
        },
        {
            'master_code': 'VC-LUBE-002',
            'title_en': 'Silicone Lubricant Premium 50ml',
            'title_ar': 'مزلق سيليكون فاخر 50 مل',
            'description': 'Long-lasting silicone-based lubricant, waterproof formula.',
            'category': 'Lubricants',
            'selling_price': Decimal('279.00'),
            'image_urls': ['https://example.com/lube2.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-LB-002', 'cost_price': Decimal('110.00'), 'stock_status': 'in_stock'},
            ]
        },
        # 安全套类
        {
            'master_code': 'VC-CONDOM-001',
            'title_en': 'Ultra Thin Condoms 12 Pack',
            'title_ar': 'واقيات ذكرية فائقة الرقة 12 قطعة',
            'description': 'Ultra-thin latex condoms for enhanced sensitivity.',
            'category': 'Condoms',
            'selling_price': Decimal('89.00'),
            'image_urls': ['https://example.com/condom1.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-CD-001', 'cost_price': Decimal('35.00'), 'stock_status': 'in_stock'},
                {'supplier': 'QR', 'supplier_code': 'QR-CD-001', 'cost_price': Decimal('30.00'), 'stock_status': 'in_stock'},
            ]
        },
        {
            'master_code': 'VC-CONDOM-002',
            'title_en': 'Ribbed & Dotted Condoms 10 Pack',
            'title_ar': 'واقيات ذكرية مضلعة ومنقطة 10 قطع',
            'description': 'Textured condoms for extra stimulation.',
            'category': 'Condoms',
            'selling_price': Decimal('99.00'),
            'image_urls': ['https://example.com/condom2.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-CD-002', 'cost_price': Decimal('40.00'), 'stock_status': 'in_stock'},
            ]
        },
        # 情趣玩具类
        {
            'master_code': 'VC-TOY-001',
            'title_en': 'Vibrating Ring Rechargeable',
            'title_ar': 'حلقة اهتزاز قابلة للشحن',
            'description': 'Rechargeable vibrating ring with 7 vibration modes.',
            'category': 'Toys',
            'selling_price': Decimal('459.00'),
            'image_urls': ['https://example.com/toy1.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-TY-001', 'cost_price': Decimal('180.00'), 'stock_status': 'in_stock'},
            ]
        },
        {
            'master_code': 'VC-TOY-002',
            'title_en': 'Cock Ring Silicone Set',
            'title_ar': 'مجموعة حلقات قضيب سيليكون',
            'description': 'Set of 3 silicone cock rings in different sizes.',
            'category': 'Toys',
            'selling_price': Decimal('189.00'),
            'image_urls': ['https://example.com/toy2.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-TY-002', 'cost_price': Decimal('70.00'), 'stock_status': 'in_stock'},
                {'supplier': 'QR', 'supplier_code': 'QR-TY-002', 'cost_price': Decimal('60.00'), 'stock_status': 'in_stock'},
            ]
        },
        # 保健品类
        {
            'master_code': 'VC-SUPP-001',
            'title_en': 'Men Vitality Capsules 60 Count',
            'title_ar': 'كبسولات حيوية للرجال 60 حبة',
            'description': 'Natural supplement for male vitality and energy.',
            'category': 'Supplements',
            'selling_price': Decimal('399.00'),
            'image_urls': ['https://example.com/supp1.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-SU-001', 'cost_price': Decimal('160.00'), 'stock_status': 'in_stock'},
            ]
        },
        {
            'master_code': 'VC-SUPP-002',
            'title_en': 'Performance Booster Tablets 30 Count',
            'title_ar': 'أقراص تعزيز الأداء 30 حبة',
            'description': 'Fast-acting performance enhancement tablets.',
            'category': 'Supplements',
            'selling_price': Decimal('499.00'),
            'image_urls': ['https://example.com/supp2.jpg'],
            'supplier_skus': [
                {'supplier': 'VIP', 'supplier_code': 'VIP-SU-002', 'cost_price': Decimal('200.00'), 'stock_status': 'in_stock'},
            ]
        },
    ]

    created_products = {}
    for prod_data in products_data:
        # 创建 MasterSKU
        master_sku, created = MasterSKU.objects.get_or_create(
            master_code=prod_data['master_code'],
            defaults={
                'title_en': prod_data['title_en'],
                'title_ar': prod_data['title_ar'],
                'description': prod_data['description'],
                'category': prod_data['category'],
                'selling_price': prod_data['selling_price'],
                'image_urls': prod_data['image_urls'],
                'is_active': True,
            }
        )
        created_products[prod_data['master_code']] = master_sku

        # 创建 SupplierSKU 映射
        for sup_sku_data in prod_data['supplier_skus']:
            supplier = suppliers.get(sup_sku_data['supplier'])
            if supplier:
                SupplierSKU.objects.get_or_create(
                    supplier=supplier,
                    master_sku=master_sku,
                    defaults={
                        'supplier_code': sup_sku_data['supplier_code'],
                        'cost_price': sup_sku_data['cost_price'],
                        'stock_status': sup_sku_data['stock_status'],
                        'last_stock_check': datetime.now() - timedelta(days=random.randint(0, 7)),
                    }
                )

        print(f"  ✓ 商品：{prod_data['master_code']} - {prod_data['title_en']}")

    return created_products


def create_distributors(users):
    """创建分销商"""
    print("\n📦 创建分销商...")

    distributors_data = [
        {'name': '自营一组', 'type': 'self_operated', 'user': users.get('test_self1')},
        {'name': '自营二组', 'type': 'self_operated', 'user': users.get('test_self2')},
        {'name': '迪拜分销商 - Ahmed', 'type': 'distributor', 'user': users.get('test_dist1')},
        {'name': '阿布扎比分销商 - Mohammed', 'type': 'distributor', 'user': users.get('test_dist2')},
        {'name': '沙迦分销商 - Fatima', 'type': 'distributor', 'user': users.get('test_dist3')},
    ]

    distributors = {}
    for dist_data in distributors_data:
        distributor, created = Distributor.objects.get_or_create(
            name=dist_data['name'],
            defaults={
                'type': dist_data['type'],
                'user': dist_data['user'],
                'is_active': True,
            }
        )
        distributors[dist_data['name']] = distributor
        print(f"  ✓ 分销商：{distributor.name} ({distributor.get_type_display()})")

    return distributors


def create_site_environments(distributors):
    """创建站点环境配置"""
    print("\n📦 创建站点环境...")

    envs_data = [
        {
            'distributor_name': '自营一组',
            'domain_a': 'https://shop-vip-ae.com',
            'domain_b': 'https://wellness-uae.com',
            'pixel_id': '1234567890123456',
            'whatsapp_number': '+971501234567',
            'payment_method': 'Facebook Ad Account #1',
            'cloaker_config': {'enabled': True, 'provider': 'CloakerPro'},
        },
        {
            'distributor_name': '自营二组',
            'domain_a': 'https://premium-health-ae.com',
            'domain_b': 'https://mens-care-uae.com',
            'pixel_id': '2345678901234567',
            'whatsapp_number': '+971502345678',
            'payment_method': 'Facebook Ad Account #2',
            'cloaker_config': {'enabled': True, 'provider': 'CloakerPro'},
        },
        {
            'distributor_name': '迪拜分销商 - Ahmed',
            'domain_a': 'https://ahmed-shop-ae.com',
            'domain_b': 'https://ahmed-wellness.com',
            'pixel_id': '3456789012345678',
            'whatsapp_number': '+971503456789',
            'payment_method': 'Distributor Own Ad Account',
            'cloaker_config': {'enabled': False},
        },
        {
            'distributor_name': '阿布扎比分销商 - Mohammed',
            'domain_a': 'https://mohammed-store.com',
            'domain_b': 'https://abudhabi-health.com',
            'pixel_id': '4567890123456789',
            'whatsapp_number': '+971504567890',
            'payment_method': 'Distributor Own Ad Account',
            'cloaker_config': {'enabled': False},
        },
        {
            'distributor_name': '沙迦分销商 - Fatima',
            'domain_a': 'https://fatima-shop-ae.com',
            'domain_b': 'https://sharjah-wellness.com',
            'pixel_id': '5678901234567890',
            'whatsapp_number': '+971505678901',
            'payment_method': 'Distributor Own Ad Account',
            'cloaker_config': {'enabled': False},
        },
    ]

    for env_data in envs_data:
        distributor = distributors.get(env_data['distributor_name'])
        if distributor:
            SiteEnvironment.objects.get_or_create(
                distributor=distributor,
                defaults={
                    'domain_a': env_data['domain_a'],
                    'domain_b': env_data['domain_b'],
                    'pixel_id': env_data['pixel_id'],
                    'whatsapp_number': env_data['whatsapp_number'],
                    'payment_method': env_data['payment_method'],
                    'cloaker_config': env_data['cloaker_config'],
                }
            )
            print(f"  ✓ 站点环境：{distributor.name} - {env_data['domain_a']}")


def create_distributor_selections(distributors, products):
    """创建分销商选品"""
    print("\n📦 创建分销商选品...")

    # 自营组选择所有商品
    self_operated_dists = [d for name, d in distributors.items() if '自营' in name]
    for distributor in self_operated_dists:
        for master_code, master_sku in products.items():
            DistributorSelection.objects.get_or_create(
                distributor=distributor,
                master_sku=master_sku,
            )
        print(f"  ✓ {distributor.name}: 选择全部 {len(products)} 个商品")

    # 分销商选择部分商品
    distributor_selections = {
        '迪拜分销商 - Ahmed': ['VC-SPRAY-001', 'VC-SPRAY-002', 'VC-LUBE-001', 'VC-TOY-001'],
        '阿布扎比分销商 - Mohammed': ['VC-CONDOM-001', 'VC-CONDOM-002', 'VC-LUBE-001', 'VC-LUBE-002'],
        '沙迦分销商 - Fatima': ['VC-SUPP-001', 'VC-SUPP-002', 'VC-SPRAY-001', 'VC-LUBE-001'],
    }

    for dist_name, selected_codes in distributor_selections.items():
        distributor = distributors.get(dist_name)
        if distributor:
            for code in selected_codes:
                master_sku = products.get(code)
                if master_sku:
                    DistributorSelection.objects.get_or_create(
                        distributor=distributor,
                        master_sku=master_sku,
                    )
            print(f"  ✓ {distributor.name}: 选择 {len(selected_codes)} 个商品")


def create_wp_sites(distributors):
    """创建 WordPress 站点"""
    print("\n📦 创建 WP 站点...")

    wp_sites_data = [
        {
            'distributor_name': '自营一组',
            'site_url': 'https://shop-vip-ae.com',
            'consumer_key': 'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'consumer_secret': 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        {
            'distributor_name': '自营二组',
            'site_url': 'https://premium-health-ae.com',
            'consumer_key': 'ck_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
            'consumer_secret': 'cs_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
        },
        {
            'distributor_name': '迪拜分销商 - Ahmed',
            'site_url': 'https://ahmed-shop-ae.com',
            'consumer_key': 'ck_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
            'consumer_secret': 'cs_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        },
    ]

    for wp_data in wp_sites_data:
        distributor = distributors.get(wp_data['distributor_name'])
        if distributor:
            WPSite.objects.get_or_create(
                distributor=distributor,
                defaults={
                    'site_url': wp_data['site_url'],
                    'consumer_key': wp_data['consumer_key'],
                    'consumer_secret': wp_data['consumer_secret'],
                    'is_active': True,
                }
            )
            print(f"  ✓ WP 站点：{wp_data['site_url']}")


def create_orders(distributors, products, suppliers):
    """创建示例订单"""
    print("\n📦 创建订单...")

    # 客户数据池
    customer_names = [
        'Ahmed Al Mansoori', 'Mohammed Al Hashemi', 'Fatima Al Zaabi',
        'Khalid Al Shamsi', 'Mariam Al Ketbi', 'Saeed Al Mazrouei',
        'Omar Al Nuaimi', 'Layla Al Suwaidi', 'Hamad Al Qasimi', 'Noor Al Bloushi'
    ]

    cities = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah']

    # 订单状态池
    statuses = ['pending', 'reviewed', 'pushed', 'shipped', 'delivered', 'rejected']

    # 创建 30 个示例订单
    for i in range(30):
        distributor = random.choice(list(distributors.values()))
        status = random.choice(statuses)

        # 随机选择 1-3 个商品
        selected_products = random.sample(list(products.items()), random.randint(1, 3))

        # 计算订单总额
        total_amount = sum(
            products[code].selling_price * random.randint(1, 2)
            for code, products in [(p[0], {p[0]: p[1]}) for p in selected_products]
        )

        # 确定供应商（模拟路由结果）
        routed_supplier = suppliers['VIP'] if random.random() > 0.3 else suppliers['QR']

        order = Order.objects.create(
            distributor=distributor,
            source=random.choice(['website', 'whatsapp', 'manual']),
            customer_name=random.choice(customer_names),
            customer_phone=f"+97150{random.randint(1000000, 9999999)}",
            customer_address=f"Villa {random.randint(1, 100)}, Street {random.randint(1, 50)}",
            city=random.choice(cities),
            total_amount=total_amount,
            routed_supplier=routed_supplier,
            status=status,
            delivery_fee=Decimal('50.00'),
            notes=f"Order #{i+1} - Test data",
        )

        # 创建订单明细
        for master_code, master_sku in selected_products:
            qty = random.randint(1, 2)
            supplier_sku = SupplierSKU.objects.filter(
                master_sku=master_sku,
                supplier=routed_supplier
            ).first()

            OrderItem.objects.create(
                order=order,
                master_sku=master_sku,
                quantity=qty,
                unit_price=master_sku.selling_price,
                cost_price=supplier_sku.cost_price if supplier_sku else Decimal('0'),
            )

        print(f"  ✓ 订单：{order.order_number} - {distributor.name} - {status} - AED {total_amount}")

    # 更新订单利润（模拟路由引擎计算）
    for order in Order.objects.all():
        cost_total = sum(item.cost_price * item.quantity for item in order.items.all())
        order.profit = order.total_amount - cost_total - order.delivery_fee
        order.save()

    print(f"  ✓ 已更新所有订单利润计算")


def print_summary():
    """打印数据摘要"""
    print("\n" + "="*60)
    print("📊 数据摘要")
    print("="*60)
    print(f"  用户数：{User.objects.filter(username__startswith='test_').count()}")
    print(f"  供应商数：{Supplier.objects.count()}")
    print(f"  商品数 (MasterSKU): {MasterSKU.objects.count()}")
    print(f"  供应商 SKU 映射：{SupplierSKU.objects.count()}")
    print(f"  分销商数：{Distributor.objects.count()}")
    print(f"  站点环境数：{SiteEnvironment.objects.count()}")
    print(f"  选品记录数：{DistributorSelection.objects.count()}")
    print(f"  WP 站点数：{WPSite.objects.count()}")
    print(f"  订单数：{Order.objects.count()}")
    print(f"  订单明细数：{OrderItem.objects.count()}")
    print("="*60)

    # 财务摘要
    total_revenue = sum(order.total_amount for order in Order.objects.all())
    total_profit = sum(order.profit for order in Order.objects.all())
    print(f"\n💰 财务摘要")
    print(f"  总销售额：AED {total_revenue:.2f}")
    print(f"  总利润：AED {total_profit:.2f}")
    print(f"  平均客单价：AED {total_revenue / Order.objects.count():.2f}" if Order.objects.count() > 0 else "")
    print(f"  利润率：{(total_profit / total_revenue * 100):.1f}%" if total_revenue > 0 else "")
    print("="*60)


def main():
    """主函数"""
    print("\n" + "="*60)
    print("Vaultcare OS - Seed Data Generator")
    print("="*60)

    # 直接清空现有测试数据（非交互式）
    print("\nClearing existing test data...")
    clear_all()

    # 创建数据
    users = create_users()
    suppliers = create_suppliers()
    products = create_products(suppliers)
    distributors = create_distributors(users)
    create_site_environments(distributors)
    create_distributor_selections(distributors, products)
    create_wp_sites(distributors)
    create_orders(distributors, products, suppliers)

    # 打印摘要
    print_summary()

    print("\n" + "="*60)
    print("Seed Data Generation Complete!")
    print("="*60)
    print("\nLogin Credentials:")
    print("   admin: test_admin / 123456")
    print("   self_operated: test_self1 / 123456")
    print("   distributor: test_dist1 / 123456")
    print("\nURLs:")
    print("   Frontend: http://localhost:5173")
    print("   Backend API: http://localhost:8000/api/")
    print("   Django Admin: http://localhost:8000/admin")
    print("="*60)


if __name__ == '__main__':
    main()
