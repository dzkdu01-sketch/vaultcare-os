from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pim', '0005_mastersku_emergency_override_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='mastersku',
            name='review_reject_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='review_submit_count',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
