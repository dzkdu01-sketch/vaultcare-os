"""
生成 Task 1-3 测试数据脚本
用于测试 AI 配置、状态机重构、AI 整合手动新增功能
"""

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vaultcare.settings')
import django
django.setup()

from django.contrib.auth.models import User
from pim.models import AIConfig, MasterSKU, Category
from django.db.models import Count
from decimal import Decimal

print("=" * 60)
print("开始生成 Task 1-3 测试数据")
print("=" * 60)

# ---------------------------------------------------------------------------
# 1. Task 1: AI 配置测试数据
# ---------------------------------------------------------------------------
print("\n[Task 1] 创建 AI 配置数据...")

# 创建默认 AI 配置
ai_config, created = AIConfig.objects.get_or_create(id=1, defaults={
    'ocr_enabled': True,
    'copywriting_enabled': True,
    'review_assistant_enabled': True,
    'primary_model': 'claude-3-5-haiku-20241022',
    'fallback_model': 'claude-3-5-sonnet-20241022',
    'enable_fallback': True,
    'max_retries': 3,
    'timeout_seconds': 30,
})
if created:
    print(f"  [OK] 创建 AI 配置：{ai_config}")
else:
    print(f"  [OK] AI 配置已存在，更新设置...")
    ai_config.primary_model = 'claude-3-5-haiku-20241022'
    ai_config.fallback_model = 'claude-3-5-sonnet-20241022'
    ai_config.max_retries = 3
    ai_config.save()

print(f"  [OK] AI 配置当前设置:")
print(f"    - OCR 功能：{'开启' if ai_config.ocr_enabled else '关闭'}")
print(f"    - 文案优化：{'开启' if ai_config.copywriting_enabled else '关闭'}")
print(f"    - 主模型：{ai_config.primary_model}")
print(f"    - 降级模型：{ai_config.fallback_model}")
print(f"    - 最大重试：{ai_config.max_retries}次")

# ---------------------------------------------------------------------------
# 2. Task 2: 状态机测试数据
# ---------------------------------------------------------------------------
print("\n[Task 2] 创建状态机测试数据...")

# 获取或创建测试用户
test_user, _ = User.objects.get_or_create(
    username='test_state_machine',
    defaults={'email': 'test@vaultcare.com', 'is_staff': True}
)

# 获取品类
category = Category.objects.first()
if not category:
    print("  [WARN] 未找到品类，跳过测试数据创建")
else:
    # 创建不同状态的商品
    state_test_data = [
        ('draft', False, False, '草稿商品（从未上架）'),
        ('pending_review', False, False, '待审核商品'),
        ('publishable', True, True, '可发布商品（已上架）'),
        ('publishable', False, True, '可发布商品（未上架）'),
        ('inactive_delisted', False, True, '已下架商品（曾上架）'),
    ]

    for status, is_active, ever_published, desc in state_test_data:
        sku, created = MasterSKU.objects.get_or_create(
            master_code=f'vc-u-state-{status}',
            defaults={
                'title_en': f'Test State - {desc}',
                'title_ar': f'اختبار الحالة - {desc}',
                'primary_category': category,
                'region': 'u',
                'selling_price': Decimal('99.00'),
                'is_active': is_active,
                'ever_published': ever_published,
                'review_status': status,
                'review_submitted_by': test_user if status == 'pending_review' else None,
                'reviewed_by': test_user if status == 'publishable' else None,
                'image_urls': ['https://example.com/test-state.jpg'],
            }
        )
        if created:
            print(f"  [OK] 创建：{desc} -> {sku.master_code}")
        else:
            print(f"  [OK] 已存在：{desc} -> {sku.master_code}")

# ---------------------------------------------------------------------------
# 3. Task 3: AI 辅助程度测试数据
# ---------------------------------------------------------------------------
print("\n[Task 3] 创建 AI 辅助程度测试数据...")

ai_assisted_test_data = [
    ('none', '完全手动创建'),
    ('ocr', 'AI 识别创建'),
    ('optimize', 'AI 文案优化创建'),
    ('both', 'AI 完整辅助创建'),
]

for ai_level, desc in ai_assisted_test_data:
    sku, created = MasterSKU.objects.get_or_create(
        master_code=f'vc-u-ai-{ai_level}',
        defaults={
            'title_en': f'Test AI Assisted - {desc}',
            'title_ar': f'اختبار الذكاء الاصطناعي - {desc}',
            'primary_category': category,
            'region': 'u',
            'selling_price': Decimal('149.00'),
            'is_active': False,
            'ever_published': False,
            'review_status': 'draft',
            'ai_assisted': ai_level,
            'image_urls': [f'https://example.com/test-ai-{ai_level}.jpg'],
        }
    )
    if created:
        print(f"  [OK] 创建：{desc} (ai_assisted={ai_level}) -> {sku.master_code}")
    else:
        sku.ai_assisted = ai_level
        sku.save()
        print(f"  [OK] 更新：{desc} (ai_assisted={ai_level}) -> {sku.master_code}")

# ---------------------------------------------------------------------------
# 4. 综合测试数据（组合状态 + AI 辅助）
# ---------------------------------------------------------------------------
print("\n[综合] 创建组合测试数据...")

combo_test_data = [
    ('draft', 'none', '草稿 - 完全手动'),
    ('draft', 'ocr', '草稿-AI 识别'),
    ('draft', 'optimize', '草稿-AI 文案优化'),
    ('draft', 'both', '草稿-AI 完整辅助'),
    ('pending_review', 'ocr', '待审核-AI 识别'),
    ('pending_review', 'both', '待审核-AI 完整辅助'),
    ('publishable', 'none', '可发布 - 完全手动'),
    ('publishable', 'ocr', '可发布-AI 识别'),
    ('inactive_delisted', 'ocr', '已下架-AI 识别'),
    ('inactive_delisted', 'both', '已下架-AI 完整辅助'),
]

for status, ai_level, desc in combo_test_data:
    sku, created = MasterSKU.objects.get_or_create(
        master_code=f'vc-u-combo-{status}-{ai_level}',
        defaults={
            'title_en': f'Combo Test - {desc}',
            'title_ar': f'اختبار combo - {desc}',
            'primary_category': category,
            'region': 'u',
            'selling_price': Decimal('199.00'),
            'is_active': (status == 'publishable'),
            'ever_published': (status in ['publishable', 'inactive_delisted']),
            'review_status': status,
            'ai_assisted': ai_level,
            'image_urls': [f'https://example.com/combo-{status}-{ai_level}.jpg'],
        }
    )
    if created:
        print(f"  [OK] 创建：{desc} -> {sku.master_code}")
    else:
        print(f"  [OK] 已存在：{desc} -> {sku.master_code}")

# ---------------------------------------------------------------------------
# 5. 统计信息
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("测试数据生成完成 - 统计信息")
print("=" * 60)

total_skus = MasterSKU.objects.count()
print(f"\n商品总数：{total_skus}")

print("\n按 review_status 分布:")
for item in MasterSKU.objects.values('review_status').annotate(count=Count('review_status')):
    print(f"  - {item['review_status']}: {item['count']}")

print("\n按 ai_assisted 分布:")
for item in MasterSKU.objects.values('ai_assisted').annotate(count=Count('ai_assisted')):
    level = item['ai_assisted'] or '未设置'
    print(f"  - {level}: {item['count']}")

print("\n按 ever_published 分布:")
print(f"  - 从未上架：{MasterSKU.objects.filter(ever_published=False).count()}")
print(f"  - 曾上架过：{MasterSKU.objects.filter(ever_published=True).count()}")

print("\n" + "=" * 60)
print("测试数据可用于:")
print("  1. AI 配置页面测试 (/settings/ai)")
print("  2. 状态机流转测试 (draft/pending_review/publishable/inactive_delisted)")
print("  3. AI 辅助程度筛选测试 (none/ocr/optimize/both)")
print("  4. 组合条件筛选测试")
print("=" * 60)
