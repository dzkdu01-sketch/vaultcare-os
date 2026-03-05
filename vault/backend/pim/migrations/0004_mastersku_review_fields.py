from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pim', '0003_seed_categories'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='mastersku',
            name='review_note',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='review_status',
            field=models.CharField(
                choices=[('draft', 'Draft'), ('pending_review', 'Pending Review'), ('publishable', 'Publishable')],
                db_index=True,
                default='draft',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='review_submitted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='review_submitted_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='submitted_reviews',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='mastersku',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approved_reviews',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
