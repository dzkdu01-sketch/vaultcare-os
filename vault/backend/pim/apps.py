from django.apps import AppConfig


class PimConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pim'

    def ready(self):
        import pim.signals  # noqa: F401
