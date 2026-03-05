from django.db import migrations


CATEGORIES = [
    ('1', 'Vibrators',              '女士震动用品'),
    ('2', 'Dildo',                  '阳具'),
    ('3', 'Butt Plugs',             '肛塞'),
    ('4', 'Masturbators',           '男士手持飞机杯'),
    ('5', 'Cock Rings & Enhancers', '阴茎环和延长套'),
    ('6', 'med',                    '药品/延时/香水/润滑油等'),
    ('7', 'Half Body Sex Doll',     '屁股和半身娃娃'),
    ('8', 'Full Body Sex Doll',     '全身娃娃'),
    ('9', 'other',                  '其他杂类（内衣/SM/前列腺等）'),
    ('A', 'Strap-Ons',              '穿戴绑带类'),
]

OPERATIONAL_TAGS = ['best_seller', 'high_value', 'new_arrival']


def seed_data(apps, schema_editor):
    Category = apps.get_model('pim', 'Category')
    OperationalTag = apps.get_model('pim', 'OperationalTag')

    for code, name_en, name_zh in CATEGORIES:
        Category.objects.get_or_create(
            code=code,
            defaults={'name_en': name_en, 'name_zh': name_zh},
        )

    for name in OPERATIONAL_TAGS:
        OperationalTag.objects.get_or_create(name=name)


def unseed_data(apps, schema_editor):
    Category = apps.get_model('pim', 'Category')
    OperationalTag = apps.get_model('pim', 'OperationalTag')
    Category.objects.filter(code__in=[c[0] for c in CATEGORIES]).delete()
    OperationalTag.objects.filter(name__in=OPERATIONAL_TAGS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pim', '0002_category_operationaltag_priceauditlog_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_data, reverse_code=unseed_data),
    ]
