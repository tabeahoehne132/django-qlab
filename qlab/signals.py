from django.apps import apps
from django.db.models.signals import post_migrate
from django.dispatch import receiver


@receiver(post_migrate)
def sync_qlab_registry(sender, **kwargs):  # noqa
    from qlab.models import ModelRegistry
    from qlab.settings import qlab_settings

    existing_labels = set()

    for app_label in qlab_settings.ALLOWED_APPS:
        try:
            app_config = apps.get_app_config(app_label)
        except LookupError:
            continue

        for model in app_config.get_models():
            label = f"{app_label}_{model.__name__}"
            existing_labels.add(label)

            ModelRegistry.objects.get_or_create(
                model_label=label,
                defaults={
                    "app_label": app_label,
                    "model_name": model.__name__,
                    "status": "submitted",
                },
            )

    ModelRegistry.objects.exclude(model_label__in=existing_labels).delete()
